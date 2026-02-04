/**
 * Precipitation Service
 * Integração com endpoint de precipitação da API Merx
 * e lógica de ajuste de janela de colheita
 */

import { isFeatureEnabled } from './feature-flags.service'

// ==================== Types ====================

export interface PrecipitationPoint {
  date: string          // YYYY-MM-DD
  precipMm: number      // mm/dia
}

export interface PrecipitationData {
  points: PrecipitationPoint[]
  totalMm: number
  avgDailyMm: number
  maxDailyMm: number
  rainyDays: number
  dryDays: number
  fetchedAt: Date
  source: 'API' | 'CACHE' | 'UNAVAILABLE'
}

export interface HarvestAdjustment {
  originalStart: Date
  adjustedStart: Date
  delayDays: number
  reason: string | null
  recentPrecipMm: number
  grainQualityRisk: 'BAIXO' | 'MEDIO' | 'ALTO'
}

// ==================== Constants ====================

const MERX_API_BASE = process.env.MERX_API_URL || 'https://homolog.api.merx.tech/api/monitoramento'

// Thresholds para ajuste de colheita
const PRECIP_THRESHOLDS = {
  HIGH_RAIN: 100,      // mm em 10 dias - atrasar 5 dias
  MODERATE_RAIN: 50,   // mm em 10 dias - atrasar 3 dias
  LOW_RAIN: 20,        // mm em 10 dias - sem ajuste
  GRAIN_QUALITY_HIGH: 80,   // mm - risco alto de qualidade
  GRAIN_QUALITY_MED: 40,    // mm - risco médio
}

// ==================== Helper Functions ====================

function getCentroid(geometry: any): { lat: number; lon: number } {
  try {
    let coords: number[][][] = []
    
    if (geometry.type === 'FeatureCollection' && geometry.features?.[0]) {
      coords = geometry.features[0].geometry.coordinates
    } else if (geometry.type === 'Feature') {
      coords = geometry.geometry.coordinates
    } else if (geometry.type === 'Polygon') {
      coords = geometry.coordinates
    }
    
    if (!coords || coords.length === 0) {
      return { lat: -15.0, lon: -47.0 } // Default Brasil central
    }
    
    // Pegar primeiro anel do polígono
    const ring = coords[0]
    let sumLat = 0
    let sumLon = 0
    
    for (const point of ring) {
      sumLon += point[0]
      sumLat += point[1]
    }
    
    return {
      lat: sumLat / ring.length,
      lon: sumLon / ring.length
    }
  } catch (error) {
    console.error('Error calculating centroid:', error)
    return { lat: -15.0, lon: -47.0 }
  }
}

// ==================== API Functions ====================

/**
 * Busca dados de precipitação da API Merx
 */
export async function fetchPrecipitation(
  geometry: any,
  startDate: Date,
  endDate: Date
): Promise<PrecipitationData> {
  try {
    const centroid = getCentroid(geometry)
    
    const body = {
      pontos: [{
        latitude: centroid.lat,
        longitude: centroid.lon,
        nome: 'talhao_0'
      }],
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0]
    }
    
    console.log('[PRECIP] Fetching precipitation data:', {
      lat: centroid.lat,
      lon: centroid.lon,
      start: body.start_date,
      end: body.end_date
    })
    
    const response = await fetch(`${MERX_API_BASE}/consulta-precipitacao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000)
    })
    
    if (!response.ok) {
      console.error('[PRECIP] API error:', response.status, response.statusText)
      return getEmptyPrecipitationData('UNAVAILABLE')
    }
    
    const data = await response.json()
    
    // Processar resposta
    const rawPoints = data['talhao_0'] || data['fazenda_1'] || []
    
    if (!Array.isArray(rawPoints) || rawPoints.length === 0) {
      console.log('[PRECIP] No data returned from API')
      return getEmptyPrecipitationData('UNAVAILABLE')
    }
    
    const points: PrecipitationPoint[] = rawPoints.map((p: any) => ({
      date: p.date,
      precipMm: p.GPM_mm_day || p.precip || p.value || 0
    }))
    
    // Calcular estatísticas
    const precipValues = points.map(p => p.precipMm)
    const totalMm = precipValues.reduce((sum, v) => sum + v, 0)
    const avgDailyMm = points.length > 0 ? totalMm / points.length : 0
    const maxDailyMm = Math.max(...precipValues, 0)
    const rainyDays = precipValues.filter(v => v > 0.5).length
    const dryDays = precipValues.filter(v => v <= 0.5).length
    
    console.log('[PRECIP] Data fetched:', {
      points: points.length,
      totalMm: totalMm.toFixed(1),
      avgDailyMm: avgDailyMm.toFixed(1),
      rainyDays
    })
    
    return {
      points,
      totalMm,
      avgDailyMm,
      maxDailyMm,
      rainyDays,
      dryDays,
      fetchedAt: new Date(),
      source: 'API'
    }
  } catch (error) {
    console.error('[PRECIP] Error fetching precipitation:', error)
    return getEmptyPrecipitationData('UNAVAILABLE')
  }
}

function getEmptyPrecipitationData(source: 'API' | 'CACHE' | 'UNAVAILABLE'): PrecipitationData {
  return {
    points: [],
    totalMm: 0,
    avgDailyMm: 0,
    maxDailyMm: 0,
    rainyDays: 0,
    dryDays: 0,
    fetchedAt: new Date(),
    source
  }
}

// ==================== Harvest Adjustment ====================

/**
 * Calcula ajuste de janela de colheita baseado em precipitação recente
 */
export function calculateHarvestAdjustment(
  harvestStart: Date,
  precipData: PrecipitationData
): HarvestAdjustment {
  // Filtrar últimos 10 dias antes da colheita
  const harvestStartTime = harvestStart.getTime()
  const tenDaysBefore = harvestStartTime - (10 * 24 * 60 * 60 * 1000)
  
  const recentPoints = precipData.points.filter(p => {
    const pointTime = new Date(p.date).getTime()
    return pointTime >= tenDaysBefore && pointTime <= harvestStartTime
  })
  
  const recentPrecipMm = recentPoints.reduce((sum, p) => sum + p.precipMm, 0)
  
  let delayDays = 0
  let reason: string | null = null
  let grainQualityRisk: 'BAIXO' | 'MEDIO' | 'ALTO' = 'BAIXO'
  
  if (recentPrecipMm > PRECIP_THRESHOLDS.HIGH_RAIN) {
    delayDays = 5
    reason = `Atraso de 5 dias devido a ${recentPrecipMm.toFixed(0)}mm nos últimos 10 dias`
    grainQualityRisk = 'ALTO'
  } else if (recentPrecipMm > PRECIP_THRESHOLDS.MODERATE_RAIN) {
    delayDays = 3
    reason = `Atraso de 3 dias devido a ${recentPrecipMm.toFixed(0)}mm nos últimos 10 dias`
    grainQualityRisk = 'MEDIO'
  } else if (recentPrecipMm > PRECIP_THRESHOLDS.GRAIN_QUALITY_MED) {
    grainQualityRisk = 'MEDIO'
  }
  
  const adjustedStart = new Date(harvestStart)
  adjustedStart.setDate(adjustedStart.getDate() + delayDays)
  
  return {
    originalStart: harvestStart,
    adjustedStart,
    delayDays,
    reason,
    recentPrecipMm,
    grainQualityRisk
  }
}

/**
 * Busca e processa precipitação para um talhão
 * Respeita feature flags
 */
export async function getPrecipitationForField(
  workspaceId: string,
  geometry: any,
  seasonStart: Date,
  harvestStart?: Date
): Promise<{
  data: PrecipitationData
  adjustment: HarvestAdjustment | null
} | null> {
  // Verificar se precipitação está habilitada
  const enabled = await isFeatureEnabled(workspaceId, 'enablePrecipitation')
  
  if (!enabled) {
    console.log('[PRECIP] Precipitation disabled for workspace')
    return null
  }
  
  // Definir período de busca
  const endDate = new Date()
  const startDate = new Date(seasonStart)
  
  // Buscar dados
  const precipData = await fetchPrecipitation(geometry, startDate, endDate)
  
  // Calcular ajuste se temos data de colheita
  let adjustment: HarvestAdjustment | null = null
  if (harvestStart && precipData.source !== 'UNAVAILABLE') {
    const adjustEnabled = await isFeatureEnabled(workspaceId, 'usePrecipitationAdjust')
    if (adjustEnabled) {
      adjustment = calculateHarvestAdjustment(harvestStart, precipData)
    }
  }
  
  return { data: precipData, adjustment }
}

/**
 * Formata dados de precipitação para armazenamento (JSON string)
 */
export function serializePrecipitation(data: PrecipitationData): string {
  return JSON.stringify({
    points: data.points,
    totalMm: data.totalMm,
    avgDailyMm: data.avgDailyMm,
    maxDailyMm: data.maxDailyMm,
    rainyDays: data.rainyDays,
    dryDays: data.dryDays,
    fetchedAt: data.fetchedAt.toISOString(),
    source: data.source
  })
}

/**
 * Deserializa dados de precipitação do banco
 */
export function deserializePrecipitation(json: string | null): PrecipitationData | null {
  if (!json) return null
  
  try {
    const parsed = JSON.parse(json)
    return {
      ...parsed,
      fetchedAt: new Date(parsed.fetchedAt)
    }
  } catch {
    return null
  }
}
