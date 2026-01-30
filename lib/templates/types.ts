/**
 * Template Types
 * Tipos compartilhados para o sistema de templates de análise
 */

import type { AgroData } from '@prisma/client'
import type { PhenologyResult } from '@/lib/services/phenology.service'

// ==================== Template Configuration ====================

export interface TemplateConfig {
  id: string
  name: string
  description: string
  icon: string
  color: string
  version: string
}

// ==================== Analysis Context ====================

export interface FieldContext {
  id: string
  name: string
  city: string
  state: string
  cropType: string
  areaHa: number
  seasonStartDate: string
}

export interface AnalysisContext {
  field: FieldContext
  agroData: {
    areaHa: number | null
    volumeEstimatedKg: number | null
    plantingDate: string | null
    sosDate: string | null
    eosDate: string | null
    peakDate: string | null
    cycleDays: number | null
    confidenceScore: number | null
    confidence: string | null
    historicalCorrelation: number | null
    phenologyHealth: string | null
    peakNdvi: number | null
    detectedReplanting: boolean
  }
  phenology: PhenologyResult
  rawData?: {
    ndvi?: any[]
    precipitation?: any[]
    soil?: any
  }
}

// ==================== Template Response ====================

export interface BaseAnalysisResult {
  status: string
  statusLabel: string
  statusColor: 'green' | 'yellow' | 'red' | 'blue'
  summary: string
  risks: string[]
  recommendations: string[]
  metrics: Record<string, any>
}

// Credit Template
export interface CreditAnalysisResult extends BaseAnalysisResult {
  status: 'NORMAL' | 'ALERTA' | 'CRITICO'
  metrics: {
    washoutRisk: 'BAIXO' | 'MEDIO' | 'ALTO'
    guaranteeHealth: number
    deliveryProbability: number
    cprAdherence: boolean
  }
}

// Logistics Template
export interface LogisticsAnalysisResult extends BaseAnalysisResult {
  status: 'OTIMO' | 'ATENCAO' | 'CRITICO'
  metrics: {
    harvestStart: string
    harvestEnd: string
    dailyVolume: number
    peakStart: string
    peakEnd: string
    weatherRisk: 'BAIXO' | 'MEDIO' | 'ALTO'
    grainQualityRisk: 'BAIXO' | 'MEDIO' | 'ALTO'
    trucksNeeded: number
  }
}

// Risk Matrix Template
export interface RiskMatrixAnalysisResult extends BaseAnalysisResult {
  status: 'EXCELENTE' | 'BOM' | 'ATENCAO' | 'CRITICO'
  metrics: {
    overallScore: number
    climaticRisk: 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO'
    phenologicalRisk: 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO'
    operationalRisk: 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO'
    commercialRisk: 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO'
    trend: 'IMPROVING' | 'STABLE' | 'WORSENING'
  }
}

export type AnalysisResult = CreditAnalysisResult | LogisticsAnalysisResult | RiskMatrixAnalysisResult

// ==================== Template Registry ====================

export type TemplateId = 'CREDIT' | 'LOGISTICS' | 'RISK_MATRIX'

export interface TemplateDefinition {
  config: TemplateConfig
  buildSystemPrompt: () => string
  buildUserPrompt: (context: AnalysisContext) => string
  parseResponse: (response: any) => AnalysisResult
  getFallbackResult: (context: AnalysisContext) => AnalysisResult
}
