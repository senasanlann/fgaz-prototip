import React, { useState } from 'react';
import { ProcessedScenarioData } from '../data/scenarios';
import { modelArtifact } from '../inference/autoencoder';

interface InteractiveChartsProps {
  scenarioData: ProcessedScenarioData;
  selectedDay: number;
}

export const InteractiveCharts: React.FC<InteractiveChartsProps> = ({
  scenarioData,
  selectedDay,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const totalDays = scenarioData.definition.days;
  const telemetry = scenarioData.telemetryDaily;
  const inference = scenarioData.inferredDaily;

  // IMPORTANT REQUIREMENT:
  // Data is known up to `selectedDay`.
  // Data after `selectedDay` is rendered with low opacity or hidden to respect timeline causality.
  const activeIndex = hoverIndex !== null && hoverIndex <= selectedDay ? hoverIndex : selectedDay;
  const activeTelem = telemetry[activeIndex] || telemetry[selectedDay];
  const activeInfer = inference[activeIndex] || inference[selectedDay];

  // SVG dimensions
  const width = 880;
  const height = 165;
  const pad = { top: 25, right: 35, bottom: 25, left: 60 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const getX = (d: number) => pad.left + (d / (totalDays - 1)) * plotW;

  // IMPORTANT REQUIREMENT:
  // "Mark leak onset, AI detection, and conventional alarm events, but ONLY reveal events up to the currently selected simulation day."
  const events: Array<{ day: number; label: string; color: string }> = [];

  if (scenarioData.definition.leak_start_day !== null && scenarioData.definition.leak_start_day <= selectedDay) {
    events.push({
      day: scenarioData.definition.leak_start_day,
      label: 'kaçak başladı (gerçek)',
      color: '#64748b',
    });
  }

  if (scenarioData.aiDetectionDay !== null && scenarioData.aiDetectionDay <= selectedDay) {
    events.push({
      day: scenarioData.aiDetectionDay,
      label: 'AI tespiti',
      color: '#dc2626',
    });
  }

  if (scenarioData.conventionalAlarmDay !== null && scenarioData.conventionalAlarmDay <= selectedDay) {
    events.push({
      day: scenarioData.conventionalAlarmDay,
      label: 'klasik alarm (7°C)',
      color: '#2563eb',
    });
  }

  // Crosshair mouse tracker
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const normX = (mouseX - pad.left) / plotW;
    const targetDay = Math.round(normX * (totalDays - 1));
    if (targetDay >= 0 && targetDay < totalDays) {
      setHoverIndex(targetDay);
    }
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  // Subplot 1: Cabinet Temperature (°C) [2 to 11]
  const tMin = 2.0;
  const tMax = 11.0;
  const getYTemp = (val: number) => pad.top + plotH - ((val - tMin) / (tMax - tMin)) * plotH;

  const pathTempMaxObserved = telemetry
    .slice(0, selectedDay + 1)
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.day)} ${getYTemp(p.t_cabin_max)}`)
    .join(' ');
  const pathTempMeanObserved = telemetry
    .slice(0, selectedDay + 1)
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.day)} ${getYTemp(p.t_cabin_mean)}`)
    .join(' ');

  // Subplot 2: Duty Cycle (%) [0 to 100%]
  const getYDuty = (duty: number) => pad.top + plotH - (duty / 1.0) * plotH;
  const pathDutyObserved = telemetry
    .slice(0, selectedDay + 1)
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.day)} ${getYDuty(p.duty)}`)
    .join(' ');

  // Subplot 3: Suction Pressure (bar) [1.8 to 5.2]
  const pMin = 1.8;
  const pMax = 5.2;
  const getYPress = (p: number) => pad.top + plotH - ((p - pMin) / (pMax - pMin)) * plotH;
  const pathPressObserved = telemetry
    .slice(0, selectedDay + 1)
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.day)} ${getYPress(p.p_suction)}`)
    .join(' ');

  // Subplot 4: Anomaly Score (log scale) [0.01 to 2.5]
  const logMin = Math.log10(0.01);
  const logMax = Math.log10(2.5);
  const getYScore = (s: number | null) => {
    if (s === null || s <= 0.005) return pad.top + plotH;
    const l = Math.log10(Math.max(0.01, s));
    const clamped = Math.max(logMin, Math.min(logMax, l));
    return pad.top + plotH - ((clamped - logMin) / (logMax - logMin)) * plotH;
  };

  const validScorePoints = inference.slice(0, selectedDay + 1).filter((p) => p.score !== null);
  const pathScoreObserved = validScorePoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.day)} ${getYScore(p.score)}`)
    .join(' ');

  const renderGridAndMilestones = () => (
    <>
      {/* Background horizontal borders */}
      <line x1={pad.left} y1={pad.top + plotH} x2={pad.left + plotW} y2={pad.top + plotH} stroke="#e2e8f0" strokeWidth="1" />
      <line x1={pad.left} y1={pad.top} x2={pad.left + plotW} y2={pad.top} stroke="#f1f5f9" strokeWidth="1" />

      {/* Vertical Milestone lines (Only up to selectedDay!) */}
      {events.map((e, idx) => (
        <g key={idx}>
          <line
            x1={getX(e.day)}
            y1={pad.top - 8}
            x2={getX(e.day)}
            y2={pad.top + plotH}
            stroke={e.color}
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <text
            x={getX(e.day) + 3}
            y={pad.top - 2}
            fill={e.color}
            fontSize="10"
            fontWeight="bold"
            fontFamily="sans-serif"
          >
            {e.label}
          </text>
        </g>
      ))}

      {/* Current Day vertical scrubber line */}
      <line
        x1={getX(selectedDay)}
        y1={pad.top}
        x2={getX(selectedDay)}
        y2={pad.top + plotH}
        stroke="#3b82f6"
        strokeWidth="1.5"
        strokeDasharray="3 2"
      />

      {/* Hover line */}
      {hoverIndex !== null && hoverIndex <= selectedDay && (
        <line
          x1={getX(hoverIndex)}
          y1={pad.top}
          x2={getX(hoverIndex)}
          y2={pad.top + plotH}
          stroke="#0f172a"
          strokeWidth="1"
          opacity="0.4"
        />
      )}
    </>
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-6 space-y-6">
      {/* Live hover crosshair status readout */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800">
            İncelenen Nokta: Gün {activeTelem.day} ({activeTelem.date})
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
              activeInfer.status === 'kırmızı'
                ? 'bg-rose-100 text-rose-800'
                : activeInfer.status === 'sarı'
                ? 'bg-amber-100 text-amber-800'
                : activeInfer.status === 'veri yetersiz'
                ? 'bg-slate-100 text-slate-700'
                : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {activeInfer.status.toUpperCase()}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-slate-600">
          <span>Kabin Ort: <strong className="text-blue-700">{activeTelem.t_cabin_mean}°C</strong></span>
          <span>Maks: <strong className="text-sky-600">{activeTelem.t_cabin_max}°C</strong></span>
          <span>Duty: <strong className="text-slate-900">{(activeTelem.duty * 100).toFixed(0)}%</strong></span>
          <span>Basınç: <strong className="text-teal-700">{activeTelem.p_suction} bar</strong></span>
          <span>AI Skor: <strong className="text-slate-900">{activeInfer.score !== null ? activeInfer.score.toFixed(4) : '—'}</strong></span>
        </div>
      </div>

      <div className="space-y-5">
        {/* Subplot 1: Kabin Sıcaklığı (°C) */}
        <div>
          <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1">
            <span>Kabin Sıcaklığı (°C, günlük ort. ve maks.): klasik alarm bunu izler</span>
            <div className="flex items-center gap-3 text-[11px] font-normal text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-1 bg-[#90caf9] inline-block rounded" /> Kabin maks.
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-1 bg-[#1565c0] inline-block rounded" /> Kabin ort.
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <span className="w-2.5 h-0.5 border-t border-dashed border-slate-400 inline-block" /> 7 °C alarm eşiği
              </span>
            </div>
          </div>
          <div className="relative overflow-x-auto">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-auto select-none"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              {renderGridAndMilestones()}

              {/* 7°C Alarm Line */}
              <line
                x1={pad.left}
                y1={getYTemp(7.0)}
                x2={pad.left + plotW}
                y2={getYTemp(7.0)}
                stroke="#64748b"
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />
              <text x={pad.left + 5} y={getYTemp(7.0) + 12} fill="#64748b" fontSize="10" fontFamily="sans-serif">
                klasik alarm eşiği 7 °C
              </text>

              {/* Y Axis ticks */}
              {[4, 7, 10].map((t) => (
                <text key={t} x={pad.left - 8} y={getYTemp(t) + 3} textAnchor="end" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                  {t}°
                </text>
              ))}

              {/* Observed curves up to selected day */}
              <path d={pathTempMaxObserved} fill="none" stroke="#90caf9" strokeWidth="1.6" />
              <path d={pathTempMeanObserved} fill="none" stroke="#1565c0" strokeWidth="2.2" />

              {/* Active dots */}
              <circle cx={getX(activeTelem.day)} cy={getYTemp(activeTelem.t_cabin_mean)} r="3.5" fill="#1565c0" />
              <circle cx={getX(activeTelem.day)} cy={getYTemp(activeTelem.t_cabin_max)} r="3" fill="#90caf9" />
            </svg>
          </div>
        </div>

        {/* Subplot 2: Kompresör Çalışma Oranı (%) */}
        <div>
          <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1">
            <span>Kompresör Çalışma Oranı (%, günlük)</span>
            <span className="text-[11px] text-slate-400 font-normal">Kapasite düştükçe kabini soğutmak için çalışma süresi artar</span>
          </div>
          <div className="relative overflow-x-auto">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-auto select-none"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              {renderGridAndMilestones()}

              {/* 100% duty line */}
              <line x1={pad.left} y1={getYDuty(1.0)} x2={pad.left + plotW} y2={getYDuty(1.0)} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="2 2" />

              {/* Y Axis ticks */}
              {[20, 50, 80, 100].map((d) => (
                <text key={d} x={pad.left - 8} y={getYDuty(d / 100) + 3} textAnchor="end" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                  %{d}
                </text>
              ))}

              {/* Curve */}
              <path d={pathDutyObserved} fill="none" stroke="#2563eb" strokeWidth="2.2" />
              <circle cx={getX(activeTelem.day)} cy={getYDuty(activeTelem.duty)} r="3.5" fill="#2563eb" />
            </svg>
          </div>
        </div>

        {/* Subplot 3: Emme Basıncı (bar) */}
        <div>
          <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1">
            <span>Emme Basıncı (bar, çalışırken, günlük)</span>
            <span className="text-[11px] text-slate-400 font-normal">Soğutucu akışkan azaldıkça buharlaşma sıcaklığı ve emme basıncı düşer</span>
          </div>
          <div className="relative overflow-x-auto">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-auto select-none"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              {renderGridAndMilestones()}

              {/* Y Axis ticks */}
              {[2.5, 3.5, 4.5].map((p) => (
                <text key={p} x={pad.left - 8} y={getYPress(p) + 3} textAnchor="end" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                  {p.toFixed(1)}
                </text>
              ))}

              {/* Curve */}
              <path d={pathPressObserved} fill="none" stroke="#0d9488" strokeWidth="2.2" />
              <circle cx={getX(activeTelem.day)} cy={getYPress(activeTelem.p_suction)} r="3.5" fill="#0d9488" />
            </svg>
          </div>
        </div>

        {/* Subplot 4: AI Anomali Skoru (Logaritmik Ölçek) */}
        <div>
          <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1">
            <span>AI Anomali Skoru (3 günlük ortalama) ve Model Eşiği</span>
            <div className="flex items-center gap-2 text-[11px] font-normal text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-1 bg-slate-900 inline-block rounded" /> Autoencoder Skoru
              </span>
              <span className="flex items-center gap-1 text-rose-600 font-medium">
                <span className="w-2.5 h-0.5 border-t-2 border-dashed border-rose-600 inline-block" /> Eşik ({modelArtifact.threshold.toFixed(4)})
              </span>
            </div>
          </div>
          <div className="relative overflow-x-auto">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-auto select-none"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              {renderGridAndMilestones()}

              {/* Threshold line */}
              <line
                x1={pad.left}
                y1={getYScore(modelArtifact.threshold)}
                x2={pad.left + plotW}
                y2={getYScore(modelArtifact.threshold)}
                stroke="#dc2626"
                strokeWidth="1.8"
                strokeDasharray="5 3"
              />
              <text x={pad.left + 5} y={getYScore(modelArtifact.threshold) - 5} fill="#dc2626" fontSize="10" fontWeight="bold">
                eşik ({modelArtifact.threshold.toFixed(4)})
              </text>

              {/* Y Axis ticks in log scale */}
              {[0.02, 0.1, 0.5, 2.0].map((v) => (
                <text key={v} x={pad.left - 8} y={getYScore(v) + 3} textAnchor="end" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                  {v}
                </text>
              ))}

              {/* Curve */}
              <path d={pathScoreObserved} fill="none" stroke="#0f172a" strokeWidth="2.2" />
              {activeInfer.score !== null && (
                <circle cx={getX(activeInfer.day)} cy={getYScore(activeInfer.score)} r="4" fill="#0f172a" />
              )}

              {/* X Axis ticks */}
              {[0, 30, 60, 90, 119].filter((d) => d < totalDays).map((d) => (
                <text key={d} x={getX(d)} y={pad.top + plotH + 16} textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                  Gün {d}
                </text>
              ))}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};
