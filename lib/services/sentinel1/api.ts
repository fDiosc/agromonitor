/**
 * Sentinel-1 Radar Service - API and data fetching
 *
 * Integração com Copernicus Data Space para dados SAR Sentinel-1
 * Usado para preencher gaps de NDVI causados por nuvens
 */

import { isFeatureEnabled } from '@/lib/services/feature-flags.service'
import { getAccessToken, getCopernicusCredentials } from './auth'
import { getBbox } from './helpers'
import { fetchS1Statistics } from './statistics'
import type { S1Scene, S1DataPoint, S1ProcessingResult } from './types'

const SENTINEL_HUB_CATALOG = 'https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search'

/**
 * Busca cenas Sentinel-1 disponíveis para uma geometria e período
 */
async function searchS1Scenes(
  accessToken: string,
  geometry: any,
  startDate: Date,
  endDate: Date
): Promise<S1Scene[]> {
  const bbox = getBbox(geometry)
  if (!bbox) return []

  try {
    const response = await fetch(SENTINEL_HUB_CATALOG, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bbox,
        datetime: `${startDate.toISOString()}/${endDate.toISOString()}`,
        collections: ['sentinel-1-grd'],
        limit: 100
      }),
      signal: AbortSignal.timeout(60000)
    })

    if (!response.ok) {
      console.error('[SENTINEL1] Catalog search failed:', response.status)
      return []
    }

    const data = await response.json()
    const features = data.features || []

    console.log('[SENTINEL1] Found', features.length, 'scenes')

    return features.map((f: any) => ({
      id: f.id,
      date: f.properties?.datetime?.split('T')[0] || '',
      orbitState: f.properties?.['sat:orbit_state'] || 'ascending',
      polarization: f.properties?.['s1:polarization'] || 'VV+VH'
    }))
  } catch (error) {
    console.error('[SENTINEL1] Error searching scenes:', error)
    return []
  }
}

/**
 * Busca dados Sentinel-1 para um talhão
 */
export async function getS1DataForField(
  workspaceId: string,
  geometry: any,
  startDate: Date,
  endDate: Date
): Promise<S1ProcessingResult | null> {
  const radarEnabled = await isFeatureEnabled(workspaceId, 'enableRadarNdvi')
  if (!radarEnabled) {
    console.log('[SENTINEL1] Radar NDVI disabled for workspace')
    return null
  }

  const accessToken = await getAccessToken(workspaceId)
  if (!accessToken) {
    console.log('[SENTINEL1] No access token available')
    return {
      scenes: [],
      data: [],
      rviTimeSeries: [],
      source: 'UNAVAILABLE',
      fetchedAt: new Date()
    }
  }

  const scenes = await searchS1Scenes(accessToken, geometry, startDate, endDate)

  if (scenes.length === 0) {
    console.log('[SENTINEL1] No scenes found for period')
    return {
      scenes: [],
      data: [],
      rviTimeSeries: [],
      source: 'UNAVAILABLE',
      fetchedAt: new Date()
    }
  }

  const dataPoints = await fetchS1Statistics(accessToken, geometry, startDate, endDate)

  const rviTimeSeries = dataPoints.map((dp: S1DataPoint) => ({
    date: dp.date,
    rvi: dp.rvi || 0
  }))

  console.log('[SENTINEL1] Data fetch complete:', {
    scenes: scenes.length,
    dataPoints: dataPoints.length,
    rviPoints: rviTimeSeries.length,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  })

  return {
    scenes,
    data: dataPoints,
    rviTimeSeries,
    source: 'API',
    fetchedAt: new Date()
  }
}

/**
 * Verifica se o workspace tem credenciais Copernicus configuradas
 */
export async function hasCopernicusCredentials(workspaceId: string): Promise<boolean> {
  const credentials = await getCopernicusCredentials(workspaceId)
  return credentials !== null
}

/**
 * Serializa resultado S1 para armazenamento
 */
export function serializeS1Data(result: S1ProcessingResult): string {
  return JSON.stringify({
    scenes: result.scenes,
    data: result.data,
    rviTimeSeries: result.rviTimeSeries,
    source: result.source,
    fetchedAt: result.fetchedAt.toISOString()
  })
}

/**
 * Deserializa dados S1 do banco
 */
export function deserializeS1Data(json: string | null): S1ProcessingResult | null {
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
