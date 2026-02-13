/**
 * Sentinel-1 Radar Service
 * Integração com Copernicus Data Space para dados SAR Sentinel-1
 * Usado para preencher gaps de NDVI causados por nuvens
 */

import prisma from '@/lib/prisma'
import { isFeatureEnabled } from './feature-flags.service'

// ==================== Types ====================

export interface S1Scene {
  id: string
  date: string
  orbitState: 'ascending' | 'descending'
  polarization: string
}

export interface S1DataPoint {
  date: string
  vv: number           // Backscatter VV (dB)
  vh: number           // Backscatter VH (dB)
  rvi?: number         // Radar Vegetation Index
  vhVvRatio?: number   // VH/VV ratio
}

export interface S1ProcessingResult {
  scenes: S1Scene[]
  data: S1DataPoint[]
  rviTimeSeries: { date: string, rvi: number }[]
  source: 'API' | 'UNAVAILABLE'
  fetchedAt: Date
}

export interface CopernicusAuth {
  accessToken: string
  expiresAt: Date
}

// ==================== Constants ====================

const COPERNICUS_TOKEN_URL = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token'
const SENTINEL_HUB_CATALOG = 'https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search'
const SENTINEL_HUB_STATISTICAL = 'https://sh.dataspace.copernicus.eu/api/v1/statistics'

// Cache de tokens por workspace
const tokenCache = new Map<string, CopernicusAuth>()

// ==================== Authentication ====================

/**
 * Obtém credenciais Copernicus do workspace
 */
async function getCopernicusCredentials(workspaceId: string): Promise<{
  clientId: string
  clientSecret: string
} | null> {
  const settings = await prisma.workspaceSettings.findUnique({
    where: { workspaceId },
    select: {
      copernicusClientId: true,
      copernicusClientSecret: true
    }
  })
  
  if (!settings?.copernicusClientId || !settings?.copernicusClientSecret) {
    return null
  }
  
  return {
    clientId: settings.copernicusClientId,
    clientSecret: settings.copernicusClientSecret
  }
}

/**
 * Obtém access token do Copernicus Data Space (OAuth2)
 */
async function getAccessToken(workspaceId: string): Promise<string | null> {
  // Verificar cache
  const cached = tokenCache.get(workspaceId)
  if (cached && cached.expiresAt > new Date()) {
    return cached.accessToken
  }
  
  // Buscar credenciais
  const credentials = await getCopernicusCredentials(workspaceId)
  if (!credentials) {
    console.log('[SENTINEL1] No Copernicus credentials configured for workspace')
    return null
  }
  
  try {
    const response = await fetch(COPERNICUS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret
      }),
      signal: AbortSignal.timeout(30000)
    })
    
    if (!response.ok) {
      console.error('[SENTINEL1] Token request failed:', response.status)
      return null
    }
    
    const data = await response.json()
    
    // Calcular expiração (com margem de 5 minutos)
    const expiresIn = data.expires_in || 300
    const expiresAt = new Date(Date.now() + (expiresIn - 300) * 1000)
    
    // Cachear token
    tokenCache.set(workspaceId, {
      accessToken: data.access_token,
      expiresAt
    })
    
    console.log('[SENTINEL1] Token obtained, expires in', expiresIn, 'seconds')
    return data.access_token
  } catch (error) {
    console.error('[SENTINEL1] Error getting access token:', error)
    return null
  }
}

// ==================== Helper Functions ====================

function getBbox(geometry: any): [number, number, number, number] | null {
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
    let minLon = Infinity, maxLon = -Infinity
    let minLat = Infinity, maxLat = -Infinity
    
    for (const point of ring) {
      minLon = Math.min(minLon, point[0])
      maxLon = Math.max(maxLon, point[0])
      minLat = Math.min(minLat, point[1])
      maxLat = Math.max(maxLat, point[1])
    }
    
    return [minLon, minLat, maxLon, maxLat]
  } catch {
    return null
  }
}

/**
 * Calcula DpRVI (Dual-pol Radar Vegetation Index) a partir de VH e VV
 * 
 * Fórmula correta para Sentinel-1 (RVI4S1):
 *   q = VH_lin / VV_lin (ratio)
 *   DpRVI = q(q+3) / (q+1)²
 * 
 * Esta fórmula naturalmente varia de 0 a 1:
 *   - q → 0 (solo exposto): DpRVI → 0
 *   - q → 1 (vegetação densa): DpRVI → 1
 * 
 * Referência: Mandal et al. (2020), Bhogapurapu et al. (2022)
 * Script oficial: https://custom-scripts.sentinel-hub.com/sentinel-1/radar_vegetation_index/
 */
function calculateRVI(vhDb: number, vvDb: number): number {
  // Converter de dB para linear (potência)
  const vhLin = Math.pow(10, vhDb / 10)
  const vvLin = Math.pow(10, vvDb / 10)
  
  // Evitar divisão por zero
  if (vvLin < 1e-10) return 1
  
  // Ratio q = VH/VV (em linear)
  const q = vhLin / vvLin
  
  // DpRVI = q(q+3) / (q+1)²
  // Equivalente a: 1 - m*beta onde m = (1-q)/(1+q) e beta = 1/(1+q)
  const numerator = q * (q + 3)
  const denominator = (q + 1) * (q + 1)
  
  const rvi = numerator / denominator
  
  // Teoricamente já está em 0-1, mas clamp por segurança
  return Math.max(0, Math.min(1, rvi))
}

// ==================== API Functions ====================

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
 * Extrai polígono GeoJSON da geometria
 */
function getPolygon(geometry: any): any | null {
  try {
    const geojson = typeof geometry === 'string' ? JSON.parse(geometry) : geometry
    
    if (geojson.type === 'FeatureCollection') {
      return geojson.features[0]?.geometry || null
    } else if (geojson.type === 'Feature') {
      return geojson.geometry || null
    } else if (geojson.type === 'Polygon' || geojson.type === 'MultiPolygon') {
      return geojson
    }
    return null
  } catch {
    return null
  }
}

/**
 * Processa cenas Sentinel-1 usando Statistical API
 * Retorna valores médios de VH e VV por data
 */
async function fetchS1Statistics(
  accessToken: string,
  geometry: any,
  startDate: Date,
  endDate: Date
): Promise<S1DataPoint[]> {
  const polygon = getPolygon(geometry)
  if (!polygon) {
    console.error('[SENTINEL1] Could not extract polygon from geometry')
    return []
  }
  
  // Evalscript para extrair VV e VH em LINEAR_POWER
  // IMPORTANTE: dataMask é obrigatório para a Statistical API
  const evalscript = `
//VERSION=3
function setup() {
  return {
    input: [{
      bands: ["VV", "VH", "dataMask"],
      units: "LINEAR_POWER"
    }],
    output: [
      { id: "vv_linear", bands: 1, sampleType: "FLOAT32" },
      { id: "vh_linear", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1, sampleType: "UINT8" }
    ]
  }
}

function evaluatePixel(sample) {
  return {
    vv_linear: [sample.VV],
    vh_linear: [sample.VH],
    dataMask: [sample.dataMask]
  }
}
`

  try {
    const response = await fetch(SENTINEL_HUB_STATISTICAL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: {
          bounds: {
            geometry: polygon,
            properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' }
          },
          data: [{
            type: 'sentinel-1-grd',
            dataFilter: {
              timeRange: {
                from: startDate.toISOString(),
                to: endDate.toISOString()
              },
              mosaickingOrder: 'mostRecent',
              polarization: 'DV'
            },
            processing: {
              backCoeff: 'GAMMA0_TERRAIN',
              orthorectify: true
            }
          }]
        },
        aggregation: {
          timeRange: {
            from: startDate.toISOString(),
            to: endDate.toISOString()
          },
          aggregationInterval: {
            of: 'P1D'
          },
          evalscript,
          // Usar width/height em vez de resx/resy para evitar erro de resolução
          // 100x100 pixels = ~300m resolução para talhão típico de 30ha
          width: 100,
          height: 100
        },
        calculations: {
          default: {}
        }
      }),
      signal: AbortSignal.timeout(120000)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('[SENTINEL1] Statistical API failed:', response.status, errorText.substring(0, 200))
      return []
    }
    
    const data = await response.json()
    const dataPoints: S1DataPoint[] = []
    
    // Parse da resposta da Statistical API
    const intervals = data.data || []
    
    for (const interval of intervals) {
      const dateFrom = interval.interval?.from
      if (!dateFrom) continue
      
      const date = dateFrom.split('T')[0]
      const outputs = interval.outputs || {}
      
      // Extrair valores médios de VV e VH (em linear power)
      const vvStats = outputs.vv_linear?.bands?.B0?.stats
      const vhStats = outputs.vh_linear?.bands?.B0?.stats
      
      if (vvStats?.mean !== undefined && vhStats?.mean !== undefined) {
        // Converter de linear power para dB: dB = 10 * log10(linear)
        const vvLin = vvStats.mean
        const vhLin = vhStats.mean
        
        // Evitar log de zero
        if (vvLin > 0 && vhLin > 0) {
          const vvDb = 10 * Math.log10(vvLin)
          const vhDb = 10 * Math.log10(vhLin)
          const rvi = calculateRVI(vhDb, vvDb)
          
          dataPoints.push({
            date,
            vv: vvDb,
            vh: vhDb,
            rvi,
            vhVvRatio: vhLin / vvLin
          })
        }
      }
    }
    
    console.log('[SENTINEL1] Statistical API returned', dataPoints.length, 'data points')
    
    return dataPoints.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )
  } catch (error) {
    console.error('[SENTINEL1] Error fetching statistics:', error)
    return []
  }
}

// ==================== Main Functions ====================

/**
 * Busca dados Sentinel-1 para um talhão
 */
export async function getS1DataForField(
  workspaceId: string,
  geometry: any,
  startDate: Date,
  endDate: Date
): Promise<S1ProcessingResult | null> {
  // Verificar se radar está habilitado
  const radarEnabled = await isFeatureEnabled(workspaceId, 'enableRadarNdvi')
  if (!radarEnabled) {
    console.log('[SENTINEL1] Radar NDVI disabled for workspace')
    return null
  }
  
  // Obter token
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
  
  // Buscar cenas disponíveis (para metadata)
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
  
  // Buscar dados estatísticos reais via Statistical API
  const dataPoints = await fetchS1Statistics(accessToken, geometry, startDate, endDate)
  
  // Construir série temporal de RVI
  const rviTimeSeries = dataPoints.map(dp => ({
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

// ==================== Process API (Imagens) ====================

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

// ==================== Catalog Search (Cloud Coverage) ====================

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
  // Radar collections don't have cloud coverage
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

    // Get cloud coverage from matched scenes
    const cloudValues: number[] = []
    for (const feature of features) {
      const cc = feature.properties?.['eo:cloud_cover']
      if (cc !== undefined && cc !== null) {
        cloudValues.push(cc)
      }
    }

    if (cloudValues.length === 0) return null

    // Return the minimum cloud coverage (best scene for this date range)
    return Math.round(Math.min(...cloudValues) * 10) / 10
  } catch (error) {
    console.error('[SENTINEL1] Catalog search error:', error)
    return null
  }
}
