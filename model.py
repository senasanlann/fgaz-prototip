"""
model.py - Autoencoder anomali modeli (AI'ın asıl işi)

Fikir: Model sadece SAĞLIKLI dolabın verisini görür ve "normal davranışı" öğrenir.
Dış hava, saat ve hafta sonu gibi bağlam bilgisi de girdidir; böylece model "sıcak gün
olduğu için çok çalışan kompresör" ile "gaz eksik olduğu için çok çalışan kompresör"ü
ayırabilir. Model bir pencereyi ne kadar kötü yeniden üretirse, o pencere o kadar şüphelidir.

Akış: 15 dk ham veri -> 6 saatlik pencereler -> ölçekleme -> MLP (X -> X)
      -> rekonstrüksiyon hatası -> günlük skor -> 3 günlük kayan ortalama -> eşik -> durum
"""

import numpy as np
import pandas as pd
import joblib
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import StandardScaler

WINDOW = "6h"           # pencere uzunluğu
SMOOTH_DAYS = 3         # günlük skorun kayan ortalama uzunluğu
THRESHOLD_PCT = 99      # eşik: sağlıklı doğrulama skorlarının yüzdeliği
RED_AFTER_DAYS = 3      # kaç ardışık gün eşik üstü olursa kırmızı

# Modelin gördüğü özellikler ve panelde gösterilecek Türkçe adları
FEATURES = {
    "p_suction":  "Emme basıncı (bar)",
    "superheat":  "Kızgınlık (K)",
    "duty":       "Kompresör çalışma oranı",
    "kwh":        "Enerji (kWh / 6 saat)",
    "t_cab_mean": "Kabin ort. sıcaklık (°C)",
    "t_cab_max":  "Kabin maks. sıcaklık (°C)",
    "t_amb":      "Dış hava (°C)",          # bağlam
    "hour_sin":   "Saat (sin)",             # bağlam
    "hour_cos":   "Saat (cos)",             # bağlam
    "weekend":    "Hafta sonu",             # bağlam (mağaza yükü hafta sonu daha yüksek)
}
CONTEXT = ["t_amb", "hour_sin", "hour_cos", "weekend"]   # modele girdi, skora dahil değil

# Gaz kaçağının fiziksel "imzası": her özelliğin kaçakta hangi yöne saptığı (+1 artar, -1 azalır).
# Skor sadece bu yöndeki sapmaları sayar. Ters yöndeki sapmalar (ör. emme basıncının
# beklenenden YÜKSEK olması) kaçak belirtisi değildir; sayılsaydı sağlıklı dolaptaki yavaş
# kaymalar yanlış alarm üretirdi (evaluate.py'deki ek sağlıklı serilerde görüldü).
LEAK_SIGN = {
    "p_suction": -1,    # emme basıncı düşer
    "superheat": +1,    # kızgınlık artar
    "duty": +1,         # kompresör daha uzun çalışır
    "kwh": +1,          # enerji tüketimi artar
    "t_cab_mean": +1,   # (ağır kaçakta) kabin ısınır
    "t_cab_max": +1,
}


def make_windows(df):
    """15 dakikalık telemetriyi 6 saatlik özellik pencerelerine toplar."""
    d = df.set_index("timestamp")
    w = d["compressor_on"]
    g = d.resample(WINDOW)

    # Emme basıncı ve kızgınlık sadece kompresör çalışırken anlamlıdır:
    # çalışma oranıyla ağırlıklı ortalama alınır.
    def run_mean(col):
        num = (d[col] * w).resample(WINDOW).sum()
        den = w.resample(WINDOW).sum()
        return (num / den.replace(0, np.nan)).fillna(g[col].mean())

    hour = g["t_cabin"].mean().index.hour
    out = pd.DataFrame({
        "p_suction": run_mean("p_suction_bar"),
        "superheat": run_mean("superheat_K"),
        "duty": g["compressor_on"].mean(),
        "kwh": g["energy_kWh"].sum(),
        "t_cab_mean": g["t_cabin"].mean(),
        "t_cab_max": g["t_cabin"].max(),
        "t_amb": g["t_ambient"].mean(),
    })
    # Pencerenin orta saati (0-6 penceresi için 3:00 vb.)
    mid = hour + 3
    out["hour_sin"] = np.sin(2 * np.pi * mid / 24)
    out["hour_cos"] = np.cos(2 * np.pi * mid / 24)
    out["weekend"] = (out.index.dayofweek >= 5).astype(float)
    return out[list(FEATURES)]


def _feature_errors(bundle, windows):
    """
    Her pencere ve her özellik için kaçak yönündeki kare hata (ölçekli uzayda) + beklenen değer.
    Bağlam özellikleri skora katılmaz; modele sadece girdi olarak verilir.
    """
    X = bundle["scaler"].transform(windows[list(FEATURES)])
    X_hat = bundle["mlp"].predict(X)
    resid = pd.DataFrame(X - X_hat, index=windows.index, columns=list(FEATURES))
    sign = pd.Series(LEAK_SIGN)
    sq_err = (resid[sign.index] * sign).clip(lower=0) ** 2
    expected = pd.DataFrame(bundle["scaler"].inverse_transform(X_hat),
                            index=windows.index, columns=list(FEATURES))
    return sq_err, expected


def _daily(bundle, windows):
    """Pencere hatalarından günlük ham ve yumuşatılmış skor."""
    sq_err, expected = _feature_errors(bundle, windows)
    win_score = sq_err.mean(axis=1)                     # pencere MSE'si (kaçak yönünde)
    # dropna: farklı dönemlerden birleştirilmiş verideki boş günleri atar
    daily = win_score.resample("1D").mean().dropna().to_frame("score_raw")
    # İlk SMOOTH_DAYS-1 gün skor üretilmez (ortalama henüz dolmadı -> oynak olurdu)
    daily["score"] = daily["score_raw"].rolling(SMOOTH_DAYS).mean()
    return daily, sq_err, expected


def train(healthy_train_windows, healthy_val_windows, seed=0):
    """Sadece sağlıklı veriyle eğitir; eşiği ayrı sağlıklı doğrulama verisinden belirler."""
    scaler = StandardScaler().fit(healthy_train_windows)
    X = scaler.transform(healthy_train_windows)
    # Autoencoder: girdi = çıktı, ortada 4 nöronluk dar boğaz
    mlp = MLPRegressor(hidden_layer_sizes=(16, 4, 16), activation="tanh",
                       alpha=1e-3, max_iter=3000, random_state=seed)
    mlp.fit(X, X)
    bundle = {"scaler": scaler, "mlp": mlp, "features": list(FEATURES)}

    val_daily, _, _ = _daily(bundle, healthy_val_windows)
    bundle["threshold"] = float(np.nanpercentile(val_daily["score"], THRESHOLD_PCT))
    return bundle


def score(bundle, df):
    """
    Ham telemetriden günlük skor, durum ve "neden şüpheli?" açıklaması üretir.
    Dönüş: günlük DataFrame (score, status, streak, top1/top2 özellikleri ve sapmaları)
    """
    windows = make_windows(df)
    daily, sq_err, expected = _daily(bundle, windows)

    # Ardışık eşik üstü gün sayısı -> durum
    above = daily["score"] > bundle["threshold"]
    streak = above.groupby((~above).cumsum()).cumsum()
    daily["streak"] = streak
    daily["status"] = np.select([daily["score"].isna(), streak >= RED_AFTER_DAYS, streak >= 1],
                                ["veri yetersiz", "kırmızı", "sarı"], "yeşil")

    # Özellik bazlı katkı (bağlam özellikleri hariç) ve gerçek - beklenen farkı
    cols = list(LEAK_SIGN)
    contrib = sq_err[cols].resample("1D").mean().dropna().rolling(SMOOTH_DAYS, min_periods=1).mean()
    diff = (windows[cols] - expected[cols]).resample("1D").mean().dropna()
    diff = diff.rolling(SMOOTH_DAYS, min_periods=1).mean()
    for k in (1, 2):
        top = contrib.apply(lambda r: r.nlargest(k).index[-1], axis=1)
        daily[f"top{k}"] = top
        daily[f"top{k}_diff"] = [diff.loc[i, c] for i, c in top.items()]
    return daily


def explain(row):
    """Bir günlük satır için panelde gösterilecek kısa Türkçe açıklama."""
    texts = []
    for k in (1, 2):
        f, dv = row[f"top{k}"], row[f"top{k}_diff"]
        yon = "yüksek" if dv > 0 else "düşük"
        if f == "duty":
            texts.append(f"Kompresör beklenenden {abs(dv) * 100:.0f} puan daha {'fazla' if dv > 0 else 'az'} çalışıyor")
        else:
            texts.append(f"{FEATURES[f]} beklenenden {abs(dv):.2f} {yon}")
    return "; ".join(texts)


def save(bundle, path="data/model.joblib"):
    import os
    os.makedirs(os.path.dirname(path), exist_ok=True)
    joblib.dump(bundle, path)


def load(path="data/model.joblib"):
    return joblib.load(path)


if __name__ == "__main__":
    # dataset.py'nin ürettiği sağlıklı eğitim/doğrulama verisiyle eğitir ve kaydeder.
    import dataset
    import os
    if not os.path.exists(f"{dataset.DATA_DIR}/scenarios.csv"):
        dataset.build_all()
    train_df, _ = dataset.load("train_healthy")
    val_df, _ = dataset.load("val_healthy")
    train_w = pd.concat([make_windows(s) for s in dataset.segments(train_df)])
    val_w = pd.concat([make_windows(s) for s in dataset.segments(val_df)])

    bundle = train(train_w, val_w)
    save(bundle)
    print(f"Eğitim pencere sayısı: {len(train_w)}, doğrulama: {len(val_w)}")
    print(f"Eşik (doğrulama günlük skorlarının %{THRESHOLD_PCT}'i): {bundle['threshold']:.4f}")

    # Ön kontrol: %20 kaçak senaryosu
    df, charge = dataset.load("leak_20")
    daily = score(bundle, df)
    red = [i for i, s in enumerate(daily["status"]) if s == "kırmızı"]
    if red:
        day = red[0]
        print(f"\nleak_20: kaçak başlangıcı = gün 30, ilk kırmızı = gün {day}, "
              f"o gün eksik gaz = %{100 * (1 - charge.iloc[day * 96]):.1f}")
        print("Açıklama:", explain(daily.iloc[day]))
    else:
        print("\nleak_20: AI kırmızı alarm vermedi")
