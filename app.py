"""
app.py - Streamlit paneli: Sensörsüz F-gaz kaçak tespiti (canlı demo)

Çalıştırma:  streamlit run app.py
İlk açılışta veri ve model yoksa otomatik üretilir (~1-2 dakika), sonra önbellekten gelir.
"""

import os

import pandas as pd
import plotly.graph_objects as go
import streamlit as st
from plotly.subplots import make_subplots

import baseline
import dataset
import evaluate
import impact
import model

st.set_page_config(page_title="Sensörsüz F-gaz Kaçak Tespiti", page_icon="❄️", layout="wide")

SCENARIOS = {
    "%0 – sağlıklı dolap": "test_healthy",
    "%5 kaçak (90 günde)": "leak_05",
    "%10 kaçak (90 günde)": "leak_10",
    "%20 kaçak (90 günde)": "leak_20",
    "%40 kaçak (90 günde)": "leak_40",
}
STATUS_STYLE = {
    "yeşil": ("#1b8a3a", "🟢 NORMAL", "Dolap beklenen şekilde çalışıyor."),
    "sarı": ("#c99a00", "🟡 İZLENİYOR", "Beklenenden sapma var, birkaç gün daha izleniyor."),
    "kırmızı": ("#c62828", "🔴 MİKRO-KAÇAK ŞÜPHESİ", "Kontrol önerilir: teknisyen kaçak testi yapmalı."),
    "veri yetersiz": ("#666666", "⚪ VERİ TOPLANIYOR", "İlk 3 gün skor üretilmez."),
}


# ---------------------------------------------------------------------------
# Önbellekli hazırlık: veri + model + sonuçlar (deploy edilen linkin tek tıkla çalışması için)
# ---------------------------------------------------------------------------
@st.cache_resource(show_spinner="İlk açılış: senaryolar üretiliyor ve model eğitiliyor (~1-2 dk)...")
def get_model():
    return evaluate.ensure_data_and_model()


@st.cache_data(show_spinner=False)
def get_scenario(name):
    """Telemetri, gerçek şarj, günlük AI skoru, 6 saatlik pencereler ve klasik alarm günü."""
    df, charge = dataset.load(name)
    daily = model.score(get_model(), df)
    windows = model.make_windows(df)
    return df, charge, daily, windows, baseline.first_alarm_day(df)


@st.cache_data(show_spinner="Senaryolar karşılaştırılıyor...")
def get_results():
    bundle = get_model()
    meta = dataset.load_meta().set_index("name")
    results = pd.DataFrame([evaluate.evaluate_leak(bundle, n, meta.loc[n]) for n in evaluate.LEAK_NAMES])
    healthy = evaluate.evaluate_healthy(bundle)
    if os.path.exists("results_healthy.csv"):
        extra = pd.read_csv("results_healthy.csv")
    else:
        extra = evaluate.evaluate_healthy_extra(bundle)
    return results, healthy, extra


@st.cache_data(show_spinner="Enerji farkı hesaplanıyor...")
def get_excess_kwh(name, from_day, to_day):
    return impact.excess_kwh(name, from_day, to_day)


# ---------------------------------------------------------------------------
# Kenar çubuğu
# ---------------------------------------------------------------------------
st.sidebar.title("⚙️ Ayarlar")
choice = st.sidebar.radio("Kaçak senaryosu", list(SCENARIOS), index=3)
name = SCENARIOS[choice]

st.sidebar.markdown("**Etki varsayımları** (doğrulanmalı)")
A = dict(impact.ASSUMPTIONS)
A["charge_kg"] = st.sidebar.number_input("Sistem gaz şarjı (kg)", 1.0, 500.0, A["charge_kg"], 5.0)
A["elec_price_tl_per_kWh"] = st.sidebar.number_input("Elektrik fiyatı (TL/kWh)", 0.0, 50.0,
                                                     A["elec_price_tl_per_kWh"], 0.5)
A["gas_price_tl_per_kg"] = st.sidebar.number_input("R-404A fiyatı (TL/kg)", 0.0, 20000.0,
                                                   A["gas_price_tl_per_kg"], 100.0)
A["grid_ef_kg_per_kWh"] = st.sidebar.number_input("Şebeke emisyon faktörü (kg CO2/kWh)", 0.0, 1.5,
                                                  A["grid_ef_kg_per_kWh"], 0.01)
st.sidebar.caption(f"GWP R-404A = {A['gwp_r404a']} (IPCC AR4)")

# ---------------------------------------------------------------------------
# Veri
# ---------------------------------------------------------------------------
bundle = get_model()
df, charge, daily, windows, classic_day = get_scenario(name)
results, healthy, extra = get_results()
n_days = len(daily)
is_leak = name != "test_healthy"
leak_start = dataset.LEAK_START_DAY if is_leak else None
red_days = [i for i, s in enumerate(daily["status"]) if s == "kırmızı" and i >= (leak_start or 0)]
ai_day = red_days[0] if red_days else None

st.title("❄️ Sensörsüz F-gaz Kaçak Tespiti")
st.caption("Market soğutma dolabı · R-404A · Ek sensör yok: sadece kontrol cihazının zaten "
           "kaydettiği telemetri · Autoencoder anomali modeli")

# Zaman kaydırıcısı: demoda günleri "canlı" ilerletmek için
day = st.slider("📅 Simülasyon günü (kaydırarak zamanı ilerletin)", 3, n_days - 1, n_days - 1)
today = daily.iloc[day]

# ---------------------------------------------------------------------------
# Durum kartı + büyük metrik
# ---------------------------------------------------------------------------
col_card, col_metric = st.columns([2, 1])
with col_card:
    color, title, text = STATUS_STYLE[today["status"]]
    reason = ""
    if today["status"] in ("sarı", "kırmızı"):
        reason = f"<br><b>Neden şüpheli?</b> {model.explain(today)}"
    real = (f"<br><span style='opacity:.8'>Gerçek (modelin görmediği) eksik gaz: "
            f"%{100 * (1 - charge.iloc[day * dataset.STEPS_PER_DAY]):.1f}</span>")
    st.markdown(
        f"<div style='background:{color};color:white;padding:18px 22px;border-radius:12px'>"
        f"<div style='font-size:13px;opacity:.85'>Gün {day} durumu</div>"
        f"<div style='font-size:28px;font-weight:700'>{title}</div>"
        f"<div style='font-size:16px'>{text}{reason}{real}</div></div>",
        unsafe_allow_html=True)

with col_metric:
    if not is_leak:
        st.metric("Kaç gün önce?", "—")
        st.caption(f"Sağlıklı dolap. AI kırmızı alarm sayısı: {healthy['kırmızı alarm sayısı']} "
                   f"({healthy['gün']} gün), klasik alarm: {healthy['klasik alarm']}.")
    elif ai_day is None:
        st.metric("Kaç gün önce?", "AI yakalamadı")
    elif classic_day is None:
        st.metric("Kaç gün önce?", f"≥ {n_days - 1 - ai_day} gün")
        st.caption("Klasik alarm simülasyon boyunca **hiç çalmadı**; fark simülasyon sonuna göre "
                   "(alt sınır).")
    else:
        st.metric("Kaç gün önce?", f"{classic_day - ai_day} gün")
        st.caption(f"AI: gün {ai_day} · Klasik alarm: gün {classic_day}")

# ---------------------------------------------------------------------------
# Grafikler
# ---------------------------------------------------------------------------
# Günlük özetler: gün içi dalgalanma (defrost, mağaza saatleri) eğilimi gizlemesin
t0 = df["timestamp"].iloc[0]
end = t0 + pd.Timedelta(days=day + 1)
cab = df.set_index("timestamp")["t_cabin"].resample("1D").agg(["mean", "max"])
wd = windows.resample("1D").mean()
cab, wd = cab[cab.index < end], wd[wd.index < end]
s = daily.iloc[: day + 1]

fig = make_subplots(rows=4, cols=1, shared_xaxes=True, vertical_spacing=0.06,
                    subplot_titles=["Kabin sıcaklığı (°C, günlük ort. ve maks.): klasik alarm bunu izler",
                                    "Kompresör çalışma oranı (%, günlük)",
                                    "Emme basıncı (bar, çalışırken, günlük)",
                                    "AI anomali skoru (3 günlük ort.) ve eşik"])
fig.add_trace(go.Scatter(x=cab.index, y=cab["max"], name="Kabin maks.",
                         line=dict(color="#90caf9", width=1)), 1, 1)
fig.add_trace(go.Scatter(x=cab.index, y=cab["mean"], name="Kabin ort.",
                         line=dict(color="#1565c0")), 1, 1)
fig.add_hline(y=baseline.ALARM_TEMP_C, line_dash="dot", line_color="gray", row=1, col=1,
              annotation_text="klasik alarm eşiği 7 °C", annotation_position="bottom left")
fig.add_trace(go.Scatter(x=wd.index, y=100 * wd["duty"], name="Çalışma oranı (%)"), 2, 1)
fig.add_trace(go.Scatter(x=wd.index, y=wd["p_suction"], name="Emme basıncı"), 3, 1)
fig.add_trace(go.Scatter(x=s.index, y=s["score"], name="AI skoru", line=dict(color="black")), 4, 1)
fig.add_hline(y=bundle["threshold"], line_dash="dash", line_color="red", row=4, col=1,
              annotation_text="eşik", annotation_position="top left")

# Dikey çizgiler (sadece seçilen güne kadar gerçekleşmiş olanlar)
events = [(leak_start, "kaçak başladı (gerçek)", "gray"),
          (ai_day, "AI tespiti", "red"),
          (classic_day, "klasik alarm", "blue")]
for ev_day, label, c in events:
    if ev_day is not None and ev_day <= day:
        x = t0 + pd.Timedelta(days=ev_day)
        fig.add_vline(x=x, line_dash="dash", line_color=c)
        fig.add_annotation(x=x, y=1.075, yref="paper", text=label, showarrow=False,
                           font=dict(color=c, size=12), xanchor="left", yanchor="bottom")
fig.update_layout(height=860, showlegend=False, margin=dict(t=90, b=20, l=10, r=10))
fig.update_xaxes(range=[t0, df["timestamp"].iloc[-1]])
fig.update_yaxes(type="log", row=4, col=1)   # logaritmik: eşiğin aşıldığı an net görünsün
st.plotly_chart(fig, width="stretch")

# ---------------------------------------------------------------------------
# Etki kutusu
# ---------------------------------------------------------------------------
st.subheader("🌍 Erken tespitin etkisi (simülasyon tahmini)")
if is_leak and ai_day is not None:
    ref_day = classic_day if classic_day is not None else n_days - 1
    kwh = get_excess_kwh(name, ai_day, ref_day)
    imp = impact.impact_for(name, ai_day, ref_day, kwh, A)
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Kurtarılan gaz", f"{imp['kurtarılan gaz (kg)']:.1f} kg")
    c2.metric("Önlenen emisyon", f"{imp['önlenen tCO2e (toplam)']:.1f} tCO2e")
    c3.metric("Kurtarılan enerji", f"{imp['kurtarılan enerji (kWh)']:.0f} kWh")
    c4.metric("Tasarruf", f"{imp['tasarruf (TL)']:,.0f} TL".replace(",", "."))
    note = "Klasik alarm hiç çalmadığı için simülasyon sonuna kadar hesaplandı: **alt sınır**. " \
        if classic_day is None else ""
    st.caption(f"{note}AI tespiti (gün {ai_day}) ile klasik alarm/simülasyon sonu (gün {ref_day}) "
               f"arasında, kaçağın AI uyarısıyla onarıldığı varsayılır. kWh tek dolap için "
               f"hesaplanmıştır; gaz miktarı seçilen sistem şarjına ({A['charge_kg']:.0f} kg) göredir.")
else:
    st.info("Bu senaryoda AI tespiti yok; kurtarılan miktar hesaplanmaz.")

# ---------------------------------------------------------------------------
# Tüm senaryolar
# ---------------------------------------------------------------------------
st.subheader("🏁 Tüm senaryolar: AI vs klasik sıcaklık alarmı")
# Kolonlarda sayı ve metin ("çalmadı") karışık olduğu için gösterimde metne çevrilir
st.dataframe(results.astype(str), hide_index=True, width="stretch")
n_ev, n_d = int(extra["kırmızı alarm sayısı"].sum()), int(extra["gün"].sum())
st.caption(f"Yanlış alarm kontrolü: sağlıklı test serisinde {healthy['kırmızı alarm sayısı']} kırmızı alarm "
           f"({healthy['gün']} gün). Farklı mevsimlerden 6 ek sağlıklı seride {n_d} günde {n_ev} yanlış "
           f"kırmızı alarm (≈ {365 * n_ev / n_d:.1f} / yıl / dolap). Klasik alarm: 50 kg şarj varsayımıyla.")

# ---------------------------------------------------------------------------
# Dürüstlük bölümü
# ---------------------------------------------------------------------------
st.subheader("🔍 Bu prototip neyi kanıtlıyor / neyi kanıtlamıyor")
c1, c2 = st.columns(2)
with c1:
    st.markdown("""
**Kanıtlıyor**
- Yavaş gaz kaçağı kabin sıcaklığını uzun süre **değiştirmez**; klasik alarm %5–%20 kaçakları
  hiç görmedi, %40'ı ancak gazın ~%34'ü kaçınca gördü.
- Kontrol cihazının zaten kaydettiği veriden (basınç, kızgınlık, çalışma süresi, kWh, dış hava)
  bir Autoencoder, kaçağı **%4–10 eksik gaz** seviyesinde, haftalar önce yakalayabiliyor.
- Model dış hava ve saati bağlam olarak kullandığı için sıcak günü kaçak sanmıyor; hangi
  ölçümün saptığını açıklayabiliyor.
""")
with c2:
    st.markdown("""
**Kanıtlamıyor (henüz)**
- Veri **sentetik**: basitleştirilmiş, fiziğe dayalı bir simülatörden geliyor; gerçek bir
  dolapta denenmedi.
- Sahadaki yanlış alarm oranı farklı olabilir (sensör arızası, ayar değişikliği, bakım vb.).
- Her senaryo tek bir rastgele tohumla çalıştırıldı.
- GWP dışındaki etki varsayımları (emisyon faktörü, fiyatlar, şarj) **doğrulanmalı**.
""")
