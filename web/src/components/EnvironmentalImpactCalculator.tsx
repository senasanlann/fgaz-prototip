import React from 'react';
import { Leaf, Zap, DollarSign, Wind, Info, RefreshCw, Scale, Globe, Flame } from 'lucide-react';
import { ProcessedScenarioData } from '../data/scenarios';
import {
  EnvironmentalAssumptions,
  DEFAULT_ASSUMPTIONS,
  computeEnvironmentalImpact,
} from '../utils/impact';

interface EnvironmentalImpactCalculatorProps {
  scenarioData: ProcessedScenarioData;
  assumptions: EnvironmentalAssumptions;
  onAssumptionsChange: (assumptions: EnvironmentalAssumptions) => void;
}

export const EnvironmentalImpactCalculator: React.FC<EnvironmentalImpactCalculatorProps> = ({
  scenarioData,
  assumptions,
  onAssumptionsChange,
}) => {
  const isHealthy = scenarioData.definition.key === 'test_healthy';
  const aiDay = scenarioData.aiDetectionDay;
  const classicDay = scenarioData.conventionalAlarmDay;
  const totalDays = scenarioData.definition.days;
  const baselineExcessKwh = scenarioData.definition.baselineExcessKwh;

  const aiPoint = aiDay !== null ? scenarioData.telemetryDaily[aiDay] : null;
  const refDay = classicDay !== null ? classicDay : totalDays - 1;
  const refPoint = scenarioData.telemetryDaily[refDay];

  const deficitAi = aiPoint ? aiPoint.true_deficit_pct : 0;
  const deficitRef = refPoint ? refPoint.true_deficit_pct : 0;

  const impact = computeEnvironmentalImpact(
    aiDay,
    classicDay,
    totalDays,
    deficitAi,
    deficitRef,
    baselineExcessKwh,
    assumptions
  );

  const handleNumberChange = (key: keyof EnvironmentalAssumptions, val: number) => {
    onAssumptionsChange({
      ...assumptions,
      [key]: val,
    });
  };

  const handleReset = () => {
    onAssumptionsChange({ ...DEFAULT_ASSUMPTIONS });
  };

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌍</span>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            Çevresel ve Ekonomik Etki Hesaplayıcısı
          </h2>
        </div>
        <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
          Varsayımsal Simülasyon Tahmini (Doğrulanmalı)
        </span>
      </div>

      {/* Assumptions parameter inputs toolbar */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Hesaplama Parametreleri ve Fiyat Varsayımları
          </h3>
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Varsayılanlara Sıfırla</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Charge kg */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-1">
              <Scale className="w-3.5 h-3.5 text-slate-400" />
              Sistem Gaz Şarjı (kg)
            </label>
            <div className="relative">
              <input
                type="number"
                min={1.0}
                max={500.0}
                step={5.0}
                value={assumptions.charge_kg}
                onChange={(e) => handleNumberChange('charge_kg', parseFloat(e.target.value) || 1)}
                className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">kg</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Market merkezi sistemi için tipik mertebe</span>
          </div>

          {/* Electricity price */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-1">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              Elektrik Fiyatı (TL/kWh)
            </label>
            <div className="relative">
              <input
                type="number"
                min={0.0}
                max={50.0}
                step={0.5}
                value={assumptions.elec_price_tl_per_kWh}
                onChange={(e) => handleNumberChange('elec_price_tl_per_kWh', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">TL</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Ticari tarife (EPDK referans)</span>
          </div>

          {/* Gas price */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-1">
              <Flame className="w-3.5 h-3.5 text-rose-500" />
              R-404A Dolum Fiyatı (TL/kg)
            </label>
            <div className="relative">
              <input
                type="number"
                min={0.0}
                max={20000.0}
                step={100.0}
                value={assumptions.gas_price_tl_per_kg}
                onChange={(e) => handleNumberChange('gas_price_tl_per_kg', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">TL</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">F-gaz kota kısıtı nedeniyle değişken</span>
          </div>

          {/* Grid EF */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-1">
              <Globe className="w-3.5 h-3.5 text-emerald-500" />
              Şebeke Emisyon Faktörü
            </label>
            <div className="relative">
              <input
                type="number"
                min={0.0}
                max={1.5}
                step={0.01}
                value={assumptions.grid_ef_kg_per_kWh}
                onChange={(e) => handleNumberChange('grid_ef_kg_per_kWh', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">kg/kWh</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Türkiye elektrik şebekesi ortalaması</span>
          </div>
        </div>

        <div className="mt-2.5 pt-2 border-t border-slate-200/60 text-[11px] text-slate-500">
          <strong>GWP R-404A = {assumptions.gwp_r404a}</strong> (IPCC AR4, 100 yıllık küresel ısınma potansiyeli; AB 517/2014 F-Gaz Tüzüğü resmi değeri).
        </div>
      </div>

      {/* Impact Metric Cards */}
      {isHealthy || !impact ? (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-sm flex items-center gap-2.5">
          <Info className="w-5 h-5 text-slate-400 shrink-0" />
          <span>
            {isHealthy
              ? 'Sağlıklı sistem senaryosunda gaz kaçağı bulunmamaktadır; kurtarılan gaz veya enerji tasarrufu hesaplanmaz.'
              : 'Bu senaryoda henüz anomali eşiği aşılmadığı için erken müdahale tasarrufu hesaplanamaz.'}
          </span>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Kurtarılan Gaz */}
            <div className="bg-gradient-to-br from-blue-50 to-white p-4 rounded-xl border border-blue-200 flex flex-col justify-between shadow-2xs">
              <div className="flex items-center justify-between text-slate-600 text-xs font-semibold">
                <span>Kurtarılan Soğutucu Gaz</span>
                <Wind className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-3xl font-black text-blue-900 tracking-tight my-2 font-mono">
                {impact.savedGasKg.toFixed(2)}{' '}
                <span className="text-sm font-bold text-blue-600">kg</span>
              </div>
              <span className="text-[11px] text-slate-500">
                Şarj: {assumptions.charge_kg} kg · Δ%{(impact.deficitRefPct - impact.deficitAiPct).toFixed(1)} kaçak farkı
              </span>
            </div>

            {/* KPI 2: Önlenen Emisyon */}
            <div className="bg-gradient-to-br from-emerald-50 to-white p-4 rounded-xl border border-emerald-200 flex flex-col justify-between shadow-2xs">
              <div className="flex items-center justify-between text-slate-600 text-xs font-semibold">
                <span>Önlenen Sera Gazı Emisyonu</span>
                <Leaf className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-3xl font-black text-emerald-900 tracking-tight my-2 font-mono">
                {impact.preventedTco2eTotal.toFixed(2)}{' '}
                <span className="text-sm font-bold text-emerald-600">tCO2e</span>
              </div>
              <div className="text-[11px] text-slate-500 flex justify-between">
                <span>Gaz Kaçağı: {impact.preventedTco2eGas.toFixed(2)} t</span>
                <span>Elektrik: {impact.preventedTco2eElec.toFixed(2)} t</span>
              </div>
            </div>

            {/* KPI 3: Kurtarılan Enerji */}
            <div className="bg-gradient-to-br from-amber-50 to-white p-4 rounded-xl border border-amber-200 flex flex-col justify-between shadow-2xs">
              <div className="flex items-center justify-between text-slate-600 text-xs font-semibold">
                <span>Kurtarılan Elektrik Enerjisi</span>
                <Zap className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-3xl font-black text-amber-900 tracking-tight my-2 font-mono">
                {impact.savedKwh.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}{' '}
                <span className="text-sm font-bold text-amber-600">kWh</span>
              </div>
              <span className="text-[11px] text-slate-500">
                Kompresörün aşırı çalışma süresi farkı
              </span>
            </div>

            {/* KPI 4: Finansal Tasarruf */}
            <div className="bg-gradient-to-br from-violet-50 to-white p-4 rounded-xl border border-violet-200 flex flex-col justify-between shadow-2xs">
              <div className="flex items-center justify-between text-slate-600 text-xs font-semibold">
                <span>Tahmini Toplam Tasarruf</span>
                <DollarSign className="w-4 h-4 text-violet-600" />
              </div>
              <div className="text-3xl font-black text-violet-900 tracking-tight my-2 font-mono">
                {impact.savingsTl.toLocaleString('tr-TR')}{' '}
                <span className="text-sm font-bold text-violet-600">TL</span>
              </div>
              <span className="text-[11px] text-slate-500">
                Gaz dolumu + elektrik faturası tasarrufu
              </span>
            </div>
          </div>

          {/* Transparent calculation caveat box */}
          <div className="p-3.5 rounded-lg bg-amber-50/60 border border-amber-200 text-xs text-amber-950 leading-relaxed">
            <span className="font-bold block mb-1">
              ⚠️ Şartlı Simülasyon Hesabı ve Doğrulama Notu:
            </span>
            {impact.isLowerBound && (
              <span className="font-semibold">
                Klasik sıcaklık alarmı simülasyon boyunca hiç çalmadığı için hesaplama simülasyon sonuna ({impact.refDay}. gün) kadar yapılmıştır; bu nedenle sonuç bir <u>alt sınırdır</u> (gerçekte kaçak tespit edilene kadar daha fazla gaz kaçardı).{' '}
              </span>
            )}
            Hesaplama, AI tespit günü (Gün {impact.aiDay}) ile klasik alarm/simülasyon sonu (Gün {impact.refDay}) arasında kaçağın uyarının ardından hemen onarıldığı varsayımına dayanır. kWh tek dolap için hesaplanmıştır; gaz miktarı seçilen sistem şarjına ({assumptions.charge_kg.toFixed(0)} kg) göre orantılanmıştır.
          </div>
        </div>
      )}
    </section>
  );
};
