/**
 * Fixtures de dados de precipitação para testes.
 */

import { dateOffset } from '../helpers/test-utils'

interface WaterBalancePoint {
  date: string
  ETc: number
  ETr: number
  deficit: number
  excess: number
  balance: number
}

interface WaterBalanceData {
  points: WaterBalancePoint[]
  totalDeficit: number
  totalExcess: number
  avgDeficit: number
  maxDeficit: number
  stressDays: number
  excessDays: number
  fetchedAt: Date
  source: 'API' | 'CACHE' | 'UNAVAILABLE'
}

function generateWBSeries(
  startDate: string,
  count: number,
  avgDeficit: number
): WaterBalancePoint[] {
  return Array.from({ length: count }, (_, i) => {
    const deficit = Math.max(0, avgDeficit + Math.sin(i * 0.2) * 1.5)
    const excess = avgDeficit < 0 ? Math.abs(avgDeficit) * 0.5 : 0
    return {
      date: dateOffset(startDate, i),
      ETc: 5.0,
      ETr: 5.0 - deficit,
      deficit: Math.round(deficit * 100) / 100,
      excess: Math.round(excess * 100) / 100,
      balance: Math.round((excess - deficit) * 100) / 100,
    }
  })
}

// ============================================================
// 1. WB_NO_STRESS — Sem déficit hídrico
// ============================================================
const noStressPoints = generateWBSeries('2025-10-01', 90, 0)
export const WB_NO_STRESS: WaterBalanceData = {
  points: noStressPoints,
  totalDeficit: 0,
  totalExcess: 20,
  avgDeficit: 0,
  maxDeficit: 0,
  stressDays: 0,
  excessDays: 10,
  fetchedAt: new Date('2025-10-01'),
  source: 'API',
}

// ============================================================
// 2. WB_MODERATE_STRESS — Déficit moderado
// ============================================================
const modPoints = generateWBSeries('2025-10-01', 90, 2.5)
export const WB_MODERATE_STRESS: WaterBalanceData = {
  points: modPoints,
  totalDeficit: 150,
  totalExcess: 0,
  avgDeficit: 2.5,
  maxDeficit: 4.0,
  stressDays: 25,
  excessDays: 0,
  fetchedAt: new Date('2025-10-01'),
  source: 'API',
}

// ============================================================
// 3. WB_SEVERE_STRESS — Déficit severo
// ============================================================
const sevPoints = generateWBSeries('2025-10-01', 90, 4.0)
export const WB_SEVERE_STRESS: WaterBalanceData = {
  points: sevPoints,
  totalDeficit: 300,
  totalExcess: 0,
  avgDeficit: 4.0,
  maxDeficit: 5.5,
  stressDays: 55,
  excessDays: 0,
  fetchedAt: new Date('2025-10-01'),
  source: 'API',
}

// ============================================================
// 4. WB_CRITICAL_STRESS — Déficit crítico
// ============================================================
const critPoints = generateWBSeries('2025-10-01', 90, 5.0)
export const WB_CRITICAL_STRESS: WaterBalanceData = {
  points: critPoints,
  totalDeficit: 450,
  totalExcess: 0,
  avgDeficit: 5.0,
  maxDeficit: 6.5,
  stressDays: 75,
  excessDays: 0,
  fetchedAt: new Date('2025-10-01'),
  source: 'API',
}
