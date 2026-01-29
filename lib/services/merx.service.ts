/**
 * Merx Service
 * Integração com a API de monitoramento da Merx
 */

const BASE_URL = process.env.MERX_API_URL || 'https://homolog.api.merx.tech/api/monitoramento'
const PROXY_URL = process.env.CORS_PROXY_URL || 'https://corsproxy.io/?'

// ==================== Types ====================

export interface NdviPoint {
  date: string
  ndvi_raw?: number
  ndvi_smooth?: number
  ndvi_interp?: number
  cloud_cover?: number
}

export interface PrecipitationPoint {
  date: string
  precipitation_mm?: number
}

export interface MerxReport {
  ndvi: NdviPoint[]
  precipitacao: PrecipitationPoint[]
  area_ha: number
  solo: any
  historical_ndvi: NdviPoint[][]
  idade_lavoura?: any
  zarc_anual?: any
}

export class MerxServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public httpStatus?: number,
    public retryable: boolean = false
  ) {
    super(message)
    this.name = 'MerxServiceError'
  }
}

// ==================== Private Helpers ====================

/**
 * Requisição com FormData (arquivo de geometria)
 */
async function requestWithFile(
  endpoint: string,
  data?: Record<string, any>,
  geometryJson?: string,
  options: { timeout?: number; retries?: number } = {}
): Promise<any> {
  const { timeout = 30000, retries = 2 } = options
  const targetUrl = `${BASE_URL}${endpoint}`

  const buildFormData = () => {
    const formData = new FormData()
    
    if (geometryJson) {
      const blob = new Blob([geometryJson], { type: 'application/geo+json' })
      formData.append('arquivo', blob, 'geometry.geojson')
    }
    
    if (data) {
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, String(value))
        }
      })
    }
    
    return formData
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const fetchOptions: RequestInit = {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
        body: buildFormData()
      }

      let response: Response
      try {
        response = await fetch(targetUrl, fetchOptions)
      } catch {
        const proxyTarget = `${PROXY_URL}${encodeURIComponent(targetUrl)}`
        response = await fetch(proxyTarget, {
          ...fetchOptions,
          signal: controller.signal
        })
      }

      clearTimeout(timeoutId)

      if (response.status === 429) {
        throw new MerxServiceError('Rate limit exceeded', 'RATE_LIMIT', 429, true)
      }

      if (!response.ok) {
        const text = await response.text()
        throw new MerxServiceError(
          `API Error: ${text.substring(0, 200)}`,
          'API_ERROR',
          response.status,
          response.status >= 500
        )
      }

      return await response.json()
    } catch (error) {
      if (error instanceof MerxServiceError) {
        if (error.retryable && attempt < retries) {
          await delay(Math.pow(2, attempt) * 1000)
          continue
        }
        throw error
      }

      if ((error as Error).name === 'AbortError') {
        if (attempt < retries) {
          await delay(1000)
          continue
        }
        throw new MerxServiceError('Request timeout', 'TIMEOUT', undefined, true)
      }

      throw new MerxServiceError(
        `Network error: ${(error as Error).message}`,
        'NETWORK_ERROR',
        undefined,
        true
      )
    }
  }

  throw new MerxServiceError('Max retries exceeded', 'MAX_RETRIES')
}

/**
 * Requisição com JSON (para endpoints que aceitam coordenadas)
 */
async function requestWithJson(
  endpoint: string,
  data: Record<string, any>,
  options: { timeout?: number; retries?: number } = {}
): Promise<any> {
  const { timeout = 30000, retries = 2 } = options
  const targetUrl = `${BASE_URL}${endpoint}`

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const fetchOptions: RequestInit = {
        method: 'POST',
        headers: { 
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify(data)
      }

      let response: Response
      try {
        response = await fetch(targetUrl, fetchOptions)
      } catch {
        const proxyTarget = `${PROXY_URL}${encodeURIComponent(targetUrl)}`
        response = await fetch(proxyTarget, {
          ...fetchOptions,
          signal: controller.signal
        })
      }

      clearTimeout(timeoutId)

      if (response.status === 429) {
        throw new MerxServiceError('Rate limit exceeded', 'RATE_LIMIT', 429, true)
      }

      if (!response.ok) {
        const text = await response.text()
        throw new MerxServiceError(
          `API Error: ${text.substring(0, 200)}`,
          'API_ERROR',
          response.status,
          response.status >= 500
        )
      }

      return await response.json()
    } catch (error) {
      if (error instanceof MerxServiceError) {
        if (error.retryable && attempt < retries) {
          await delay(Math.pow(2, attempt) * 1000)
          continue
        }
        throw error
      }

      if ((error as Error).name === 'AbortError') {
        if (attempt < retries) {
          await delay(1000)
          continue
        }
        throw new MerxServiceError('Request timeout', 'TIMEOUT', undefined, true)
      }

      throw new MerxServiceError(
        `Network error: ${(error as Error).message}`,
        'NETWORK_ERROR',
        undefined,
        true
      )
    }
  }

  throw new MerxServiceError('Max retries exceeded', 'MAX_RETRIES')
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function findDeepValue(obj: any, key: string): any {
  if (!obj || typeof obj !== 'object') return null
  if (obj[key] !== undefined) return obj[key]

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const val = findDeepValue(item, key)
      if (val !== null) return val
    }
  } else {
    for (const k in obj) {
      const val = findDeepValue(obj[k], key)
      if (val !== null) return val
    }
  }
  return null
}

function extractFieldData(res: any): any[] {
  if (!res) return []
  if (Array.isArray(res)) return res
  
  // Procurar por talhao_ ou ponto_
  const key = Object.keys(res).find(k => k.startsWith('talhao_') || k.startsWith('ponto_'))
  if (key) return res[key]
  if (res.data) return res.data
  return res
}

/**
 * Extrai centroid de um GeoJSON
 */
function extractCentroid(geometryJson: string): { lat: number; lng: number } | null {
  try {
    const geojson = JSON.parse(geometryJson)
    const feature = geojson.features?.[0] || geojson
    const geometry = feature.geometry || feature
    
    let coords: [number, number][] = []
    
    if (geometry.type === 'Polygon') {
      coords = geometry.coordinates[0]
    } else if (geometry.type === 'MultiPolygon') {
      coords = geometry.coordinates[0][0]
    }
    
    if (coords.length === 0) return null
    
    let sumLng = 0, sumLat = 0
    coords.forEach(([lng, lat]) => {
      sumLng += lng
      sumLat += lat
    })
    
    return {
      lng: sumLng / coords.length,
      lat: sumLat / coords.length
    }
  } catch {
    return null
  }
}

// ==================== Public API ====================

export async function getFullReport(
  geometryJson: string,
  analysisStartDate: string,
  crop: string = 'SOJA'
): Promise<MerxReport> {
  const today = new Date().toISOString().split('T')[0]
  const centroid = extractCentroid(geometryJson)

  // Requisições paralelas principais
  const requests: Promise<any>[] = [
    // NDVI (com arquivo)
    requestWithFile('/consulta-ndvi', {
      start_date: analysisStartDate,
      end_date: today
    }, geometryJson, { timeout: 45000 }),
    
    // Área lavoura (com arquivo)
    requestWithFile('/consulta-area-lavoura', {
      cultura: crop
    }, geometryJson),
    
    // Solo (com arquivo)
    requestWithFile('/consulta-solo', {}, geometryJson)
  ]

  // Precipitação - usa JSON com array de pontos
  if (centroid) {
    requests.push(
      requestWithJson('/consulta-precipitacao', {
        pontos: [{ latitude: centroid.lat, longitude: centroid.lng }],
        start_date: analysisStartDate,
        end_date: today
      }).catch(e => {
        console.warn('Precipitação falhou:', e.message)
        return null
      })
    )
  }

  const results = await Promise.allSettled(requests)

  // Extrair dados
  const ndvi = results[0].status === 'fulfilled' 
    ? extractFieldData(results[0].value) as NdviPoint[]
    : []
  
  const areaFullResponse = results[1].status === 'fulfilled' ? results[1].value : null
  const solo = results[2].status === 'fulfilled' ? extractFieldData(results[2].value) : null
  
  // Precipitação (se disponível)
  let precipitacao: PrecipitationPoint[] = []
  if (results.length > 3 && results[3].status === 'fulfilled' && results[3].value) {
    const precipData = results[3].value
    if (Array.isArray(precipData)) {
      precipitacao = precipData
    } else if (precipData.data && Array.isArray(precipData.data)) {
      precipitacao = precipData.data
    }
  }

  // Extrair área
  let area_ha = 0
  const possibleKeys = ['area_ha', 'area', 'area_total', 'tamanho_ha']
  for (const k of possibleKeys) {
    const found = findDeepValue(areaFullResponse, k)
    if (found !== null && parseFloat(found) > 0) {
      area_ha = parseFloat(found)
      break
    }
  }

  // Buscar histórico (últimas 3 safras) com timeout maior
  const historical_ndvi: NdviPoint[][] = []
  const historyYears = [1, 2, 3]

  for (const yearOffset of historyYears) {
    try {
      const hStart = new Date(analysisStartDate)
      hStart.setFullYear(hStart.getFullYear() - yearOffset)
      
      const hEndBase = new Date(today)
      hEndBase.setFullYear(hEndBase.getFullYear() - yearOffset)
      
      // Estender 90 dias para pegar projeção
      const hEndFuture = new Date(hEndBase)
      hEndFuture.setDate(hEndFuture.getDate() + 90)

      const hRes = await requestWithFile('/consulta-ndvi', {
        start_date: hStart.toISOString().split('T')[0],
        end_date: hEndFuture.toISOString().split('T')[0]
      }, geometryJson, { timeout: 45000, retries: 1 })

      const hData = extractFieldData(hRes) as NdviPoint[]
      if (Array.isArray(hData) && hData.length > 0) {
        historical_ndvi.push(hData)
      }
    } catch (e) {
      console.warn(`Histórico ano -${yearOffset} falhou:`, e instanceof Error ? e.message : e)
    }
  }

  return {
    ndvi,
    precipitacao,
    area_ha,
    solo,
    historical_ndvi
  }
}

/**
 * Busca dados complementares (idade da lavoura e ZARC)
 */
export async function getComplementaryData(
  geometryJson: string,
  plantingDate: string,
  crop: string = 'SOJA'
): Promise<{ idade_lavoura: any; zarc_anual: any }> {
  const year = parseInt(plantingDate.split('-')[0]) || new Date().getFullYear()

  try {
    const [idadeRes, zarcRes] = await Promise.allSettled([
      requestWithFile('/consulta-idade-lavoura', {
        cultura: crop,
        data_plantio: plantingDate
      }, geometryJson),
      requestWithFile('/consulta-zarc-anual', {
        ano: year,
        cultura: crop
      }, geometryJson)
    ])

    return {
      idade_lavoura: idadeRes.status === 'fulfilled' ? extractFieldData(idadeRes.value) : null,
      zarc_anual: zarcRes.status === 'fulfilled' ? extractFieldData(zarcRes.value) : null
    }
  } catch (e) {
    console.warn('Dados complementares falharam:', e)
    return { idade_lavoura: null, zarc_anual: null }
  }
}
