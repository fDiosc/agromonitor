/**
 * Water Balance Service
 * Integração com endpoint de balanço hídrico da API Merx
 * e lógica de ajuste de EOS por estresse hídrico
 */

import { isFeatureEnabled } from './feature-flags.service'

// ==================== Types ====================

export interface WaterBalancePoint {
  date: string           // YYYY-MM-DD
  ETc: number            // Evapotranspiração da cultura (mm)
  ETr: number            // Evapotranspiração real (mm)
  deficit: number        // Déficit hídrico (mm)
  excess: number         // Excedente hídrico (mm)
  balance: number        // Balanço (positivo = excedente, negativo = déficit)
  soilMoisture?: number  // Umidade do solo (%)
}

export interface WaterBalanceData {
  points: WaterBalancePoint[]
  totalDeficit: number
  totalExcess: number
  avgDeficit: number
  maxDeficit: number
  stressDays: number        // Dias com déficit significativo (> 5mm)
  excessDays: number        // Dias com excedente (> 10mm)
  fetchedAt: Date
  source: 'API' | 'CACHE' | 'UNAVAILABLE'
}

export interface EosAdjustment {
  originalEos: Date
  adjustedEos: Date
  adjustmentDays: number
  yieldImpact: number       // Multiplicador (0.7 = 30% perda)
  reason: string | null
  stressLevel: 'BAIXO' | 'MODERADO' | 'SEVERO' | 'CRITICO'
}

// ==================== Constants ====================

const MERX_API_BASE = process.env.MERX_API_URL || 'https://homolog.api.merx.tech/api/monitoramento'

// Thresholds para ajuste de EOS por estresse hídrico
const WATER_STRESS_THRESHOLDS = {
  DEFICIT_SEVERE: 100,     // mm déficit acumulado - ciclo encurta muito
  DEFICIT_MODERATE: 50,    // mm déficit acumulado - ciclo encurta
  DEFICIT_LIGHT: 25,       // mm déficit acumulado - pequeno impacto
  STRESS_DAYS_SEVERE: 21,  // dias com déficit significativo
  STRESS_DAYS_MODERATE: 14,
  YIELD_IMPACT_SEVERE: 0.70,    // 30% perda
  YIELD_IMPACT_MODERATE: 0.85,  // 15% perda
  YIELD_IMPACT_LIGHT: 0.95,     // 5% perda
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

// ==================== API Functions ====================

/**
 * Busca dados de balanço hídrico da API Merx
 */
export async function fetchWaterBalance(
  geometry: any,
  plantingDate: Date,
  crop: string
): Promise<WaterBalanceData> {
  try {
    const geojson = ensureFeatureCollection(
      typeof geometry === 'string' ? JSON.parse(geometry) : geometry
    )
    
    // Mapear cultura para formato da API
    const cropMap: Record<string, string> = {
      SOJA: 'SOJA',
      MILHO: 'MILHO',
      ALGODAO: 'ALGODAO',
      TRIGO: 'FEIJAO', // Fallback
    }
    
    const body = {
      geojson,
      data_plantio: plantingDate.toISOString().split('T')[0],
      cultura: cropMap[crop] || 'SOJA'
    }
    
    console.log('[WATER_BALANCE] Fetching water balance data:', {
      plantingDate: body.data_plantio,
      cultura: body.cultura
    })
    
    const response = await fetch(`${MERX_API_BASE}/consulta-balanco-hidrico-json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000) // 60s timeout
    })
    
    if (!response.ok) {
      console.error('[WATER_BALANCE] API error:', response.status, response.statusText)
      return getEmptyWaterBalanceData('UNAVAILABLE')
    }
    
    const data = await response.json()
    
    // Processar resposta - formato pode variar
    const rawPoints = data['talhao_0'] || data['fazenda_1'] || data.balanco || []
    
    if (!Array.isArray(rawPoints) || rawPoints.length === 0) {
      console.log('[WATER_BALANCE] No data returned from API')
      return getEmptyWaterBalanceData('UNAVAILABLE')
    }
    
    const points: WaterBalancePoint[] = rawPoints.map((p: any) => {
      const ETc = p.ETc || p.etc || 0
      const ETr = p.ETr || p.etr || p.ETreal || 0
      const deficit = Math.max(0, ETc - ETr)
      const excess = p.excedente || p.excess || Math.max(0, ETr - ETc)
      
      return {
        date: p.date || p.data,
        ETc,
        ETr,
        deficit,
        excess,
        balance: excess - deficit,
        soilMoisture: p.umidade || p.soilMoisture
      }
    })
    
    // Calcular estatísticas
    const deficits = points.map(p => p.deficit)
    const totalDeficit = deficits.reduce((sum, v) => sum + v, 0)
    const totalExcess = points.reduce((sum, p) => sum + p.excess, 0)
    const avgDeficit = points.length > 0 ? totalDeficit / points.length : 0
    const maxDeficit = Math.max(...deficits, 0)
    const stressDays = deficits.filter(d => d > 5).length
    const excessDays = points.filter(p => p.excess > 10).length
    
    console.log('[WATER_BALANCE] Data fetched:', {
      points: points.length,
      totalDeficit: totalDeficit.toFixed(1),
      stressDays,
      excessDays
    })
    
    return {
      points,
      totalDeficit,
      totalExcess,
      avgDeficit,
      maxDeficit,
      stressDays,
      excessDays,
      fetchedAt: new Date(),
      source: 'API'
    }
  } catch (error) {
    console.error('[WATER_BALANCE] Error fetching water balance:', error)
    return getEmptyWaterBalanceData('UNAVAILABLE')
  }
}

function getEmptyWaterBalanceData(source: 'API' | 'CACHE' | 'UNAVAILABLE'): WaterBalanceData {
  return {
    points: [],
    totalDeficit: 0,
    totalExcess: 0,
    avgDeficit: 0,
    maxDeficit: 0,
    stressDays: 0,
    excessDays: 0,
    fetchedAt: new Date(),
    source
  }
}

// ==================== EOS Adjustment ====================

/**
 * Calcula ajuste de EOS baseado em estresse hídrico
 */
export function calculateEosAdjustment(
  eosDate: Date,
  waterBalance: WaterBalanceData,
  phenologicalPhase: 'vegetative' | 'reproductive' | 'senescence' = 'reproductive'
): EosAdjustment {
  const { totalDeficit, stressDays } = waterBalance
  
  let adjustmentDays = 0
  let yieldImpact = 1.0
  let reason: string | null = null
  let stressLevel: EosAdjustment['stressLevel'] = 'BAIXO'
  
  // Análise baseada em fase fenológica
  const isReproductive = phenologicalPhase === 'reproductive'
  const multiplier = isReproductive ? 1.5 : 1.0 // Fase reprodutiva é mais sensível
  
  const effectiveDeficit = totalDeficit * multiplier
  const effectiveStressDays = stressDays * multiplier
  
  if (effectiveDeficit > WATER_STRESS_THRESHOLDS.DEFICIT_SEVERE || 
      effectiveStressDays > WATER_STRESS_THRESHOLDS.STRESS_DAYS_SEVERE) {
    adjustmentDays = -12 // Ciclo encurta muito
    yieldImpact = WATER_STRESS_THRESHOLDS.YIELD_IMPACT_SEVERE
    stressLevel = 'CRITICO'
    reason = `Estresse hídrico crítico: ${totalDeficit.toFixed(0)}mm déficit, ${stressDays} dias de estresse${isReproductive ? ' (fase reprodutiva)' : ''}`
  } else if (effectiveDeficit > WATER_STRESS_THRESHOLDS.DEFICIT_MODERATE ||
             effectiveStressDays > WATER_STRESS_THRESHOLDS.STRESS_DAYS_MODERATE) {
    adjustmentDays = -7
    yieldImpact = WATER_STRESS_THRESHOLDS.YIELD_IMPACT_MODERATE
    stressLevel = 'SEVERO'
    reason = `Estresse hídrico severo: ${totalDeficit.toFixed(0)}mm déficit acumulado`
  } else if (effectiveDeficit > WATER_STRESS_THRESHOLDS.DEFICIT_LIGHT) {
    adjustmentDays = -3
    yieldImpact = WATER_STRESS_THRESHOLDS.YIELD_IMPACT_LIGHT
    stressLevel = 'MODERADO'
    reason = `Estresse hídrico moderado: ${totalDeficit.toFixed(0)}mm déficit`
  }
  
  const adjustedEos = new Date(eosDate)
  adjustedEos.setDate(adjustedEos.getDate() + adjustmentDays)
  
  return {
    originalEos: eosDate,
    adjustedEos,
    adjustmentDays,
    yieldImpact,
    reason,
    stressLevel
  }
}

/**
 * Busca e processa balanço hídrico para um talhão
 * Respeita feature flags
 */
export async function getWaterBalanceForField(
  workspaceId: string,
  geometry: any,
  plantingDate: Date,
  crop: string,
  eosDate?: Date
): Promise<{
  data: WaterBalanceData
  adjustment: EosAdjustment | null
} | null> {
  // Verificar se balanço hídrico está habilitado
  const enabled = await isFeatureEnabled(workspaceId, 'enableWaterBalance')
  
  if (!enabled) {
    console.log('[WATER_BALANCE] Water balance disabled for workspace')
    return null
  }
  
  // Buscar dados
  const waterBalanceData = await fetchWaterBalance(geometry, plantingDate, crop)
  
  // Calcular ajuste se temos data de EOS e ajuste está habilitado
  let adjustment: EosAdjustment | null = null
  if (eosDate && waterBalanceData.source !== 'UNAVAILABLE') {
    const adjustEnabled = await isFeatureEnabled(workspaceId, 'useWaterBalanceAdjust')
    if (adjustEnabled) {
      adjustment = calculateEosAdjustment(eosDate, waterBalanceData)
    }
  }
  
  return { data: waterBalanceData, adjustment }
}

/**
 * Formata dados de balanço hídrico para armazenamento (JSON string)
 */
export function serializeWaterBalance(data: WaterBalanceData): string {
  return JSON.stringify({
    points: data.points,
    totalDeficit: data.totalDeficit,
    totalExcess: data.totalExcess,
    avgDeficit: data.avgDeficit,
    maxDeficit: data.maxDeficit,
    stressDays: data.stressDays,
    excessDays: data.excessDays,
    fetchedAt: data.fetchedAt.toISOString(),
    source: data.source
  })
}

/**
 * Deserializa dados de balanço hídrico do banco
 */
export function deserializeWaterBalance(json: string | null): WaterBalanceData | null {
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
