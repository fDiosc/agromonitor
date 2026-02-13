/**
 * Step 02: Detect phenology (SOS, EOS, peak, confidence)
 * Runs twice: once without planting input (detected), once with (effective)
 */

import type { PipelineContext, StepResult } from '../types'
import { calculatePhenology } from '@/lib/services/phenology.service'

export async function detectPhenology(ctx: PipelineContext): Promise<StepResult> {
  if (!ctx.merxReport) {
    return { ok: false, error: 'Sem dados Merx para calcular fenologia' }
  }

  const { merxReport, field, areaHa } = ctx

  // 1. Detected phenology (pure algorithm, no planting input)
  const detectedPhenology = calculatePhenology(
    merxReport.ndvi,
    merxReport.historical_ndvi,
    { crop: field.cropType, areaHa, plantingDateInput: null }
  )
  ctx.detectedPhenology = detectedPhenology

  // 2. Effective phenology (with planting date if available)
  const plantingDateInput = field.plantingDateInput
    ? field.plantingDateInput.toISOString().split('T')[0]
    : null
  ctx.plantingDateInput = plantingDateInput

  const phenology = plantingDateInput
    ? calculatePhenology(
        merxReport.ndvi,
        merxReport.historical_ndvi,
        { crop: field.cropType, areaHa, plantingDateInput }
      )
    : detectedPhenology

  ctx.phenology = phenology

  if (plantingDateInput) {
    console.log(`[PROCESS] Data de plantio informada pelo produtor: ${plantingDateInput}`)
    console.log(`[PROCESS] Detected vs Effective planting: ${detectedPhenology.plantingDate} vs ${phenology.plantingDate}`)
  }

  return { ok: true }
}
