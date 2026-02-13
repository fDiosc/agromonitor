/**
 * Phenology Service - Helper Functions
 */

import type { NdviPoint } from '../merx.service'
import type { CropThresholds, PhenologyDiagnostic } from './types'
import { CROP_THRESHOLDS } from './types'

export function getThresholds(crop: string): CropThresholds {
  return CROP_THRESHOLDS[crop.toUpperCase()] || CROP_THRESHOLDS.SOJA
}

export function movingAverage(data: number[], window: number): number[] {
  const result: number[] = []
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - Math.floor(window / 2))
    const end = Math.min(data.length, i + Math.ceil(window / 2))
    const slice = data.slice(start, end)
    result.push(slice.reduce((a, b) => a + b, 0) / slice.length)
  }
  return result
}

export function detectReplanting(
  smoothed: number[],
  thresholds: CropThresholds
): { detected: boolean; index: number } {
  // Procura por queda > 0.2 seguida de subida > 0.15 em janela de 30 dias
  for (let i = 5; i < smoothed.length - 5; i++) {
    const before = smoothed[i - 5]
    const current = smoothed[i]
    const after = smoothed[i + 5]

    if (before > 0.5 && current < 0.35 && after > 0.5) {
      return { detected: true, index: i }
    }
  }
  return { detected: false, index: -1 }
}

export function calculateCorrelation(current: number[], historyAvg: number[]): number {
  const n = Math.min(current.length, historyAvg.length)
  if (n < 3) return 50

  let sumDiff = 0
  for (let i = 0; i < n; i++) {
    sumDiff += Math.abs(current[i] - historyAvg[i])
  }

  const avgDiff = sumDiff / n
  return Math.max(0, Math.min(100, Math.round((1 - avgDiff * 1.5) * 100)))
}

/**
 * Detecta tendência de senescência usando regressão linear
 * Retorna dados para cálculo dinâmico de EOS
 */
export function detectSenescenceTrend(
  data: NdviPoint[],
  peakIdx: number,
  windowDays: number = 14
): {
  isSenescence: boolean
  slope: number
  rSquared: number
  lastNdvi: number
  lastDate: string
} | null {
  if (data.length < 10 || peakIdx < 0) return null

  // Pegar dados após o pico
  const afterPeak = data.slice(peakIdx)
  if (afterPeak.length < 5) return null

  // Pegar últimos N pontos
  const lastN = afterPeak.slice(-windowDays)
  if (lastN.length < 5) return null

  // Regressão linear
  const baseTime = new Date(lastN[0].date).getTime()
  const dayMs = 24 * 60 * 60 * 1000

  const points = lastN.map(p => ({
    x: (new Date(p.date).getTime() - baseTime) / dayMs,
    y: p.ndvi_smooth || p.ndvi_interp || 0
  }))

  const n = points.length
  const sumX = points.reduce((s, p) => s + p.x, 0)
  const sumY = points.reduce((s, p) => s + p.y, 0)
  const meanX = sumX / n
  const meanY = sumY / n

  let ssXY = 0, ssXX = 0, ssYY = 0
  points.forEach(p => {
    const dx = p.x - meanX
    const dy = p.y - meanY
    ssXY += dx * dy
    ssXX += dx * dx
    ssYY += dy * dy
  })

  if (ssXX === 0) return null

  const slope = ssXY / ssXX
  const rSquared = ssYY > 0 ? Math.pow(ssXY, 2) / (ssXX * ssYY) : 0

  const lastPoint = lastN[lastN.length - 1]
  const lastNdvi = lastPoint.ndvi_smooth || lastPoint.ndvi_interp || 0
  const peakNdvi = data[peakIdx].ndvi_smooth || data[peakIdx].ndvi_interp || 0

  // Critérios para senescência:
  // 1. slope < -0.01 (queda de pelo menos 1%/dia)
  // 2. R² > 0.7 (tendência consistente)
  // 3. NDVI atual < 85% do pico (passou do máximo)
  const isSenescence =
    slope < -0.01 &&
    rSquared > 0.7 &&
    lastNdvi < peakNdvi * 0.85

  return {
    isSenescence,
    slope,
    rSquared,
    lastNdvi,
    lastDate: lastPoint.date
  }
}

/**
 * Calcula EOS dinâmico baseado em modelo exponencial
 * Retorna a data quando a projeção cruza o threshold de EOS
 */
export function calculateDynamicEos(
  lastNdvi: number,
  lastDate: string,
  slope: number,
  eosThreshold: number,
  minNdvi: number = 0.18
): string | null {
  // Modelo exponencial: NDVI(t) = MIN + (NDVI_0 - MIN) * e^(-k*t)
  // Resolver para t quando NDVI(t) = threshold

  if (lastNdvi <= eosThreshold) {
    // Já está abaixo do threshold
    return lastDate
  }

  // Taxa de decaimento
  const decayRate = Math.abs(slope) / Math.max(0.3, lastNdvi - minNdvi)

  // Resolver: threshold = MIN + (lastNdvi - MIN) * e^(-k*t)
  // (threshold - MIN) / (lastNdvi - MIN) = e^(-k*t)
  // t = -ln((threshold - MIN) / (lastNdvi - MIN)) / k

  const ratio = (eosThreshold - minNdvi) / (lastNdvi - minNdvi)

  if (ratio <= 0 || ratio >= 1) {
    // Matematicamente impossível
    return null
  }

  const daysToEos = -Math.log(ratio) / decayRate

  // Limitar a 60 dias no máximo
  if (daysToEos > 60 || daysToEos < 0) {
    return null
  }

  const eosDate = new Date(lastDate)
  eosDate.setDate(eosDate.getDate() + Math.round(daysToEos))

  return eosDate.toISOString().split('T')[0]
}

export function estimateYield(maxNdvi: number, areaHa: number, crop: string): number {
  const thresholds = getThresholds(crop)

  // Fator de ajuste baseado no NDVI máximo
  // NDVI 0.8+ = 100% do potencial, 0.6 = ~75%, etc
  const ndviFactor = Math.min(1, Math.max(0.3, (maxNdvi - 0.3) / 0.5))

  return Math.round(thresholds.baseYieldKgHa * ndviFactor * areaHa)
}

export function assessPhenologyHealth(
  maxNdvi: number,
  correlation: number,
  method: 'ALGORITHM' | 'PROJECTION',
  diagnostics: PhenologyDiagnostic[]
): 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' {
  const errorCount = diagnostics.filter(d => d.type === 'ERROR').length
  const warningCount = diagnostics.filter(d => d.type === 'WARNING').length

  if (errorCount > 0) return 'POOR'
  if (maxNdvi >= 0.75 && correlation >= 70 && method === 'ALGORITHM' && warningCount === 0) {
    return 'EXCELLENT'
  }
  if (maxNdvi >= 0.65 && correlation >= 50) return 'GOOD'
  if (maxNdvi >= 0.50 || warningCount <= 1) return 'FAIR'
  return 'POOR'
}

export function calculateConfidenceScore(params: {
  hasSos: boolean
  hasEos: boolean
  hasPeak: boolean
  method: 'ALGORITHM' | 'PROJECTION'
  correlation: number
  dataPoints: number
  peakNdvi: number
  peakMinNdvi: number
  hasInputPlantingDate?: boolean
}): number {
  let score = 10

  // Bônus grande se plantio foi informado pelo produtor
  if (params.hasInputPlantingDate) {
    score += 25 // Data confiável do produtor
  }

  if (params.hasSos) score += 20
  if (params.hasEos) score += 15
  if (params.hasPeak) score += 15
  if (params.method === 'ALGORITHM') score += 10 // Reduzido pois plantio informado também conta
  if (params.correlation > 70) score += 10
  if (params.dataPoints >= 20) score += 5
  if (params.peakNdvi >= params.peakMinNdvi) score += 5

  return Math.min(100, score)
}
