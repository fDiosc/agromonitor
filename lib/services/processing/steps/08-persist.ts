/**
 * Step 08: Persist all computed data to database.
 * Handles both normal flow and short-circuit (NO_CROP).
 */

import type { PipelineContext, StepResult } from '../types'
import prisma from '@/lib/prisma'

export async function persist(ctx: PipelineContext): Promise<StepResult> {
  const { fieldId, field } = ctx

  // ─── Short-circuit persistence (NO_CROP) ───────────────
  if (ctx.shortCircuited && ctx.cropPatternResult) {
    await persistShortCircuit(ctx)
    return { ok: true }
  }

  if (!ctx.phenology || !ctx.detectedPhenology || !ctx.merxReport || !ctx.cropPatternResult) {
    return { ok: false, error: 'Dados insuficientes para persistir' }
  }

  const { phenology, detectedPhenology, merxReport, cropPatternResult } = ctx

  // Detected fields (never overwritten by manual edit)
  const detectedFields = {
    detectedPlantingDate: detectedPhenology.plantingDate ? new Date(detectedPhenology.plantingDate) : null,
    detectedSosDate: detectedPhenology.sosDate ? new Date(detectedPhenology.sosDate) : null,
    detectedEosDate: detectedPhenology.eosDate ? new Date(detectedPhenology.eosDate) : null,
    detectedPeakDate: detectedPhenology.peakDate ? new Date(detectedPhenology.peakDate) : null,
    detectedCycleDays: detectedPhenology.cycleDays,
    detectedCropType: field.cropType,
    detectedConfidence: detectedPhenology.confidence,
    detectedConfidenceScore: detectedPhenology.confidenceScore,
  }

  const cropPatternData = JSON.stringify({
    metrics: cropPatternResult.metrics,
    hypotheses: cropPatternResult.hypotheses,
    reason: cropPatternResult.reason,
    cropCategory: cropPatternResult.cropCategory,
  })

  const rawAreaData = JSON.stringify({
    area_ha: ctx.areaHa,
    harvestAdjustment: ctx.harvestAdjustment,
    waterBalance: ctx.waterBalanceData,
    eosAdjustment: ctx.eosAdjustment,
    thermal: ctx.thermalData,
    climateEnvelope: ctx.climateEnvelopeData,
    radar: ctx.radarData,
    fusion: ctx.fusionData,
    fusionMetrics: ctx.fusionMetrics,
    calibrationStats: ctx.calibrationStats,
    fusedEos: ctx.fusedEosDate ? {
      date: ctx.fusedEosDate,
      method: ctx.fusedEosMethod,
      confidence: ctx.fusedEosConfidence,
      passed: ctx.fusedEosPassed,
    } : null,
  })

  // AI Validation spread
  const aiFields = ctx.aiValidationResult ? {
    aiValidationResult: ctx.aiValidationResult.agreement,
    aiValidationDate: new Date(),
    aiValidationConfidence: ctx.aiValidationResult.confidence,
    aiValidationAgreement: JSON.stringify({
      eosAdjustedDate: ctx.aiValidationResult.eosAdjustedDate,
      eosAdjustmentReason: ctx.aiValidationResult.eosAdjustmentReason,
      stageAgreement: ctx.aiValidationResult.stageAgreement,
      harvestReadiness: ctx.aiValidationResult.harvestReadiness,
      riskAssessment: ctx.aiValidationResult.riskAssessment,
      recommendations: ctx.aiValidationResult.recommendations,
    }),
    aiEosAdjustedDate: ctx.aiValidationResult.eosAdjustedDate
      ? new Date(ctx.aiValidationResult.eosAdjustedDate) : null,
    aiVisualAlerts: JSON.stringify(ctx.aiValidationResult.visualAlerts),
    aiCurationReport: JSON.stringify(ctx.aiValidationResult.curationReport),
    aiCostReport: JSON.stringify(ctx.aiValidationResult.costReport),
    ...(ctx.aiValidationResult.cropVerification ? {
      aiCropVerificationStatus: ctx.aiValidationResult.cropVerification.status,
      aiCropVerificationData: JSON.stringify(ctx.aiValidationResult.cropVerification),
    } : {}),
  } : {}

  const coreData = {
    areaHa: ctx.areaHa,
    volumeEstimatedKg: phenology.yieldEstimateKg,
    plantingDate: phenology.plantingDate ? new Date(phenology.plantingDate) : null,
    sosDate: phenology.sosDate ? new Date(phenology.sosDate) : null,
    eosDate: phenology.eosDate ? new Date(phenology.eosDate) : null,
    peakDate: phenology.peakDate ? new Date(phenology.peakDate) : null,
    cycleDays: phenology.cycleDays,
    phenologyMethod: phenology.method,
    confidenceScore: ctx.finalConfidenceScore,
    confidence: phenology.confidence,
    historicalCorrelation: ctx.finalCorrelation,
    detectedReplanting: phenology.detectedReplanting,
    replantingDate: phenology.replantingDate ? new Date(phenology.replantingDate) : null,
    yieldEstimateKgHa: phenology.yieldEstimateKgHa,
    phenologyHealth: phenology.phenologyHealth,
    peakNdvi: phenology.peakNdvi,
    ...detectedFields,
    rawNdviData: JSON.stringify(merxReport.ndvi),
    rawPrecipData: ctx.precipitationData || JSON.stringify(merxReport.precipitacao),
    rawSoilData: JSON.stringify(merxReport.solo),
    rawHistoricalData: JSON.stringify(merxReport.historical_ndvi),
    rawAreaData,
    rawZarcData: JSON.stringify(ctx.complementary?.zarc_anual),
    zarcWindowStart: ctx.zarcAnalysis?.window?.windowStart || null,
    zarcWindowEnd: ctx.zarcAnalysis?.window?.windowEnd || null,
    zarcOptimalStart: ctx.zarcAnalysis?.window?.optimalStart || null,
    zarcOptimalEnd: ctx.zarcAnalysis?.window?.optimalEnd || null,
    zarcPlantingRisk: ctx.zarcAnalysis?.plantingRisk ?? null,
    zarcPlantingStatus: ctx.zarcAnalysis?.plantingStatus !== 'UNKNOWN'
      ? ctx.zarcAnalysis?.plantingStatus ?? null
      : null,
    cropPatternStatus: cropPatternResult.status,
    cropPatternData,
    ...aiFields,
    diagnostics: JSON.stringify(phenology.diagnostics),
  }

  // Upsert AgroData
  await prisma.agroData.upsert({
    where: { fieldId },
    update: { ...coreData, updatedAt: new Date() },
    create: { fieldId, ...coreData },
  })

  // Save NDVI data points
  await persistNdviPoints(fieldId, merxReport)

  // Mark stale analyses
  await markStaleAnalyses(fieldId)

  // Update field status
  const errorMessage = ctx.warnings.length > 0 ? ctx.warnings.join('; ') : null
  await prisma.field.update({
    where: { id: fieldId },
    data: {
      status: ctx.finalStatus,
      errorMessage,
      areaHa: ctx.areaHa,
      processedAt: new Date(),
      dataVersion: { increment: 1 },
    },
  })

  return { ok: true }
}

// ─── Short-circuit persist (NO_CROP) ─────────────────────

async function persistShortCircuit(ctx: PipelineContext) {
  const { fieldId, cropPatternResult, merxReport, areaHa } = ctx
  if (!cropPatternResult) return

  await prisma.agroData.upsert({
    where: { fieldId },
    update: {
      areaHa,
      volumeEstimatedKg: 0,
      peakNdvi: cropPatternResult.metrics.peakNdvi,
      phenologyHealth: 'POOR',
      confidenceScore: 10,
      confidence: 'LOW',
      phenologyMethod: 'ALGORITHM',
      rawNdviData: merxReport ? JSON.stringify(merxReport.ndvi) : null,
      rawHistoricalData: merxReport ? JSON.stringify(merxReport.historical_ndvi) : null,
      cropPatternStatus: cropPatternResult.status,
      cropPatternData: JSON.stringify({
        metrics: cropPatternResult.metrics,
        hypotheses: cropPatternResult.hypotheses,
        reason: cropPatternResult.reason,
        cropCategory: cropPatternResult.cropCategory,
      }),
      eosDate: null, sosDate: null, peakDate: null, cycleDays: null, plantingDate: null,
      aiValidationResult: null, aiValidationAgreement: null,
      aiEosAdjustedDate: null, aiValidationConfidence: null, aiVisualAlerts: null,
      diagnostics: JSON.stringify([{
        type: 'ERROR',
        code: cropPatternResult.status,
        message: cropPatternResult.reason,
      }]),
      updatedAt: new Date(),
    },
    create: {
      fieldId,
      areaHa,
      volumeEstimatedKg: 0,
      peakNdvi: cropPatternResult.metrics.peakNdvi,
      phenologyHealth: 'POOR',
      confidenceScore: 10,
      confidence: 'LOW',
      phenologyMethod: 'ALGORITHM',
      rawNdviData: merxReport ? JSON.stringify(merxReport.ndvi) : null,
      rawHistoricalData: merxReport ? JSON.stringify(merxReport.historical_ndvi) : null,
      cropPatternStatus: cropPatternResult.status,
      cropPatternData: JSON.stringify({
        metrics: cropPatternResult.metrics,
        hypotheses: cropPatternResult.hypotheses,
        reason: cropPatternResult.reason,
        cropCategory: cropPatternResult.cropCategory,
      }),
      diagnostics: JSON.stringify([{
        type: 'ERROR',
        code: cropPatternResult.status,
        message: cropPatternResult.reason,
      }]),
    },
  })

  await prisma.field.update({
    where: { id: fieldId },
    data: { status: 'SUCCESS', processedAt: new Date() },
  })
}

// ─── NDVI points persistence ─────────────────────────────

async function persistNdviPoints(fieldId: string, merxReport: any) {
  if (merxReport.ndvi.length > 0) {
    await prisma.ndviDataPoint.deleteMany({ where: { fieldId, isHistorical: false } })
    await prisma.ndviDataPoint.createMany({
      data: merxReport.ndvi.map((point: any) => ({
        fieldId,
        date: new Date(point.date),
        ndviRaw: point.ndvi_raw,
        ndviSmooth: point.ndvi_smooth,
        ndviInterp: point.ndvi_interp,
        cloudCover: point.cloud_cover,
        isHistorical: false,
        seasonYear: new Date(point.date).getFullYear(),
      })),
    })
  }

  for (let i = 0; i < merxReport.historical_ndvi.length; i++) {
    const season = merxReport.historical_ndvi[i]
    if (season.length > 0) {
      const seasonYear = new Date(season[0].date).getFullYear()
      await prisma.ndviDataPoint.deleteMany({ where: { fieldId, seasonYear, isHistorical: true } })
      await prisma.ndviDataPoint.createMany({
        data: season.map((point: any) => ({
          fieldId,
          date: new Date(point.date),
          ndviRaw: point.ndvi_raw,
          ndviSmooth: point.ndvi_smooth,
          ndviInterp: point.ndvi_interp,
          cloudCover: point.cloud_cover,
          isHistorical: true,
          seasonYear,
        })),
      })
    }
  }
}

// ─── Stale analyses ──────────────────────────────────────

async function markStaleAnalyses(fieldId: string) {
  const staleAnalyses = await prisma.analysis.findMany({ where: { fieldId } })
  if (staleAnalyses.length > 0) {
    const { enqueueAnalysis } = await import('@/lib/services/analysis-queue.service')
    await prisma.analysis.updateMany({
      where: { fieldId },
      data: { isStale: true, staleReason: 'Talhão reprocessado', reprocessStatus: 'PENDING' },
    })
    for (const analysis of staleAnalyses) {
      enqueueAnalysis(fieldId, analysis.templateId, analysis.id)
    }
    console.log(`[PROCESS] ${staleAnalyses.length} análises marcadas para reprocessamento`)
  }
}
