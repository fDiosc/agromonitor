/**
 * NDVI Fusion Service
 * Combina dados ópticos (Sentinel-2) com radar (Sentinel-1)
 * para preencher gaps causados por nuvens
 */

import { isFeatureEnabled } from './feature-flags.service'

// ==================== Types ====================

export interface NdviPoint {
  date: string
  ndvi: number
  source: 'OPTICAL' | 'RADAR' | 'INTERPOLATED'
  quality: number        // 0-1, confiança do valor
  cloudCover?: number    // % de cobertura de nuvens (se óptico)
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
  fusionMethod: 'LINEAR_REGRESSION' | 'RATIO_SCALING' | 'NONE'
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
  
  // Converter RVI para NDVI
  const radarAsNdvi: NdviPoint[] = radarInGaps.map(rp => ({
    date: rp.date,
    ndvi: rviToNdvi(rp.rvi, crop),
    source: 'RADAR' as const,
    quality: 0.7  // Qualidade reduzida para dados de radar
  }))
  
  // Combinar e ordenar
  const allPoints = [...validOptical, ...radarAsNdvi].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )
  
  console.log('[NDVI_FUSION] Fusion complete:', {
    opticalPoints: validOptical.length,
    gaps: gaps.length,
    radarPointsUsed: radarAsNdvi.length
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
 * Processa fusão para um talhão (respeita feature flags)
 */
export async function getFusedNdviForField(
  workspaceId: string,
  opticalData: { date: string, ndvi: number, cloudCover?: number }[],
  radarData: RviPoint[],
  crop: string
): Promise<FusionResult | null> {
  // Verificar se uso de radar para gaps está habilitado
  const useRadar = await isFeatureEnabled(workspaceId, 'useRadarForGaps')
  
  if (!useRadar) {
    console.log('[NDVI_FUSION] Radar fusion disabled for workspace')
    return null
  }
  
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
 */
export function calculateFusionQuality(result: FusionResult): {
  overallQuality: number
  continuityScore: number
  radarContribution: number
} {
  const total = result.opticalPoints + result.radarPoints + result.interpolatedPoints
  
  if (total === 0) {
    return { overallQuality: 0, continuityScore: 0, radarContribution: 0 }
  }
  
  // Qualidade geral (óptico > radar > interpolado)
  const weightedQuality = (
    result.opticalPoints * 1.0 +
    result.radarPoints * 0.7 +
    result.interpolatedPoints * 0.5
  ) / total
  
  // Contribuição do radar
  const radarContribution = result.radarPoints / total
  
  // Score de continuidade (menos gaps = melhor)
  const continuityScore = result.gapsFilled > 0 ? 0.8 : 1.0
  
  return {
    overallQuality: weightedQuality,
    continuityScore,
    radarContribution
  }
}
