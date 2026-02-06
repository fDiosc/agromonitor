/**
 * NDVI Fusion Service
 * Combina dados ópticos (Sentinel-2) com radar (Sentinel-1)
 * para preencher gaps causados por nuvens
 * 
 * Suporta calibração local por talhão (quando habilitada)
 * Referência: Pelta et al. (2022) "SNAF: Sentinel-1 to NDVI for Agricultural Fields"
 */

import { isFeatureEnabled, getFeatureFlags } from './feature-flags.service'
import { 
  applyCalibration,
  getFixedCoefficients
} from './rvi-calibration.service'

// ==================== Types ====================

export interface NdviPoint {
  date: string
  ndvi: number
  source: 'OPTICAL' | 'RADAR' | 'INTERPOLATED'
  quality: number        // 0-1, confiança do valor
  cloudCover?: number    // % de cobertura de nuvens (se óptico)
  calibrationMethod?: 'LOCAL' | 'FIXED'  // Método de calibração usado (se radar)
}

export interface RviPoint {
  date: string
  rvi: number            // Radar Vegetation Index (0-1)
}

export interface FusionResult {
  points: NdviPoint[]
  gapsFilled: number     // Número de gaps preenchidos por radar
  opticalPoints: number
  radarPoints: number
  interpolatedPoints: number
  fusionMethod: 'LINEAR_REGRESSION' | 'LOCAL_CALIBRATION' | 'RATIO_SCALING' | 'NONE'
  calibrationR2?: number  // R² da calibração usada (se local)
}

// ==================== Constants ====================

// Modelo de regressão RVI -> NDVI
// NDVI ≈ a * RVI + b
// Valores baseados em literatura: Filgueiras et al. (2019), Veloso et al. (2017)
const RVI_TO_NDVI_PARAMS = {
  SOJA: { a: 1.15, b: -0.15, r2: 0.78 },
  MILHO: { a: 1.10, b: -0.12, r2: 0.75 },
  ALGODAO: { a: 1.20, b: -0.18, r2: 0.72 },
  DEFAULT: { a: 1.12, b: -0.14, r2: 0.70 }
}

// Threshold para considerar um ponto como gap (nuvem)
const CLOUD_THRESHOLD = 50  // % de cobertura de nuvem
const GAP_THRESHOLD_DAYS = 10  // Dias sem dado óptico para considerar gap

// ==================== Helper Functions ====================

/**
 * Converte RVI para NDVI usando modelo de regressão
 */
function rviToNdvi(rvi: number, crop: string): number {
  const params = RVI_TO_NDVI_PARAMS[crop as keyof typeof RVI_TO_NDVI_PARAMS] 
    || RVI_TO_NDVI_PARAMS.DEFAULT
  
  const ndvi = params.a * rvi + params.b
  
  // Clamp para range válido de NDVI
  return Math.max(-1, Math.min(1, ndvi))
}

/**
 * Identifica gaps na série temporal de NDVI
 */
function findGaps(opticalPoints: NdviPoint[], maxGapDays: number = GAP_THRESHOLD_DAYS): {
  gapStart: Date
  gapEnd: Date
  daysMissing: number
}[] {
  if (opticalPoints.length < 2) return []
  
  const gaps: { gapStart: Date, gapEnd: Date, daysMissing: number }[] = []
  const sorted = [...opticalPoints].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )
  
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = new Date(sorted[i].date)
    const next = new Date(sorted[i + 1].date)
    const daysDiff = Math.floor((next.getTime() - current.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysDiff > maxGapDays) {
      gaps.push({
        gapStart: current,
        gapEnd: next,
        daysMissing: daysDiff
      })
    }
  }
  
  return gaps
}

/**
 * Filtra pontos de radar que caem dentro de gaps
 */
function getRadarPointsInGaps(
  radarPoints: RviPoint[],
  gaps: { gapStart: Date, gapEnd: Date }[]
): RviPoint[] {
  return radarPoints.filter(rp => {
    const rpDate = new Date(rp.date)
    return gaps.some(gap => rpDate > gap.gapStart && rpDate < gap.gapEnd)
  })
}

// ==================== Main Functions ====================

/**
 * Funde dados ópticos e radar para criar série temporal contínua
 * Versão síncrona - usa coeficientes fixos da literatura
 */
export function fuseOpticalAndRadar(
  opticalData: { date: string, ndvi: number, cloudCover?: number }[],
  radarData: RviPoint[],
  crop: string
): FusionResult {
  // Converter dados ópticos para NdviPoint
  const opticalPoints: NdviPoint[] = opticalData.map(pt => ({
    date: pt.date,
    ndvi: pt.ndvi,
    source: 'OPTICAL' as const,
    quality: pt.cloudCover ? Math.max(0, 1 - pt.cloudCover / 100) : 1,
    cloudCover: pt.cloudCover
  }))
  
  // Filtrar pontos ópticos de baixa qualidade
  const validOptical = opticalPoints.filter(p => 
    !p.cloudCover || p.cloudCover < CLOUD_THRESHOLD
  )
  
  // Se não há dados de radar, retornar só óptico
  if (!radarData || radarData.length === 0) {
    return {
      points: validOptical,
      gapsFilled: 0,
      opticalPoints: validOptical.length,
      radarPoints: 0,
      interpolatedPoints: 0,
      fusionMethod: 'NONE'
    }
  }
  
  // Identificar gaps
  const gaps = findGaps(validOptical)
  
  if (gaps.length === 0) {
    return {
      points: validOptical,
      gapsFilled: 0,
      opticalPoints: validOptical.length,
      radarPoints: 0,
      interpolatedPoints: 0,
      fusionMethod: 'NONE'
    }
  }
  
  // Encontrar pontos de radar nos gaps
  const radarInGaps = getRadarPointsInGaps(radarData, gaps)
  
  // Converter RVI para NDVI usando coeficientes fixos
  const radarAsNdvi: NdviPoint[] = radarInGaps.map(rp => {
    const fixedCoefs = getFixedCoefficients(crop)
    const ndvi = Math.max(-1, Math.min(1, fixedCoefs.a * rp.rvi + fixedCoefs.b))
    return {
      date: rp.date,
      ndvi,
      source: 'RADAR' as const,
      quality: 0.7 * fixedCoefs.r2,  // Qualidade ajustada pelo R²
      calibrationMethod: 'FIXED' as const
    }
  })
  
  // Combinar e ordenar
  const allPoints = [...validOptical, ...radarAsNdvi].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )
  
  console.log('[NDVI_FUSION] Fusion complete:', {
    opticalPoints: validOptical.length,
    gaps: gaps.length,
    radarPointsUsed: radarAsNdvi.length,
    method: 'FIXED'
  })
  
  return {
    points: allPoints,
    gapsFilled: radarAsNdvi.length,
    opticalPoints: validOptical.length,
    radarPoints: radarAsNdvi.length,
    interpolatedPoints: 0,
    fusionMethod: 'LINEAR_REGRESSION'
  }
}

/**
 * Funde dados ópticos e radar com suporte a calibração local
 * Versão assíncrona - verifica e usa modelo local se disponível
 */
export async function fuseOpticalAndRadarCalibrated(
  opticalData: { date: string, ndvi: number, cloudCover?: number }[],
  radarData: RviPoint[],
  crop: string,
  fieldId: string,
  workspaceId: string
): Promise<FusionResult> {
  // Verificar se calibração local está habilitada
  const featureFlags = await getFeatureFlags(workspaceId)
  const useLocalCalibration = featureFlags.useLocalCalibration
  
  // Converter dados ópticos para NdviPoint
  const opticalPoints: NdviPoint[] = opticalData.map(pt => ({
    date: pt.date,
    ndvi: pt.ndvi,
    source: 'OPTICAL' as const,
    quality: pt.cloudCover ? Math.max(0, 1 - pt.cloudCover / 100) : 1,
    cloudCover: pt.cloudCover
  }))
  
  // Filtrar pontos ópticos de baixa qualidade
  const validOptical = opticalPoints.filter(p => 
    !p.cloudCover || p.cloudCover < CLOUD_THRESHOLD
  )
  
  // Se não há dados de radar, retornar só óptico
  if (!radarData || radarData.length === 0) {
    return {
      points: validOptical,
      gapsFilled: 0,
      opticalPoints: validOptical.length,
      radarPoints: 0,
      interpolatedPoints: 0,
      fusionMethod: 'NONE'
    }
  }
  
  // Identificar gaps
  const gaps = findGaps(validOptical)
  
  if (gaps.length === 0) {
    return {
      points: validOptical,
      gapsFilled: 0,
      opticalPoints: validOptical.length,
      radarPoints: 0,
      interpolatedPoints: 0,
      fusionMethod: 'NONE'
    }
  }
  
  // Encontrar pontos de radar nos gaps
  const radarInGaps = getRadarPointsInGaps(radarData, gaps)
  
  // Converter RVI para NDVI usando calibração (local ou fixa)
  const radarAsNdvi: NdviPoint[] = []
  let usedLocalCalibration = false
  let calibrationR2 = 0
  
  for (const rp of radarInGaps) {
    const result = await applyCalibration(
      rp.rvi, 
      fieldId, 
      crop, 
      useLocalCalibration
    )
    
    if (result.method === 'LOCAL') {
      usedLocalCalibration = true
      calibrationR2 = result.modelR2 || 0
    }
    
    radarAsNdvi.push({
      date: rp.date,
      ndvi: result.ndvi,
      source: 'RADAR' as const,
      quality: result.method === 'LOCAL' ? 0.85 * result.confidence : 0.7 * result.confidence,
      calibrationMethod: result.method
    })
  }
  
  // Combinar e ordenar
  const allPoints = [...validOptical, ...radarAsNdvi].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )
  
  const fusionMethod = usedLocalCalibration ? 'LOCAL_CALIBRATION' : 'LINEAR_REGRESSION'
  
  console.log('[NDVI_FUSION] Fusion complete:', {
    opticalPoints: validOptical.length,
    gaps: gaps.length,
    radarPointsUsed: radarAsNdvi.length,
    method: fusionMethod,
    calibrationR2: usedLocalCalibration ? calibrationR2 : undefined
  })
  
  return {
    points: allPoints,
    gapsFilled: radarAsNdvi.length,
    opticalPoints: validOptical.length,
    radarPoints: radarAsNdvi.length,
    interpolatedPoints: 0,
    fusionMethod,
    calibrationR2: usedLocalCalibration ? calibrationR2 : undefined
  }
}

/**
 * Processa fusão para um talhão (respeita feature flags)
 * Usa calibração local quando disponível e habilitada
 */
export async function getFusedNdviForField(
  workspaceId: string,
  opticalData: { date: string, ndvi: number, cloudCover?: number }[],
  radarData: RviPoint[],
  crop: string,
  fieldId?: string
): Promise<FusionResult | null> {
  // Verificar se uso de radar para gaps está habilitado
  const useRadar = await isFeatureEnabled(workspaceId, 'useRadarForGaps')
  
  if (!useRadar) {
    console.log('[NDVI_FUSION] Radar fusion disabled for workspace')
    return null
  }
  
  // Se temos fieldId, usar versão calibrada que verifica modelo local
  if (fieldId) {
    return fuseOpticalAndRadarCalibrated(
      opticalData, 
      radarData, 
      crop, 
      fieldId, 
      workspaceId
    )
  }
  
  // Fallback para versão síncrona com coeficientes fixos
  return fuseOpticalAndRadar(opticalData, radarData, crop)
}

/**
 * Serializa resultado de fusão para armazenamento
 */
export function serializeFusionResult(result: FusionResult): string {
  return JSON.stringify(result)
}

/**
 * Calcula métricas de qualidade da fusão
 * Considera R² da calibração local quando disponível
 */
export function calculateFusionQuality(result: FusionResult): {
  overallQuality: number
  continuityScore: number
  radarContribution: number
  calibrationQuality: number
} {
  const total = result.opticalPoints + result.radarPoints + result.interpolatedPoints
  
  if (total === 0) {
    return { overallQuality: 0, continuityScore: 0, radarContribution: 0, calibrationQuality: 0 }
  }
  
  // Qualidade da calibração (maior se local com bom R²)
  const calibrationQuality = result.fusionMethod === 'LOCAL_CALIBRATION' && result.calibrationR2
    ? result.calibrationR2
    : 0.7  // Valor padrão para coeficientes fixos
  
  // Peso do radar ajustado pela qualidade da calibração
  const radarWeight = result.fusionMethod === 'LOCAL_CALIBRATION' 
    ? 0.85 * calibrationQuality  // Maior peso para calibração local
    : 0.7 * calibrationQuality   // Peso reduzido para fixo
  
  // Qualidade geral (óptico > radar calibrado > interpolado)
  const weightedQuality = (
    result.opticalPoints * 1.0 +
    result.radarPoints * radarWeight +
    result.interpolatedPoints * 0.5
  ) / total
  
  // Contribuição do radar
  const radarContribution = result.radarPoints / total
  
  // Score de continuidade (menos gaps = melhor, calibração local é bônus)
  let continuityScore = result.gapsFilled > 0 ? 0.8 : 1.0
  if (result.fusionMethod === 'LOCAL_CALIBRATION' && result.gapsFilled > 0) {
    continuityScore = 0.9  // Bônus para gaps preenchidos com calibração local
  }
  
  return {
    overallQuality: weightedQuality,
    continuityScore,
    radarContribution,
    calibrationQuality
  }
}
