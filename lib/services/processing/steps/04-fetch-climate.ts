/**
 * Step 04: Fetch climate data (precipitation, water balance, thermal, climate envelope, ZARC)
 * All external API calls are wrapped in try/catch for graceful degradation.
 */

import type { PipelineContext, StepResult } from '../types'
import { getComplementaryData } from '@/lib/services/merx.service'
import { calculateHistoricalCorrelation } from '@/lib/services/correlation.service'
import { analyzeZarc } from '@/lib/services/zarc.service'
import { getPrecipitationForField, serializePrecipitation } from '@/lib/services/precipitation.service'
import { getWaterBalanceForField, serializeWaterBalance } from '@/lib/services/water-balance.service'
import { getThermalDataForField, serializeThermalData } from '@/lib/services/thermal.service'
import { getClimateEnvelopeForField, serializeClimateEnvelope } from '@/lib/services/climate-envelope.service'

export async function fetchClimate(ctx: PipelineContext): Promise<StepResult> {
  if (!ctx.merxReport || !ctx.phenology) {
    return { ok: false, error: 'Sem fenologia para buscar clima' }
  }

  const { field, phenology, merxReport } = ctx

  // ─── Correlation ───────────────────────────────────────
  const correlation = calculateHistoricalCorrelation(
    merxReport.ndvi,
    merxReport.historical_ndvi,
    { sosThreshold: 0.35, minPointsForCorrelation: 5 }
  )
  ctx.finalCorrelation = correlation.numPointsCompared >= 5
    ? correlation.compositeScore
    : phenology.historicalCorrelation

  // ─── Complementary + ZARC ──────────────────────────────
  const complementary = await getComplementaryData(
    field.geometryJson,
    phenology.plantingDate || field.seasonStartDate.toISOString().split('T')[0],
    field.cropType
  )
  ctx.complementary = complementary

  const plantingDateForZarc = phenology.plantingDate
    ? new Date(phenology.plantingDate)
    : (field.plantingDateInput || null)

  const zarcAnalysis = analyzeZarc(complementary.zarc_anual, plantingDateForZarc)
  ctx.zarcAnalysis = zarcAnalysis

  if (!field.workspaceId) return { ok: true }

  const geometry = JSON.parse(field.geometryJson)
  const plantingDate = phenology.plantingDate
    ? new Date(phenology.plantingDate)
    : field.seasonStartDate

  // ─── Precipitation ─────────────────────────────────────
  try {
    const harvestStart = phenology.eosDate ? new Date(phenology.eosDate) : undefined
    const precipResult = await getPrecipitationForField(
      field.workspaceId, geometry, field.seasonStartDate, harvestStart
    )
    if (precipResult) {
      ctx.precipitationData = serializePrecipitation(precipResult.data)
      ctx.harvestAdjustment = precipResult.adjustment
    }
  } catch (err) {
    console.warn('[PROCESS] Erro ao buscar precipitação (continuando):', err)
  }

  // ─── Water Balance ─────────────────────────────────────
  try {
    const eosDate = phenology.eosDate ? new Date(phenology.eosDate) : undefined
    const wbResult = await getWaterBalanceForField(
      field.workspaceId, geometry, plantingDate, field.cropType, eosDate
    )
    if (wbResult) {
      ctx.waterBalanceData = serializeWaterBalance(wbResult.data)
      ctx.eosAdjustment = wbResult.adjustment
      ctx.waterBalStressDays = wbResult.data.stressDays || 0
      ctx.waterBalYieldImpact = wbResult.adjustment?.yieldImpact
        ? Math.round((1 - wbResult.adjustment.yieldImpact) * 100)
        : 0
    }
  } catch (err) {
    console.warn('[PROCESS] Erro ao buscar balanço hídrico (continuando):', err)
  }

  // ─── Thermal / GDD ─────────────────────────────────────
  try {
    const thermalResult = await getThermalDataForField(
      field.workspaceId, geometry, plantingDate, field.cropType
    )
    if (thermalResult) {
      ctx.thermalData = serializeThermalData(thermalResult)
    }
  } catch (err) {
    console.warn('[PROCESS] Erro ao buscar dados térmicos (continuando):', err)
  }

  // ─── Climate Envelope ──────────────────────────────────
  try {
    const envelopeResult = await getClimateEnvelopeForField(
      field.workspaceId, geometry, field.seasonStartDate
    )
    if (envelopeResult) {
      if (envelopeResult.precipitation) {
        ctx.climateEnvelopeData.precipitation = serializeClimateEnvelope(envelopeResult.precipitation)
      }
      if (envelopeResult.temperature) {
        ctx.climateEnvelopeData.temperature = serializeClimateEnvelope(envelopeResult.temperature)
      }
    }
  } catch (err) {
    console.warn('[PROCESS] Erro ao calcular envelope climático (continuando):', err)
  }

  return { ok: true }
}
