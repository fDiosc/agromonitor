/**
 * Fixtures de dados de temperatura para testes de GDD.
 * Formato: TemperatureData do thermal.service
 */

import { dateOffset } from '../helpers/test-utils'

interface TemperaturePoint {
  date: string
  value: number
  tmin?: number
  tmax?: number
}

interface TemperatureData {
  points: TemperaturePoint[]
  avgTemp: number
  minTemp: number
  maxTemp: number
  fetchedAt: Date
  source: 'API' | 'CACHE' | 'UNAVAILABLE'
}

function generateTempSeries(
  startDate: string,
  count: number,
  avgTemp: number,
  variation: number = 3
): TemperaturePoint[] {
  return Array.from({ length: count }, (_, i) => {
    const temp = avgTemp + (Math.sin(i * 0.3) * variation)
    return {
      date: dateOffset(startDate, i),
      value: Math.round(temp * 10) / 10,
      tmin: Math.round((temp - 5) * 10) / 10,
      tmax: Math.round((temp + 5) * 10) / 10,
    }
  })
}

// ============================================================
// 1. TEMP_NORMAL_PR — Paraná, Tmean ~25°C, 120 dias
// GDD esperado: ~(25-10)*120 = 1800
// ============================================================
const prPoints = generateTempSeries('2025-10-01', 120, 25, 3)
export const TEMP_NORMAL_PR: TemperatureData = {
  points: prPoints,
  avgTemp: 25,
  minTemp: 17,
  maxTemp: 33,
  fetchedAt: new Date('2025-10-01'),
  source: 'API',
}

// ============================================================
// 2. TEMP_COLD_RS — Rio Grande do Sul, Tmean ~18°C, 120 dias
// GDD esperado: ~(18-10)*120 = 960
// ============================================================
const rsPoints = generateTempSeries('2025-10-01', 120, 18, 4)
export const TEMP_COLD_RS: TemperatureData = {
  points: rsPoints,
  avgTemp: 18,
  minTemp: 9,
  maxTemp: 27,
  fetchedAt: new Date('2025-10-01'),
  source: 'API',
}

// ============================================================
// 3. TEMP_HOT_MT — Mato Grosso, Tmean ~30°C, 120 dias
// GDD esperado: ~(30-10)*120 = 2400
// ============================================================
const mtPoints = generateTempSeries('2025-10-01', 120, 30, 2)
export const TEMP_HOT_MT: TemperatureData = {
  points: mtPoints,
  avgTemp: 30,
  minTemp: 25,
  maxTemp: 35,
  fetchedAt: new Date('2025-10-01'),
  source: 'API',
}

// ============================================================
// 4. TEMP_BELOW_TBASE — Período frio (Tmean < Tbase)
// GDD deve ser 0 para esses dias
// ============================================================
const coldPoints = generateTempSeries('2025-07-01', 30, 8, 2)
export const TEMP_BELOW_TBASE: TemperatureData = {
  points: coldPoints,
  avgTemp: 8,
  minTemp: 3,
  maxTemp: 13,
  fetchedAt: new Date('2025-07-01'),
  source: 'API',
}

// ============================================================
// 5. TEMP_EMPTY — Sem dados de temperatura
// ============================================================
export const TEMP_EMPTY: TemperatureData = {
  points: [],
  avgTemp: 0,
  minTemp: 0,
  maxTemp: 0,
  fetchedAt: new Date('2025-10-01'),
  source: 'UNAVAILABLE',
}
