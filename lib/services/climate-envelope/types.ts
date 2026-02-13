/**
 * Climate Envelope - Types and constants
 */

// ==================== Constants ====================

export const MERX_API_BASE = process.env.MERX_API_URL || 'https://homolog.api.merx.tech/api/monitoramento'
export const YEARS_FOR_ENVELOPE = 5
export const ANOMALY_THRESHOLD = 1.5  // Desvios padrão para considerar anomalia
export const EXTREME_THRESHOLD = 2.5  // Desvios padrão para evento extremo

// ==================== Types ====================

export interface DailyClimatePoint {
  date: string           // YYYY-MM-DD
  dayOfYear: number      // 1-365
  value: number          // mm para precip, °C para temp
}

export interface ClimateEnvelopePoint {
  dayOfYear: number
  mean: number           // Média dos últimos N anos
  stdDev: number         // Desvio padrão
  upper: number          // mean + 1.5 * stdDev
  lower: number          // mean - 1.5 * stdDev
  min: number            // Valor mínimo histórico
  max: number            // Valor máximo histórico
  count: number          // Número de observações
}

export interface ClimateEnvelope {
  type: 'PRECIPITATION' | 'TEMPERATURE'
  points: ClimateEnvelopePoint[]
  historicalYears: number
  generatedAt: Date
  anomalies: ClimateAnomaly[]
}

export interface ClimateAnomaly {
  date: string
  dayOfYear: number
  actualValue: number
  expectedMean: number
  deviation: number      // Número de desvios padrão
  type: 'ABOVE' | 'BELOW' | 'EXTREME_ABOVE' | 'EXTREME_BELOW'
  description: string
}

export interface ClimateComparisonResult {
  envelope: ClimateEnvelope
  currentSeason: DailyClimatePoint[]
  anomalies: ClimateAnomaly[]
  summary: {
    daysAboveNormal: number
    daysBelowNormal: number
    extremeEvents: number
    avgDeviation: number
  }
}

// ==================== Date Helpers ====================

export function getDayOfYear(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date) : date
  const start = new Date(d.getFullYear(), 0, 0)
  const diff = d.getTime() - start.getTime()
  const oneDay = 1000 * 60 * 60 * 24
  return Math.floor(diff / oneDay)
}

export function getDateFromDayOfYear(dayOfYear: number, year: number): string {
  const date = new Date(year, 0, dayOfYear)
  return date.toISOString().split('T')[0]
}
