/**
 * Step 03: Analyze crop pattern.
 * Short-circuits on NO_CROP — pipeline stops after persisting minimal data.
 */

import type { PipelineContext, StepResult } from '../types'
import { analyzeCropPattern } from '@/lib/services/crop-pattern.service'

export async function analyzeCropPatternStep(ctx: PipelineContext): Promise<StepResult> {
  if (!ctx.merxReport || !ctx.phenology) {
    return { ok: false, error: 'Dados insuficientes para análise de padrão' }
  }

  const result = analyzeCropPattern(
    ctx.merxReport.ndvi,
    ctx.field.cropType,
    ctx.phenology.sosDate,
    ctx.phenology.eosDate
  )
  ctx.cropPatternResult = result

  console.log(`[PROCESS] Crop Pattern: ${result.status} (${result.cropCategory}) - ${result.reason}`)

  if (result.shouldShortCircuit) {
    console.log(`[PROCESS] SHORT-CIRCUIT: ${result.status} -- salvando dados mínimos e retornando`)
    return { ok: true, shortCircuit: true }
  }

  return { ok: true }
}
