export type ScenarioKey =
  | 'test_healthy'
  | 'leak_05'
  | 'leak_10'
  | 'leak_20'
  | 'leak_40';

export type StatusType = 'yeşil' | 'sarı' | 'kırmızı' | 'veri yetersiz';

export interface DailyTelemetryPoint {
  day: number;
  date: string;
  t_cabin_mean: number;
  t_cabin_max: number;
  duty: number; // 0 to 1 (fraction)
  p_suction: number; // bar
  superheat: number; // K
  score: number | null; // smoothed score
  score_raw: number;
  status: StatusType;
  streak: number;
  true_deficit_pct: number;
  explanation: string;
  excess_kwh: number; // incremental excess kWh compared to healthy
}

export interface ScenarioInfo {
  id: ScenarioKey;
  label: string;
  shortLabel: string;
  days: number;
  leakStartDay: number | null;
  aiDay: number | null;
  classicDay: number | null;
  finalDeficitPct: number;
  excessKwhTotal: number;
  daily: DailyTelemetryPoint[];
}

export interface Assumptions {
  charge_kg: number;
  elec_price_tl_per_kWh: number;
  gas_price_tl_per_kg: number;
  grid_ef_kg_per_kWh: number;
  gwp_r404a: number;
}

export interface ImpactResult {
  savedGasKg: number;
  preventedTco2eGas: number;
  preventedTco2eElec: number;
  preventedTco2eTotal: number;
  savedKwh: number;
  savingsTl: number;
  isLowerBound: boolean;
  refDay: number;
  aiDay: number;
}

export interface BenchmarkResult {
  senaryo: string;
  deficitPct: number;
  leakStartDay: number;
  aiFirstRedDay: number | string;
  classicAlarmDay: number | string;
  leadTime: string;
  deficitAtAiPct: number | string;
  escapedGasAtAiKg: number | string;
  escapedGasAtEndKg: number;
  preLeakFalseAlarms: number;
}

export interface HealthyCheckResult {
  startDate: string;
  days: number;
  yellowDays: number;
  redDays: number;
  redAlarmEvents: number;
  classicAlarm: string;
}
