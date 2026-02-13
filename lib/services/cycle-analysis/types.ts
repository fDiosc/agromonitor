/**
 * Cycle Analysis Types and Constants
 */

import type { NdviPoint } from '../merx.service'

// ==================== Types ====================

export interface CycleDetection {
  year: number
  sosDate: string | null
  eosDate: string | null
  peakDate: string | null
  sosDayOfYear: number | null
  eosDayOfYear: number | null
  cycleDays: number
  peakNdvi: number
  data: NdviPoint[]
}

export interface AlignedCyclePoint {
  dayOfCycle: number // 0 = SOS
  date: string
  ndvi: number
}

export interface AlignedCycle {
  year: number
  sosDate: string
  eosDate: string | null
  cycleDays: number
  peakNdvi: number
  points: AlignedCyclePoint[]
}

export interface HistoricalEnvelope {
  dayOfCycle: number
  min: number
  max: number
  avg: number
  median: number
  count: number
}

export interface CycleAnalysisResult {
  currentCycle: AlignedCycle | null
  historicalCycles: AlignedCycle[]
  envelope: HistoricalEnvelope[]
  avgCycleDays: number
  projectedEosDate: string | null
  correlationScore: number
  adherenceScore: number
}

// ==================== Configuration ====================

export const CROP_THRESHOLDS: Record<string, { sosNdvi: number; eosNdvi: number; minCycle: number; maxCycle: number }> = {
  SOJA: { sosNdvi: 0.35, eosNdvi: 0.38, minCycle: 90, maxCycle: 150 },
  MILHO: { sosNdvi: 0.30, eosNdvi: 0.35, minCycle: 100, maxCycle: 160 },
  ALGODAO: { sosNdvi: 0.32, eosNdvi: 0.40, minCycle: 150, maxCycle: 200 },
  TRIGO: { sosNdvi: 0.30, eosNdvi: 0.35, minCycle: 90, maxCycle: 140 }
}
