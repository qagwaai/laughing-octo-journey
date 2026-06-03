import type { Sw13bGeneratedVisualSample, Sw13bVisualTier } from './asteroid-visual-generator';

export interface Sw13bVisualMetrics {
  sphericityProxy: number;
  radialVarianceIndex: number;
  curvatureVarianceIndex: number;
  featureDensity: number;
  silhouetteComplexityScore: number;
}

export interface Sw13bVisualGateThresholds {
  rockySphericityMax: number;
  minimumFeatureDensity: number;
  minimumComplexityScore: number;
  heroComplexityDelta: number;
}

export interface Sw13bVisualGateResult {
  passed: boolean;
  reasons: string[];
}

export const SW13B_CONSERVATIVE_VISUAL_THRESHOLDS: Sw13bVisualGateThresholds = {
  rockySphericityMax: 0.9,
  minimumFeatureDensity: 0.14,
  minimumComplexityScore: 0.28,
  heroComplexityDelta: 0.015,
};

function mean(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function variance(values: readonly number[], center: number): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + (value - center) * (value - center), 0) / values.length;
}

function secondDerivativeSeries(values: readonly number[]): number[] {
  if (values.length < 3) {
    return [];
  }

  const results: number[] = [];
  for (let i = 0; i < values.length; i += 1) {
    const prev = values[(i - 1 + values.length) % values.length] ?? values[0] ?? 0;
    const current = values[i] ?? 0;
    const next = values[(i + 1) % values.length] ?? values[values.length - 1] ?? 0;
    results.push(next - 2 * current + prev);
  }

  return results;
}

export function computeSw13bVisualMetrics(sample: Sw13bGeneratedVisualSample): Sw13bVisualMetrics {
  const radialMean = mean(sample.radialProfile);
  const radialVariance = variance(sample.radialProfile, radialMean);
  const radialVarianceIndex = Math.sqrt(Math.max(0, radialVariance));

  const second = secondDerivativeSeries(sample.radialProfile);
  const curvatureVarianceIndex = Math.sqrt(Math.max(0, variance(second, mean(second))));

  const featureDensity = mean(sample.featureMask);

  const curvatureCrossings = second.reduce((count, value, index) => {
    const next = second[(index + 1) % second.length] ?? 0;
    return count + (Math.sign(value) !== Math.sign(next) ? 1 : 0);
  }, 0);
  const crossingRatio = second.length === 0 ? 0 : curvatureCrossings / second.length;

  const silhouetteComplexityScore =
    radialVarianceIndex * 0.9 + curvatureVarianceIndex * 0.6 + crossingRatio * 0.4 + featureDensity * 0.35;

  const sphericityProxy = 1 / (1 + radialVarianceIndex * 8 + curvatureVarianceIndex * 2 + featureDensity * 1.5);

  return {
    sphericityProxy: Number(sphericityProxy.toFixed(6)),
    radialVarianceIndex: Number(radialVarianceIndex.toFixed(6)),
    curvatureVarianceIndex: Number(curvatureVarianceIndex.toFixed(6)),
    featureDensity: Number(featureDensity.toFixed(6)),
    silhouetteComplexityScore: Number(silhouetteComplexityScore.toFixed(6)),
  };
}

export function evaluateSw13bRockyVisualGate(
  metrics: Sw13bVisualMetrics,
  thresholds: Sw13bVisualGateThresholds = SW13B_CONSERVATIVE_VISUAL_THRESHOLDS,
): Sw13bVisualGateResult {
  const reasons: string[] = [];

  if (metrics.sphericityProxy > thresholds.rockySphericityMax) {
    reasons.push('sphericity proxy is too sphere-like');
  }

  if (metrics.featureDensity < thresholds.minimumFeatureDensity) {
    reasons.push('feature density is below rocky threshold');
  }

  if (metrics.silhouetteComplexityScore < thresholds.minimumComplexityScore) {
    reasons.push('silhouette complexity is below rocky threshold');
  }

  return {
    passed: reasons.length === 0,
    reasons,
  };
}

function tierMeanComplexity(samples: readonly Sw13bGeneratedVisualSample[], tier: Sw13bVisualTier): number {
  const scoped = samples.filter((sample) => sample.descriptor.tier === tier);
  if (scoped.length === 0) {
    return 0;
  }

  return mean(scoped.map((sample) => computeSw13bVisualMetrics(sample).silhouetteComplexityScore));
}

export function evaluateSw13bHeroBaselineSeparation(
  samples: readonly Sw13bGeneratedVisualSample[],
  thresholds: Sw13bVisualGateThresholds = SW13B_CONSERVATIVE_VISUAL_THRESHOLDS,
): Sw13bVisualGateResult {
  const baselineComplexity = tierMeanComplexity(samples, 'B');
  const heroComplexity = tierMeanComplexity(samples, 'H');
  const reasons: string[] = [];

  if (heroComplexity < baselineComplexity + thresholds.heroComplexityDelta) {
    reasons.push('hero complexity does not exceed baseline by required delta');
  }

  return {
    passed: reasons.length === 0,
    reasons,
  };
}
