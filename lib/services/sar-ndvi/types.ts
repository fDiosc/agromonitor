/**
 * SAR-NDVI Adaptive Fusion - Type definitions
 */

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
