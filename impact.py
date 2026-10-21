"""
impact.py - Etki hesabı: erken tespit ne kadar gaz, CO2e, kWh ve TL kurtarıyor?

Mantık: AI kaçağı X gününde, klasik alarm Y gününde buluyor. Kaçağın tespit edilince
onarıldığını varsayarsak, X ile Y arasında kaçacak gaz ve harcanacak fazla elektrik
"kurtarılmış" olur. Klasik alarm hiç çalmadıysa Y = simülasyon sonu alınır; bu durumda
sonuç bir ALT SINIRDIR (gerçekte kaçak daha uzun sürerdi).

Tüm sonuçlar SİMÜLASYON TAHMİNİDİR; gerçek bir dolapta ölçülmemiştir.
"""

import pandas as pd

import dataset
from simulator import simulate

# ---------------------------------------------------------------------------
# VARSAYIMLAR (tek yerde, kaynak notuyla). Panelden değiştirilebilir.
# ---------------------------------------------------------------------------
ASSUMPTIONS = {
    "gwp_r404a": 3922,
    # IPCC AR4 (2007), 100 yıllık GWP. AB F-gaz Tüzüğü 517/2014 Ek I'de de bu değer kullanılır.
    # Not: Daha yeni IPCC AR5 değeri 3943, AR6 değeri ~4728'dir; AR4 resmi raporlamada yaygın.

    "charge_kg": 50.0,
    # Sistemin toplam gaz şarjı (kg). Market merkezi sistemleri için tipik mertebe;
    # tek dolaplı sistemlerde çok daha az olabilir. Ayarlanabilir.

    "grid_ef_kg_per_kWh": 0.44,
    # Türkiye elektrik şebekesi emisyon faktörü (kg CO2 / kWh). DOĞRULANMALI:
    # kaynak ve yıla göre ~0.40–0.50 aralığında değerler raporlanmaktadır.

    "elec_price_tl_per_kWh": 4.0,
    # Ticari elektrik fiyatı (TL/kWh, vergiler dahil). DOĞRULANMALI: güncel EPDK tarifesine bakılmalı.

    "gas_price_tl_per_kg": 1500.0,
    # R-404A dolum fiyatı (TL/kg). DOĞRULANMALI: F-gaz kısıtlamaları nedeniyle fiyat hızla değişiyor.
}

LABEL = "simülasyon tahmini"
STEPS_PER_DAY = dataset.STEPS_PER_DAY


def excess_kwh(name, from_day, to_day):
    """
    Kaçaklı dolabın, aynı hava/yük koşullarındaki sağlıklı dolaba göre fazla tükettiği
    enerji (kWh), [from_day, to_day) aralığında. Sağlıklı karşılaştırma, simülatör aynı
    tohum ve tarihle çalıştırılarak elde edilir (girdiler birebir aynı, sadece şarj tam).
    """
    meta = dataset.load_meta().set_index("name").loc[name]
    leak_df, _ = dataset.load(name)
    healthy_df, _ = simulate(int(meta["days"]), start=meta["start"], charge_ratio=1.0,
                             seed=int(meta["seed"]))
    a, b = from_day * STEPS_PER_DAY, to_day * STEPS_PER_DAY
    return float((leak_df["energy_kWh"].iloc[a:b] - healthy_df["energy_kWh"].iloc[a:b]).sum())


def impact_for(name, ai_day, ref_day, kwh_saved, a=ASSUMPTIONS):
    """Bir senaryo için kurtarılan gaz, kWh, tCO2e ve TL."""
    _, charge = dataset.load(name)
    deficit_ai = 1 - charge.iloc[ai_day * STEPS_PER_DAY]
    deficit_ref = 1 - charge.iloc[ref_day * STEPS_PER_DAY]
    kg_saved = a["charge_kg"] * (deficit_ref - deficit_ai)

    t_gas = kg_saved * a["gwp_r404a"] / 1000                 # gaz kaçağından önlenen tCO2e
    t_elec = kwh_saved * a["grid_ef_kg_per_kWh"] / 1000      # elektrikten önlenen tCO2e
    return {
        "kurtarılan gaz (kg)": round(kg_saved, 2),
        "kurtarılan enerji (kWh)": round(kwh_saved, 1),
        "önlenen tCO2e (gaz)": round(t_gas, 2),
        "önlenen tCO2e (elektrik)": round(t_elec, 3),
        "önlenen tCO2e (toplam)": round(t_gas + t_elec, 2),
        "tasarruf (TL)": round(kg_saved * a["gas_price_tl_per_kg"]
                               + kwh_saved * a["elec_price_tl_per_kWh"]),
        "etiket": LABEL,
    }


def impact_table(results, a=ASSUMPTIONS, kwh_cache=None):
    """
    evaluate.py'nin results.csv tablosundan her senaryo için etki hesabı.
    kwh_cache: {senaryo: kWh} verilirse fazla tüketim yeniden simüle edilmez (panel için hızlı).
    """
    meta = dataset.load_meta().set_index("name")
    rows = []
    for _, r in results.iterrows():
        name = r["senaryo"]
        ai = r["AI ilk kırmızı (gün)"]
        if str(ai) == "yakalamadı":
            rows.append({"senaryo": name, "not": "AI yakalamadı, kurtarılan yok", "etiket": LABEL})
            continue
        ai_day = int(ai)
        classic = r["klasik alarm (gün)"]
        lower_bound = str(classic) == "çalmadı"
        ref_day = int(meta.loc[name, "days"]) - 1 if lower_bound else int(classic)
        if kwh_cache is not None and name in kwh_cache:
            kwh = kwh_cache[name]
        else:
            kwh = excess_kwh(name, ai_day, ref_day)
        rows.append({
            "senaryo": name,
            "AI günü": ai_day,
            "karşılaştırma günü": ref_day,
            **impact_for(name, ai_day, ref_day, kwh, a),
            "not": "alt sınır (klasik alarm çalmadı, sim. sonuna kadar)" if lower_bound else "",
        })
    return pd.DataFrame(rows)


if __name__ == "__main__":
    results = pd.read_csv("results.csv")
    table = impact_table(results)
    pd.set_option("display.width", 250)
    pd.set_option("display.max_columns", 20)
    print("VARSAYIMLAR")
    for k, v in ASSUMPTIONS.items():
        print(f"  {k:<24} = {v}")
    print(f"\nETKİ ({LABEL}, dolap başına)")
    print(table.drop(columns="etiket").to_string(index=False))
    table.to_csv("impact.csv", index=False)
    print("\nimpact.csv dosyasına kaydedildi.")
