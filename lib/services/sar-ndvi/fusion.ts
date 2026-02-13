/**
 * SAR-NDVI Adaptive Fusion - Main fusion logic
 *
 * Estratégia adaptativa de fusão SAR → NDVI baseada em pesquisa científica:
 * - Seleciona features automaticamente (VH, VV, ou VV+VH) baseado em correlação
 * - Usa GPR (Gaussian Process Regression) ou KNN como modelos
 * - Calibração local por talhão
 * - Fallback gracioso para dados ópticos
 *
 * Referências:
 * - Gaussian Process Regression for vegetation: Verrelst et al. (2021)
 * - SAR-NDVI fusion: Garioud et al. (2021) "SenRVM"
 * - VH/VV selection: Veloso et al. (2017)
 */

import prisma from '@/lib/prisma'
import { loadCalibration, trainLocalCalibration, saveCalibration } from './calibration'
import type { SarPoint, NdviPoint, CalibrationModel, FusionResult } from './types'

/**
 * Aplica fusão SAR → NDVI para preencher gaps
 */
export async function fuseSarNdvi(
  fieldId: string,
  opticalData: { date: string, ndvi: number, cloudCover?: number }[],
  sarData: SarPoint[],
  options: { forceRetrain?: boolean } = {}
): Promise<FusionResult> {
  console.log(`[SAR_FUSION] Starting fusion for field ${fieldId}`)
  console.log(`[SAR_FUSION] Optical: ${opticalData.length}, SAR: ${sarData.length}`)

  // Resultado padrão (fallback)
  const defaultResult: FusionResult = {
    points: opticalData.map(d => ({
      date: d.date,
      ndvi: d.ndvi,
      source: 'OPTICAL' as const,
      quality: d.cloudCover ? Math.max(0, 1 - d.cloudCover / 100) : 1
    })),
    gapsFilled: 0,
    opticalPoints: opticalData.length,
    sarFusedPoints: 0,
    fusionMethod: 'NONE',
    featureUsed: 'NONE',
    modelR2: 0,
    modelRMSE: 0,
    calibrationUsed: false
  }

  // Se não há SAR, retornar só óptico
  if (!sarData || sarData.length < 5) {
    console.log('[SAR_FUSION] Not enough SAR data, returning optical only')
    return defaultResult
  }

  // Carregar ou treinar calibração
  let calibration = await loadCalibration(fieldId)

  if (!calibration || options.forceRetrain) {
    calibration = await trainLocalCalibration(fieldId, sarData, opticalData)
    if (calibration) {
      await saveCalibration(calibration)
    }
  }

  if (!calibration) {
    console.log('[SAR_FUSION] No calibration available, returning optical only')
    return defaultResult
  }

  // Identificar gaps (períodos sem dados ópticos > 10 dias)
  const sortedOptical = [...opticalData]
    .filter(d => !d.cloudCover || d.cloudCover < 50)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const gaps: { start: Date, end: Date }[] = []
  for (let i = 0; i < sortedOptical.length - 1; i++) {
    const current = new Date(sortedOptical[i].date)
    const next = new Date(sortedOptical[i + 1].date)
    const daysDiff = (next.getTime() - current.getTime()) / (1000 * 60 * 60 * 24)
    if (daysDiff > 10) {
      gaps.push({ start: current, end: next })
    }
  }

  if (gaps.length === 0) {
    console.log('[SAR_FUSION] No gaps found, returning optical only')
    return { ...defaultResult, calibrationUsed: true, modelR2: calibration.r2 }
  }

  console.log(`[SAR_FUSION] Found ${gaps.length} gaps to fill`)

  // Converter pontos ópticos
  const fusedPoints: NdviPoint[] = sortedOptical.map(d => ({
    date: d.date,
    ndvi: d.ndvi,
    source: 'OPTICAL' as const,
    quality: d.cloudCover ? Math.max(0, 1 - d.cloudCover / 100) : 1
  }))

  // Preparar função de predição
  let predict: (x: number[]) => number
  let predictWithUncertainty: ((x: number[]) => { mean: number, std: number }) | null = null

  if (calibration.modelType === 'GPR' && calibration.params.alpha) {
    // Reconstruir GPR
    const { alpha, xTrain, yMean, means, stds, lengthScale } = calibration.params

    const kernel = (x1: number[], x2: number[]): number => {
      const dist = x1.reduce((sum, v, i) => sum + (v - x2[i]) ** 2, 0)
      return Math.exp(-dist / (2 * (lengthScale || 1) ** 2))
    }

    predictWithUncertainty = (x: number[]) => {
      const xNorm = x.map((v, j) => (v - (means?.[j] || 0)) / (stds?.[j] || 1))
      const kStar = xTrain!.map(xi => kernel(xNorm, xi))
      const predMean = (yMean || 0) + kStar.reduce((sum, ki, i) => sum + ki * (alpha?.[i] || 0), 0)
      return { mean: Math.max(0, Math.min(1, predMean)), std: 0.1 } // Incerteza simplificada
    }
    predict = (x) => predictWithUncertainty!(x).mean
  } else if (calibration.modelType === 'KNN' && calibration.params.trainingData) {
    // Reconstruir KNN
    const trainingData = calibration.params.trainingData
    const k = calibration.params.k || 5

    predict = (x: number[]) => {
      const distances = trainingData.map(td => ({
        dist: Math.sqrt(td.features.reduce((sum, f, i) => sum + (f - x[i]) ** 2, 0)),
        y: td.ndvi
      }))
      distances.sort((a, b) => a.dist - b.dist)
      const neighbors = distances.slice(0, k)
      const totalWeight = neighbors.reduce((sum, n) => sum + 1 / (n.dist + 1e-6), 0)
      return neighbors.reduce((sum, n) => sum + n.y / (n.dist + 1e-6), 0) / totalWeight
    }
  } else {
    // Fallback para linear
    const { coeffs, intercept } = calibration.params
    predict = (x: number[]) => (intercept || 0) + (coeffs || []).reduce((sum, c, i) => sum + c * (x[i] || 0), 0)
  }

  // Encontrar SAR em gaps e aplicar predição
  let sarFusedCount = 0

  for (const sar of sarData) {
    const sarDate = new Date(sar.date)

    // Verificar se está em um gap
    const inGap = gaps.some(gap => sarDate > gap.start && sarDate < gap.end)
    if (!inGap) continue

    // Verificar se já existe ponto nesta data
    const exists = fusedPoints.some(p => p.date === sar.date)
    if (exists) continue

    // Preparar features baseado no tipo
    let features: number[]
    switch (calibration.featureType) {
      case 'VH':
        features = [sar.vh]
        break
      case 'VV':
        features = [sar.vv]
        break
      default:
        features = [sar.vv, sar.vh]
    }

    // Predizer NDVI
    const ndviPred = predict(features)
    let uncertainty: number | undefined

    if (predictWithUncertainty) {
      const result = predictWithUncertainty(features)
      uncertainty = result.std
    }

    // Qualidade baseada no R² do modelo
    const quality = Math.min(0.9, 0.5 + calibration.r2 * 0.4)

    fusedPoints.push({
      date: sar.date,
      ndvi: Math.max(0, Math.min(1, ndviPred)),
      source: 'SAR_FUSED',
      quality,
      uncertainty
    })

    sarFusedCount++
  }

  // Ordenar por data
  fusedPoints.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  console.log(`[SAR_FUSION] Fusion complete: ${sarFusedCount} gaps filled`)

  return {
    points: fusedPoints,
    gapsFilled: sarFusedCount,
    opticalPoints: sortedOptical.length,
    sarFusedPoints: sarFusedCount,
    fusionMethod: calibration.modelType,
    featureUsed: calibration.featureType,
    modelR2: calibration.r2,
    modelRMSE: calibration.rmse,
    calibrationUsed: true
  }
}

/**
 * Verifica se fusão SAR está habilitada para o workspace
 */
export async function isSarFusionEnabled(workspaceId: string): Promise<boolean> {
  try {
    const settings = await prisma.workspaceSettings.findUnique({
      where: { workspaceId }
    })

    // Novo campo: enableSarNdviFusion (BETA)
    // Fallback para enableRadarNdvi se novo campo não existir
    return settings?.enableSarNdviFusion ?? settings?.enableRadarNdvi ?? false
  } catch {
    return false
  }
}

/**
 * Calcula indicador de confiança para data de colheita
 * Considera fonte de dados (óptico vs fusionado)
 */
export function calculateHarvestConfidence(
  fusionResult: FusionResult,
  baseConfidence: number
): { confidence: number, source: 'OPTICAL' | 'MIXED' | 'SAR_HEAVY', note: string } {
  const sarRatio = fusionResult.sarFusedPoints / (fusionResult.opticalPoints + fusionResult.sarFusedPoints)

  if (sarRatio === 0) {
    return {
      confidence: baseConfidence,
      source: 'OPTICAL',
      note: 'Baseado apenas em dados ópticos'
    }
  } else if (sarRatio < 0.3) {
    // Poucos pontos SAR, confiança levemente reduzida mas qualidade do modelo compensa
    const adjustment = 0.95 + fusionResult.modelR2 * 0.05
    return {
      confidence: baseConfidence * adjustment,
      source: 'MIXED',
      note: `Fusão SAR-NDVI (${(sarRatio * 100).toFixed(0)}% SAR, R²=${(fusionResult.modelR2 * 100).toFixed(0)}%)`
    }
  } else {
    // Muitos pontos SAR, confiança depende mais do modelo
    const adjustment = 0.85 + fusionResult.modelR2 * 0.15
    return {
      confidence: baseConfidence * adjustment,
      source: 'SAR_HEAVY',
      note: `Fusão SAR pesada (${(sarRatio * 100).toFixed(0)}% SAR, R²=${(fusionResult.modelR2 * 100).toFixed(0)}%)`
    }
  }
}
