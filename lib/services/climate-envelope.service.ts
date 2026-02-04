/**
 * Climate Envelope Service
 * Calcula bandas históricas (tipo Bollinger) para precipitação e temperatura
 * para detectar anomalias climáticas e ajustar projeções
 */

import { isFeatureEnabled } from './feature-flags.service'

// ==================== Constants ====================

const MERX_API_BASE = process.env.MERX_API_URL || 'https://homolog.api.merx.tech/api/monitoramento'
const YEARS_FOR_ENVELOPE = 5
const ANOMALY_THRESHOLD = 1.5  // Desvios padrão para considerar anomalia
const EXTREME_THRESHOLD = 2.5  // Desvios padrão para evento extremo

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

// ==================== Helper Functions ====================

function ensureFeatureCollection(geometry: any): any {
  if (geometry.type === 'FeatureCollection') {
    return geometry
  } else if (geometry.type === 'Feature') {
    return { type: 'FeatureCollection', features: [geometry] }
  } else if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {},
        geometry: geometry
      }]
    }
  }
  return geometry
}

/**
 * Extrai array de dados da resposta da API de forma robusta.
 * A API Merx pode retornar a key com diferentes nomes:
 * - 'talhao_0', 'talhao_1', etc. (índice do talhão)
 * - 'fazenda_1' (para fazendas)
 * - Nome do talhão informado na geometria (ex: 'Talhão 24')
 * - Qualquer outro nome personalizado
 * 
 * Esta função busca o primeiro array disponível na resposta.
 */
function extractApiDataArray(data: any): any[] {
  if (!data || typeof data !== 'object') return []
  
  // Tentar keys comuns primeiro para performance
  const commonKeys = ['talhao_0', 'fazenda_1', 'field_centroid', 'balanco']
  for (const key of commonKeys) {
    if (Array.isArray(data[key]) && data[key].length > 0) {
      return data[key]
    }
  }
  
  // Buscar qualquer key que contenha um array não-vazio
  for (const key of Object.keys(data)) {
    const value = data[key]
    if (Array.isArray(value) && value.length > 0) {
      console.log(`[API] Usando key dinâmica: "${key}" com ${value.length} items`)
      return value
    }
  }
  
  return []
}

function getCentroid(geometry: any): { lat: number, lon: number } | null {
  try {
    const geojson = typeof geometry === 'string' ? JSON.parse(geometry) : geometry
    let coords: number[][][] = []
    
    if (geojson.type === 'FeatureCollection') {
      coords = geojson.features[0]?.geometry?.coordinates || []
    } else if (geojson.type === 'Feature') {
      coords = geojson.geometry?.coordinates || []
    } else if (geojson.type === 'Polygon') {
      coords = geojson.coordinates || []
    }
    
    if (coords.length === 0 || coords[0].length === 0) return null
    
    const ring = coords[0]
    let sumLon = 0, sumLat = 0
    for (const point of ring) {
      sumLon += point[0]
      sumLat += point[1]
    }
    return {
      lon: sumLon / ring.length,
      lat: sumLat / ring.length
    }
  } catch {
    return null
  }
}

// ==================== API Functions ====================

/**
 * Busca dados históricos de precipitação da API
 */
async function fetchHistoricalPrecipitation(
  geometry: any,
  startDate: Date,
  endDate: Date
): Promise<DailyClimatePoint[]> {
  try {
    const centroid = getCentroid(geometry)
    if (!centroid) return []
    
    const body = {
      pontos: [{
        latitude: centroid.lat,
        longitude: centroid.lon,
        nome: 'field_centroid'
      }],
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0]
    }
    
    const response = await fetch(`${MERX_API_BASE}/consulta-precipitacao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000)
    })
    
    if (!response.ok) return []
    
    const data = await response.json()
    const points = extractApiDataArray(data)
    
    if (points.length === 0) return []
    
    return points.map((p: any) => ({
      date: p.date,
      dayOfYear: getDayOfYear(p.date),
      value: p.GPM_mm_day || p.value || 0
    }))
  } catch (error) {
    console.error('[CLIMATE_ENVELOPE] Error fetching precipitation:', error)
    return []
  }
}

/**
 * Busca dados históricos de temperatura da API
 */
async function fetchHistoricalTemperature(
  geometry: any,
  startDate: Date,
  endDate: Date
): Promise<DailyClimatePoint[]> {
  try {
    const geojson = ensureFeatureCollection(
      typeof geometry === 'string' ? JSON.parse(geometry) : geometry
    )
    
    const body = {
      geojson,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0]
    }
    
    const response = await fetch(`${MERX_API_BASE}/consulta-temperatura-json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000)
    })
    
    if (!response.ok) return []
    
    const data = await response.json()
    const points = extractApiDataArray(data)
    
    if (points.length === 0) return []
    
    return points.map((p: any) => ({
      date: p.date,
      dayOfYear: getDayOfYear(p.date),
      value: p.value || p.temp_media || 0
    }))
  } catch (error) {
    console.error('[CLIMATE_ENVELOPE] Error fetching temperature:', error)
    return []
  }
}

/**
 * Busca dados históricos para múltiplos anos
 */
export async function fetchHistoricalClimateData(
  geometry: any,
  seasonStartDate: Date,
  seasonEndDate: Date,
  type: 'PRECIPITATION' | 'TEMPERATURE',
  yearsBack: number = YEARS_FOR_ENVELOPE
): Promise<DailyClimatePoint[][]> {
  const historicalData: DailyClimatePoint[][] = []
  const currentYear = seasonStartDate.getFullYear()
  
  // Limitar anos de acordo com a API (temperatura máx 3 anos)
  const maxYears = type === 'TEMPERATURE' ? Math.min(yearsBack, 3) : yearsBack
  
  console.log(`[CLIMATE_ENVELOPE] Fetching ${maxYears} years of ${type} data`)
  
  for (let i = 1; i <= maxYears; i++) {
    const yearOffset = i
    const startDate = new Date(seasonStartDate)
    startDate.setFullYear(currentYear - yearOffset)
    const endDate = new Date(seasonEndDate)
    endDate.setFullYear(currentYear - yearOffset)
    
    const fetchFn = type === 'PRECIPITATION' 
      ? fetchHistoricalPrecipitation 
      : fetchHistoricalTemperature
    
    const points = await fetchFn(geometry, startDate, endDate)
    
    if (points.length > 0) {
      historicalData.push(points)
      console.log(`[CLIMATE_ENVELOPE] Year ${currentYear - yearOffset}: ${points.length} points`)
    }
  }
  
  return historicalData
}

// ==================== Additional Helper Functions ====================

function getDayOfYear(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date) : date
  const start = new Date(d.getFullYear(), 0, 0)
  const diff = d.getTime() - start.getTime()
  const oneDay = 1000 * 60 * 60 * 24
  return Math.floor(diff / oneDay)
}

function getDateFromDayOfYear(dayOfYear: number, year: number): string {
  const date = new Date(year, 0, dayOfYear)
  return date.toISOString().split('T')[0]
}

// ==================== Envelope Calculation ====================

/**
 * Calcula o envelope climático a partir de dados históricos
 */
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

/**
 * Detecta anomalias comparando safra atual com envelope
 */
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

/**
 * Compara safra atual com envelope e retorna resultado completo
 */
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

/**
 * Formata dados de envelope para o gráfico Recharts
 */
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

/**
 * Calcula impacto de anomalias climáticas na fenologia
 */
export function calculateClimateImpact(comparison: ClimateComparisonResult): {
  eosAdjustmentDays: number
  yieldImpact: number
  riskLevel: 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO'
  explanation: string
} {
  const { summary, anomalies } = comparison
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

/**
 * Obtém envelope climático para um talhão (respeita feature flags)
 * Busca dados históricos automaticamente da API
 */
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

/**
 * Serializa envelope para armazenamento
 */
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
