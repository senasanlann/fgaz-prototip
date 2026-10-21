import React, { useState } from 'react';
import { Table, CheckCircle2, ChevronDown, ChevronUp, BellOff, BellRing, ArrowRight } from 'lucide-react';
import { ProcessedScenarioData } from '../data/scenarios';
import { BENCHMARK_RESULTS, HEALTHY_EXTRA_RESULTS, HEALTHY_TEST_SUMMARY } from '../data/scenariosData';

interface ComparisonSectionProps {
  scenarioData: ProcessedScenarioData;
}

export const ComparisonSection: React.FC<ComparisonSectionProps> = ({ scenarioData }) => {
  const [showHealthyTable, setShowHealthyTable] = useState<boolean>(false);

  const def = scenarioData.definition;
  const isHealthy = def.key === 'test_healthy';
  const aiDay = scenarioData.aiDetectionDay;
  const classicDay = scenarioData.conventionalAlarmDay;
  const leadDays = scenarioData.leadTimeDays;
  const isLowerBound = scenarioData.isLowerBound;

  const totalHealthyDays = HEALTHY_EXTRA_RESULTS.reduce((acc, r) => acc + r.days, 0);
  const totalHealthyAlarms = HEALTHY_EXTRA_RESULTS.reduce((acc, r) => acc + r.redAlarmEvents, 0);
  const annualFalseAlarmRate = (365 * totalHealthyAlarms) / totalHealthyDays;

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚖️</span>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            AI vs Klasik Sıcaklık Alarmı Karşılaştırması
          </h2>
        </div>
        <span className="text-xs text-slate-500 font-mono">
          Klasik Kural: Kabin sıcaklığı &gt; 7°C (2 saat kesintisiz)
        </span>
      </div>

      {/* Active scenario comparison highlight card */}
      <div className="bg-slate-50 rounded-xl p-4 sm:p-5 border border-slate-200">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-3">
          <span>SEÇİLİ SENARYO İÇİN ERKEN UYARI PERFORMANSI</span>
          <span className="font-mono text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded font-bold">
            {def.label}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          {/* AI System Box */}
          <div className="bg-white p-3.5 rounded-xl border border-rose-200 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800 mb-1">
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
              Autoencoder Anomali Tespiti
            </div>
            <div className="text-2xl font-black text-rose-950 my-1 font-mono">
              {aiDay !== null ? `Gün ${aiDay}` : isHealthy ? 'Alarm Yok (Normal)' : 'Tespit Edilemedi'}
            </div>
            <p className="text-[11px] text-slate-500">
              {aiDay !== null ? `Gazın henüz %${scenarioData.telemetryDaily[aiDay]?.true_deficit_pct.toFixed(1)}'i eksildiğinde tetiklendi.` : 'Kabin sıcaklığı etkilenmeden önce telemetri izlendi.'}
            </p>
          </div>

          {/* Comparison Flow Icon */}
          <div className="flex flex-col items-center justify-center text-center px-2">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              {leadDays !== null ? (isLowerBound ? 'Alt Sınır Avantajı' : 'Ölçülen Avantaj') : 'Sonuç'}
            </div>
            <div className="text-2xl font-black text-emerald-700 font-mono flex items-center gap-1">
              {leadDays !== null ? `${isLowerBound ? '≥ ' : ''}${leadDays} Gün` : '—'}
            </div>
            <span className="text-[11px] text-slate-400 mt-1">
              {isLowerBound
                ? 'Klasik alarm simülasyon boyunca çalmadı; fark simülasyon sonuna göredir.'
                : leadDays !== null
                ? 'Klasik termostat alarmından tam 53 gün önce tespit.'
                : 'Sağlıklı sistemde alarm oluşmadı.'}
            </span>
          </div>

          {/* Conventional Alarm Box */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1">
              {classicDay !== null ? <BellRing className="w-3.5 h-3.5 text-blue-600" /> : <BellOff className="w-3.5 h-3.5 text-slate-400" />}
              Sektörel Klasik Sıcaklık Alarmı
            </div>
            <div className="text-2xl font-black text-slate-900 my-1 font-mono">
              {classicDay !== null ? `Gün ${classicDay}` : 'Çalmadı (Tetiklenmedi)'}
            </div>
            <p className="text-[11px] text-slate-500">
              {classicDay !== null
                ? `Kabin ancak gazın %34.1'i kaçtığında 7°C üstüne çıktı.`
                : 'Termostat histerezisi gaz kaçağını fark edemedi.'}
            </p>
          </div>
        </div>
      </div>

      {/* Comprehensive benchmark table from results.csv */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Tüm Senaryolar Kıyaslama Tablosu (results.csv)
        </h3>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-3 py-2.5 whitespace-nowrap">Senaryo</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">90 Günde Eksik (%)</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">Kaçak Başlangıcı</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">AI İlk Kırmızı</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">Klasik Alarm</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Kaç Gün Önce?</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">AI Tespitinde Eksik</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">AI'a Kadar Kaçan</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">Klasiğe/Sona Kadar</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">Kaçak Öncesi Yanlış Alarm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-slate-800">
              {BENCHMARK_RESULTS.map((row) => (
                <tr
                  key={row.senaryo}
                  className={`transition-colors ${
                    def.key === row.senaryo ? 'bg-blue-50/80 font-bold' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="px-3 py-2.5 font-sans font-semibold text-blue-700 whitespace-nowrap">
                    {row.senaryo}
                  </td>
                  <td className="px-3 py-2.5 text-right">%{row.deficitPct}</td>
                  <td className="px-3 py-2.5 text-right">{row.leakStartDay}. Gün</td>
                  <td className="px-3 py-2.5 text-right text-rose-600 font-bold">Gün {row.aiFirstRedDay}</td>
                  <td className="px-3 py-2.5 text-right">
                    <span
                      className={
                        row.classicAlarmDay === 'çalmadı'
                          ? 'text-slate-400 italic font-sans'
                          : 'text-blue-600 font-bold'
                      }
                    >
                      {row.classicAlarmDay === 'çalmadı' ? 'Çalmadı' : `Gün ${row.classicAlarmDay}`}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-sans font-semibold text-emerald-700 whitespace-nowrap">
                    {row.leadTime}
                  </td>
                  <td className="px-3 py-2.5 text-right">%{row.deficitAtAiPct}</td>
                  <td className="px-3 py-2.5 text-right">{row.escapedGasAtAiKg} kg</td>
                  <td className="px-3 py-2.5 text-right">{row.escapedGasAtEndKg} kg</td>
                  <td className="px-3 py-2.5 text-right text-slate-400">{row.preLeakFalseAlarms} gün</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Healthy seasonal false-alarm audit */}
      <div className="pt-2 border-t border-slate-100 space-y-2">
        <p className="text-xs text-slate-600 leading-relaxed">
          <strong>Yanlış Alarm Denetimi:</strong> Sağlıklı test serisinde ({HEALTHY_TEST_SUMMARY.days} gün) {HEALTHY_TEST_SUMMARY.redAlarmEvents} yanlış alarm üretilmiştir. Yılın 6 farklı mevsiminden türetilen {totalHealthyDays} günlük ek kontrol setinde yalnızca {totalHealthyAlarms} yanlış kırmızı alarm gerçekleşmiştir (≈ {annualFalseAlarmRate.toFixed(1)} alarm/yıl/dolap).
        </p>

        <div>
          <button
            type="button"
            onClick={() => setShowHealthyTable(!showHealthyTable)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
          >
            <Table className="w-3.5 h-3.5" />
            <span>
              {showHealthyTable
                ? '6 Farklı Mevsim Yanlış Alarm Detaylarını Gizle'
                : '6 Farklı Mevsim Yanlış Alarm Detaylarını Göster (results_healthy.csv)'}
            </span>
            {showHealthyTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showHealthyTable && (
            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2">Başlangıç Tarihi</th>
                    <th className="px-3 py-2 text-right">İzlenen Gün</th>
                    <th className="px-3 py-2 text-right">Sarı Gün (İzleniyor)</th>
                    <th className="px-3 py-2 text-right">Kırmızı Gün</th>
                    <th className="px-3 py-2 text-right">Ayrı Kırmızı Alarm Sayısı</th>
                    <th className="px-3 py-2">Klasik Alarm</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                  {HEALTHY_EXTRA_RESULTS.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-sans font-medium">{r.startDate}</td>
                      <td className="px-3 py-2 text-right">{r.days}</td>
                      <td className="px-3 py-2 text-right text-amber-600">{r.yellowDays}</td>
                      <td className="px-3 py-2 text-right text-rose-600 font-bold">{r.redDays}</td>
                      <td className="px-3 py-2 text-right">{r.redAlarmEvents}</td>
                      <td className="px-3 py-2 text-slate-500 font-sans">{r.classicAlarm}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100/70 font-semibold font-mono">
                    <td className="px-3 py-2 font-sans">Toplam</td>
                    <td className="px-3 py-2 text-right">{totalHealthyDays} gün</td>
                    <td className="px-3 py-2 text-right text-amber-600">
                      {HEALTHY_EXTRA_RESULTS.reduce((a, b) => a + b.yellowDays, 0)}
                    </td>
                    <td className="px-3 py-2 text-right text-rose-600">
                      {HEALTHY_EXTRA_RESULTS.reduce((a, b) => a + b.redDays, 0)}
                    </td>
                    <td className="px-3 py-2 text-right text-rose-700 font-bold">{totalHealthyAlarms}</td>
                    <td className="px-3 py-2 text-emerald-700 font-sans flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> 0 klasik hata
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
