/**
 * Sentinel-1 Radar Service - Process API (images, cloud coverage)
 */

import { getAccessToken } from './auth'

const SENTINEL_HUB_CATALOG = 'https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search'
const PROCESS_URL = 'https://sh.dataspace.copernicus.eu/api/v1/process'

/**
 * Busca imagem renderizada do CDSE Process API
 * Reutiliza auth existente do sentinel1.service
 * Usado pelo pipeline de Validação Visual IA (Curador + Juiz)
 */
export async function processImage(
  workspaceId: string,
  params: {
    bbox: [number, number, number, number]
    dateFrom: string
    dateTo: string
    evalscript: string
    dataCollection: string
    width?: number
    height?: number
  }
): Promise<Buffer | null> {
  const accessToken = await getAccessToken(workspaceId)
  if (!accessToken) return null

  const body = {
    input: {
      bounds: {
        bbox: params.bbox,
        properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' }
      },
      data: [{
        dataFilter: {
          timeRange: { from: params.dateFrom, to: params.dateTo },
          ...(params.dataCollection.includes('sentinel-2') ||
              params.dataCollection.includes('landsat')
              ? { maxCloudCoverage: 100 } : {})
        },
        type: params.dataCollection
      }]
    },
    output: {
      width: params.width ?? 512,
      height: params.height ?? 512,
      responses: [{ identifier: 'default', format: { type: 'image/png' } }]
    },
    evalscript: params.evalscript
  }

  try {
    const response = await fetch(PROCESS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'image/png'
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000)
    })

    if (!response.ok) {
      console.error('[SENTINEL1] Process image error:', response.status, await response.text().catch(() => ''))
      return null
    }
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error) {
    console.error('[SENTINEL1] Process image error:', error)
    return null
  }
}

/**
 * Search Sentinel Hub Catalog for cloud coverage of a given bbox + date range.
 * Returns the average cloud coverage (%) from matching scenes, or null if unavailable.
 * Only applicable to optical collections (Sentinel-2, Landsat).
 */
export async function searchCatalogCloudCover(
  workspaceId: string,
  params: {
    bbox: [number, number, number, number]
    dateFrom: string
    dateTo: string
    collection: string
  }
): Promise<number | null> {
  if (params.collection.includes('sentinel-1')) return null

  const accessToken = await getAccessToken(workspaceId)
  if (!accessToken) return null

  const body = {
    bbox: params.bbox,
    datetime: `${params.dateFrom}/${params.dateTo}`,
    collections: [params.collection],
    limit: 5,
    fields: {
      include: ['properties.eo:cloud_cover', 'properties.datetime'],
    },
  }

  try {
    const response = await fetch(SENTINEL_HUB_CATALOG, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) return null

    const data = await response.json()
    const features = data.features || []

    if (features.length === 0) return null

    const cloudValues: number[] = []
    for (const feature of features) {
      const cc = feature.properties?.['eo:cloud_cover']
      if (cc !== undefined && cc !== null) {
        cloudValues.push(cc)
      }
    }

    if (cloudValues.length === 0) return null

    return Math.round(Math.min(...cloudValues) * 10) / 10
  } catch (error) {
    console.error('[SENTINEL1] Catalog search error:', error)
    return null
  }
}
