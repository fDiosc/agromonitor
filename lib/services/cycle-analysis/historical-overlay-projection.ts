/**
 * Internal helpers for prepareHistoricalOverlayData
 */

import type { NdviPoint } from '../merx.service'
import { detectPhenologicalPhase } from './helpers'

const dayMs = 24 * 60 * 60 * 1000

/**
 * Filtra chartData pelo range relevante e recalcula lastCurrentIdx/lastCurrentValue
 */
export function applyRangeFilter(
  dateMap: Map<string, any>,
  chartData: any[],
  firstCurrentDate: string,
  lastCurrentDate: string,
  eosDate: string | null
): { chartData: any[]; lastCurrentIdx: number; lastCurrentValue: number } {
  let lastCurrentIdx = -1
  let lastCurrentValue = 0
  chartData.forEach((entry: any, idx: number) => {
    if (entry.current !== undefined) {
      lastCurrentIdx = idx
      lastCurrentValue = entry.current
    }
  })

  const rangeStart = new Date(firstCurrentDate)
  rangeStart.setDate(rangeStart.getDate() - 15)
  const rangeStartStr = rangeStart.toISOString().split('T')[0]
  const lastCurrentTime = new Date(lastCurrentDate).getTime()
  const todayTime = new Date().getTime()

  let maxAvailableDate = lastCurrentTime
  dateMap.forEach((entry: any, dateStr: string) => {
    const dateTime = new Date(dateStr).getTime()
    const hasData = entry.current !== undefined || entry.h1 !== undefined ||
                    entry.h2 !== undefined || entry.h3 !== undefined
    if (hasData && dateTime > maxAvailableDate) maxAvailableDate = dateTime
  })

  let rangeEnd: Date
  if (eosDate) {
    const eosTime = new Date(eosDate).getTime()
    const eosPlus30 = eosTime + (30 * dayMs)
    const candidates = [eosPlus30, maxAvailableDate + (7 * dayMs), todayTime + (7 * dayMs)]
    rangeEnd = new Date(Math.max(...candidates))
  } else {
    const lastPlus60 = lastCurrentTime + (60 * dayMs)
    rangeEnd = new Date(Math.max(lastPlus60, maxAvailableDate + (7 * dayMs)))
  }

  const rangeEndStr = rangeEnd.toISOString().split('T')[0]
  const rangeEndTime = rangeEnd.getTime()

  for (let t = lastCurrentTime + dayMs; t <= rangeEndTime; t += dayMs) {
    const dateStr = new Date(t).toISOString().split('T')[0]
    if (!dateMap.has(dateStr)) dateMap.set(dateStr, { date: dateStr })
  }

  const filtered = Array.from(dateMap.values())
    .filter((d: any) => d.date >= rangeStartStr && d.date <= rangeEndStr)
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())

  lastCurrentIdx = -1
  lastCurrentValue = 0
  filtered.forEach((entry: any, idx: number) => {
    if (entry.current !== undefined) {
      lastCurrentIdx = idx
      lastCurrentValue = entry.current
    }
  })

  return { chartData: filtered, lastCurrentIdx, lastCurrentValue }
}

const HISTORICAL_KEYS = ['h1', 'h2', 'h3'] as const
const MIN_NDVI = 0.18 // Solo + palha residual
const MAX_NDVI_PLATEAU = 0.92

/**
 * Aplica projeção adaptativa aos pontos do chartData após o último dado atual
 */
export function applyAdaptiveProjection(
  chartData: any[],
  currentData: NdviPoint[],
  lastCurrentIdx: number,
  lastCurrentValue: number
): void {
  if (lastCurrentIdx < 0 || lastCurrentIdx >= chartData.length - 1) return

  const phaseDetection = detectPhenologicalPhase(currentData)
  const baseTime = new Date(chartData[lastCurrentIdx].date).getTime()
  const dayMs = 24 * 60 * 60 * 1000
  const slope = phaseDetection.trend?.slope || -0.01

  chartData[lastCurrentIdx].projection = lastCurrentValue

  for (let i = lastCurrentIdx + 1; i < chartData.length; i++) {
    const entry = chartData[i]
    const daysFromLast = (new Date(entry.date).getTime() - baseTime) / dayMs

    const historicalValues: number[] = []
    HISTORICAL_KEYS.forEach(key => {
      if (entry[key] !== undefined && entry[key] !== null) {
        historicalValues.push(entry[key])
      }
    })
    const historicalAvg = historicalValues.length > 0
      ? historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length
      : null

    if (phaseDetection.phase === 'senescence') {
      const decayRate = Math.abs(slope) / Math.max(0.3, lastCurrentValue - MIN_NDVI)
      const exponentialProjection = MIN_NDVI + (lastCurrentValue - MIN_NDVI) * Math.exp(-decayRate * daysFromLast)

      let projection: number
      if (historicalAvg !== null && historicalAvg < exponentialProjection) {
        projection = historicalAvg
      } else {
        projection = exponentialProjection
      }
      entry.projection = Math.max(MIN_NDVI, Math.min(projection, lastCurrentValue))
    } else if (phaseDetection.phase === 'vegetative') {
      const trendProjection = Math.min(MAX_NDVI_PLATEAU, lastCurrentValue + slope * daysFromLast)
      const nearPlateau = lastCurrentValue > 0.80

      if (historicalAvg !== null) {
        if (nearPlateau) {
          entry.projection = Math.min(trendProjection, Math.max(historicalAvg, MIN_NDVI))
        } else {
          entry.projection = 0.6 * trendProjection + 0.4 * historicalAvg
        }
      } else {
        entry.projection = trendProjection
      }
      entry.projection = Math.max(0.1, Math.min(MAX_NDVI_PLATEAU, entry.projection))
    } else {
      if (historicalAvg !== null) {
        entry.projection = historicalAvg
      } else {
        const gradualDecline = 0.002 * daysFromLast
        entry.projection = Math.max(MIN_NDVI, lastCurrentValue - gradualDecline)
      }
      entry.projection = Math.max(MIN_NDVI, Math.min(MAX_NDVI_PLATEAU, entry.projection))
    }

    entry.projection = Math.max(0.1, Math.min(1.0, entry.projection))
  }
}
