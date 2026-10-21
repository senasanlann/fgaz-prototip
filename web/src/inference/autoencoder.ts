import modelArtifactData from '../data/model_artifact.json';

export interface ModelArtifact {
  features: string[];
  context_features: string[];
  leak_signs: Record<string, number>;
  threshold: number;
  smooth_days: number;
  red_after_days: number;
  scaler: {
    mean: number[];
    scale: number[];
    var: number[];
  };
  mlp: {
    layer_sizes: number[];
    coefs: number[][][]; // [layer_idx][in_dim][out_dim]
    intercepts: number[][]; // [layer_idx][out_dim]
    activation: string;
    out_activation: string;
  };
}

export const modelArtifact: ModelArtifact = modelArtifactData as ModelArtifact;

export const FEATURE_LABELS: Record<string, string> = {
  p_suction: 'Emme basıncı (bar)',
  superheat: 'Kızgınlık (K)',
  duty: 'Kompresör çalışma oranı',
  kwh: 'Enerji (kWh / 6 saat)',
  t_cab_mean: 'Kabin ort. sıcaklık (°C)',
  t_cab_max: 'Kabin maks. sıcaklık (°C)',
  t_amb: 'Dış hava (°C)',
  hour_sin: 'Saat (sin)',
  hour_cos: 'Saat (cos)',
  weekend: 'Hafta sonu',
};

export interface WindowFeatureInput {
  timestamp: string;
  features: Record<string, number>;
}

export interface WindowInferenceResult {
  timestamp: string;
  rawInput: number[];
  scaledInput: number[];
  scaledReconstructed: number[];
  expectedOutput: number[];
  sqErrors: Record<string, number>; // only for monitored features
  windowMse: number;
}

export interface DailyInferenceResult {
  day: number;
  score_raw: number;
  score: number | null; // 3-day smoothed
  status: 'yeşil' | 'sarı' | 'kırmızı' | 'veri yetersiz';
  streak: number;
  top1: string;
  top1_diff: number;
  top2: string;
  top2_diff: number;
  explanation: string;
}

/**
 * Standard Scaler transform: (x - mean) / scale
 */
export function scaleFeatures(rawFeatures: number[], artifact: ModelArtifact = modelArtifact): number[] {
  const { mean, scale } = artifact.scaler;
  return rawFeatures.map((val, idx) => (val - mean[idx]) / scale[idx]);
}

/**
 * Standard Scaler inverse transform: x_scaled * scale + mean
 */
export function inverseScaleFeatures(scaledFeatures: number[], artifact: ModelArtifact = modelArtifact): number[] {
  const { mean, scale } = artifact.scaler;
  return scaledFeatures.map((val, idx) => val * scale[idx] + mean[idx]);
}

/**
 * MLP Forward Pass matching scikit-learn MLPRegressor:
 * architecture: 10 -> 16 (tanh) -> 4 (tanh) -> 16 (tanh) -> 10 (identity)
 */
export function forwardMLP(scaledInput: number[], artifact: ModelArtifact = modelArtifact): number[] {
  const { coefs, intercepts } = artifact.mlp;
  let current = scaledInput;

  // 3 hidden layers with tanh activation
  for (let l = 0; l < coefs.length - 1; l++) {
    const W = coefs[l];
    const b = intercepts[l];
    const outDim = b.length;
    const nextLayer = new Array<number>(outDim);

    for (let j = 0; j < outDim; j++) {
      let sum = b[j];
      for (let i = 0; i < current.length; i++) {
        sum += current[i] * W[i][j];
      }
      nextLayer[j] = Math.tanh(sum);
    }
    current = nextLayer;
  }

  // Output layer (linear / identity for MLPRegressor)
  const lastIdx = coefs.length - 1;
  const W_out = coefs[lastIdx];
  const b_out = intercepts[lastIdx];
  const outDim = b_out.length;
  const output = new Array<number>(outDim);

  for (let j = 0; j < outDim; j++) {
    let sum = b_out[j];
    for (let i = 0; i < current.length; i++) {
      sum += current[i] * W_out[i][j];
    }
    output[j] = sum;
  }

  return output;
}

/**
 * Infer a single 6-hour window
 */
export function inferWindow(windowRecord: WindowFeatureInput, artifact: ModelArtifact = modelArtifact): WindowInferenceResult {
  const featureNames = artifact.features;
  const rawInput = featureNames.map((name) => windowRecord.features[name] ?? 0);
  const scaledInput = scaleFeatures(rawInput, artifact);
  const scaledReconstructed = forwardMLP(scaledInput, artifact);
  const expectedOutput = inverseScaleFeatures(scaledReconstructed, artifact);

  const sqErrors: Record<string, number> = {};
  let monitoredSqSum = 0;
  let monitoredCount = 0;

  for (let i = 0; i < featureNames.length; i++) {
    const fname = featureNames[i];
    const sign = artifact.leak_signs[fname];
    if (sign !== undefined) {
      // Directional residual error in scaled space:
      // resid = X - X_hat
      // sq_err = clip(resid * sign, lower=0) ** 2
      const resid = scaledInput[i] - scaledReconstructed[i];
      const directionalResid = Math.max(0, resid * sign);
      const sq = directionalResid * directionalResid;
      sqErrors[fname] = sq;
      monitoredSqSum += sq;
      monitoredCount++;
    }
  }

  const windowMse = monitoredCount > 0 ? monitoredSqSum / monitoredCount : 0;

  return {
    timestamp: windowRecord.timestamp,
    rawInput,
    scaledInput,
    scaledReconstructed,
    expectedOutput,
    sqErrors,
    windowMse,
  };
}

/**
 * Full inference and anomaly decision logic across a sequence of windows for a scenario
 */
export function runAutoencoderInference(
  windows: WindowFeatureInput[],
  totalDays: number,
  artifact: ModelArtifact = modelArtifact
): DailyInferenceResult[] {
  const windowResults = windows.map((w) => inferWindow(w, artifact));

  // Windows per day is 4 (24 hours / 6h = 4)
  const windowsPerDay = 4;
  const numDays = Math.min(totalDays, Math.floor(windowResults.length / windowsPerDay));

  const rawDailyScores: number[] = [];
  const dailyMonitoredContribs: Record<string, number>[] = [];
  const dailyDiffs: Record<string, number>[] = [];

  const monitoredFeatures = Object.keys(artifact.leak_signs);

  for (let day = 0; day < numDays; day++) {
    const dayWindows = windowResults.slice(day * windowsPerDay, (day + 1) * windowsPerDay);
    const dayMse = dayWindows.reduce((acc, w) => acc + w.windowMse, 0) / dayWindows.length;
    rawDailyScores.push(dayMse);

    // Feature contributions (mean sq error across day windows)
    const dayContrib: Record<string, number> = {};
    const dayDiff: Record<string, number> = {};

    for (const f of monitoredFeatures) {
      const fIdx = artifact.features.indexOf(f);
      dayContrib[f] = dayWindows.reduce((acc, w) => acc + w.sqErrors[f], 0) / dayWindows.length;
      dayDiff[f] = dayWindows.reduce((acc, w) => acc + (w.rawInput[fIdx] - w.expectedOutput[fIdx]), 0) / dayWindows.length;
    }

    dailyMonitoredContribs.push(dayContrib);
    dailyDiffs.push(dayDiff);
  }

  // 3-day smoothing and consecutive streak state machine
  const dailyResults: DailyInferenceResult[] = [];
  let streak = 0;

  for (let day = 0; day < numDays; day++) {
    let smoothedScore: number | null = null;
    let status: 'yeşil' | 'sarı' | 'kırmızı' | 'veri yetersiz' = 'yeşil';

    if (day < artifact.smooth_days - 1) {
      // First 2 days: score is null
      smoothedScore = null;
      status = 'veri yetersiz';
      streak = 0;
    } else {
      // 3-day rolling mean
      const s0 = rawDailyScores[day];
      const s1 = rawDailyScores[day - 1];
      const s2 = rawDailyScores[day - 2];
      smoothedScore = (s0 + s1 + s2) / 3.0;

      if (smoothedScore > artifact.threshold) {
        streak += 1;
      } else {
        streak = 0;
      }

      if (streak >= artifact.red_after_days) {
        status = 'kırmızı';
      } else if (streak >= 1) {
        status = 'sarı';
      } else {
        status = 'yeşil';
      }
    }

    // Smoothed feature contributions and diffs for explanation
    const windowStart = Math.max(0, day - artifact.smooth_days + 1);
    const windowLength = day - windowStart + 1;

    const smoothedContrib: Record<string, number> = {};
    const smoothedDiff: Record<string, number> = {};

    for (const f of monitoredFeatures) {
      let sumC = 0;
      let sumD = 0;
      for (let k = windowStart; k <= day; k++) {
        sumC += dailyMonitoredContribs[k][f];
        sumD += dailyDiffs[k][f];
      }
      smoothedContrib[f] = sumC / windowLength;
      smoothedDiff[f] = sumD / windowLength;
    }

    // Sort features by contribution descending
    const sortedFeatures = [...monitoredFeatures].sort((a, b) => smoothedContrib[b] - smoothedContrib[a]);
    const top1 = sortedFeatures[0] || 'duty';
    const top2 = sortedFeatures[1] || 'superheat';
    const top1_diff = smoothedDiff[top1] || 0;
    const top2_diff = smoothedDiff[top2] || 0;

    // Generate root cause explanation
    let explanation = '';
    if (status === 'sarı' || status === 'kırmızı') {
      const parts: string[] = [];
      for (const [feat, diffVal] of [
        [top1, top1_diff] as const,
        [top2, top2_diff] as const,
      ]) {
        const direction = diffVal > 0 ? 'yüksek' : 'düşük';
        if (feat === 'duty') {
          parts.push(`Kompresör beklenenden ${Math.round(Math.abs(diffVal) * 100)} puan daha ${diffVal > 0 ? 'fazla' : 'az'} çalışıyor`);
        } else {
          parts.push(`${FEATURE_LABELS[feat]} beklenenden ${Math.abs(diffVal).toFixed(2)} ${direction}`);
        }
      }
      explanation = parts.join('; ');
    }

    dailyResults.push({
      day,
      score_raw: rawDailyScores[day],
      score: smoothedScore,
      status,
      streak,
      top1,
      top1_diff,
      top2,
      top2_diff,
      explanation,
    });
  }

  return dailyResults;
}
