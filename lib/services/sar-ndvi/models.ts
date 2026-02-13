/**
 * SAR-NDVI Adaptive Fusion - ML model trainers
 */

import { mean, std, pearsonR, r2Score, rmse } from './statistics'
import type { SarPoint } from './types'

/**
 * K-Nearest Neighbors Regression
 */
export function trainKNN(X: number[][], y: number[], k = 5): {
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
export function trainGPR(X: number[][], y: number[], lengthScale = 1.0, noiseVar = 0.1): {
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
export function trainLinear(X: number[][], y: number[]): {
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

/**
 * Seleciona automaticamente a melhor feature baseado em correlação
 * Regra: Se corrVH > 70% → usar só VH; senão → usar VV+VH
 */
export function selectBestFeature(
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
