/**
 * Step 07: AI visual validation (if feature enabled)
 */

import type { PipelineContext, StepResult } from '../types'
import { runAIValidation } from '@/lib/services/ai-validation.service'
import { getFeatureFlags } from '@/lib/services/feature-flags.service'

export async function runAiValidation(ctx: PipelineContext): Promise<StepResult> {
  const { field, phenology } = ctx
  if (!field.workspaceId || !phenology) return { ok: true }

  try {
    const featureFlags = await getFeatureFlags(field.workspaceId)
    const shouldRunAI = featureFlags.enableAIValidation && (
      featureFlags.aiValidationTrigger === 'ON_PROCESS' ||
      (featureFlags.aiValidationTrigger === 'ON_LOW_CONFIDENCE' && ctx.finalConfidenceScore < 50)
    )

    if (!shouldRunAI) return { ok: true }

    console.log('[PROCESS] Running AI visual validation...')

    // Prepare enrichment data
    const gddData = parseGddData(ctx.thermalData)
    const waterBalData = parseWaterBalData(ctx.waterBalanceData, ctx.eosAdjustment)
    const precipJudgeData = parsePrecipData(ctx.precipitationData, ctx.harvestAdjustment)
    const zarcJudgeData = parseZarcData(ctx.complementary, ctx.zarcAnalysis)

    ctx.aiValidationResult = await runAIValidation({
      fieldId: ctx.fieldId,
      workspaceId: field.workspaceId,
      geometry: field.geometryJson,
      cropType: field.cropType,
      areaHa: ctx.areaHa,
      plantingDate: phenology.plantingDate,
      plantingSource: phenology.method,
      sosDate: phenology.sosDate,
      eosDate: ctx.fusedEosDate || phenology.eosDate,
      eosMethod: ctx.fusedEosMethod ? `FUSION_${ctx.fusedEosMethod}` : phenology.method,
      confidenceScore: ctx.finalConfidenceScore,
      peakNdvi: phenology.peakNdvi,
      peakDate: phenology.peakDate,
      phenologyHealth: phenology.phenologyHealth,
      gddData,
      waterBalanceData: waterBalData,
      precipData: precipJudgeData,
      zarcData: zarcJudgeData,
      fusionMetrics: ctx.fusionMetrics ? {
        gapsFilled: ctx.fusionMetrics.gapsFilled,
        radarContribution: ctx.fusionMetrics.radarContribution,
        continuityScore: ctx.fusionMetrics.continuityScore,
      } : undefined,
      cropPatternResult: ctx.cropPatternResult!,
      curatorModel: featureFlags.aiCuratorModel,
    })

    console.log('[PROCESS] AI Validation:', {
      agreement: ctx.aiValidationResult.agreement,
      confidence: ctx.aiValidationResult.confidence,
      visualAlerts: ctx.aiValidationResult.visualAlerts.length,
    })
  } catch (err) {
    console.warn('[PROCESS] Erro na validação visual IA (continuando):', err)
  }

  return { ok: true }
}

// ─── Parse helpers ───────────────────────────────────────

function parseGddData(thermalData: string | null) {
  if (!thermalData) return undefined
  try {
    const parsed = JSON.parse(thermalData)
    return {
      accumulated: parsed.gddAnalysis?.accumulatedGdd || 0,
      required: parsed.gddAnalysis?.requiredGdd || 0,
      progress: parsed.gddAnalysis?.progressPercent || 0,
      daysToMaturity: parsed.gddAnalysis?.daysToMaturity ?? null,
      confidence: parsed.gddAnalysis?.confidence || 'LOW',
    }
  } catch { return undefined }
}

function parseWaterBalData(waterBalanceData: string | null, eosAdjustment: any) {
  if (!waterBalanceData) return undefined
  try {
    const parsed = JSON.parse(waterBalanceData)
    return {
      deficit: parsed.totalDeficit || 0,
      stressDays: parsed.stressDays || 0,
      stressLevel: eosAdjustment?.stressLevel || 'LOW',
      waterAdjustment: eosAdjustment?.adjustmentDays || 0,
    }
  } catch { return undefined }
}

function parsePrecipData(precipitationData: string | null, harvestAdjustment: any) {
  if (!precipitationData) return undefined
  try {
    const parsed = JSON.parse(precipitationData)
    return {
      recentPrecipMm: harvestAdjustment?.recentPrecipMm || parsed.totalMm || 0,
      qualityRisk: harvestAdjustment?.grainQualityRisk || 'LOW',
    }
  } catch { return undefined }
}

function parseZarcData(complementary: any, zarcAnalysis: any) {
  if (!complementary?.zarc_anual || !zarcAnalysis?.window) return undefined
  return {
    plantingStatus: zarcAnalysis.plantingStatus || 'UNKNOWN',
    plantingRisk: zarcAnalysis.plantingRisk ?? 0,
    windowStart: zarcAnalysis.window.windowStart?.toISOString().split('T')[0] || '',
    windowEnd: zarcAnalysis.window.windowEnd?.toISOString().split('T')[0] || '',
  }
}
