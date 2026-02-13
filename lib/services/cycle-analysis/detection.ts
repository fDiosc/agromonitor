/**
 * Cycle Detection and Analysis Functions
 */

import type { NdviPoint } from '../merx.service'
import type { CycleDetection, AlignedCycle, AlignedCyclePoint, HistoricalEnvelope, CycleAnalysisResult } from './types'
import { getDayOfYear, detectCycleBoundaries } from './helpers'

/**
 * Detecta ciclo fenológico em uma série de dados NDVI
 */
export function detectCycle(data: NdviPoint[], crop: string, year?: number): CycleDetection {
  const sorted = [...data]
    .filter(d => d.ndvi_smooth !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const { sosIdx, eosIdx, peakIdx, peakNdvi } = detectCycleBoundaries(sorted, crop)

  const sosDate = sosIdx >= 0 ? sorted[sosIdx].date : null
  const eosDate = eosIdx >= 0 ? sorted[eosIdx].date : null
  const peakDate = peakIdx >= 0 ? sorted[peakIdx].date : null

  const sosDayOfYear = sosDate ? getDayOfYear(new Date(sosDate)) : null
  const eosDayOfYear = eosDate ? getDayOfYear(new Date(eosDate)) : null

  let cycleDays = 120 // default
  if (sosDate && eosDate) {
    const sosTime = new Date(sosDate).getTime()
    const eosTime = new Date(eosDate).getTime()
    cycleDays = Math.round((eosTime - sosTime) / (1000 * 60 * 60 * 24))
  }

  const detectedYear = year || (sorted.length > 0 ? new Date(sorted[0].date).getFullYear() : new Date().getFullYear())

  return {
    year: detectedYear,
    sosDate,
    eosDate,
    peakDate,
    sosDayOfYear,
    eosDayOfYear,
    cycleDays,
    peakNdvi,
    data: sorted
  }
}

/**
 * Alinha dados NDVI pelo dia do ciclo (0 = SOS)
 */
export function alignCycleData(detection: CycleDetection): AlignedCycle | null {
  if (!detection.sosDate) return null

  const sosTime = new Date(detection.sosDate).getTime()

  const points: AlignedCyclePoint[] = detection.data
    .filter(d => d.ndvi_smooth !== null)
    .map(d => {
      const dayOfCycle = Math.round(
        (new Date(d.date).getTime() - sosTime) / (1000 * 60 * 60 * 24)
      )
      return {
        dayOfCycle,
        date: d.date,
        ndvi: d.ndvi_smooth || d.ndvi_interp || 0
      }
    })
    .filter(p => p.dayOfCycle >= -10) // Incluir até 10 dias antes do SOS
    .sort((a, b) => a.dayOfCycle - b.dayOfCycle)

  if (points.length === 0) return null

  return {
    year: detection.year,
    sosDate: detection.sosDate,
    eosDate: detection.eosDate,
    cycleDays: detection.cycleDays,
    peakNdvi: detection.peakNdvi,
    points
  }
}

/**
 * Calcula envelope histórico (min, max, avg, median por dia do ciclo)
 */
export function calculateEnvelope(alignedCycles: AlignedCycle[]): HistoricalEnvelope[] {
  if (alignedCycles.length === 0) return []

  // Encontrar range de dias
  let minDay = 0
  let maxDay = 0
  alignedCycles.forEach(cycle => {
    cycle.points.forEach(p => {
      if (p.dayOfCycle < minDay) minDay = p.dayOfCycle
      if (p.dayOfCycle > maxDay) maxDay = p.dayOfCycle
    })
  })

  const envelope: HistoricalEnvelope[] = []

  // Para cada dia do ciclo
  for (let day = minDay; day <= maxDay; day++) {
    const values: number[] = []

    alignedCycles.forEach(cycle => {
      // Encontrar ponto mais próximo deste dia
      const closest = cycle.points.reduce((prev, curr) => {
        return Math.abs(curr.dayOfCycle - day) < Math.abs(prev.dayOfCycle - day) ? curr : prev
      })

      // Só usar se estiver dentro de 3 dias
      if (Math.abs(closest.dayOfCycle - day) <= 3) {
        values.push(closest.ndvi)
      }
    })

    if (values.length > 0) {
      values.sort((a, b) => a - b)
      const mid = Math.floor(values.length / 2)

      envelope.push({
        dayOfCycle: day,
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        median: values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2,
        count: values.length
      })
    }
  }

  return envelope
}

/**
 * Calcula aderência da safra atual ao envelope histórico
 */
export function calculateAdherence(
  currentCycle: AlignedCycle,
  envelope: HistoricalEnvelope[]
): number {
  if (!currentCycle || envelope.length === 0) return 50

  let totalScore = 0
  let count = 0

  currentCycle.points.forEach(point => {
    const envPoint = envelope.find(e => Math.abs(e.dayOfCycle - point.dayOfCycle) <= 2)
    if (envPoint) {
      // Score baseado na distância da média
      const range = envPoint.max - envPoint.min
      if (range > 0) {
        const distFromAvg = Math.abs(point.ndvi - envPoint.avg)
        const normalizedDist = distFromAvg / (range / 2)
        totalScore += Math.max(0, 100 - normalizedDist * 50)
        count++
      }
    }
  })

  return count > 0 ? Math.round(totalScore / count) : 50
}

/**
 * Projeta EOS baseado no histórico
 */
export function projectEos(
  currentCycle: AlignedCycle,
  historicalCycles: AlignedCycle[]
): { projectedEosDate: string; avgCycleDays: number; confidence: number } | null {
  if (!currentCycle || historicalCycles.length === 0) return null

  // Calcular média de dias do ciclo histórico
  const cycleDaysArray = historicalCycles
    .filter(c => c.eosDate)
    .map(c => c.cycleDays)

  if (cycleDaysArray.length === 0) return null

  const avgCycleDays = Math.round(
    cycleDaysArray.reduce((a, b) => a + b, 0) / cycleDaysArray.length
  )

  // Projetar EOS
  const sosDate = new Date(currentCycle.sosDate)
  const projectedEos = new Date(sosDate)
  projectedEos.setDate(projectedEos.getDate() + avgCycleDays)

  // Confidence baseada no desvio padrão
  const variance = cycleDaysArray.reduce((sum, days) => {
    return sum + Math.pow(days - avgCycleDays, 2)
  }, 0) / cycleDaysArray.length
  const stdDev = Math.sqrt(variance)
  const confidence = Math.max(30, Math.min(95, 100 - stdDev * 2))

  return {
    projectedEosDate: projectedEos.toISOString().split('T')[0],
    avgCycleDays,
    confidence: Math.round(confidence)
  }
}

/**
 * Análise completa de ciclo com histórico
 */
export function analyzeCycles(
  currentData: NdviPoint[],
  historicalData: NdviPoint[][],
  crop: string = 'SOJA'
): CycleAnalysisResult {
  // Detectar ciclo atual
  const currentDetection = detectCycle(currentData, crop, new Date().getFullYear())
  const currentCycle = alignCycleData(currentDetection)

  // Processar histórico
  const historicalCycles: AlignedCycle[] = []
  historicalData.forEach((data, idx) => {
    if (data.length > 0) {
      const year = new Date().getFullYear() - (idx + 1)
      const detection = detectCycle(data, crop, year)
      const aligned = alignCycleData(detection)
      if (aligned) {
        historicalCycles.push(aligned)
      }
    }
  })

  // Calcular envelope
  const envelope = calculateEnvelope(historicalCycles)

  // Calcular aderência
  const adherenceScore = currentCycle
    ? calculateAdherence(currentCycle, envelope)
    : 50

  // Projetar EOS
  const projection = currentCycle
    ? projectEos(currentCycle, historicalCycles)
    : null

  // Correlação = média de (100 - |diff de NDVI| * 100) para cada ponto
  let correlationScore = 50
  if (currentCycle && envelope.length > 0) {
    let sumCorr = 0
    let countCorr = 0
    currentCycle.points.forEach(p => {
      const envPoint = envelope.find(e => Math.abs(e.dayOfCycle - p.dayOfCycle) <= 2)
      if (envPoint) {
        const diff = Math.abs(p.ndvi - envPoint.avg)
        sumCorr += Math.max(0, 100 - diff * 150)
        countCorr++
      }
    })
    correlationScore = countCorr > 0 ? Math.round(sumCorr / countCorr) : 50
  }

  return {
    currentCycle,
    historicalCycles,
    envelope,
    avgCycleDays: projection?.avgCycleDays || 120,
    projectedEosDate: projection?.projectedEosDate || null,
    correlationScore,
    adherenceScore
  }
}
