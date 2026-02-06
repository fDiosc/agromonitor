/**
 * SAR-NDVI Adaptive Fusion Service (BETA)
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

import prisma from '../prisma'

// ==================== Types ====================

export interface SarPoint {
  date: string
  vv: number  // dB
  vh: number  // dB
}

export interface NdviPoint {
  date: string
  ndvi: number
  source: 'OPTICAL' | 'SAR_FUSED' | 'INTERPOLATED'
  quality: number      // 0-1 confiança
  uncertainty?: number // ± desvio padrão (se GPR)
}

export interface CalibrationModel {
  fieldId: string
  featureType: 'VH' | 'VV' | 'VV_VH'
  modelType: 'GPR' | 'KNN'
  r2: number
  rmse: number
  correlationVV: number
  correlationVH: number
  trainedAt: string
  nPairs: number
  // Parâmetros do modelo
  params: {
    // Para regressão simples (fallback)
    coeffs?: number[]
    intercept?: number
    // Para KNN
    trainingData?: { features: number[], ndvi: number }[]
    k?: number
    // Para GPR
    alpha?: number[]
    xTrain?: number[][]
    yMean?: number
    means?: number[]
    stds?: number[]
    lengthScale?: number
  }
}

export interface FusionResult {
  points: NdviPoint[]
  gapsFilled: number
  opticalPoints: number
  sarFusedPoints: number
  fusionMethod: 'GPR' | 'KNN' | 'LINEAR' | 'NONE'
  featureUsed: 'VH' | 'VV' | 'VV_VH' | 'NONE'
  modelR2: number
  modelRMSE: number
  calibrationUsed: boolean
}

// ==================== Statistics ====================

function mean(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function std(arr: number[]): number {
  if (arr.length === 0) return 0
  const m = mean(arr)
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length)
}

function pearsonR(x: number[], y: number[]): number {
  const n = x.length
  if (n === 0) return 0
  const mx = mean(x), my = mean(y)
  const sx = std(x), sy = std(y)
  if (sx === 0 || sy === 0) return 0
  return x.reduce((sum, xi, i) => sum + (xi - mx) * (y[i] - my), 0) / (n * sx * sy)
}

function r2Score(yTrue: number[], yPred: number[]): number {
  const yMean = mean(yTrue)
  const ssTot = yTrue.reduce((sum, y) => sum + (y - yMean) ** 2, 0)
  const ssRes = yTrue.reduce((sum, y, i) => sum + (y - yPred[i]) ** 2, 0)
  if (ssTot === 0) return 0
  return 1 - ssRes / ssTot
}

function rmse(yTrue: number[], yPred: number[]): number {
  return Math.sqrt(yTrue.reduce((sum, y, i) => sum + (y - yPred[i]) ** 2, 0) / yTrue.length)
}

// ==================== Models ====================

/**
 * K-Nearest Neighbors Regression
 */
function trainKNN(X: number[][], y: number[], k = 5): {
  predict: (x: number[]) => number
  trainingData: { features: number[], ndvi: number }[]
} {
  const means = X[0].map((_, j) => mean(X.map(row => row[j])))
  const stdsArr = X[0].map((_, j) => std(X.map(row => row[j])) || 1)
  const XNorm = X.map(row => row.map((v, j) => (v - means[j]) / stdsArr[j]))
  
  const trainingData = X.map((row, i) => ({ features: row, ndvi: y[i] }))
  
  return {
    predict: (x: number[]) => {
      const xNorm = x.map((v, j) => (v - means[j]) / stdsArr[j])
      const distances = XNorm.map((row, i) => ({
        dist: Math.sqrt(row.reduce((sum, v, j) => sum + (v - xNorm[j]) ** 2, 0)),
        y: y[i]
      }))
      distances.sort((a, b) => a.dist - b.dist)
      const neighbors = distances.slice(0, Math.min(k, distances.length))
      const totalWeight = neighbors.reduce((sum, n) => sum + 1 / (n.dist + 1e-6), 0)
      return neighbors.reduce((sum, n) => sum + n.y / (n.dist + 1e-6), 0) / totalWeight
    },
    trainingData
  }
}

/**
 * Gaussian Process Regression (simplificado)
 * Retorna predição + incerteza
 */
function trainGPR(X: number[][], y: number[], lengthScale = 1.0, noiseVar = 0.1): {
  predict: (x: number[]) => { mean: number, std: number }
  params: {
    alpha: number[]
    xTrain: number[][]
    yMean: number
    means: number[]
    stds: number[]
    lengthScale: number
  }
} {
  const n = X.length
  const means = X[0].map((_, j) => mean(X.map(row => row[j])))
  const stdsArr = X[0].map((_, j) => std(X.map(row => row[j])) || 1)
  const XNorm = X.map(row => row.map((v, j) => (v - means[j]) / stdsArr[j]))
  const yMean = mean(y)
  const yNorm = y.map(v => v - yMean)
  
  const kernel = (x1: number[], x2: number[]): number => {
    const dist = x1.reduce((sum, v, i) => sum + (v - x2[i]) ** 2, 0)
    return Math.exp(-dist / (2 * lengthScale ** 2))
  }
  
  // Compute K matrix
  const K: number[][] = Array(n).fill(0).map(() => Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      K[i][j] = kernel(XNorm[i], XNorm[j])
      if (i === j) K[i][j] += noiseVar
    }
  }
  
  // Invert K (Gauss-Jordan)
  const aug = K.map((row, i) => [...row, ...Array(n).fill(0).map((_, j) => i === j ? 1 : 0)])
  for (let col = 0; col < n; col++) {
    let maxRow = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]]
    if (Math.abs(aug[col][col]) < 1e-10) aug[col][col] = 1e-10
    const scale = aug[col][col]
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= scale
    for (let row = 0; row < n; row++) {
      if (row !== col) {
        const factor = aug[row][col]
        for (let j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j]
      }
    }
  }
  const KInv = aug.map(row => row.slice(n))
  const alpha = KInv.map(row => row.reduce((sum, v, i) => sum + v * yNorm[i], 0))
  
  return {
    predict: (x: number[]) => {
      const xNorm = x.map((v, j) => (v - means[j]) / stdsArr[j])
      const kStar = XNorm.map(xi => kernel(xNorm, xi))
      const predMean = yMean + kStar.reduce((sum, ki, i) => sum + ki * alpha[i], 0)
      
      // Variance
      const kStarStar = kernel(xNorm, xNorm) + noiseVar
      const v = KInv.map(row => row.reduce((sum, k, i) => sum + k * kStar[i], 0))
      const variance = kStarStar - kStar.reduce((sum, ki, i) => sum + ki * v[i], 0)
      
      return { mean: predMean, std: Math.sqrt(Math.max(0, variance)) }
    },
    params: {
      alpha,
      xTrain: XNorm,
      yMean,
      means,
      stds: stdsArr,
      lengthScale
    }
  }
}

/**
 * Regressão Linear (fallback)
 */
function trainLinear(X: number[][], y: number[]): {
  predict: (x: number[]) => number
  coeffs: number[]
  intercept: number
} {
  const n = X.length
  const k = X[0].length
  
  const means: number[] = []
  const stds: number[] = []
  const XNorm = X.map(row => row.map((v, j) => {
    if (means[j] === undefined) {
      const col = X.map(r => r[j])
      means[j] = mean(col)
      stds[j] = std(col) || 1
    }
    return (v - means[j]) / stds[j]
  }))
  
  const yMean = mean(y)
  const yNorm = y.map(v => v - yMean)
  
  // XtX + regularization
  const lambda = 1.0
  const XtX: number[][] = Array(k).fill(0).map(() => Array(k).fill(0))
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      for (let m = 0; m < n; m++) {
        XtX[i][j] += XNorm[m][i] * XNorm[m][j]
      }
    }
    XtX[i][i] += lambda
  }
  
  const XtY: number[] = Array(k).fill(0)
  for (let i = 0; i < k; i++) {
    for (let m = 0; m < n; m++) {
      XtY[i] += XNorm[m][i] * yNorm[m]
    }
  }
  
  // Solve
  const aug = XtX.map((row, i) => [...row, XtY[i]])
  for (let col = 0; col < k; col++) {
    let maxRow = col
    for (let row = col + 1; row < k; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]]
    if (Math.abs(aug[col][col]) < 1e-10) aug[col][col] = 1e-10
    for (let row = 0; row < k; row++) {
      if (row !== col) {
        const factor = aug[row][col] / aug[col][col]
        for (let j = col; j <= k; j++) aug[row][j] -= factor * aug[col][j]
      }
    }
  }
  
  const coeffsNorm = aug.map((row, i) => row[k] / row[i])
  const coeffs = coeffsNorm.map((c, j) => c / stds[j])
  const intercept = yMean - coeffs.reduce((sum, c, j) => sum + c * means[j], 0)
  
  return {
    predict: (x: number[]) => intercept + x.reduce((sum, xi, i) => sum + coeffs[i] * xi, 0),
    coeffs,
    intercept
  }
}

// ==================== Feature Selection ====================

/**
 * Seleciona automaticamente a melhor feature baseado em correlação
 * Regra: Se corrVH > 70% → usar só VH; senão → usar VV+VH
 */
function selectBestFeature(
  sarPoints: SarPoint[],
  ndviPoints: { date: string, ndvi: number }[]
): { featureType: 'VH' | 'VV' | 'VV_VH', pairs: { features: number[], ndvi: number }[], corrVV: number, corrVH: number } {
  // Criar mapa de NDVI
  const ndviMap = new Map<string, number>()
  for (const d of ndviPoints) {
    ndviMap.set(d.date, d.ndvi)
  }
  
  // Criar pares com tolerância de ±5 dias
  const pairs: { vv: number, vh: number, ndvi: number }[] = []
  
  for (const sar of sarPoints) {
    let ndvi: number | undefined
    for (const offset of [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5]) {
      const checkDate = new Date(sar.date)
      checkDate.setDate(checkDate.getDate() + offset)
      const val = ndviMap.get(checkDate.toISOString().split('T')[0])
      if (val !== undefined) { ndvi = val; break }
    }
    if (ndvi !== undefined) {
      pairs.push({ vv: sar.vv, vh: sar.vh, ndvi })
    }
  }
  
  if (pairs.length < 5) {
    // Poucos pares, usar VV+VH como default
    return { 
      featureType: 'VV_VH', 
      pairs: pairs.map(p => ({ features: [p.vv, p.vh], ndvi: p.ndvi })),
      corrVV: 0,
      corrVH: 0
    }
  }
  
  // Calcular correlações
  const vv = pairs.map(p => p.vv)
  const vh = pairs.map(p => p.vh)
  const ndvi = pairs.map(p => p.ndvi)
  
  const corrVV = Math.abs(pearsonR(vv, ndvi))
  const corrVH = Math.abs(pearsonR(vh, ndvi))
  
  console.log(`[SAR_FUSION] Correlations: VV=${(corrVV * 100).toFixed(1)}%, VH=${(corrVH * 100).toFixed(1)}%`)
  
  // Regra de seleção baseada em pesquisa
  if (corrVH > 0.70) {
    // VH é muito bom, usar sozinho
    return { 
      featureType: 'VH', 
      pairs: pairs.map(p => ({ features: [p.vh], ndvi: p.ndvi })),
      corrVV,
      corrVH
    }
  } else if (corrVV > corrVH + 0.15) {
    // VV é significativamente melhor
    return { 
      featureType: 'VV', 
      pairs: pairs.map(p => ({ features: [p.vv], ndvi: p.ndvi })),
      corrVV,
      corrVH
    }
  } else {
    // Usar ambos
    return { 
      featureType: 'VV_VH', 
      pairs: pairs.map(p => ({ features: [p.vv, p.vh], ndvi: p.ndvi })),
      corrVV,
      corrVH
    }
  }
}

// ==================== Calibration ====================

/**
 * Treina modelo de calibração local para o talhão
 */
export async function trainLocalCalibration(
  fieldId: string,
  sarPoints: SarPoint[],
  ndviPoints: { date: string, ndvi: number }[]
): Promise<CalibrationModel | null> {
  console.log(`[SAR_FUSION] Training calibration for field ${fieldId}`)
  console.log(`[SAR_FUSION] SAR points: ${sarPoints.length}, NDVI points: ${ndviPoints.length}`)
  
  // Selecionar features
  const { featureType, pairs, corrVV, corrVH } = selectBestFeature(sarPoints, ndviPoints)
  
  if (pairs.length < 8) {
    console.log(`[SAR_FUSION] Not enough pairs (${pairs.length}) for calibration`)
    return null
  }
  
  console.log(`[SAR_FUSION] Using feature: ${featureType}, pairs: ${pairs.length}`)
  
  const X = pairs.map(p => p.features)
  const y = pairs.map(p => p.ndvi)
  
  // Testar GPR e KNN via LOOCV simplificado
  let bestModel: 'GPR' | 'KNN' = 'GPR'
  let bestR2 = -999
  let bestRMSE = 999
  
  // Testar GPR
  try {
    const gprPreds: number[] = []
    const gprTrue: number[] = []
    for (let i = 0; i < X.length; i++) {
      const XTrain = X.filter((_, j) => j !== i)
      const yTrain = y.filter((_, j) => j !== i)
      const model = trainGPR(XTrain, yTrain)
      gprPreds.push(model.predict(X[i]).mean)
      gprTrue.push(y[i])
    }
    const gprR2 = r2Score(gprTrue, gprPreds)
    const gprRMSE = rmse(gprTrue, gprPreds)
    if (gprR2 > bestR2) {
      bestModel = 'GPR'
      bestR2 = gprR2
      bestRMSE = gprRMSE
    }
  } catch { }
  
  // Testar KNN
  try {
    const knnPreds: number[] = []
    const knnTrue: number[] = []
    for (let i = 0; i < X.length; i++) {
      const XTrain = X.filter((_, j) => j !== i)
      const yTrain = y.filter((_, j) => j !== i)
      const model = trainKNN(XTrain, yTrain, 5)
      knnPreds.push(model.predict(X[i]))
      knnTrue.push(y[i])
    }
    const knnR2 = r2Score(knnTrue, knnPreds)
    const knnRMSE = rmse(knnTrue, knnPreds)
    if (knnR2 > bestR2) {
      bestModel = 'KNN'
      bestR2 = knnR2
      bestRMSE = knnRMSE
    }
  } catch { }
  
  console.log(`[SAR_FUSION] Best model: ${bestModel}, R²=${(bestR2 * 100).toFixed(1)}%, RMSE=${bestRMSE.toFixed(3)}`)
  
  // Treinar modelo final com todos os dados
  let params: CalibrationModel['params'] = {}
  
  if (bestModel === 'GPR') {
    const model = trainGPR(X, y)
    params = model.params
  } else {
    const model = trainKNN(X, y, 5)
    params = { trainingData: model.trainingData, k: 5 }
  }
  
  // Também treinar linear como fallback
  const linearModel = trainLinear(X, y)
  params.coeffs = linearModel.coeffs
  params.intercept = linearModel.intercept
  
  return {
    fieldId,
    featureType,
    modelType: bestModel,
    r2: bestR2,
    rmse: bestRMSE,
    correlationVV: corrVV,
    correlationVH: corrVH,
    trainedAt: new Date().toISOString(),
    nPairs: pairs.length,
    params
  }
}

/**
 * Salva calibração no banco de dados
 */
export async function saveCalibration(calibration: CalibrationModel): Promise<void> {
  try {
    // Salvar no agroData do field
    const field = await prisma.field.findUnique({
      where: { id: calibration.fieldId },
      include: { agroData: true }
    })
    
    if (!field) return
    
    let rawAreaData: any = {}
    if (field.agroData?.rawAreaData) {
      try {
        rawAreaData = JSON.parse(field.agroData.rawAreaData)
      } catch { }
    }
    
    rawAreaData.sarCalibration = calibration
    
    if (field.agroData) {
      await prisma.agroData.update({
        where: { fieldId: calibration.fieldId },
        data: { rawAreaData: JSON.stringify(rawAreaData) }
      })
    }
    
    console.log(`[SAR_FUSION] Calibration saved for field ${calibration.fieldId}`)
  } catch (error) {
    console.error('[SAR_FUSION] Error saving calibration:', error)
  }
}

/**
 * Carrega calibração do banco de dados
 */
export async function loadCalibration(fieldId: string): Promise<CalibrationModel | null> {
  try {
    const field = await prisma.field.findUnique({
      where: { id: fieldId },
      include: { agroData: true }
    })
    
    if (!field?.agroData?.rawAreaData) return null
    
    const rawAreaData = JSON.parse(field.agroData.rawAreaData)
    return rawAreaData.sarCalibration || null
  } catch {
    return null
  }
}

// ==================== Fusion ====================

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
