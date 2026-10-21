import React from 'react';
import { Layers, ShieldCheck, AlertCircle } from 'lucide-react';
import { ScenarioKey, SCENARIO_DEFINITIONS } from '../data/scenarios';

interface ScenarioSelectorProps {
  currentScenarioKey: ScenarioKey;
  onScenarioChange: (key: ScenarioKey) => void;
  isInferring: boolean;
}

export const ScenarioSelector: React.FC<ScenarioSelectorProps> = ({
  currentScenarioKey,
  onScenarioChange,
  isInferring,
}) => {
  const scenarioKeys: ScenarioKey[] = ['test_healthy', 'leak_05', 'leak_10', 'leak_20', 'leak_40'];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-600" />
          <h2 className="text-sm sm:text-base font-bold text-slate-900">
            Kaçak Senaryosu Seçimi
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          {isInferring ? (
            <span className="text-blue-600 font-medium animate-pulse flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
              Autoencoder çıkarımı yapılıyor...
            </span>
          ) : (
            <span className="text-emerald-700 font-medium flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Doğrulanmış Model Aktif (Eşik: 0.3881)
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        {scenarioKeys.map((key) => {
          const sc = SCENARIO_DEFINITIONS[key];
          const isSelected = currentScenarioKey === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onScenarioChange(key)}
              className={`text-left p-3 rounded-xl border transition-all flex flex-col justify-between ${
                isSelected
                  ? 'bg-blue-50/90 border-blue-600 ring-2 ring-blue-600/20 shadow-xs'
                  : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100/80 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider ${
                      isSelected ? 'text-blue-800' : 'text-slate-600'
                    }`}
                  >
                    {sc.shortLabel}
                  </span>
                  {sc.lossPct > 0 ? (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                        isSelected ? 'bg-blue-200/80 text-blue-900' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      -%{sc.lossPct}
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">
                      %100 Şarj
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                  {sc.description}
                </p>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>{sc.days} Gün</span>
                {sc.leak_start_day && <span>Kaçak: Gün {sc.leak_start_day}</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
