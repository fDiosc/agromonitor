/**
 * Climate Envelope - Analysis functions
 */

import { isFeatureEnabled } from '../feature-flags.service'
import { ANOMALY_THRESHOLD, EXTREME_THRESHOLD, getDayOfYear, getDateFromDayOfYear } from './types'
import type {
  DailyClimatePoint,
  ClimateEnvelope,
  ClimateEnvelopePoint,
  ClimateAnomaly,
  ClimateComparisonResult
} from './types'
import { fetchHistoricalPrecipitation, fetchHistoricalTemperature, fetchHistoricalClimateData } from './api'

// ==================== Envelope Calculation ====================

/** Calcula o envelope climático a partir de dados históricos */
export function calculateClimateEnvelope(
  historicalData: DailyClimatePoint[][],
  type: 'PRECIPITATION' | 'TEMPERATURE'
): ClimateEnvelope {
  // Agrupar por dia do ano
  const byDayOfYear: Map<number, number[]> = new Map()

  for (const yearData of historicalData) {
    for (const point of yearData) {
      const doy = point.dayOfYear || getDayOfYear(point.date)

      if (!byDayOfYear.has(doy)) {
        byDayOfYear.set(doy, [])
      }
      byDayOfYear.get(doy)!.push(point.value)
    }
  }

  // Calcular estatísticas para cada dia do ano
  const points: ClimateEnvelopePoint[] = []

  for (let doy = 1; doy <= 365; doy++) {
    const values = byDayOfYear.get(doy) || []

    if (values.length === 0) {
      // Interpolar de dias vizinhos se não há dados
      const prevDoy = doy > 1 ? doy - 1 : 365
      const nextDoy = doy < 365 ? doy + 1 : 1
      const prevValues = byDayOfYear.get(prevDoy) || []
      const nextValues = byDayOfYear.get(nextDoy) || []

      if (prevValues.length > 0 || nextValues.length > 0) {
        const allNeighbors = [...prevValues, ...nextValues]
        const mean = allNeighbors.reduce((a, b) => a + b, 0) / allNeighbors.length
        points.push({
          dayOfYear: doy,
          mean,
          stdDev: 0,
          upper: mean,
          lower: mean,
          min: mean,
          max: mean,
          count: 0
        })
      }
      continue
    }

    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
    const stdDev = Math.sqrt(variance)

    points.push({
      dayOfYear: doy,
      mean,
      stdDev,
      upper: mean + ANOMALY_THRESHOLD * stdDev,
      lower: Math.max(0, mean - ANOMALY_THRESHOLD * stdDev),
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length
    })
  }

  return {
    type,
    points,
    historicalYears: historicalData.length,
    generatedAt: new Date(),
    anomalies: []
  }
}

/** Detecta anomalias comparando safra atual com envelope */
export function detectAnomalies(
  currentSeason: DailyClimatePoint[],
  envelope: ClimateEnvelope
): ClimateAnomaly[] {
  const anomalies: ClimateAnomaly[] = []

  for (const point of currentSeason) {
    const doy = point.dayOfYear || getDayOfYear(point.date)
    const envelopePoint = envelope.points.find(p => p.dayOfYear === doy)

    if (!envelopePoint || envelopePoint.stdDev === 0) continue

    const deviation = (point.value - envelopePoint.mean) / envelopePoint.stdDev

    if (Math.abs(deviation) >= ANOMALY_THRESHOLD) {
      let type: ClimateAnomaly['type']
      let description: string

      const typeLabel = envelope.type === 'PRECIPITATION' ? 'Precipitação' : 'Temperatura'

      if (deviation >= EXTREME_THRESHOLD) {
        type = 'EXTREME_ABOVE'
        description = `${typeLabel} extremamente acima do normal (${deviation.toFixed(1)}σ)`
      } else if (deviation >= ANOMALY_THRESHOLD) {
        type = 'ABOVE'
        description = `${typeLabel} acima do normal (${deviation.toFixed(1)}σ)`
      } else if (deviation <= -EXTREME_THRESHOLD) {
        type = 'EXTREME_BELOW'
        description = `${typeLabel} extremamente abaixo do normal (${Math.abs(deviation).toFixed(1)}σ)`
      } else {
        type = 'BELOW'
        description = `${typeLabel} abaixo do normal (${Math.abs(deviation).toFixed(1)}σ)`
      }

      anomalies.push({
        date: point.date,
        dayOfYear: doy,
        actualValue: point.value,
        expectedMean: envelopePoint.mean,
        deviation,
        type,
        description
      })
    }
  }

  return anomalies
}

/** Compara safra atual com envelope e retorna resultado completo */
export function compareWithEnvelope(
  currentSeason: DailyClimatePoint[],
  envelope: ClimateEnvelope
): ClimateComparisonResult {
  const anomalies = detectAnomalies(currentSeason, envelope)

  const daysAboveNormal = anomalies.filter(a => a.type === 'ABOVE' || a.type === 'EXTREME_ABOVE').length
  const daysBelowNormal = anomalies.filter(a => a.type === 'BELOW' || a.type === 'EXTREME_BELOW').length
  const extremeEvents = anomalies.filter(a => a.type.startsWith('EXTREME')).length
  const avgDeviation = anomalies.length > 0
    ? anomalies.reduce((sum, a) => sum + a.deviation, 0) / anomalies.length
    : 0

  return {
    envelope: { ...envelope, anomalies },
    currentSeason,
    anomalies,
    summary: {
      daysAboveNormal,
      daysBelowNormal,
      extremeEvents,
      avgDeviation
    }
  }
}

/** Formata dados de envelope para o gráfico Recharts */
export function formatEnvelopeForChart(
  envelope: ClimateEnvelope,
  currentSeason: DailyClimatePoint[],
  startDayOfYear: number,
  endDayOfYear: number,
  year: number
): any[] {
  const chartData: any[] = []

  for (let doy = startDayOfYear; doy <= endDayOfYear; doy++) {
    const envPoint = envelope.points.find(p => p.dayOfYear === doy)
    const currentPoint = currentSeason.find(p => (p.dayOfYear || getDayOfYear(p.date)) === doy)

    if (envPoint) {
      chartData.push({
        date: getDateFromDayOfYear(doy, year),
        dayOfYear: doy,
        mean: envPoint.mean,
        upper: envPoint.upper,
        lower: envPoint.lower,
        current: currentPoint?.value,
        isAnomaly: currentPoint && (currentPoint.value > envPoint.upper || currentPoint.value < envPoint.lower)
      })
    }
  }

  return chartData
}

/** Calcula impacto de anomalias climáticas na fenologia */
export function calculateClimateImpact(comparison: ClimateComparisonResult): {
  eosAdjustmentDays: number
  yieldImpact: number
  riskLevel: 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO'
  explanation: string
} {
  const { summary } = comparison
  const isTemp = comparison.envelope.type === 'TEMPERATURE'

  let eosAdjustmentDays = 0
  let yieldImpact = 0
  let riskLevel: 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO' = 'BAIXO'
  let explanation = 'Condições climáticas dentro da normalidade.'

  if (summary.extremeEvents >= 5) {
    riskLevel = 'CRITICO'
    eosAdjustmentDays = isTemp ? 7 : 5
    yieldImpact = -15
    explanation = `${summary.extremeEvents} eventos climáticos extremos detectados. Alto risco de impacto na produtividade.`
  } else if (summary.extremeEvents >= 2 || summary.avgDeviation > 2) {
    riskLevel = 'ALTO'
    eosAdjustmentDays = isTemp ? 5 : 3
    yieldImpact = -10
    explanation = `Anomalias significativas detectadas (${summary.extremeEvents} extremos, desvio médio: ${summary.avgDeviation.toFixed(1)}σ).`
  } else if (summary.daysAboveNormal + summary.daysBelowNormal > 10) {
    riskLevel = 'MEDIO'
    eosAdjustmentDays = isTemp ? 3 : 2
    yieldImpact = -5
    explanation = `Padrão climático levemente anormal: ${summary.daysAboveNormal} dias acima, ${summary.daysBelowNormal} dias abaixo do normal.`
  }

  return { eosAdjustmentDays, yieldImpact, riskLevel, explanation }
}

/** Obtém envelope climático para um talhão (respeita feature flags). Busca dados históricos da API. */
export async function getClimateEnvelopeForField(
  workspaceId: string,
  geometry: any,
  seasonStartDate: Date,
  currentPrecipData?: DailyClimatePoint[],
  currentTempData?: DailyClimatePoint[]
): Promise<{
  precipitation: ClimateComparisonResult | null
  temperature: ClimateComparisonResult | null
} | null> {
  const enabled = await isFeatureEnabled(workspaceId, 'enableClimateEnvelope')

  if (!enabled) {
    console.log('[CLIMATE_ENVELOPE] Feature disabled for workspace')
    return null
  }

  console.log('[CLIMATE_ENVELOPE] Starting climate envelope calculation')

  // Definir período da safra atual
  const seasonEndDate = new Date()

  let precipResult: ClimateComparisonResult | null = null
  let tempResult: ClimateComparisonResult | null = null

  try {
    // Buscar dados de precipitação atual se não fornecido
    let currentPrecip = currentPrecipData
    if (!currentPrecip || currentPrecip.length === 0) {
      currentPrecip = await fetchHistoricalPrecipitation(geometry, seasonStartDate, seasonEndDate)
    }

    // Buscar dados históricos de precipitação
    if (currentPrecip.length > 0) {
      const historicalPrecip = await fetchHistoricalClimateData(
        geometry, seasonStartDate, seasonEndDate, 'PRECIPITATION', 5
      )

      if (historicalPrecip.length >= 2) {
        const envelope = calculateClimateEnvelope(historicalPrecip, 'PRECIPITATION')
        precipResult = compareWithEnvelope(currentPrecip, envelope)
        console.log('[CLIMATE_ENVELOPE] Precipitation envelope calculated:', {
          historicalYears: historicalPrecip.length,
          anomalies: precipResult.anomalies.length,
          daysAboveNormal: precipResult.summary.daysAboveNormal,
          daysBelowNormal: precipResult.summary.daysBelowNormal
        })
      }
    }

    // Buscar dados de temperatura atual se não fornecido
    let currentTemp = currentTempData
    if (!currentTemp || currentTemp.length === 0) {
      currentTemp = await fetchHistoricalTemperature(geometry, seasonStartDate, seasonEndDate)
    }

    // Buscar dados históricos de temperatura (máx 3 anos pela API)
    if (currentTemp.length > 0) {
      const historicalTemp = await fetchHistoricalClimateData(
        geometry, seasonStartDate, seasonEndDate, 'TEMPERATURE', 3
      )

      if (historicalTemp.length >= 2) {
        const envelope = calculateClimateEnvelope(historicalTemp, 'TEMPERATURE')
        tempResult = compareWithEnvelope(currentTemp, envelope)
        console.log('[CLIMATE_ENVELOPE] Temperature envelope calculated:', {
          historicalYears: historicalTemp.length,
          anomalies: tempResult.anomalies.length,
          daysAboveNormal: tempResult.summary.daysAboveNormal,
          daysBelowNormal: tempResult.summary.daysBelowNormal
        })
      }
    }
  } catch (error) {
    console.error('[CLIMATE_ENVELOPE] Error calculating envelope:', error)
  }

  return {
    precipitation: precipResult,
    temperature: tempResult
  }
}

/** Serializa envelope para armazenamento */
export function serializeClimateEnvelope(data: ClimateComparisonResult): string {
  return JSON.stringify({
    envelope: {
      type: data.envelope.type,
      points: data.envelope.points,
      historicalYears: data.envelope.historicalYears,
      generatedAt: data.envelope.generatedAt.toISOString()
    },
    summary: data.summary,
    anomalies: data.anomalies
  })
}
