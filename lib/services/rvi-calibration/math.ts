/**
 * RVI Calibration - Math / training functions
 */

/**
 * Treina regressão linear simples (OLS)
 * NDVI = a * RVI + b
 */
export function trainLinearRegression(pairs: { ndvi: number, rvi: number }[]): {
  a: number
  b: number
  r2: number
  rmse: number
} {
  const n = pairs.length

  if (n < 2) {
    throw new Error('Insufficient pairs for regression')
  }

  // Somas para OLS
  const sumX = pairs.reduce((s, p) => s + p.rvi, 0)
  const sumY = pairs.reduce((s, p) => s + p.ndvi, 0)
  const sumXY = pairs.reduce((s, p) => s + p.rvi * p.ndvi, 0)
  const sumX2 = pairs.reduce((s, p) => s + p.rvi * p.rvi, 0)

  const denominator = n * sumX2 - sumX * sumX

  if (Math.abs(denominator) < 1e-10) {
    // Variância zero em X - usar coeficientes default
    return { a: 1.0, b: 0, r2: 0, rmse: 1 }
  }

  const a = (n * sumXY - sumX * sumY) / denominator
  const b = (sumY - a * sumX) / n

  // Calcular R² e RMSE
  const meanY = sumY / n
  const ssTotal = pairs.reduce((s, p) => s + Math.pow(p.ndvi - meanY, 2), 0)
  const ssResidual = pairs.reduce((s, p) => s + Math.pow(p.ndvi - (a * p.rvi + b), 2), 0)

  const r2 = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0
  const rmse = Math.sqrt(ssResidual / n)

  return { a, b, r2, rmse }
}
