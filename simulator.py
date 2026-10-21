"""
simulator.py - Sanal market dolabı (basitleştirilmiş, fiziğe dayalı "gri kutu" model)

Tam bir dinamik soğutma çevrimi modeli DEĞİLDİR. Amaç: kontrol cihazının zaten kaydettiği
telemetrinin, gaz eksildikçe (undercharge) literatürle uyumlu yönlerde değişmesini sağlamak.

Model özeti (her 1 dakikalık alt adımda):
  - Kabin tek bir ısıl kütle: C * dT/dt = mağazadan ısı girişi + kapı/yük ısısı - soğutma
  - Termostat kabini 3–5 °C arasında tutar (histerezisli aç/kapa)
  - Buharlaşma/yoğuşma sıcaklıkları basit farklarla bulunur, basınçlar CoolProp'tan gelir
  - Gaz eksikliği (d = 1 - charge_ratio) aşağıdaki PARAMS içindeki ilişkilerle etkiler
Kayıt aralığı 15 dakikadır (1 gün = 96 satır).
"""

import numpy as np
import pandas as pd
import CoolProp.CoolProp as CP

REFRIGERANT = "R404A"

# ---------------------------------------------------------------------------
# TÜM VARSAYIMLAR TEK YERDE
# Değerler "makul büyüklük" seçilmiştir; gerçek bir dolaba kalibre edilmemiştir.
# ---------------------------------------------------------------------------
PARAMS = {
    # --- Zaman ---
    "dt_log_min": 15,          # kayıt aralığı (dk)
    "dt_sub_min": 1,           # fizik alt adımı (dk); termostat bu çözünürlükte çalışır

    # --- Termostat (pozitif soğutma, şarküteri/süt dolabı) ---
    "t_on": 5.0,               # kabin bu sıcaklığa çıkınca kompresör çalışır (°C)
    "t_off": 3.0,              # kabin bu sıcaklığa inince kompresör durur (°C)

    # --- Dış hava (kondenser dışarıda) ---
    "t_out_mean": 15.0,        # yıllık ortalama (°C), Türkiye'nin ılıman bölgeleri gibi
    "t_out_season_amp": 10.0,  # yaz-kış genliği (°C); en soğuk gün ~15 Ocak
    "t_out_day_amp": 5.0,      # gece-gündüz genliği (°C); en sıcak saat 15:00
    "t_out_noise_sd": 1.5,     # hava durumu sapması (AR(1) gürültü, °C)

    # --- Mağaza içi ve kabin ısı dengesi ---
    "t_store_base": 21.0,      # mağaza içi sıcaklık (°C)
    "t_store_coupling": 0.15,  # dış hava 1 K artınca mağaza içi 0.15 K artar
    "ua_cabin_kW_K": 0.065,    # mağazadan kabine ısı geçişi (kW/K) -> ~1.1 kW sürekli yük
    "c_cabin_kJ_K": 1500.0,    # kabin + ürün ısıl kütlesi (kJ/K), ~400 kg gıda mertebesi
    "store_open_h": 8,         # mağaza açılış saati
    "store_close_h": 22,       # mağaza kapanış saati
    "door_load_kW": 0.45,      # açık saatlerde ortalama kapı/müşteri/dolum ısı yükü (kW)
    "weekend_factor": 1.3,     # hafta sonu daha kalabalık

    # --- Soğutma çevrimi (sağlıklı, nominal) ---
    "q_nom_kW": 2.8,           # nominal soğutma kapasitesi (T_kond = 35 °C'de)
    "p_nom_kW": 1.3,           # nominal kompresör gücü (T_kond = 35 °C'de) -> COP ~2.2
    "p_fan_kW": 0.08,          # evaporatör fanları (sürekli çalışır)
    "dT_evap_K": 10.0,         # kabin - buharlaşma sıcaklığı farkı (çalışırken)
    "dT_cond_K": 10.0,         # yoğuşma - dış hava sıcaklığı farkı
    "t_cond_min": 25.0,        # minimum yoğuşma sıcaklığı (kışın basma basıncı kontrolü)
    "cap_per_K_cond": 0.012,   # yoğuşma 1 K artınca kapasite %1.2 düşer
    "pow_per_K_cond": 0.015,   # yoğuşma 1 K artınca güç %1.5 artar
    "superheat_nom_K": 6.0,    # genleşme valfinin hedeflediği kızgınlık (K)
    "dT_evap_off_K": 2.0,      # kompresör dururken evaporatör kabine yaklaşır (kabin - 2 K)

    # --- Sağlıklı dolaptaki doğal dalgalanmalar (gerçekçilik) ---
    # Bunlar olmadan sağlıklı dolap "fazla düzgün" olur ve en küçük sapma bile hemen
    # yakalanır; bu da sonuçları gerçekçi olmayan biçimde iyi gösterir.
    "defrost_hours": (1, 7, 13, 19),  # günde 4 defrost (orta sıcaklık dolaplarında tipik)
    "defrost_min": 30,         # defrost süresi (dk); kompresör zorla durur (off-cycle defrost)
    "frost_max_K": 1.5,        # iki defrost arasında buz birikimiyle buharlaşma sıc. düşüşü (K)
    "frost_cap_loss": 0.05,    # buz birikimiyle en fazla %5 kapasite kaybı
    "q_ref_kW": 1.3,           # evaporatörün "tipik" ısı yükü (kW)
    "evap_load_K_per_kW": 1.5, # yük 1 kW artınca buharlaşma sıcaklığı 1.5 K yükselir
    "sh_load_K_per_kW": 1.5,   # yük 1 kW artınca kızgınlık 1.5 K artar (valf geç tepki verir)
    "sh_start_K": 4.0,         # kompresör açılınca kızgınlık 4 K fazlasıyla başlar...
    "sh_start_tau_min": 4.0,   # ...ve ~4 dakikada oturur (çok sık durup kalkmak = yüksek kızgınlık)
    "sh_hunt_sd_K": 1.0,       # genleşme valfi salınımı (15 dk'lık adımlar arası, K)
    "sh_drift_sd_K": 0.5,      # günler süren yavaş kayma (valf ayarı, sensör montajı, K)
    "evap_drift_sd_K": 0.4,    # buharlaşma sıcaklığında yavaş kayma (fan/hava akışı, kirlenme, K)

    # --- Gaz eksikliğinin etkileri (d = 1 - charge_ratio) ---
    # Yönler literatürle uyumludur (ör. Kim & Braun 2012, Int. J. Refrig.; Mehrabi & Yuill
    # 2017): az şarjda evaporatör yeterince beslenmez -> emme basıncı düşer, kızgınlık artar,
    # kapasite ve COP düşer. Büyüklükler bu prototip için seçilmiş tahminlerdir.
    # Üslü ifadeler etkiyi doğrusal olmayan yapar: %10 eksikte küçük, %30+ eksikte belirgin.
    "evap_drop_coef": 15.0,    # buharlaşma sıcaklığı düşüşü = 15 * d^1.3 K  (d=0.2 -> ~1.9 K)
    "evap_drop_exp": 1.3,
    "sh_rise_coef": 60.0,      # kızgınlık artışı = 60 * d^1.5 K           (d=0.2 -> ~5.4 K)
    "sh_rise_exp": 1.5,
    "cap_loss_coef": 3.0,      # kapasite çarpanı = 1 - 3.0 * d^2          (d=0.2 -> 0.88)
    "pow_loss_coef": 1.0,      # güç çarpanı      = 1 - 1.0 * d^2          (d=0.2 -> 0.96)
                               # güç kapasiteden az düştüğü için COP düşer
    "cond_drop_coef": 3.0,     # yoğuşma sıcaklığı düşüşü = 3 * d K (kondenserde daha az sıvı)

    # --- Ölçüm gürültüsü (standart sapma) ---
    "noise_t_K": 0.15,         # sıcaklık sensörleri
    "noise_p_bar": 0.03,       # basınç transmitterleri
    "noise_sh_K": 0.4,         # kızgınlık (iki ölçümün farkı olduğu için daha gürültülü)
    "noise_power_rel": 0.02,   # elektrik sayacı (%2)
}

# ---------------------------------------------------------------------------
# CoolProp doyma tabloları (her adımda CoolProp çağırmamak için önceden hesaplanır)
# R404A bir karışımdır: emme tarafı için buhar (dew, Q=1), basma tarafı için sıvı
# (bubble, Q=0) doyma basıncı kullanılır. Basınçlar mutlak bar cinsindendir.
# ---------------------------------------------------------------------------
_T_GRID = np.arange(-45.0, 70.1, 0.5)
_P_DEW = np.array([CP.PropsSI("P", "T", t + 273.15, "Q", 1, REFRIGERANT) for t in _T_GRID]) / 1e5
_P_BUB = np.array([CP.PropsSI("P", "T", t + 273.15, "Q", 0, REFRIGERANT) for t in _T_GRID]) / 1e5


def p_sat_dew(t_c):
    """Buharlaşma sıcaklığından emme (doyma) basıncı, bar(a)."""
    return np.interp(t_c, _T_GRID, _P_DEW)


def p_sat_bubble(t_c):
    """Yoğuşma sıcaklığından basma (doyma) basıncı, bar(a)."""
    return np.interp(t_c, _T_GRID, _P_BUB)


def undercharge_effects(charge_ratio, p=PARAMS):
    """Şarj oranına göre etki çarpanları. Sağlıklıda (1.0) hepsi nötrdür."""
    d = np.clip(1.0 - np.asarray(charge_ratio, dtype=float), 0.0, 1.0)
    return {
        "evap_drop_K": p["evap_drop_coef"] * d ** p["evap_drop_exp"],
        "sh_rise_K": p["sh_rise_coef"] * d ** p["sh_rise_exp"],
        "cap_factor": np.clip(1.0 - p["cap_loss_coef"] * d ** 2, 0.05, 1.0),
        "pow_factor": np.clip(1.0 - p["pow_loss_coef"] * d ** 2, 0.05, 1.0),
        "cond_drop_K": p["cond_drop_coef"] * d,
    }


def ar1(n, phi, sd, rng):
    """Ortalama 0, standart sapma `sd` olan AR(1) süreci (birbirine bağlı yavaş dalgalanma)."""
    eps = rng.normal(0, sd * np.sqrt(1 - phi ** 2), n)
    x = np.zeros(n)
    x[0] = rng.normal(0, sd)
    for i in range(1, n):
        x[i] = phi * x[i - 1] + eps[i]
    return x


def make_ambient(index, rng, p=PARAMS):
    """Dış hava: mevsimsel sinüs + günlük sinüs + AR(1) hava durumu gürültüsü."""
    doy = index.dayofyear.to_numpy()
    hour = index.hour.to_numpy() + index.minute.to_numpy() / 60
    season = -p["t_out_season_amp"] * np.cos(2 * np.pi * (doy - 15) / 365)
    daily = p["t_out_day_amp"] * np.cos(2 * np.pi * (hour - 15) / 24)
    # AR(1): hava birkaç gün süren sıcak/soğuk dönemler yaşar
    weather = ar1(len(index), 0.995, p["t_out_noise_sd"], rng)
    return p["t_out_mean"] + season + daily + weather


def make_door_load(index, rng, p=PARAMS):
    """Mağaza saatlerinde rastgele kapı açılması / müşteri / ürün dolumu ısı yükü (kW)."""
    hour = index.hour.to_numpy()
    is_open = (hour >= p["store_open_h"]) & (hour < p["store_close_h"])
    weekend = index.dayofweek.to_numpy() >= 5
    level = p["door_load_kW"] * np.where(weekend, p["weekend_factor"], 1.0)
    # Gamma dağılımı: çoğu zaman orta yük, ara sıra büyük dolum/yoğunluk anları
    load = rng.gamma(shape=2.0, scale=level / 2.0)
    return np.where(is_open, load, 0.0)


def simulate(days, start="2025-01-01", charge_ratio=1.0, seed=0, p=PARAMS):
    """
    Dolabı `days` gün boyunca simüle eder.

    charge_ratio: sabit sayı ya da her 15 dakikalık adım için bir dizi (1.0 = tam şarj).
    Dönüş: (df, truth)
      df    -> modelin görebileceği telemetri kolonları (gerçek sensör yokmuş gibi)
      truth -> charge_ratio etiketi (sadece değerlendirme için, model görmez)
    """
    rng = np.random.default_rng(seed)
    n = int(days * 24 * 60 / p["dt_log_min"])
    index = pd.date_range(start, periods=n, freq=f"{p['dt_log_min']}min")
    charge = np.broadcast_to(np.asarray(charge_ratio, dtype=float), (n,)).copy()

    t_amb = make_ambient(index, rng, p)
    door = make_door_load(index, rng, p)
    eff = undercharge_effects(charge, p)
    # Doğal dalgalanmalar: valf salınımı (hızlı) + günler süren kaymalar (yavaş)
    sh_hunt = ar1(n, 0.5, p["sh_hunt_sd_K"], rng)
    sh_drift = ar1(n, 0.999, p["sh_drift_sd_K"], rng)      # ~10 günlük korelasyon
    evap_drift = ar1(n, 0.999, p["evap_drift_sd_K"], rng)

    n_sub = p["dt_log_min"] // p["dt_sub_min"]
    dt_s = p["dt_sub_min"] * 60
    t_cab = 4.0                     # başlangıç kabin sıcaklığı
    comp = False                    # kompresör durumu
    run_min = 0                     # kompresör kaç dakikadır çalışıyor
    out = {k: np.zeros(n) for k in
           ["t_cabin", "p_suction_bar", "p_discharge_bar", "superheat_K", "compressor_on", "power_kW"]}

    for i in range(n):
        # Bu 15 dakika boyunca sabit kabul edilen koşullar
        t_store = p["t_store_base"] + p["t_store_coupling"] * (t_amb[i] - p["t_out_mean"])
        t_cond = max(t_amb[i] + p["dT_cond_K"], p["t_cond_min"]) - eff["cond_drop_K"][i]
        cap = (p["q_nom_kW"] * eff["cap_factor"][i]
               * (1 - p["cap_per_K_cond"] * (t_cond - 35)))
        pow_run = (p["p_nom_kW"] * eff["pow_factor"][i]
                   * (1 + p["pow_per_K_cond"] * (t_cond - 35)))

        on_steps, t_evap_run_sum, sh_run_sum = 0, 0.0, 0.0
        for k in range(n_sub):
            minute = index[i].hour * 60 + index[i].minute + k * p["dt_sub_min"]
            # Son defrosttan bu yana geçen süre -> buz birikimi oranı (0..1)
            since_def = min((minute - h * 60) % 1440 for h in p["defrost_hours"])
            in_defrost = since_def < p["defrost_min"]
            frost = (since_def - p["defrost_min"]) / (360 - p["defrost_min"]) if not in_defrost else 0.0

            # Termostat (histerezis); defrost sırasında kompresör zorla durur
            if in_defrost:
                comp = False
            elif t_cab >= p["t_on"]:
                comp = True
            elif t_cab <= p["t_off"]:
                comp = False
            run_min = run_min + p["dt_sub_min"] if comp else 0

            q_in = p["ua_cabin_kW_K"] * (t_store - t_cab) + door[i]
            q_out = cap * (1 - p["frost_cap_loss"] * frost) if comp else 0.0
            t_cab += (q_in - q_out) * dt_s / p["c_cabin_kJ_K"]
            if comp:
                on_steps += 1
                dq = q_in - p["q_ref_kW"]
                t_evap_run_sum += (t_cab - p["dT_evap_K"] - eff["evap_drop_K"][i]
                                   + p["evap_load_K_per_kW"] * dq
                                   - p["frost_max_K"] * frost + evap_drift[i])
                sh_run_sum += (p["superheat_nom_K"] + eff["sh_rise_K"][i]
                               + p["sh_load_K_per_kW"] * dq
                               + p["sh_start_K"] * np.exp(-run_min / p["sh_start_tau_min"]))

        on_frac = on_steps / n_sub
        # Emme basıncı ve kızgınlık: kompresör çalıştıysa çalışma sırasındaki ortalama;
        # hiç çalışmadıysa duruş değeri (evaporatör kabine yaklaşmış, kızgınlık ~0).
        if on_steps > 0:
            t_evap = t_evap_run_sum / on_steps
            sh = sh_run_sum / on_steps + sh_hunt[i] + sh_drift[i]
        else:
            t_evap = t_cab - p["dT_evap_off_K"]
            sh = 0.5
        out["t_cabin"][i] = t_cab
        out["p_suction_bar"][i] = p_sat_dew(t_evap)
        out["p_discharge_bar"][i] = p_sat_bubble(t_cond) if on_steps > 0 else p_sat_bubble(t_store)
        out["superheat_K"][i] = sh
        out["compressor_on"][i] = on_frac
        out["power_kW"][i] = on_frac * pow_run + p["p_fan_kW"]

    # Ölçüm gürültüsü
    df = pd.DataFrame({"timestamp": index})
    df["t_ambient"] = t_amb + rng.normal(0, p["noise_t_K"], n)
    df["t_cabin"] = out["t_cabin"] + rng.normal(0, p["noise_t_K"], n)
    df["p_suction_bar"] = out["p_suction_bar"] + rng.normal(0, p["noise_p_bar"], n)
    df["p_discharge_bar"] = out["p_discharge_bar"] + rng.normal(0, p["noise_p_bar"], n)
    df["superheat_K"] = np.maximum(out["superheat_K"] + rng.normal(0, p["noise_sh_K"], n), 0)
    df["compressor_on"] = out["compressor_on"]   # kontrol cihazının kendi kaydı, gürültüsüz
    df["power_kW"] = out["power_kW"] * (1 + rng.normal(0, p["noise_power_rel"], n))
    df["energy_kWh"] = df["power_kW"] * p["dt_log_min"] / 60

    truth = pd.Series(charge, index=df.index, name="charge_ratio")
    return df, truth


if __name__ == "__main__":
    # Aynı hava ve yük koşullarında (aynı tohum) sağlıklı vs %20 eksik gaz, 30 gün (yaz başı)
    healthy, _ = simulate(30, start="2025-06-01", charge_ratio=1.0, seed=42)
    leak, _ = simulate(30, start="2025-06-01", charge_ratio=0.8, seed=42)

    def summary(df):
        return pd.Series({
            "Dış hava ort. (°C)": df["t_ambient"].mean(),
            "Kabin ort. (°C)": df["t_cabin"].mean(),
            "Kabin maks. (°C)": df["t_cabin"].max(),
            "Kabin >7 °C süresi (%)": 100 * (df["t_cabin"] > 7).mean(),
            "Emme basıncı (bar)": df.loc[df["compressor_on"] > 0, "p_suction_bar"].mean(),
            "Basma basıncı (bar)": df.loc[df["compressor_on"] > 0, "p_discharge_bar"].mean(),
            "Kızgınlık (K)": df.loc[df["compressor_on"] > 0, "superheat_K"].mean(),
            "Kompresör duty (%)": 100 * df["compressor_on"].mean(),
            "Ort. güç (kW)": df["power_kW"].mean(),
            "Toplam enerji (kWh)": df["energy_kWh"].sum(),
        })

    table = pd.DataFrame({"Sağlıklı (%100)": summary(healthy), "Kaçak (%80 şarj)": summary(leak)})
    table["Fark"] = table.iloc[:, 1] - table.iloc[:, 0]
    pd.set_option("display.width", 120)
    print("30 gün, aynı hava/yük koşulları (seed=42), Haziran\n")
    print(table.round(2).to_string())
