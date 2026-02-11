/**
 * AI Visual Validation - Shared Types
 * Types for the Curator + Judge agent pipeline
 * Adapted from POC Image Analysis lib/types.ts
 */

// ==================== Image Types ====================

export type ImageType =
  | 'truecolor'
  | 'ndvi'
  | 'radar'
  | 's3-ndvi'
  | 'landsat-truecolor'
  | 'landsat-ndvi'

export type SatelliteCollection =
  | 'sentinel-2-l2a'
  | 'sentinel-1-grd'
  | 'sentinel-3-olci'
  | 'landsat-ot-l1'

export type CuratorModelId = 'gemini-3-flash-preview' | 'gemini-2.5-flash-lite'

export interface AgenticImageEntry {
  date: string
  type: ImageType
  base64: string
  metadata: {
    collection: string
    cloudCover?: number
    bbox: number[]
  }
}

// ==================== Curation Types ====================

export interface CurationImageScore {
  date: string
  type: ImageType
  score: number        // 0-100
  included: boolean
  reason: string
}

export interface CurationReport {
  totalImages: number
  selectedImages: number
  discardedImages: number
  scores: CurationImageScore[]
  contextSummary: string
  timeSeriesCleaningSummary?: string
}

// ==================== Time Series Types ====================

export interface MultiSensorNdviEntry {
  dateFrom: string
  dateTo: string
  mean: number
  min: number
  max: number
  stDev: number
  sampleCount: number
  noDataCount: number
  median?: number
  source: 'S2' | 'S3' | 'Landsat'
  confidence: number // 0-100
  resolution: string // e.g. "10m", "300m", "30m"
}

export interface RadarTimeSeriesEntry {
  dateFrom: string
  dateTo: string
  vvMean: number
  vhMean: number
  vvStDev: number
  vhStDev: number
  sampleCount: number
}

// ==================== Cost / Token Types ====================

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  model: string
}

export interface AgentCostReport {
  model: string
  modelLabel: string
  inputTokens: number
  outputTokens: number
  inputCost: number
  outputCost: number
  totalCost: number
}

export interface CostReport {
  curator: AgentCostReport
  judge: AgentCostReport
  totalInputTokens: number
  totalOutputTokens: number
  totalCost: number
  durations: {
    fetchMs: number
    timeseriesMs: number
    curatorMs: number
    judgeMs: number
    totalMs: number
  }
}

// ==================== Judge Response Types ====================

export interface VisualFinding {
  type: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  description: string
  affectedArea: string // percentage
}

export interface HarvestReadiness {
  ready: boolean
  estimatedDate: string | null
  delayRisk: 'NONE' | 'RAIN' | 'MOISTURE' | 'MATURITY'
  delayDays: number
  notes: string
}

export interface RiskFactor {
  category: 'CLIMATIC' | 'PHYTOSANITARY' | 'OPERATIONAL'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  description: string
}

export interface RiskAssessment {
  overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  factors: RiskFactor[]
}

export interface JudgeAnalysis {
  algorithmicValidation: {
    eosAgreement: 'CONFIRMED' | 'QUESTIONED' | 'REJECTED'
    eosAdjustedDate: string | null
    eosAdjustmentReason: string | null
    stageAgreement: boolean
    stageComment: string
  }
  visualFindings: VisualFinding[]
  harvestReadiness: HarvestReadiness
  riskAssessment: RiskAssessment
  recommendations: string[]
  confidence: number // 0-100
}
