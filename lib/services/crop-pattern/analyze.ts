/**
 * Crop Pattern Service - Main Analysis
 *
 * Algorithmic pre-validator that analyzes NDVI curve shape to determine
 * whether the declared crop is actually present in the field.
 *
 * Cost: Zero (pure algorithmic, no AI calls)
 * Pipeline role: Runs BEFORE phenology/EOS/IA -- short-circuits on NO_CROP
 */

import type { NdviPoint } from '../merx.service'
import type {
  CropCategory,
  CropPatternResult,
  PerennialThresholds,
  AnnualThresholds,
  SemiPerennialThresholds,
} from './types'
import { CROP_PATTERN_THRESHOLDS } from './types'
import { getThresholds, getCropCategory, calculateMetrics } from './helpers'
import { classifyAnnual, classifyPerennial } from './classify'

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