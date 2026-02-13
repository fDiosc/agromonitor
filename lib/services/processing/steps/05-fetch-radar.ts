/**
 * Step 05: Fetch Sentinel-1 radar data, RVI calibration, and NDVI fusion
 */

import type { PipelineContext, StepResult } from '../types'
import { getS1DataForField, serializeS1Data } from '@/lib/services/sentinel1.service'
import {
  findCoincidentPairs,
  collectRviNdviPairs,
  trainLocalModel,
  getCalibrationStats,
} from '@/lib/services/rvi-calibration.service'
import {
  getFusedNdviForField,
  serializeFusionResult,
  calculateFusionQuality,
} from '@/lib/services/ndvi-fusion.service'
import {
  fuseSarNdvi,
  isSarFusionEnabled,
  calculateHarvestConfidence,
} from '@/lib/services/sar-ndvi-adaptive.service'
import { isFeatureEnabled } from '@/lib/services/feature-flags.service'

export async function fetchRadar(ctx: PipelineContext): Promise<StepResult> {
  const { field, merxReport } = ctx

  if (!field.workspaceId || !merxReport) return { ok: true }

  const geometry = JSON.parse(field.geometryJson)

  // ─── Sentinel-1 Data ───────────────────────────────────
  try {
    const radarResult = await getS1DataForField(
      field.workspaceId, geometry, field.seasonStartDate, new Date()
    )
    if (radarResult && radarResult.source !== 'UNAVAILABLE') {
      ctx.radarData = serializeS1Data(radarResult)
    }
  } catch (err) {
    console.warn('[PROCESS] Erro ao buscar dados Sentinel-1 (continuando):', err)
  }

  if (!ctx.radarData) return { ok: true }

  // ─── RVI-NDVI Calibration ─────────────────────────────
  try {
    const radarParsed = JSON.parse(ctx.radarData)
    const opticalForCalibration = merxReport.ndvi.map((pt: any) => ({
      date: pt.date,
      ndvi: pt.ndvi_smooth || pt.ndvi_raw || pt.ndvi_interp,
      cloudCover: pt.cloud_cover,
    }))

    const coincidentPairs = findCoincidentPairs(
      opticalForCalibration,
      radarParsed.rviTimeSeries || [],
      1
    )

    let pairsCollected = 0
    if (coincidentPairs.length > 0) {
      pairsCollected = await collectRviNdviPairs(ctx.fieldId, coincidentPairs)
    }

    const useLocalCalibration = await isFeatureEnabled(field.workspaceId, 'useLocalCalibration')
    if (useLocalCalibration && pairsCollected > 0) {
      ctx.calibrationStats = await getCalibrationStats(ctx.fieldId)
      const minPairs = 15
      if (ctx.calibrationStats && ctx.calibrationStats.pairsCount >= minPairs && !ctx.calibrationStats.hasModel) {
        const trainingResult = await trainLocalModel(ctx.fieldId, field.cropType || 'SOJA')
        if (trainingResult) {
          ctx.calibrationStats = await getCalibrationStats(ctx.fieldId)
        }
      }
    }
  } catch (err) {
    console.warn('[PROCESS] Erro na calibração RVI (continuando):', err)
  }

  // ─── NDVI Fusion (Adaptive or Classic) ─────────────────
  try {
    const radarParsed = JSON.parse(ctx.radarData)
    const opticalData = merxReport.ndvi.map((pt: any) => ({
      date: pt.date,
      ndvi: pt.ndvi_smooth || pt.ndvi_raw || pt.ndvi_interp,
      cloudCover: pt.cloud_cover,
    }))

    const useAdaptiveFusion = await isSarFusionEnabled(field.workspaceId)

    if (useAdaptiveFusion) {
      const sarData = radarParsed.radarHistorical?.data || radarParsed.data || []
      const sarPoints = sarData
        .map((d: any) => ({ date: d.date, vv: d.vv, vh: d.vh }))
        .filter((d: any) => d.vv !== undefined && d.vh !== undefined)

      if (sarPoints.length >= 5) {
        ctx.adaptiveFusionResult = await fuseSarNdvi(ctx.fieldId, opticalData, sarPoints)

        if (ctx.adaptiveFusionResult && ctx.adaptiveFusionResult.gapsFilled > 0) {
          ctx.fusionData = JSON.stringify(ctx.adaptiveFusionResult)
          ctx.fusionMetrics = buildFusionMetrics(ctx.adaptiveFusionResult, true)
        }
      }
    }

    // Classic fallback
    if (!ctx.adaptiveFusionResult || ctx.adaptiveFusionResult.gapsFilled === 0) {
      const fusionResult = await getFusedNdviForField(
        field.workspaceId,
        opticalData,
        radarParsed.rviTimeSeries || [],
        field.cropType || 'SOJA',
        ctx.fieldId
      )

      if (fusionResult && fusionResult.gapsFilled > 0) {
        ctx.fusionData = serializeFusionResult(fusionResult)
        const quality = calculateFusionQuality(fusionResult)
        ctx.fusionMetrics = {
          gapsFilled: fusionResult.gapsFilled,
          maxGapDays: calculateMaxGap(fusionResult.points),
          radarContribution: quality.radarContribution,
          continuityScore: quality.continuityScore,
          calibrationR2: fusionResult.calibrationR2,
          isBeta: false,
        }
      }
    }
  } catch (err) {
    console.warn('[PROCESS] Erro na fusão NDVI (continuando sem fusão):', err)
  }

  // ─── Confidence Adjustment ─────────────────────────────
  if (ctx.adaptiveFusionResult && ctx.adaptiveFusionResult.calibrationUsed && ctx.phenology) {
    const harvestConf = calculateHarvestConfidence(
      ctx.adaptiveFusionResult,
      ctx.phenology.confidenceScore
    )
    ctx.adjustedConfidence = harvestConf.confidence
    if (ctx.fusionMetrics && harvestConf.note) {
      ctx.fusionMetrics = { ...ctx.fusionMetrics, confidenceNote: harvestConf.note }
    }
  }

  return { ok: true }
}

// ─── Local helpers ───────────────────────────────────────

function buildFusionMetrics(result: any, isBeta: boolean) {
  const maxGapDays = calculateMaxGap(result.points)
  const sarRatio = result.sarFusedPoints / (result.opticalPoints + result.sarFusedPoints)

  return {
    gapsFilled: result.gapsFilled,
    maxGapDays,
    radarContribution: sarRatio,
    continuityScore: result.modelR2 > 0.5 ? 0.9 : 0.8,
    calibrationR2: result.modelR2,
    fusionMethod: result.fusionMethod,
    featureUsed: result.featureUsed,
    isBeta,
  }
}

function calculateMaxGap(points: any[]): number {
  const sorted = points.map((p: any) => new Date(p.date).getTime()).sort((a: number, b: number) => a - b)
  let max = 0
  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = (sorted[i + 1] - sorted[i]) / (1000 * 60 * 60 * 24)
    max = Math.max(max, gap)
  }
  return max
}
