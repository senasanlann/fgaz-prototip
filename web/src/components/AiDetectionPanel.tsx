import React from 'react';
import { AlertTriangle, Clock, Activity, Zap, CheckCircle2 } from 'lucide-react';
import { ProcessedScenarioData } from '../data/scenarios';
import { modelArtifact, FEATURE_LABELS } from '../inference/autoencoder';

interface AiDetectionPanelProps {
  scenarioData: ProcessedScenarioData;
  selectedDay: number;
}

export const AiDetectionPanel: React.FC<AiDetectionPanelProps> = ({
  scenarioData,
  selectedDay,
}) => {
  const currentInference = scenarioData.inferredDaily[selectedDay] || scenarioData.inferredDaily[scenarioData.inferredDaily.length - 1];
  const currentTelemetry = scenarioData.telemetryDaily[selectedDay] || scenarioData.telemetryDaily[scenarioData.telemetryDaily.length - 1];

  const status = currentInference.status;
  const score = currentInference.score;
  const streak = currentInference.streak;
  const threshold = modelArtifact.threshold;

  // Status configuration
  const statusConfig = {
    yeşil: {
      color: '#166534',
      bgGradient: 'from-emerald-700 to-emerald-600',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      title: '🟢 NORMAL',
      text: 'Dolap beklenen termodinamik ve elektriksel parametrelerle çalışıyor.',
    },
    sarı: {
      color: '#b45309',
      bgGradient: 'from-amber-600 to-amber-500',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
      title: '🟡 İZLENİYOR',
      text: 'Beklenenden sapma tespit edildi; anomali kararlılığı için birkaç gün daha izleniyor.',
    },
    kırmızı: {
      color: '#991b1b',
      bgGradient: 'from-rose-700 to-rose-600',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
      title: '🔴 MİKRO-KAÇAK ŞÜPHESİ',
      text: 'Saha kontrolü önerilir: evaporatör ve boru hatlarında teknisyen kaçak testi yapmalıdır.',
    },
    'veri yetersiz': {
      color: '#475569',
      bgGradient: 'from-slate-700 to-slate-600',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
      title: '⚪ VERİ TOPLANIYOR',
      text: 'Model 3 günlük kayan ortalama ile çalıştığı için ilk 2 gün skor üretilmez.',
    },
  }[status];

  // Lead time comparison calculation
  const isHealthy = scenarioData.definition.key === 'test_healthy';
  const aiDay = scenarioData.aiDetectionDay;
  const classicDay = scenarioData.conventionalAlarmDay;
  const totalDays = scenarioData.definition.days;

  let leadTimeText = '—';
  let leadTimeCaption = '';

  if (isHealthy) {
    leadTimeText = '—';
    leadTimeCaption = 'Sağlıklı referans dolapta hiçbir aşamada kaçak uyarısı üretilmedi.';
  } else if (aiDay === null || selectedDay < aiDay) {
    leadTimeText = 'Henüz tespit yok';
    leadTimeCaption = `AI modeli Gün ${selectedDay} itibarıyla henüz eşik üstü 3 günlük kırmızı alarm seviyesine ulaşmadı.`;
  } else {
    // AI has detected at or before selectedDay
    if (classicDay === null) {
      const minAdvantage = totalDays - 1 - aiDay;
      leadTimeText = `≥ ${minAdvantage} gün`;
      leadTimeCaption = `Klasik sıcaklık alarmı 120 gün boyunca hiç çalmadı. AI ${aiDay}. günde yakaladı (simülasyon sonuna göre alt sınır).`;
    } else {
      const adv = classicDay - aiDay;
      leadTimeText = `${adv} gün önce`;
      leadTimeCaption = `AI tespiti: Gün ${aiDay} · Klasik alarm: Gün ${classicDay} (Kabin sıcaklığı ${classicDay}. güne kadar 7°C altında kaldı).`;
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Primary Status & Anomaly Diagnostic Card */}
      <div
        className={`lg:col-span-8 rounded-2xl bg-gradient-to-r ${statusConfig.bgGradient} text-white p-5 sm:p-6 shadow-sm flex flex-col justify-between`}
      >
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium opacity-90 mb-1.5">
            <span>
              GÜN {selectedDay} İNCELEMESİ ({currentTelemetry.date})
            </span>
            <div className="flex items-center gap-2">
              <span className="bg-white/20 px-2 py-0.5 rounded text-[11px] font-mono">
                Eşik: {threshold.toFixed(4)}
              </span>
              {streak > 0 && (
                <span className="bg-white/25 px-2 py-0.5 rounded text-[11px] font-bold">
                  {streak} Gün Eşik Üstü
                </span>
              )}
            </div>
          </div>

          <div className="text-2xl sm:text-3xl font-black tracking-tight mt-1 mb-2">
            {statusConfig.title}
          </div>

          <p className="text-sm sm:text-base leading-relaxed opacity-95">
            {statusConfig.text}
          </p>

          {/* Root-cause explanation */}
          {(status === 'sarı' || status === 'kırmızı') && currentInference.explanation && (
            <div className="mt-3.5 pt-3 border-t border-white/20 text-xs sm:text-sm">
              <span className="font-bold">Neden Şüpheli?</span> {currentInference.explanation}
            </div>
          )}

          {/* Anomaly metrics grid */}
          <div className="mt-4 pt-3 border-t border-white/20 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="opacity-75 block text-[11px]">Hesaplanan Skor</span>
              <span className="font-mono font-bold text-base">
                {score !== null ? score.toFixed(4) : '—'}
              </span>
            </div>
            <div>
              <span className="opacity-75 block text-[11px]">Model Eşiği</span>
              <span className="font-mono font-bold text-base">{threshold.toFixed(4)}</span>
            </div>
            <div>
              <span className="opacity-75 block text-[11px]">1. Şüpheli Özellik</span>
              <span className="font-bold text-xs truncate block">
                {FEATURE_LABELS[currentInference.top1] || currentInference.top1}
              </span>
            </div>
            <div>
              <span className="opacity-75 block text-[11px]">2. Şüpheli Özellik</span>
              <span className="font-bold text-xs truncate block">
                {FEATURE_LABELS[currentInference.top2] || currentInference.top2}
              </span>
            </div>
          </div>
        </div>

        {/* Real unobserved deficit */}
        <div className="mt-4 pt-2.5 border-t border-white/20 text-xs opacity-90 flex items-center justify-between">
          <span>Gerçek (modelin görmediği) eksik soğutucu akışkan:</span>
          <span className="font-mono font-bold text-sm bg-white/20 px-2 py-0.5 rounded">
            %{currentTelemetry.true_deficit_pct.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Early Alert Lead Time Metric Card */}
      <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-600" />
              Erken Uyarı Avantajı
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
              AI vs Klasik
            </span>
          </div>

          <div className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight my-2">
            {leadTimeText}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-600">
          {isHealthy ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          )}
          <p className="leading-relaxed">{leadTimeCaption}</p>
        </div>
      </div>
    </div>
  );
};
