export interface EnvironmentalAssumptions {
  charge_kg: number;
  elec_price_tl_per_kWh: number;
  gas_price_tl_per_kg: number;
  grid_ef_kg_per_kWh: number;
  gwp_r404a: number;
}

export const DEFAULT_ASSUMPTIONS: EnvironmentalAssumptions = {
  charge_kg: 50.0,
  elec_price_tl_per_kWh: 4.0,
  gas_price_tl_per_kg: 1500.0,
  grid_ef_kg_per_kWh: 0.44,
  gwp_r404a: 3922,
};

export interface ImpactCalculationResult {
  savedGasKg: number;
  preventedTco2eGas: number;
  preventedTco2eElec: number;
  preventedTco2eTotal: number;
  savedKwh: number;
  savingsTl: number;
  isLowerBound: boolean;
  aiDay: number;
  refDay: number;
  deficitAiPct: number;
  deficitRefPct: number;
}

export function computeEnvironmentalImpact(
  aiDay: number | null,
  classicDay: number | null,
  totalDays: number,
  deficitAiPct: number,
  deficitRefPct: number,
  baselineExcessKwh: number,
  assumptions: EnvironmentalAssumptions
): ImpactCalculationResult | null {
  if (aiDay === null) {
    return null;
  }

  const isLowerBound = classicDay === null;
  const refDay = isLowerBound ? totalDays - 1 : classicDay;

  // Fraction of deficit (0..1)
  const d_ai = deficitAiPct / 100.0;
  const d_ref = deficitRefPct / 100.0;

  // Kurtarılan gaz = Sistem Şarjı (kg) * (Referans Gün Eksikliği - AI Gün Eksikliği)
  const savedGasKg = Number((assumptions.charge_kg * (d_ref - d_ai)).toFixed(2));

  // Kurtarılan enerji (kWh)
  const savedKwh = Number(baselineExcessKwh.toFixed(1));

  // Önlenen emisyonlar:
  // Gaz: savedGasKg * GWP / 1000
  // Elektrik: savedKwh * grid_ef / 1000
  const preventedTco2eGas = Number(((savedGasKg * assumptions.gwp_r404a) / 1000.0).toFixed(2));
  const preventedTco2eElec = Number(((savedKwh * assumptions.grid_ef_kg_per_kWh) / 1000.0).toFixed(3));
  const preventedTco2eTotal = Number((preventedTco2eGas + preventedTco2eElec).toFixed(2));

  // Parasal Tasarruf (TL)
  const savingsTl = Math.round(
    savedGasKg * assumptions.gas_price_tl_per_kg + savedKwh * assumptions.elec_price_tl_per_kWh
  );

  return {
    savedGasKg,
    preventedTco2eGas,
    preventedTco2eElec,
    preventedTco2eTotal,
    savedKwh,
    savingsTl,
    isLowerBound,
    aiDay,
    refDay,
    deficitAiPct,
    deficitRefPct,
  };
}
