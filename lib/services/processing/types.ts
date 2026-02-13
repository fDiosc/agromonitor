/**
 * Pipeline types for field processing.
 * Defines the shared context and step result contracts.
 */

import type { PhenologyResult } from '@/lib/services/phenology.service'
import type { CropPatternResult } from '@/lib/services/crop-pattern.service'
import type { EosFusionResult } from '@/lib/services/eos-fusion.service'
import type { AIValidationResult } from '@/lib/services/ai-validation.service'
import type { FusionResult as AdaptiveFusionResult } from '@/lib/services/sar-ndvi-adaptive.service'

// ==================== Pipeline Context ====================

/**
 * Shared mutable context that flows through the pipeline.
 * Each step reads from and writes to this context.
 */
export interface PipelineContext {
  // ─── Input (set by orchestrator) ──────────────────────
  fieldId: string
  field: {
    id: string
    name: string
    geometryJson: string
    seasonStartDate: Date
    cropType: string
    plantingDateInput: Date | null
    workspaceId: string | null
    status: string
  }
  startTime: number

  // ─── Step 01: Fetch NDVI ──────────────────────────────
  merxReport: {
    ndvi: any[]
    historical_ndvi: any[][]
    precipitacao: any
    solo: any
    area_ha: number
  } | null
  areaHa: number

  // ─── Step 02: Detect Phenology ────────────────────────
  detectedPhenology: PhenologyResult | null
  phenology: PhenologyResult | null
  plantingDateInput: string | null

  // ─── Step 03: Crop Pattern ────────────────────────────
  cropPatternResult: CropPatternResult | null
  shortCircuited: boolean

  // ─── Step 04: Fetch Climate ───────────────────────────
  complementary: { zarc_anual: any; idade_lavoura: any } | null
  precipitationData: string | null
  harvestAdjustment: any
  waterBalanceData: string | null
  eosAdjustment: any
  waterBalStressDays: number
  waterBalYieldImpact: number
  thermalData: string | null
  climateEnvelopeData: { precipitation: string | null; temperature: string | null }

  // ─── Step 05: Fetch Radar ─────────────────────────────
  radarData: string | null
  calibrationStats: {
    pairsCount: number
    hasModel: boolean
    modelR2: number | null
    modelRmse: number | null
    lastTrainingDate: Date | null
  } | null
  fusionData: string | null
  fusionMetrics: {
    gapsFilled: number
    maxGapDays: number
    radarContribution: number
    continuityScore: number
    calibrationR2?: number
    fusionMethod?: string
    featureUsed?: string
    isBeta?: boolean
    confidenceNote?: string
  } | null
  adaptiveFusionResult: AdaptiveFusionResult | null

  // ─── Step 06: Fuse EOS ────────────────────────────────
  adjustedConfidence: number
  fusedEosDate: string | null
  fusedEosMethod: string | null
  fusedEosConfidence: number | null
  fusedEosPassed: boolean
  finalConfidenceScore: number
  finalCorrelation: number

  // ─── Step 07: AI Validation ───────────────────────────
  aiValidationResult: AIValidationResult | null

  // ─── Step 08: Persist ─────────────────────────────────
  warnings: string[]
  finalStatus: 'SUCCESS' | 'PARTIAL' | 'ERROR'

  // ─── ZARC (calculated in fetch-climate) ───────────────
  zarcAnalysis: {
    window: { windowStart: Date; windowEnd: Date; optimalStart: Date; optimalEnd: Date } | null
    plantingRisk: number | null
    plantingStatus: string
  } | null
}

// ==================== Step Result ====================

export interface StepResult {
  ok: boolean
  error?: string
  /** Set to true to stop the pipeline early (e.g., NO_CROP short-circuit) */
  shortCircuit?: boolean
}

// ==================== Step Function Signature ====================

export type PipelineStep = (ctx: PipelineContext) => Promise<StepResult>

// ==================== Factory ====================

export function createInitialContext(
  fieldId: string,
  field: PipelineContext['field'],
): PipelineContext {
  return {
    fieldId,
    field,
    startTime: Date.now(),

    // Step 01
    merxReport: null,
    areaHa: 0,

    // Step 02
    detectedPhenology: null,
    phenology: null,
    plantingDateInput: null,

    // Step 03
    cropPatternResult: null,
    shortCircuited: false,

    // Step 04
    complementary: null,
    precipitationData: null,
    harvestAdjustment: null,
    waterBalanceData: null,
    eosAdjustment: null,
    waterBalStressDays: 0,
    waterBalYieldImpact: 0,
    thermalData: null,
    climateEnvelopeData: { precipitation: null, temperature: null },

    // Step 05
    radarData: null,
    calibrationStats: null,
    fusionData: null,
    fusionMetrics: null,
    adaptiveFusionResult: null,

    // Step 06
    adjustedConfidence: 0,
    fusedEosDate: null,
    fusedEosMethod: null,
    fusedEosConfidence: null,
    fusedEosPassed: false,
    finalConfidenceScore: 0,
    finalCorrelation: 50,

    // Step 07
    aiValidationResult: null,

    // Step 08
    warnings: [],
    finalStatus: 'SUCCESS',

    // ZARC
    zarcAnalysis: null,
  }
}
