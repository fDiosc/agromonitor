/**
 * Phenology Service - Types and Configuration
 */

export interface PhenologyConfig {
  crop: string
  areaHa: number
  // Data de plantio informada pelo produtor (opcional)
  // Se fornecida, será usada como base confiável para os cálculos
  plantingDateInput?: string | null
}

export interface PhenologyDiagnostic {
  type: 'INFO' | 'WARNING' | 'ERROR'
  code: string
  message: string
  date?: string
}

export interface PhenologyResult {
  plantingDate: string | null
  sosDate: string | null
  eosDate: string | null
  peakDate: string | null
  cycleDays: number

  detectedReplanting: boolean
  replantingDate: string | null
  yieldEstimateKg: number
  yieldEstimateKgHa: number
  phenologyHealth: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'
  peakNdvi: number

  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  confidenceScore: number
  method: 'ALGORITHM' | 'PROJECTION'
  historicalCorrelation: number

  diagnostics: PhenologyDiagnostic[]
}

export interface CropThresholds {
  sosNdvi: number
  eosNdvi: number
  peakMinNdvi: number
  cycleDays: number
  emergenceDays: number
  baseYieldKgHa: number
}

export const CROP_THRESHOLDS: Record<string, CropThresholds> = {
  SOJA: {
    sosNdvi: 0.35,
    eosNdvi: 0.38,
    peakMinNdvi: 0.70,
    cycleDays: 120,
    emergenceDays: 8,
    baseYieldKgHa: 3500
  },
  MILHO: {
    sosNdvi: 0.30,
    eosNdvi: 0.35,
    peakMinNdvi: 0.65,
    cycleDays: 140,
    emergenceDays: 7,
    baseYieldKgHa: 9000
  },
  ALGODAO: {
    sosNdvi: 0.32,
    eosNdvi: 0.40,
    peakMinNdvi: 0.60,
    cycleDays: 180,
    emergenceDays: 10,
    baseYieldKgHa: 4500
  },
  TRIGO: {
    sosNdvi: 0.30,
    eosNdvi: 0.35,
    peakMinNdvi: 0.65,
    cycleDays: 120,
    emergenceDays: 7,
    baseYieldKgHa: 3000
  }
}
