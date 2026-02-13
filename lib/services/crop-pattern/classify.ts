/**
 * Crop Pattern Service - Classification Logic
 */

import type {
  CropCategory,
  CropPatternMetrics,
  CropPatternResult,
  AnnualThresholds,
  SemiPerennialThresholds,
  PerennialThresholds,
} from './types'
import {
  generateNoCropHypotheses,
  generateAnomalousHypotheses,
  generateAtypicalHypotheses,
} from './helpers'

export function classifyAnnual(
  metrics: CropPatternMetrics,
  thresholds: AnnualThresholds | SemiPerennialThresholds,
  cropType: string
): CropPatternResult {
  const category: CropCategory = thresholds.category

  // NO_CROP: peak too low AND amplitude too small
  if (metrics.peakNdvi < thresholds.noCropPeak && metrics.amplitude < thresholds.noCropAmplitude) {
    return {
      status: 'NO_CROP',
      cropType,
      cropCategory: category,
      metrics,
      hypotheses: generateNoCropHypotheses(metrics.meanNdvi),
      reason: `Peak NDVI (${metrics.peakNdvi.toFixed(2)}) abaixo do mínimo para detecção de cultivo (${thresholds.noCropPeak}) e amplitude (${metrics.amplitude.toFixed(2)}) insuficiente (< ${thresholds.noCropAmplitude})`,
      shouldShortCircuit: true,
      shouldCallVerifier: false,  // algorithmically certain enough
    }
  }

  // ANOMALOUS: peak too low for declared crop OR no cycle + very low amplitude
  const hasCycle = metrics.cycleDurationDays !== null &&
    metrics.cycleDurationDays >= thresholds.minCycleDays * 0.7 &&
    metrics.cycleDurationDays <= thresholds.maxCycleDays * 1.3

  // For annual crops, no detectable cycle (null SOS/EOS) is itself a red flag
  const noCycleDetected = metrics.cycleDurationDays === null

  if (metrics.peakNdvi < thresholds.anomalousPeak || (!hasCycle && metrics.amplitude < thresholds.expectedAmplitude * 0.6)) {
    return {
      status: 'ANOMALOUS',
      cropType,
      cropCategory: category,
      metrics,
      hypotheses: generateAnomalousHypotheses(metrics.peakNdvi, cropType),
      reason: `Curva NDVI não se assemelha a ${thresholds.label}: peak ${metrics.peakNdvi.toFixed(2)} (esperado >= ${thresholds.anomalousPeak}), ciclo ${hasCycle ? 'detectado' : 'não detectado'}`,
      shouldShortCircuit: false,  // Verifier will confirm
      shouldCallVerifier: true,
    }
  }

  // ATYPICAL: peak below expected OR cycle out of range OR no cycle detected for annual crop
  // OR amplitude significantly below expected
  const cycleProblem = metrics.cycleDurationDays !== null && (
    metrics.cycleDurationDays < thresholds.minCycleDays ||
    metrics.cycleDurationDays > thresholds.maxCycleDays
  )

  // For annual/semi-perennial crops, absence of SOS/EOS detection is inherently atypical
  // An annual crop MUST show a clear bell-shaped cycle with detectable SOS/peak/EOS
  const noCycleForAnnual = noCycleDetected && (category === 'ANNUAL' || category === 'SEMI_PERENNIAL')

  // Amplitude well below expected for declared crop (e.g. 0.25 vs 0.35 expected for soja)
  const lowAmplitude = metrics.amplitude < thresholds.expectedAmplitude * 0.85

  if (metrics.peakNdvi < thresholds.peakMinNdvi || cycleProblem || noCycleForAnnual || lowAmplitude) {
    const reasons: string[] = []
    if (metrics.peakNdvi < thresholds.peakMinNdvi) reasons.push(`peak ${metrics.peakNdvi.toFixed(2)} (esperado >= ${thresholds.peakMinNdvi})`)
    if (cycleProblem) reasons.push(`ciclo ${metrics.cycleDurationDays}d (esperado ${thresholds.minCycleDays}-${thresholds.maxCycleDays}d)`)
    if (noCycleForAnnual) reasons.push('SOS/EOS não detectados (ciclo indefinido)')
    if (lowAmplitude) reasons.push(`amplitude ${metrics.amplitude.toFixed(2)} (esperado >= ${(thresholds.expectedAmplitude * 0.85).toFixed(2)})`)

    return {
      status: 'ATYPICAL',
      cropType,
      cropCategory: category,
      metrics,
      hypotheses: generateAtypicalHypotheses(metrics, cropType, cycleProblem || noCycleForAnnual || false),
      reason: `${thresholds.label} com desvios: ${reasons.join('; ')}`,
      shouldShortCircuit: false,
      shouldCallVerifier: true,
    }
  }

  // TYPICAL: everything within expected ranges
  return {
    status: 'TYPICAL',
    cropType,
    cropCategory: category,
    metrics,
    hypotheses: [],
    reason: `Padrão NDVI típico para ${thresholds.label}: peak ${metrics.peakNdvi.toFixed(2)}, amplitude ${metrics.amplitude.toFixed(2)}`,
    shouldShortCircuit: false,
    shouldCallVerifier: false,
  }
}

export function classifyPerennial(
  metrics: CropPatternMetrics,
  thresholds: PerennialThresholds,
  cropType: string
): CropPatternResult {
  // NO_CROP: consistently low NDVI with very low variability
  if (metrics.meanNdvi < thresholds.noCropBaseline && metrics.stdNdvi < 0.05) {
    return {
      status: 'NO_CROP',
      cropType,
      cropCategory: 'PERENNIAL',
      metrics,
      hypotheses: generateNoCropHypotheses(metrics.meanNdvi),
      reason: `NDVI médio (${metrics.meanNdvi.toFixed(2)}) consistentemente abaixo do baseline para ${thresholds.label} (${thresholds.noCropBaseline})`,
      shouldShortCircuit: true,
      shouldCallVerifier: false,
    }
  }

  // ANOMALOUS: mean below minimum expected baseline
  if (metrics.meanNdvi < thresholds.baselineMinNdvi) {
    return {
      status: 'ANOMALOUS',
      cropType,
      cropCategory: 'PERENNIAL',
      metrics,
      hypotheses: [
        `${thresholds.label} abandonado ou em renovação`,
        'Poda drástica recente',
        'Área em transição (replantio)',
      ],
      reason: `NDVI médio (${metrics.meanNdvi.toFixed(2)}) abaixo do mínimo esperado para ${thresholds.label} (${thresholds.baselineMinNdvi})`,
      shouldShortCircuit: false,
      shouldCallVerifier: true,
    }
  }

  // ATYPICAL: sudden drop from recent baseline
  if (metrics.amplitude > thresholds.anomalousDrop) {
    return {
      status: 'ATYPICAL',
      cropType,
      cropCategory: 'PERENNIAL',
      metrics,
      hypotheses: [
        'Possível geada, seca severa ou doença',
        'Desfolha intensa',
        'Evento climático extremo',
      ],
      reason: `Variação NDVI (${metrics.amplitude.toFixed(2)}) superior ao normal para ${thresholds.label} (esperado < ${thresholds.anomalousDrop})`,
      shouldShortCircuit: false,
      shouldCallVerifier: true,
    }
  }

  // TYPICAL: stable moderate-high NDVI with normal seasonal variation
  if (metrics.meanNdvi >= thresholds.baselineMinNdvi && metrics.meanNdvi <= thresholds.baselineMaxNdvi + 0.1) {
    return {
      status: 'TYPICAL',
      cropType,
      cropCategory: 'PERENNIAL',
      metrics,
      hypotheses: [],
      reason: `Padrão NDVI típico para ${thresholds.label}: média ${metrics.meanNdvi.toFixed(2)}, variação sazonal ${metrics.stdNdvi.toFixed(2)}`,
      shouldShortCircuit: false,
      shouldCallVerifier: false,
    }
  }

  // Default: TYPICAL if above max baseline (very healthy)
  return {
    status: 'TYPICAL',
    cropType,
    cropCategory: 'PERENNIAL',
    metrics,
    hypotheses: [],
    reason: `NDVI médio (${metrics.meanNdvi.toFixed(2)}) acima do esperado para ${thresholds.label} -- cafezal muito saudável`,
    shouldShortCircuit: false,
    shouldCallVerifier: false,
  }
}
