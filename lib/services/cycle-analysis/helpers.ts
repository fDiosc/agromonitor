/**
 * Cycle Analysis Helper Functions
 */

import type { NdviPoint } from '../merx.service'
import { CROP_THRESHOLDS } from './types'

export function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0)
  const diff = date.getTime() - start.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

/**
 * Regressão Linear Simples (Mínimos Quadrados Ordinários)
 * Retorna slope, intercept e R²
 */
export function linearRegression(points: { x: number; y: number }[]): {
  slope: number
  intercept: number
  rSquared: number
} | null {
  const n = points.length
  if (n < 3) return null

  const sumX = points.reduce((s, p) => s + p.x, 0)
  const sumY = points.reduce((s, p) => s + p.y, 0)
  const meanX = sumX / n
  const meanY = sumY / n

  let ssXY = 0
  let ssXX = 0
  let ssYY = 0

  points.forEach(p => {
    const dx = p.x - meanX
    const dy = p.y - meanY
    ssXY += dx * dy
    ssXX += dx * dx
    ssYY += dy * dy
  })

  if (ssXX === 0) return null

  const slope = ssXY / ssXX
  const intercept = meanY - slope * meanX
  const rSquared = ssYY > 0 ? Math.pow(ssXY, 2) / (ssXX * ssYY) : 0

  return { slope, intercept, rSquared }
}

/**
 * Detecta fase fenológica baseada na tendência dos últimos N pontos
 * Retorna: 'vegetative' | 'reproductive' | 'senescence'
 */
export function detectPhenologicalPhase(
  data: NdviPoint[],
  windowDays: number = 14
): {
  phase: 'vegetative' | 'reproductive' | 'senescence'
  trend: { slope: number; intercept: number; rSquared: number } | null
  confidence: number
} {
  if (data.length < 5) {
    return { phase: 'reproductive', trend: null, confidence: 0 }
  }

  // Pegar últimos N dias
  const sorted = [...data]
    .filter(d => d.ndvi_smooth !== null && d.ndvi_smooth !== undefined)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const lastN = sorted.slice(-windowDays)
  if (lastN.length < 5) {
    return { phase: 'reproductive', trend: null, confidence: 0 }
  }

  const baseTime = new Date(lastN[0].date).getTime()
  const dayMs = 24 * 60 * 60 * 1000

  const regressionPoints = lastN.map(p => ({
    x: (new Date(p.date).getTime() - baseTime) / dayMs,
    y: p.ndvi_smooth || p.ndvi_interp || 0
  }))

  const trend = linearRegression(regressionPoints)
  if (!trend) {
    return { phase: 'reproductive', trend: null, confidence: 0 }
  }

  // Determinar fase baseada no slope e R²
  // slope > 0.005/dia = vegetativo (subindo)
  // slope < -0.005/dia = senescência (caindo)
  // entre -0.005 e 0.005 = reprodutivo (platô)
  const SLOPE_THRESHOLD = 0.005

  let phase: 'vegetative' | 'reproductive' | 'senescence'
  let confidence = trend.rSquared * 100

  if (trend.slope > SLOPE_THRESHOLD && trend.rSquared > 0.5) {
    phase = 'vegetative'
  } else if (trend.slope < -SLOPE_THRESHOLD && trend.rSquared > 0.5) {
    phase = 'senescence'
    confidence = Math.min(100, confidence * 1.2) // Boost para senescência clara
  } else {
    phase = 'reproductive'
    confidence = Math.max(30, confidence * 0.7) // Reduzir confiança em platô
  }

  return { phase, trend, confidence }
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

export function detectCycleBoundaries(
  data: NdviPoint[],
  crop: string
): { sosIdx: number; eosIdx: number; peakIdx: number; peakNdvi: number } {
  const thresholds = CROP_THRESHOLDS[crop.toUpperCase()] || CROP_THRESHOLDS.SOJA

  // Ordenar e suavizar
  const sorted = [...data]
    .filter(d => d.ndvi_smooth !== null && d.ndvi_smooth !== undefined)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  if (sorted.length < 5) {
    return { sosIdx: -1, eosIdx: -1, peakIdx: -1, peakNdvi: 0 }
  }

  const ndviValues = sorted.map(d => d.ndvi_smooth || d.ndvi_interp || 0)
  const smoothed = movingAverage(ndviValues, 3)

  // Encontrar pico
  let peakNdvi = 0
  let peakIdx = -1
  smoothed.forEach((val, i) => {
    if (val > peakNdvi) {
      peakNdvi = val
      peakIdx = i
    }
  })

  // Encontrar SOS (antes do pico)
  let sosIdx = -1
  for (let i = peakIdx; i >= 0; i--) {
    if (smoothed[i] < thresholds.sosNdvi) {
      sosIdx = i
      break
    }
  }

  // Encontrar EOS (depois do pico)
  let eosIdx = -1
  for (let i = peakIdx; i < smoothed.length; i++) {
    if (smoothed[i] < thresholds.eosNdvi) {
      eosIdx = i
      break
    }
  }

  return { sosIdx, eosIdx, peakIdx, peakNdvi }
}
