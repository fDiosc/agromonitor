/**
 * Climate Envelope - API fetch functions
 */

import { MERX_API_BASE, YEARS_FOR_ENVELOPE } from './types'
import type { DailyClimatePoint } from './types'
import { getDayOfYear } from './types'

// ==================== Helper Functions ====================

export function ensureFeatureCollection(geometry: any): any {
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
export function extractApiDataArray(data: any): any[] {
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

export function getCentroid(geometry: any): { lat: number, lon: number } | null {
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
export async function fetchHistoricalPrecipitation(
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
export async function fetchHistoricalTemperature(
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
