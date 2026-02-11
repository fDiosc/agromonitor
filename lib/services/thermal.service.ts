/**
 * Thermal Service (GDD - Growing Degree Days)
 * Integração com endpoint de temperatura da API Merx
 * e cálculo de soma térmica para projeção de maturação
 */

import { isFeatureEnabled } from './feature-flags.service'

// ==================== Types ====================

export interface TemperaturePoint {
  date: string           // YYYY-MM-DD
  value: number          // Temperatura média (°C)
  tmin?: number          // Temperatura mínima (°C)
  tmax?: number          // Temperatura máxima (°C)
  gdd?: number           // Graus-dia calculado
  accumulatedGdd?: number // GDD acumulado
}

export interface TemperatureData {
  points: TemperaturePoint[]
  avgTemp: number
  minTemp: number
  maxTemp: number
  fetchedAt: Date
  source: 'API' | 'CACHE' | 'UNAVAILABLE'
}

export interface GddAnalysis {
  accumulatedGdd: number        // GDD acumulado desde plantio
  requiredGdd: number           // GDD necessário para maturação
  progressPercent: number       // % do ciclo completado
  daysToMaturity: number | null // Dias estimados para maturação
  projectedEos: Date | null     // Data projetada de EOS
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  method: 'GDD_PROJECTION' | 'HISTORICAL_AVERAGE'
}

// ==================== Constants ====================

const MERX_API_BASE = process.env.MERX_API_URL || 'https://homolog.api.merx.tech/api/monitoramento'

// Requisitos de GDD por cultura (valores baseados em literatura científica)
// Referências: McMaster & Wilhelm (1997), Fehr & Caviness (1977), EMBRAPA
const CROP_GDD_REQUIREMENTS: Record<string, { 
  base: number      // Temperatura base (°C)
  total: number     // GDD total para ciclo completo
  toFlowering: number  // GDD até floração
  toMaturity: number   // GDD do floração à maturação
}> = {
  SOJA: { 
    base: 10, 
    total: 1300, 
    toFlowering: 700, 
    toMaturity: 600 
  },
  MILHO: { 
    base: 10, 
    total: 1500, 
    toFlowering: 800, 
    toMaturity: 700 
  },
  ALGODAO: { 
    base: 12, 
    total: 1800, 
    toFlowering: 900, 
    toMaturity: 900 
  },
  TRIGO: { 
    base: 5, 
    total: 1100, 
    toFlowering: 600, 
    toMaturity: 500 
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

/**
 * Calcula GDD para um dia
 * Método: GDD = max(0, Tmean - Tbase)
 */
function calculateDailyGdd(temp: number, baseTemp: number): number {
  return Math.max(0, temp - baseTemp)
}

// ==================== API Functions ====================

/**
 * Busca dados de temperatura da API Merx
 */
export async function fetchTemperature(
  geometry: any,
  startDate: Date,
  endDate: Date
): Promise<TemperatureData> {
  try {
    const geojson = ensureFeatureCollection(
      typeof geometry === 'string' ? JSON.parse(geometry) : geometry
    )
    
    const body = {
      geojson,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0]
    }
    
    console.log('[THERMAL] Fetching temperature data:', {
      start: body.start_date,
      end: body.end_date
    })
    
    const response = await fetch(`${MERX_API_BASE}/consulta-temperatura-json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000)
    })
    
    if (!response.ok) {
      console.error('[THERMAL] API error:', response.status, response.statusText)
      return getEmptyTemperatureData('UNAVAILABLE')
    }
    
    const data = await response.json()
    
    // Processar resposta de forma robusta (suporta qualquer nome de key)
    const rawPoints = extractApiDataArray(data)
    
    if (rawPoints.length === 0) {
      console.log('[THERMAL] No data returned from API')
      return getEmptyTemperatureData('UNAVAILABLE')
    }
    
    const points: TemperaturePoint[] = rawPoints.map((p: any) => ({
      date: p.date || p.data,
      value: p.value || p.temp_media || p.temperatura,
      tmin: p.tmin || p.temp_min,
      tmax: p.tmax || p.temp_max
    }))
    
    // Calcular estatísticas
    const temps = points.map(p => p.value).filter(t => t != null)
    const avgTemp = temps.length > 0 ? temps.reduce((a, b) => a + b, 0) / temps.length : 0
    const minTemp = temps.length > 0 ? Math.min(...temps) : 0
    const maxTemp = temps.length > 0 ? Math.max(...temps) : 0
    
    console.log('[THERMAL] Data fetched:', {
      points: points.length,
      avgTemp: avgTemp.toFixed(1),
      minTemp: minTemp.toFixed(1),
      maxTemp: maxTemp.toFixed(1)
    })
    
    return {
      points,
      avgTemp,
      minTemp,
      maxTemp,
      fetchedAt: new Date(),
      source: 'API'
    }
  } catch (error) {
    console.error('[THERMAL] Error fetching temperature:', error)
    return getEmptyTemperatureData('UNAVAILABLE')
  }
}

function getEmptyTemperatureData(source: 'API' | 'CACHE' | 'UNAVAILABLE'): TemperatureData {
  return {
    points: [],
    avgTemp: 0,
    minTemp: 0,
    maxTemp: 0,
    fetchedAt: new Date(),
    source
  }
}

// ==================== GDD Analysis ====================

/**
 * Calcula GDD acumulado e projeta maturação
 */
export function calculateGddAnalysis(
  temperatureData: TemperatureData,
  plantingDate: Date,
  crop: string
): GddAnalysis {
  const cropConfig = CROP_GDD_REQUIREMENTS[crop] || CROP_GDD_REQUIREMENTS.SOJA
  const { base, total } = cropConfig
  
  // Filtrar pontos após plantio
  const plantingTime = plantingDate.getTime()
  const relevantPoints = temperatureData.points.filter(p => 
    new Date(p.date).getTime() >= plantingTime
  )
  
  // Calcular GDD diário e acumulado
  let accumulatedGdd = 0
  const pointsWithGdd = relevantPoints.map(point => {
    const dailyGdd = calculateDailyGdd(point.value, base)
    accumulatedGdd += dailyGdd
    return {
      ...point,
      gdd: dailyGdd,
      accumulatedGdd
    }
  })
  
  // Calcular progresso
  const progressPercent = Math.min(100, (accumulatedGdd / total) * 100)
  
  // Calcular dias para maturação
  let daysToMaturity: number | null = null
  let projectedEos: Date | null = null
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW'
  
  if (accumulatedGdd >= total) {
    // Já atingiu maturação - retroagir para encontrar quando GDD atingiu 100%
    daysToMaturity = 0
    confidence = 'HIGH'
    
    // Percorrer a série de trás para frente para encontrar o ponto onde GDD ultrapassou o total
    for (let i = pointsWithGdd.length - 1; i >= 1; i--) {
      const prevAccGdd = pointsWithGdd[i - 1].accumulatedGdd
      if (prevAccGdd < total) {
        // GDD cruzou o limiar entre pointsWithGdd[i-1] e pointsWithGdd[i]
        projectedEos = new Date(pointsWithGdd[i].date)
        break
      }
    }
    // Se não encontrou (já iniciou acima do total), usar o primeiro ponto
    if (!projectedEos && pointsWithGdd.length > 0) {
      projectedEos = new Date(pointsWithGdd[0].date)
    }
  } else if (pointsWithGdd.length >= 14) {
    // Calcular média de GDD recente (últimos 14 dias)
    const recentPoints = pointsWithGdd.slice(-14)
    const recentAvgGdd = recentPoints.reduce((sum, p) => sum + (p.gdd || 0), 0) / recentPoints.length
    
    if (recentAvgGdd > 0) {
      const remainingGdd = total - accumulatedGdd
      daysToMaturity = Math.ceil(remainingGdd / recentAvgGdd)
      
      const lastDate = pointsWithGdd.length > 0 
        ? new Date(pointsWithGdd[pointsWithGdd.length - 1].date)
        : new Date()
      projectedEos = new Date(lastDate)
      projectedEos.setDate(projectedEos.getDate() + daysToMaturity)
      
      // Confiança baseada no histórico de dados
      if (pointsWithGdd.length >= 60) {
        confidence = 'HIGH'
      } else if (pointsWithGdd.length >= 30) {
        confidence = 'MEDIUM'
      } else {
        confidence = 'LOW'
      }
    }
  }
  
  console.log('[THERMAL] GDD Analysis:', {
    accumulatedGdd: accumulatedGdd.toFixed(0),
    requiredGdd: total,
    progressPercent: progressPercent.toFixed(1),
    daysToMaturity,
    confidence
  })
  
  return {
    accumulatedGdd,
    requiredGdd: total,
    progressPercent,
    daysToMaturity,
    projectedEos,
    confidence,
    method: 'GDD_PROJECTION'
  }
}

/**
 * Busca e processa dados térmicos para um talhão
 * Respeita feature flags
 */
export async function getThermalDataForField(
  workspaceId: string,
  geometry: any,
  plantingDate: Date,
  crop: string
): Promise<{
  temperature: TemperatureData
  gddAnalysis: GddAnalysis
} | null> {
  // Verificar se soma térmica está habilitada
  const enabled = await isFeatureEnabled(workspaceId, 'enableThermalSum')
  
  if (!enabled) {
    console.log('[THERMAL] Thermal sum disabled for workspace')
    return null
  }
  
  // Definir período: do plantio até hoje
  const endDate = new Date()
  
  // Buscar dados
  const temperatureData = await fetchTemperature(geometry, plantingDate, endDate)
  
  // Calcular análise GDD
  const gddAnalysis = calculateGddAnalysis(temperatureData, plantingDate, crop)
  
  return { temperature: temperatureData, gddAnalysis }
}

/**
 * Formata dados de temperatura para armazenamento (JSON string)
 */
export function serializeThermalData(data: {
  temperature: TemperatureData
  gddAnalysis: GddAnalysis
}): string {
  return JSON.stringify({
    temperature: {
      points: data.temperature.points,
      avgTemp: data.temperature.avgTemp,
      minTemp: data.temperature.minTemp,
      maxTemp: data.temperature.maxTemp,
      fetchedAt: data.temperature.fetchedAt.toISOString(),
      source: data.temperature.source
    },
    gddAnalysis: {
      accumulatedGdd: data.gddAnalysis.accumulatedGdd,
      requiredGdd: data.gddAnalysis.requiredGdd,
      progressPercent: data.gddAnalysis.progressPercent,
      daysToMaturity: data.gddAnalysis.daysToMaturity,
      projectedEos: data.gddAnalysis.projectedEos?.toISOString() || null,
      confidence: data.gddAnalysis.confidence,
      method: data.gddAnalysis.method
    }
  })
}

/**
 * Deserializa dados térmicos do banco
 */
export function deserializeThermalData(json: string | null): {
  temperature: TemperatureData
  gddAnalysis: GddAnalysis
} | null {
  if (!json) return null
  
  try {
    const parsed = JSON.parse(json)
    return {
      temperature: {
        ...parsed.temperature,
        fetchedAt: new Date(parsed.temperature.fetchedAt)
      },
      gddAnalysis: {
        ...parsed.gddAnalysis,
        projectedEos: parsed.gddAnalysis.projectedEos 
          ? new Date(parsed.gddAnalysis.projectedEos) 
          : null
      }
    }
  } catch {
    return null
  }
}
