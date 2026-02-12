/**
 * Crop Pattern Service
 * Algorithmic pre-validator that analyzes NDVI curve shape to determine
 * whether the declared crop is actually present in the field.
 * 
 * Supports 8 crop types across 3 categories:
 * - ANNUAL: SOJA, MILHO, GERGELIM, CEVADA, ALGODAO, ARROZ
 * - SEMI_PERENNIAL: CANA
 * - PERENNIAL: CAFE
 * 
 * Cost: Zero (pure algorithmic, no AI calls)
 * Pipeline role: Runs BEFORE phenology/EOS/IA -- short-circuits on NO_CROP
 */

import type { NdviPoint } from './merx.service'

// ==================== Types ====================

export type CropPatternStatus = 'TYPICAL' | 'ATYPICAL' | 'ANOMALOUS' | 'NO_CROP'
export type CropCategory = 'ANNUAL' | 'SEMI_PERENNIAL' | 'PERENNIAL'

export interface CropPatternMetrics {
  peakNdvi: number
  basalNdvi: number
  amplitude: number
  meanNdvi: number
  stdNdvi: number
  growthRate: number         // max derivative in ascending phase
  cycleDurationDays: number | null
  dataPoints: number
}

export interface CropPatternResult {
  status: CropPatternStatus
  cropType: string
  cropCategory: CropCategory
  metrics: CropPatternMetrics
  hypotheses: string[]
  reason: string
  shouldShortCircuit: boolean  // true = do NOT run EOS/GDD/IA
  shouldCallVerifier: boolean  // true = call Verifier agent for visual confirmation
}

// ==================== Thresholds ====================

interface AnnualThresholds {
  category: 'ANNUAL'
  peakMinNdvi: number
  noCropPeak: number
  noCropAmplitude: number
  anomalousPeak: number
  minCycleDays: number
  maxCycleDays: number
  expectedAmplitude: number
  label: string
}

interface SemiPerennialThresholds {
  category: 'SEMI_PERENNIAL'
  peakMinNdvi: number
  noCropPeak: number
  noCropAmplitude: number
  anomalousPeak: number
  minCycleDays: number
  maxCycleDays: number
  expectedAmplitude: number
  label: string
}

interface PerennialThresholds {
  category: 'PERENNIAL'
  baselineMinNdvi: number
  baselineMaxNdvi: number
  noCropBaseline: number
  seasonalAmplitude: number
  anomalousDrop: number
  label: string
}

type CropThresholds = AnnualThresholds | SemiPerennialThresholds | PerennialThresholds

const CROP_PATTERN_THRESHOLDS: Record<string, CropThresholds> = {
  // ─── ANUAIS ──────────────────────────────────────────────────
  SOJA: {
    category: 'ANNUAL',
    peakMinNdvi: 0.70,
    noCropPeak: 0.45,
    noCropAmplitude: 0.15,
    anomalousPeak: 0.55,
    minCycleDays: 80,
    maxCycleDays: 160,
    expectedAmplitude: 0.35,
    label: 'Soja',
  },
  MILHO: {
    category: 'ANNUAL',
    peakMinNdvi: 0.65,
    noCropPeak: 0.40,
    noCropAmplitude: 0.15,
    anomalousPeak: 0.50,
    minCycleDays: 100,
    maxCycleDays: 180,
    expectedAmplitude: 0.30,
    label: 'Milho',
  },
  GERGELIM: {
    category: 'ANNUAL',
    peakMinNdvi: 0.55,
    noCropPeak: 0.35,
    noCropAmplitude: 0.12,
    anomalousPeak: 0.42,
    minCycleDays: 80,
    maxCycleDays: 130,
    expectedAmplitude: 0.22,
    label: 'Gergelim',
  },
  CEVADA: {
    category: 'ANNUAL',
    peakMinNdvi: 0.65,
    noCropPeak: 0.40,
    noCropAmplitude: 0.15,
    anomalousPeak: 0.50,
    minCycleDays: 80,
    maxCycleDays: 150,
    expectedAmplitude: 0.30,
    label: 'Cevada',
  },
  ALGODAO: {
    category: 'ANNUAL',
    peakMinNdvi: 0.60,
    noCropPeak: 0.38,
    noCropAmplitude: 0.12,
    anomalousPeak: 0.48,
    minCycleDays: 140,
    maxCycleDays: 220,
    expectedAmplitude: 0.25,
    label: 'Algodão',
  },
  ARROZ: {
    category: 'ANNUAL',
    peakMinNdvi: 0.65,
    noCropPeak: 0.35,
    noCropAmplitude: 0.15,
    anomalousPeak: 0.48,
    minCycleDays: 90,
    maxCycleDays: 150,
    expectedAmplitude: 0.30,
    label: 'Arroz',
  },

  // ─── SEMI-PERENE ──────────────────────────────────────────────
  CANA: {
    category: 'SEMI_PERENNIAL',
    peakMinNdvi: 0.70,
    noCropPeak: 0.35,
    noCropAmplitude: 0.10,
    anomalousPeak: 0.50,
    minCycleDays: 300,
    maxCycleDays: 540,
    expectedAmplitude: 0.35,
    label: 'Cana-de-açúcar',
  },

  // ─── PERENE ──────────────────────────────────────────────────
  CAFE: {
    category: 'PERENNIAL',
    baselineMinNdvi: 0.50,
    baselineMaxNdvi: 0.75,
    noCropBaseline: 0.30,
    seasonalAmplitude: 0.15,
    anomalousDrop: 0.25,
    label: 'Café',
  },
}

// ==================== Helper Functions ====================

function getThresholds(cropType: string): CropThresholds {
  return CROP_PATTERN_THRESHOLDS[cropType.toUpperCase()] || CROP_PATTERN_THRESHOLDS.SOJA
}

function getCropCategory(cropType: string): CropCategory {
  const t = getThresholds(cropType)
  return t.category
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower)
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const sq = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(sq)
}

function maxGrowthRate(values: number[], dates: Date[]): number {
  if (values.length < 2) return 0
  let maxRate = 0
  for (let i = 1; i < values.length; i++) {
    const daysDiff = (dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24)
    if (daysDiff > 0) {
      const rate = (values[i] - values[i - 1]) / daysDiff
      if (rate > maxRate) maxRate = rate
    }
  }
  return maxRate
}

function calculateMetrics(
  ndviValues: number[],
  dates: Date[],
  sosDate: Date | null,
  eosDate: Date | null
): CropPatternMetrics {
  const peakNdvi = Math.max(...ndviValues)
  const basalNdvi = percentile(ndviValues, 10)
  const amplitude = peakNdvi - basalNdvi
  const meanNdvi = ndviValues.reduce((a, b) => a + b, 0) / ndviValues.length
  const stdNdvi = standardDeviation(ndviValues)
  const growthRate = maxGrowthRate(ndviValues, dates)

  let cycleDurationDays: number | null = null
  if (sosDate && eosDate) {
    cycleDurationDays = (eosDate.getTime() - sosDate.getTime()) / (1000 * 60 * 60 * 24)
  }

  return {
    peakNdvi,
    basalNdvi,
    amplitude,
    meanNdvi,
    stdNdvi,
    growthRate,
    cycleDurationDays,
    dataPoints: ndviValues.length,
  }
}

// ==================== Hypothesis Generators ====================

function generateNoCropHypotheses(meanNdvi: number): string[] {
  const hypotheses: string[] = []
  if (meanNdvi < 0.20) {
    hypotheses.push('Solo exposto ou área desmatada')
    hypotheses.push('Possível área urbana ou infraestrutura')
  } else if (meanNdvi < 0.35) {
    hypotheses.push('Possível pastagem degradada ou pousio')
    hypotheses.push('Solo com cobertura residual (palhada)')
  } else {
    hypotheses.push('Possível pastagem estabelecida')
    hypotheses.push('Vegetação espontânea sem ciclo produtivo')
  }
  return hypotheses
}

function generateAnomalousHypotheses(peakNdvi: number, cropType: string): string[] {
  const hypotheses: string[] = []
  hypotheses.push(`Cultura diferente de ${cropType.toLowerCase()} (tipo não identificado)`)
  hypotheses.push('Quebra total de safra por seca, geada ou doença')
  hypotheses.push('Falha de plantio ou emergência extremamente irregular')
  if (peakNdvi > 0.40) {
    hypotheses.push('Possível cultura de cobertura ou adubo verde')
  }
  return hypotheses
}

function generateAtypicalHypotheses(
  metrics: CropPatternMetrics,
  cropType: string,
  cycleProblem: boolean
): string[] {
  const hypotheses: string[] = []
  hypotheses.push(`${cropType} sob estresse severo (hídrico, nutricional ou sanitário)`)
  if (cycleProblem) {
    hypotheses.push('Plantio muito tardio ou replantio com ciclo comprimido')
    hypotheses.push(`Variedade de ${cropType.toLowerCase()} com ciclo atípico`)
  }
  if (metrics.amplitude < 0.20) {
    hypotheses.push('Baixa cobertura foliar -- possível falha de stand')
  }
  return hypotheses
}

// ==================== Classification Logic ====================

function classifyAnnual(
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

function classifyPerennial(
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

// ==================== Main Export ====================

/**
 * Analyze NDVI time series to determine if the declared crop pattern matches.
 * Should be called BEFORE phenology calculations in the processing pipeline.
 * 
 * @param ndviData - NDVI time series from Merx API
 * @param cropType - Declared crop type from user (may be incorrect)
 * @param sosDate - Detected SOS date (if any, from preliminary scan)
 * @param eosDate - Detected EOS date (if any, from preliminary scan)
 * @returns CropPatternResult with classification, metrics, and pipeline instructions
 */
export function analyzeCropPattern(
  ndviData: NdviPoint[],
  cropType: string,
  sosDate?: string | null,
  eosDate?: string | null
): CropPatternResult {
  // Default result for insufficient data
  if (!ndviData || ndviData.length < 5) {
    return {
      status: 'ATYPICAL',
      cropType,
      cropCategory: getCropCategory(cropType),
      metrics: {
        peakNdvi: 0, basalNdvi: 0, amplitude: 0, meanNdvi: 0,
        stdNdvi: 0, growthRate: 0, cycleDurationDays: null, dataPoints: ndviData?.length || 0,
      },
      hypotheses: ['Dados insuficientes para análise de padrão'],
      reason: `Apenas ${ndviData?.length || 0} pontos NDVI disponíveis (mínimo: 5)`,
      shouldShortCircuit: false,
      shouldCallVerifier: false,
    }
  }

  // Extract valid NDVI values and dates
  const sorted = [...ndviData]
    .filter(d => (d.ndvi_smooth ?? d.ndvi_interp ?? d.ndvi_raw ?? null) !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  if (sorted.length < 5) {
    return {
      status: 'ATYPICAL',
      cropType,
      cropCategory: getCropCategory(cropType),
      metrics: {
        peakNdvi: 0, basalNdvi: 0, amplitude: 0, meanNdvi: 0,
        stdNdvi: 0, growthRate: 0, cycleDurationDays: null, dataPoints: sorted.length,
      },
      hypotheses: ['Dados válidos insuficientes para análise de padrão'],
      reason: `Apenas ${sorted.length} pontos NDVI válidos (mínimo: 5)`,
      shouldShortCircuit: false,
      shouldCallVerifier: false,
    }
  }

  const ndviValues = sorted.map(d => d.ndvi_smooth || d.ndvi_interp || d.ndvi_raw || 0)
  const dates = sorted.map(d => new Date(d.date))

  const sosParsed = sosDate ? new Date(sosDate) : null
  const eosParsed = eosDate ? new Date(eosDate) : null

  const metrics = calculateMetrics(ndviValues, dates, sosParsed, eosParsed)

  const thresholds = getThresholds(cropType)

  console.log(`[CROP-PATTERN] Analyzing ${cropType} (${thresholds.category}): peak=${metrics.peakNdvi.toFixed(2)}, amp=${metrics.amplitude.toFixed(2)}, mean=${metrics.meanNdvi.toFixed(2)}, std=${metrics.stdNdvi.toFixed(2)}, points=${metrics.dataPoints}`)

  // Route to category-specific classifier
  if (thresholds.category === 'PERENNIAL') {
    return classifyPerennial(metrics, thresholds as PerennialThresholds, cropType)
  }

  // Both ANNUAL and SEMI_PERENNIAL use the same base logic with different thresholds
  return classifyAnnual(metrics, thresholds as AnnualThresholds | SemiPerennialThresholds, cropType)
}

/**
 * Get the supported crop types and their categories
 */
export function getSupportedCropTypes(): Array<{ key: string; label: string; category: CropCategory }> {
  return Object.entries(CROP_PATTERN_THRESHOLDS).map(([key, t]) => ({
    key,
    label: 'label' in t ? t.label : key,
    category: t.category,
  }))
}

/**
 * Export thresholds for use in Verifier prompt
 */
export function getCropThresholdsForPrompt(cropType: string): {
  category: CropCategory
  label: string
  description: string
} {
  const t = getThresholds(cropType)
  
  if (t.category === 'PERENNIAL') {
    const pt = t as PerennialThresholds
    return {
      category: 'PERENNIAL',
      label: pt.label,
      description: `NDVI estável ${pt.baselineMinNdvi}-${pt.baselineMaxNdvi}, variação sazonal suave (amplitude < ${pt.seasonalAmplitude}), arbustos perenes sem ciclo SOS/EOS anual`,
    }
  }

  const at = t as AnnualThresholds | SemiPerennialThresholds
  return {
    category: t.category,
    label: at.label,
    description: `Peak NDVI >= ${at.peakMinNdvi}, ciclo ${at.minCycleDays}-${at.maxCycleDays} dias, amplitude >= ${at.expectedAmplitude}, curva bell-shape com SOS/peak/EOS distintos`,
  }
}
