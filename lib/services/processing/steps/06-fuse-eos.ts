/**
 * Step 06: Fuse EOS from NDVI + GDD + Water Balance
 */

import type { PipelineContext, StepResult } from '../types'
import { calculateFusedEos } from '@/lib/services/eos-fusion.service'

/** Map Portuguese stress levels to English */
const STRESS_LEVEL_MAP: Record<string, 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
  'BAIXO': 'LOW',
  'MODERADO': 'MEDIUM',
  'SEVERO': 'HIGH',
  'CRITICO': 'CRITICAL',
  'NONE': 'NONE',
  'LOW': 'LOW',
  'MEDIUM': 'MEDIUM',
  'HIGH': 'HIGH',
  'CRITICAL': 'CRITICAL',
}

export async function fuseEos(ctx: PipelineContext): Promise<StepResult> {
  if (!ctx.phenology || !ctx.merxReport) {
    return { ok: false, error: 'Sem fenologia para fusão EOS' }
  }

  const { phenology, merxReport, field } = ctx

  // Confidence from radar adjustment or phenology
  ctx.finalConfidenceScore = ctx.adjustedConfidence > 0
    ? Math.round(ctx.adjustedConfidence)
    : phenology.confidenceScore

  try {
    // Extract GDD data
    let gddEos: Date | null = null
    let gddAccumulated = 0
    let gddRequired = 0
    let gddConfidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW'

    if (ctx.thermalData) {
      const thermal = JSON.parse(ctx.thermalData)
      gddAccumulated = thermal.gddAnalysis?.accumulatedGdd || 0
      gddRequired = thermal.gddAnalysis?.requiredGdd || 0
      gddConfidence = (thermal.gddAnalysis?.confidence as 'HIGH' | 'MEDIUM' | 'LOW') || 'LOW'
      if (thermal.gddAnalysis?.projectedEos) {
        gddEos = new Date(thermal.gddAnalysis.projectedEos)
      }
    }

    // NDVI decline rate
    const ndviSeries = merxReport.ndvi
    const lastPt = ndviSeries.length > 0 ? ndviSeries[ndviSeries.length - 1] : null
    const lastNdvi = lastPt ? (lastPt.ndvi_smooth || lastPt.ndvi_raw || 0) : 0

    let ndviDeclineRate = 0
    if (ndviSeries.length >= 3) {
      const recent = ndviSeries.slice(-3)
      const rates: number[] = []
      for (let i = 1; i < recent.length; i++) {
        const prev = recent[i - 1].ndvi_smooth || recent[i - 1].ndvi_raw || 0
        const curr = recent[i].ndvi_smooth || recent[i].ndvi_raw || 0
        if (prev > 0) rates.push(((prev - curr) / prev) * 100)
      }
      ndviDeclineRate = rates.length > 0
        ? rates.reduce((a, b) => a + b, 0) / rates.length
        : 0
    }

    // Map stress level
    const mappedStressLevel = STRESS_LEVEL_MAP[ctx.eosAdjustment?.stressLevel || ''] ||
      (ctx.waterBalStressDays >= 20 ? 'CRITICAL' :
       ctx.waterBalStressDays >= 10 ? 'HIGH' :
       ctx.waterBalStressDays >= 5 ? 'MEDIUM' :
       ctx.waterBalStressDays > 0 ? 'LOW' : 'NONE')

    const fusionResult = calculateFusedEos({
      eosNdvi: phenology.eosDate ? new Date(phenology.eosDate) : null,
      ndviConfidence: ctx.finalConfidenceScore,
      currentNdvi: lastNdvi,
      peakNdvi: phenology.peakNdvi || 0,
      ndviDeclineRate,
      eosGdd: gddEos,
      gddConfidence,
      gddAccumulated,
      gddRequired,
      waterStressLevel: mappedStressLevel,
      stressDays: ctx.waterBalStressDays,
      yieldImpact: ctx.waterBalYieldImpact > 0 ? -ctx.waterBalYieldImpact : undefined,
      fusionMetrics: ctx.fusionMetrics ? {
        gapsFilled: ctx.fusionMetrics.gapsFilled,
        maxGapDays: ctx.fusionMetrics.maxGapDays,
        radarContribution: ctx.fusionMetrics.radarContribution,
        continuityScore: ctx.fusionMetrics.continuityScore,
      } : undefined,
      plantingDate: new Date(field.seasonStartDate),
      cropType: field.cropType,
    })

    ctx.fusedEosDate = fusionResult.eos.toISOString().split('T')[0]
    ctx.fusedEosMethod = fusionResult.method
    ctx.fusedEosConfidence = fusionResult.confidence
    ctx.fusedEosPassed = fusionResult.passed

    console.log('[PROCESS] Fused EOS:', {
      rawNdviEos: phenology.eosDate,
      fusedEos: ctx.fusedEosDate,
      method: ctx.fusedEosMethod,
      confidence: ctx.fusedEosConfidence,
    })
  } catch (err) {
    console.warn('[PROCESS] EOS Fusion error (using raw EOS):', err)
  }

  return { ok: true }
}
