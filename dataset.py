"""
dataset.py - Eğitim ve test senaryolarını üretir, data/ klasörüne kaydeder.

Üretilen dosyalar:
  data/<senaryo>.parquet        -> telemetri (modelin görebileceği kolonlar)
  data/<senaryo>_label.parquet  -> gerçek şarj oranı (sadece değerlendirme için, model görmez)
  data/scenarios.csv            -> senaryo listesi: tohum, başlangıç tarihi, kaçak bilgisi

Sağlıklı eğitim verisi, tüm mevsimleri görmek için yılın her ayından 10'ar günlük
parçalardan oluşur (120 gün). Doğrulama verisi (eşik için) her aydan 30'ar gündür (360 gün):
sağlıklı dolaptaki yavaş kaymalar ~10 gün sürdüğü için eşiği güvenilir belirlemek
çok sayıda bağımsız örnek gerektirir. Parçalar "segment" kolonu ile ayrılır.
"""

import os
import numpy as np
import pandas as pd
from simulator import simulate

DATA_DIR = "data"
STEPS_PER_DAY = 96

LEAK_START_DAY = 30        # kaçak bu günden itibaren başlar (ilk 30 gün sağlıklı)
LEAK_RAMP_DAYS = 90        # kaçak bu kadar günde son eksiklik değerine ulaşır
LEAK_DAYS = LEAK_START_DAY + LEAK_RAMP_DAYS   # 120 gün

# Senaryo tanımları: her biri farklı rastgele tohumla
SCENARIOS = [
    # ad,              tür,        gün, başlangıç,     tohum, son eksiklik
    ("train_healthy",  "train",    120, None,          100,   0.00),
    ("val_healthy",    "val",      360, None,          200,   0.00),
    ("test_healthy",   "healthy",   60, "2025-05-01",  300,   0.00),
    ("leak_05",        "leak",     120, "2025-03-01",  405,   0.05),
    ("leak_10",        "leak",     120, "2025-03-01",  410,   0.10),
    ("leak_20",        "leak",     120, "2025-03-01",  420,   0.20),
    ("leak_40",        "leak",     120, "2025-03-01",  440,   0.40),
]


def leak_profile(days, final_deficit):
    """İlk 30 gün 1.0; sonra doğrusal olarak 90 günde (1 - final_deficit)'e iner."""
    t = np.arange(days * STEPS_PER_DAY) / STEPS_PER_DAY
    ramp = np.clip((t - LEAK_START_DAY) / LEAK_RAMP_DAYS, 0, 1)
    return 1.0 - final_deficit * ramp


def make_monthly_segments(seed, days_per_month):
    """Yılın her ayının başından `days_per_month` günlük sağlıklı parça, 'segment' kolonu ile."""
    parts, labels = [], []
    for m in range(1, 13):
        df, truth = simulate(days_per_month, start=f"2025-{m:02d}-01", seed=seed + m)
        df["segment"] = m
        parts.append(df)
        labels.append(truth)
    return pd.concat(parts, ignore_index=True), pd.concat(labels, ignore_index=True)


def build_all(data_dir=DATA_DIR):
    """Tüm senaryoları üretir ve kaydeder. Senaryo listesini (DataFrame) döndürür."""
    os.makedirs(data_dir, exist_ok=True)
    rows = []
    for name, kind, days, start, seed, deficit in SCENARIOS:
        if kind == "train":
            df, truth = make_monthly_segments(seed, days_per_month=days // 12)
        elif kind == "val":
            df, truth = make_monthly_segments(seed, days_per_month=days // 12)
        else:
            charge = leak_profile(days, deficit)
            df, truth = simulate(days, start=start, charge_ratio=charge, seed=seed)
            df["segment"] = 0

        df.to_parquet(f"{data_dir}/{name}.parquet", index=False)
        pd.DataFrame({"timestamp": df["timestamp"], "charge_ratio": truth.values}) \
            .to_parquet(f"{data_dir}/{name}_label.parquet", index=False)

        rows.append({
            "name": name, "kind": kind, "days": days, "start": start or "her ay",
            "seed": seed, "final_deficit": deficit,
            "leak_start_day": LEAK_START_DAY if kind == "leak" else None,
            "rows": len(df),
        })
        print(f"  {name:<14} {len(df):>6} satır")
    meta = pd.DataFrame(rows)
    meta.to_csv(f"{data_dir}/scenarios.csv", index=False)
    return meta


def load(name, data_dir=DATA_DIR):
    """Bir senaryonun telemetrisini ve gerçek şarj oranını döndürür."""
    df = pd.read_parquet(f"{data_dir}/{name}.parquet")
    label = pd.read_parquet(f"{data_dir}/{name}_label.parquet")
    return df, label["charge_ratio"]


def segments(df):
    """Birleştirilmiş veriyi parçalarına ayırır (pencereler parçalar arası boşluğu aşmasın)."""
    return [g.drop(columns="segment") for _, g in df.groupby("segment")]


def load_meta(data_dir=DATA_DIR):
    return pd.read_csv(f"{data_dir}/scenarios.csv")


if __name__ == "__main__":
    print("Senaryolar üretiliyor...")
    meta = build_all()
    print(f"\nToplam: {meta['rows'].sum()} satır ({meta['rows'].sum() // STEPS_PER_DAY} gün)\n")
    print(meta.to_string(index=False))

    # Kontrol: kaçak senaryolarında gerçek şarj oranı beklendiği gibi mi?
    print("\nKontrol (gerçek şarj oranı):")
    for name in ["leak_05", "leak_10", "leak_20", "leak_40"]:
        _, cr = load(name)
        print(f"  {name}: gün 29 = {cr.iloc[29 * 96]:.3f}, gün 75 = {cr.iloc[75 * 96]:.3f}, "
              f"son gün = {cr.iloc[-1]:.3f}")
