/**
 * Step 01: Fetch NDVI data from Merx API
 */

import type { PipelineContext, StepResult } from '../types'
import { getFullReport } from '@/lib/services/merx.service'
import { calculateSphericalArea } from '@/lib/services/geometry.service'

export async function fetchNdvi(ctx: PipelineContext): Promise<StepResult> {
  const { field } = ctx

  const merxReport = await getFullReport(
    field.geometryJson,
    field.seasonStartDate.toISOString().split('T')[0],
    field.cropType
  )

  ctx.merxReport = merxReport

  // Calculate area — use Merx value or compute locally
  let areaHa = merxReport.area_ha
  if (!areaHa || areaHa <= 0) {
    const geojson = JSON.parse(field.geometryJson)
    const coords = geojson.features?.[0]?.geometry?.coordinates?.[0] || []
    areaHa = calculateSphericalArea(coords)
  }
  ctx.areaHa = areaHa

  return { ok: true }
}
