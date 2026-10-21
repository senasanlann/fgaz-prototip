import fs from 'fs';
import path from 'path';
import { runAutoencoderInference, modelArtifact, WindowFeatureInput } from './autoencoder';

interface ScenarioJsonData {
  name: string;
  days: number;
  seed: number;
  final_deficit: number;
  leak_start_day: number | null;
  classic_alarm_day: number | null;
  windows: WindowFeatureInput[];
  daily: Array<{
    day: number;
    date: string;
    t_cabin_mean: number;
    t_cabin_max: number;
    duty: number;
    p_suction: number;
    superheat: number;
    true_deficit_pct: number;
    py_score_raw: number;
    py_score: number | null;
    py_status: string;
    py_streak: number;
    py_top1: string;
    py_top1_diff: number;
    py_top2: string;
    py_top2_diff: number;
    py_explanation: string;
  }>;
}

export function validateAllScenarios() {
  const dataPath = path.resolve(process.cwd(), 'src/data/scenarios_data.json');
  if (!fs.existsSync(dataPath)) {
    console.error('ERROR: scenarios_data.json not found!');
    process.exit(1);
  }

  const raw = fs.readFileSync(dataPath, 'utf-8');
  const scenariosData: Record<string, ScenarioJsonData> = JSON.parse(raw);

  console.log('================================================================');
  console.log('  AUTOENCODER INFERENCE VALIDATION: TYPESCRIPT vs PYTHON');
  console.log('================================================================');
  console.log(`Model Threshold: ${modelArtifact.threshold.toFixed(6)}`);
  console.log(`Features (${modelArtifact.features.length}): ${modelArtifact.features.join(', ')}`);
  console.log(`Architecture: ${modelArtifact.mlp.layer_sizes.join(' -> ')}`);
  console.log('----------------------------------------------------------------\n');

  let overallMaxRawError = 0;
  let overallMaxSmoothError = 0;
  let allStatusesMatch = true;
  let allAlarmDaysMatch = true;

  const summaryRows: Array<{
    scenario: string;
    days: number;
    maxRawErr: number;
    maxSmoothErr: number;
    tsFirstRed: number | string;
    pyFirstRed: number | string;
    alarmMatch: boolean;
    statusMatchCount: string;
  }> = [];

  for (const [name, scData] of Object.entries(scenariosData)) {
    const tsResults = runAutoencoderInference(scData.windows, scData.days, modelArtifact);

    let maxRawErr = 0;
    let maxSmoothErr = 0;
    let matchingStatusCount = 0;

    let tsFirstRedDay: number | null = null;
    let pyFirstRedDay: number | null = null;

    for (let d = 0; d < tsResults.length; d++) {
      const ts = tsResults[d];
      const py = scData.daily[d];

      // Raw score comparison
      const rawDiff = Math.abs(ts.score_raw - py.py_score_raw);
      if (rawDiff > maxRawErr) maxRawErr = rawDiff;

      // Smoothed score comparison
      if (ts.score !== null && py.py_score !== null) {
        const smoothDiff = Math.abs(ts.score - py.py_score);
        if (smoothDiff > maxSmoothErr) maxSmoothErr = smoothDiff;
      }

      // Status match
      if (ts.status === py.py_status && ts.streak === py.py_streak) {
        matchingStatusCount++;
      } else {
        allStatusesMatch = false;
        console.warn(`[MISMATCH] ${name} Day ${d}: TS status=${ts.status} (streak ${ts.streak}) vs PY status=${py.py_status} (streak ${py.py_streak})`);
      }

      // First red day tracking
      if (ts.status === 'kırmızı' && tsFirstRedDay === null) {
        tsFirstRedDay = d;
      }
      if (py.py_status === 'kırmızı' && pyFirstRedDay === null) {
        pyFirstRedDay = d;
      }
    }

    if (maxRawErr > overallMaxRawError) overallMaxRawError = maxRawErr;
    if (maxSmoothErr > overallMaxSmoothError) overallMaxSmoothError = maxSmoothErr;

    const alarmMatch = tsFirstRedDay === pyFirstRedDay;
    if (!alarmMatch) allAlarmDaysMatch = false;

    summaryRows.push({
      scenario: name,
      days: tsResults.length,
      maxRawErr,
      maxSmoothErr,
      tsFirstRed: tsFirstRedDay !== null ? tsFirstRedDay : 'None',
      pyFirstRed: pyFirstRedDay !== null ? pyFirstRedDay : 'None',
      alarmMatch,
      statusMatchCount: `${matchingStatusCount}/${tsResults.length}`,
    });
  }

  // Print formatted comparison table
  console.table(
    summaryRows.map((r) => ({
      Senaryo: r.scenario,
      Günler: r.days,
      'Max Ham Skor Farkı': r.maxRawErr.toExponential(4),
      'Max 3G Skor Farkı': r.maxSmoothErr.toExponential(4),
      'TS İlk Kırmızı': r.tsFirstRed,
      'PY İlk Kırmızı': r.pyFirstRed,
      'Alarm Eşleşti': r.alarmMatch ? '✓ EVET' : '✗ HAYIR',
      'Durum Eşleşmesi': r.statusMatchCount,
    }))
  );

  console.log('\n----------------------------------------------------------------');
  console.log(`Overall Max Raw Score Error   : ${overallMaxRawError.toExponential(4)}`);
  console.log(`Overall Max Smoothed Score Err: ${overallMaxSmoothError.toExponential(4)}`);
  console.log(`All Scenarios Alarm Match     : ${allAlarmDaysMatch ? 'SUCCESS (100% IDENTICAL)' : 'FAILED'}`);
  console.log(`All Daily Statuses Match      : ${allStatusesMatch ? 'SUCCESS (100% IDENTICAL)' : 'FAILED'}`);
  console.log('================================================================\n');

  if (allAlarmDaysMatch && allStatusesMatch && overallMaxSmoothError < 1e-4) {
    console.log('>>> VALIDATION PASSED: TypeScript Autoencoder is numerically identical to Python reference!');
    return true;
  } else {
    console.error('>>> VALIDATION FAILED!');
    process.exit(1);
  }
}

validateAllScenarios();
