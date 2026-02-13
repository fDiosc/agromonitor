/**
 * Pipeline orchestrator for field processing.
 * Runs steps sequentially, handles short-circuit and errors.
 */

import type { PipelineContext, PipelineStep, StepResult } from './types'
import { fetchNdvi } from './steps/01-fetch-ndvi'
import { detectPhenology } from './steps/02-detect-phenology'
import { analyzeCropPatternStep } from './steps/03-crop-pattern'
import { fetchClimate } from './steps/04-fetch-climate'
import { fetchRadar } from './steps/05-fetch-radar'
import { fuseEos } from './steps/06-fuse-eos'
import { runAiValidation } from './steps/07-ai-validation'
import { persist } from './steps/08-persist'
import { determineStatus } from './helpers/status'

/** All pipeline steps in order */
const STEPS: { name: string; fn: PipelineStep }[] = [
  { name: '01-fetch-ndvi',       fn: fetchNdvi },
  { name: '02-detect-phenology', fn: detectPhenology },
  { name: '03-crop-pattern',     fn: analyzeCropPatternStep },
  { name: '04-fetch-climate',    fn: fetchClimate },
  { name: '05-fetch-radar',      fn: fetchRadar },
  { name: '06-fuse-eos',         fn: fuseEos },
  { name: '07-ai-validation',    fn: runAiValidation },
  { name: '08-persist',          fn: persist },
]

/**
 * Run the full processing pipeline.
 * Returns the final context with all computed data.
 */
export async function runPipeline(ctx: PipelineContext): Promise<PipelineContext> {
  for (const step of STEPS) {
    try {
      const result: StepResult = await step.fn(ctx)

      if (!result.ok) {
        console.error(`[PIPELINE] Step ${step.name} failed: ${result.error}`)
        ctx.warnings.push(`Etapa ${step.name}: ${result.error}`)
      }

      if (result.shortCircuit) {
        console.log(`[PIPELINE] Short-circuit at step ${step.name}`)
        ctx.shortCircuited = true
        // Still need to persist — call persist directly
        await persist(ctx)
        break
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      console.error(`[PIPELINE] Step ${step.name} threw: ${msg}`)
      ctx.warnings.push(`Etapa ${step.name}: ${msg}`)
      // Continue to next step — graceful degradation
    }
  }

  // Determine final status based on data quality
  const statusResult = determineStatus(ctx)
  ctx.finalStatus = statusResult.status
  ctx.warnings.push(...statusResult.extraWarnings)

  return ctx
}
