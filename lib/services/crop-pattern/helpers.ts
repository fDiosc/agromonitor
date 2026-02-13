/**
 * Crop Pattern Service - Helper Functions
 */

import type {
  CropCategory,
  CropPatternMetrics,
  CropThresholds,
  AnnualThresholds,
  SemiPerennialThresholds,
  PerennialThresholds,
} from './types'
import { CROP_PATTERN_THRESHOLDS } from './types'

export function getThresholds(cropType: string): CropThresholds {
  return CROP_PATTERN_THRESHOLDS[cropType.toUpperCase()] || CROP_PATTERN_THRESHOLDS.SOJA
}

export function getCropCategory(cropType: string): CropCategory {
  const t = getThresholds(cropType)
  return t.category
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower)
}

export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const sq = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(sq)
}

export function maxGrowthRate(values: number[], dates: Date[]): number {
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

export function calculateMetrics(
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

export function generateNoCropHypotheses(meanNdvi: number): string[] {
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

export function generateAnomalousHypotheses(peakNdvi: number, cropType: string): string[] {
  const hypotheses: string[] = []
  hypotheses.push(`Cultura diferente de ${cropType.toLowerCase()} (tipo não identificado)`)
  hypotheses.push('Quebra total de safra por seca, geada ou doença')
  hypotheses.push('Falha de plantio ou emergência extremamente irregular')
  if (peakNdvi > 0.40) {
    hypotheses.push('Possível cultura de cobertura ou adubo verde')
  }
  return hypotheses
}

export function generateAtypicalHypotheses(
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
