/**
 * RVI Calibration - Types and constants
 */

// ==================== Types ====================

export interface RviNdviPairInput {
  date: Date
  ndviValue: number
  rviValue: number
  cloudCover?: number
  quality: number
}

export interface CalibrationCoefficients {
  coefficientA: number  // Slope
  coefficientB: number  // Intercept
  rSquared: number      // R²
  rmse: number          // RMSE
  sampleCount: number
  trainPeriodStart: Date
  trainPeriodEnd: Date
  cropType: string
}

export interface CalibrationResult {
  ndvi: number
  method: 'LOCAL' | 'FIXED'
  confidence: number  // 0-1
  modelR2?: number
}

// ==================== Constants ====================

// Coeficientes fixos da literatura (fallback)
// Baseado em: Filgueiras et al. (2019), Veloso et al. (2017)
export const FIXED_COEFFICIENTS: Record<string, { a: number, b: number, r2: number }> = {
  SOJA: { a: 1.15, b: -0.15, r2: 0.78 },
  MILHO: { a: 1.10, b: -0.12, r2: 0.75 },
  ALGODAO: { a: 1.20, b: -0.18, r2: 0.72 },
  DEFAULT: { a: 1.12, b: -0.14, r2: 0.70 }
}

// Requisitos mínimos para treinamento
export const MIN_PAIRS_FOR_TRAINING = 15
export const MIN_R2_THRESHOLD = 0.5  // R² mínimo para usar modelo local
