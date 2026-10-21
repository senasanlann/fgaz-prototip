"""
baseline.py - Klasik sıcaklık alarmı (bugünkü sektör pratiği)

Kural: Kabin sıcaklığı 2 saat boyunca kesintisiz 7 °C'nin üstünde kalırsa alarm.
"""

# Eşikler burada; kolayca değiştirilebilir
ALARM_TEMP_C = 7.0          # alarm sıcaklığı (°C)
ALARM_DURATION_STEPS = 8    # 2 saat = 8 x 15 dakika
STEPS_PER_DAY = 96          # 1 gün = 96 satır


def first_alarm_day(df):
    """Alarmın ilk çaldığı günü döndürür; hiç çalmadıysa None."""
    # 1) Her satır: kabin eşiğin üstünde mi? (True/False)
    above = df["t_cabin"] > ALARM_TEMP_C

    # 2) Son 8 satırın hepsi True mu?
    full = above.rolling(ALARM_DURATION_STEPS).sum() == ALARM_DURATION_STEPS

    # Hiç alarm yoksa
    if not full.any():
        return None

    # 3) İlk True olan satırın numarası -> gün numarası
    first_row = int(full.to_numpy().argmax())
    return first_row // STEPS_PER_DAY


if __name__ == "__main__":
    import dataset
    for name in ["test_healthy", "leak_05", "leak_10", "leak_20", "leak_40"]:
        df, _ = dataset.load(name)
        day = first_alarm_day(df)
        print(f"{name:<14} ilk alarm günü: {day if day is not None else 'çalmadı'}")