"""
evaluate.py - Yarış: AI (Autoencoder) vs klasik sıcaklık alarmı

Her kaçak senaryosu için kimin, hangi gün, ne kadar gaz kaçtıktan sonra alarm verdiğini
ölçer. Sağlıklı test serisinde yanlış alarmları sayar. Sonuçları results.csv'ye yazar.
Not: Modelin hiç görmediği veriler kullanılır (eğitim ve eşik verisi testten ayrıdır).
"""

import os
import pandas as pd

import dataset
import model
import baseline
from simulator import simulate

CHARGE_KG = 50.0            # dolap/sistem gaz şarjı (kg), varsayım
STEPS_PER_DAY = dataset.STEPS_PER_DAY
LEAK_NAMES = ["leak_05", "leak_10", "leak_20", "leak_40"]


def ensure_data_and_model():
    """Veri yoksa üretir, model yoksa sağlıklı eğitim verisiyle eğitir."""
    if not os.path.exists(f"{dataset.DATA_DIR}/scenarios.csv"):
        dataset.build_all()
    path = f"{dataset.DATA_DIR}/model.joblib"
    if os.path.exists(path):
        return model.load(path)
    train_df, _ = dataset.load("train_healthy")
    val_df, _ = dataset.load("val_healthy")
    train_w = pd.concat([model.make_windows(s) for s in dataset.segments(train_df)])
    val_w = pd.concat([model.make_windows(s) for s in dataset.segments(val_df)])
    bundle = model.train(train_w, val_w)
    model.save(bundle, path)
    return bundle


def first_day(daily, status, from_day=0):
    """Durumu `status` olan ilk gün (from_day ve sonrası); yoksa None."""
    days = [i for i, s in enumerate(daily["status"]) if s == status and i >= from_day]
    return days[0] if days else None


def lost_kg(charge, day):
    """Kaçak başından `day` gününün başına kadar kaçan gaz (kg)."""
    return CHARGE_KG * (1 - charge.iloc[day * STEPS_PER_DAY])


def evaluate_leak(bundle, name, meta_row):
    df, charge = dataset.load(name)
    daily = model.score(bundle, df)
    start = int(meta_row["leak_start_day"])
    n_days = len(daily)

    ai_day = first_day(daily, "kırmızı", from_day=start)
    early_false = sum(daily["status"].iloc[:start] == "kırmızı")   # kaçak öncesi yanlış kırmızı
    classic_day = baseline.first_alarm_day(df)

    # Klasik alarm çalmadıysa simülasyon sonuyla kıyaslanır (ve bu açıkça belirtilir)
    ref_day = classic_day if classic_day is not None else n_days - 1
    if ai_day is None:
        lead = "AI yakalamadı"
    elif classic_day is None:
        lead = f">= {ref_day - ai_day} (klasik çalmadı, sim. sonuna göre)"
    else:
        lead = str(classic_day - ai_day)

    return {
        "senaryo": name,
        "90 günde eksik (%)": int(round(100 * meta_row["final_deficit"])),
        "kaçak başlangıcı (gün)": start,
        "AI ilk kırmızı (gün)": ai_day if ai_day is not None else "yakalamadı",
        "klasik alarm (gün)": classic_day if classic_day is not None else "çalmadı",
        "kaç gün önce": lead,
        "AI tespitinde eksik (%)": round(100 * (1 - charge.iloc[ai_day * STEPS_PER_DAY]), 1) if ai_day is not None else None,
        "AI'a kadar kaçan (kg)": round(lost_kg(charge, ai_day), 2) if ai_day is not None else None,
        "klasiğe/sona kadar kaçan (kg)": round(lost_kg(charge, ref_day), 2),
        "kaçak öncesi yanlış kırmızı (gün)": early_false,
    }


def evaluate_healthy(bundle, df=None):
    """Sağlıklı seri: kaç gün sarı/kırmızı oldu, kaç ayrı kırmızı alarm çaldı?"""
    if df is None:
        df, _ = dataset.load("test_healthy")
    daily = model.score(bundle, df)
    valid = daily[daily["status"] != "veri yetersiz"]
    red = valid["status"] == "kırmızı"
    red_events = int((red & ~red.shift(fill_value=False)).sum())   # ayrı alarm sayısı
    return {
        "gün": len(valid),
        "sarı gün": int((valid["status"] == "sarı").sum()),
        "kırmızı gün": int(red.sum()),
        "kırmızı alarm sayısı": red_events,
        "klasik alarm": "çalmadı" if baseline.first_alarm_day(df) is None else "çaldı",
    }


def evaluate_healthy_extra(bundle):
    """
    Ek kontrol: tek bir 60 günlük seri yanlış alarm oranı için az. Yılın farklı
    dönemlerinden 6 yeni sağlıklı seri (6 x 60 = 360 gün) üretip aynı ölçümü yapar.
    """
    rows = []
    for k, month in enumerate([1, 3, 5, 7, 9, 11]):
        df, _ = simulate(60, start=f"2025-{month:02d}-01", seed=500 + k)
        rows.append({"başlangıç": f"2025-{month:02d}-01", **evaluate_healthy(bundle, df)})
    return pd.DataFrame(rows)


def run(out_csv="results.csv"):
    bundle = ensure_data_and_model()
    meta = dataset.load_meta().set_index("name")
    results = pd.DataFrame([evaluate_leak(bundle, n, meta.loc[n]) for n in LEAK_NAMES])
    healthy = evaluate_healthy(bundle)
    extra = evaluate_healthy_extra(bundle)
    results.to_csv(out_csv, index=False)
    extra.to_csv("results_healthy.csv", index=False)
    return results, healthy, extra, bundle


if __name__ == "__main__":
    results, healthy, extra, bundle = run()
    pd.set_option("display.width", 250)
    pd.set_option("display.max_columns", 20)
    print(f"Eşik: {bundle['threshold']:.4f}   Gaz şarjı: {CHARGE_KG:.0f} kg\n")
    print("KAÇAK SENARYOLARI")
    print(results.to_string(index=False))
    print(f"\nSAĞLIKLI TEST SERİSİ ({healthy['gün']} gün): sarı gün = {healthy['sarı gün']}, "
          f"kırmızı gün = {healthy['kırmızı gün']}, ayrı kırmızı alarm = {healthy['kırmızı alarm sayısı']}, "
          f"klasik alarm = {healthy['klasik alarm']}")
    print("\nEK KONTROL: 6 yeni sağlıklı seri (farklı mevsimler)")
    print(extra.to_string(index=False))
    n_days, n_events = extra["gün"].sum(), extra["kırmızı alarm sayısı"].sum()
    print(f"Toplam: {n_days} günde {n_events} yanlış kırmızı alarm "
          f"(~{365 * n_events / n_days:.1f} / yıl / dolap), "
          f"eşik üstü (sarı+kırmızı) gün oranı %{100 * (extra['sarı gün'] + extra['kırmızı gün']).sum() / n_days:.1f}")
    print("\nSonuçlar results.csv ve results_healthy.csv dosyalarına kaydedildi.")
