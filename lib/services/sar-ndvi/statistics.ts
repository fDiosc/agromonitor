/**
 * SAR-NDVI Adaptive Fusion - Math/statistics helpers
 */

export function mean(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

export function std(arr: number[]): number {
  if (arr.length === 0) return 0
  const m = mean(arr)
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length)
}

export function pearsonR(x: number[], y: number[]): number {
  const n = x.length
  if (n === 0) return 0
  const mx = mean(x), my = mean(y)
  const sx = std(x), sy = std(y)
  if (sx === 0 || sy === 0) return 0
  return x.reduce((sum, xi, i) => sum + (xi - mx) * (y[i] - my), 0) / (n * sx * sy)
}

export function r2Score(yTrue: number[], yPred: number[]): number {
  const yMean = mean(yTrue)
  const ssTot = yTrue.reduce((sum, y) => sum + (y - yMean) ** 2, 0)
  const ssRes = yTrue.reduce((sum, y, i) => sum + (y - yPred[i]) ** 2, 0)
  if (ssTot === 0) return 0
  return 1 - ssRes / ssTot
}

export function rmse(yTrue: number[], yPred: number[]): number {
  return Math.sqrt(yTrue.reduce((sum, y, i) => sum + (y - yPred[i]) ** 2, 0) / yTrue.length)
}
