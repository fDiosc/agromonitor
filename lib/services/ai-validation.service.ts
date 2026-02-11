/**
 * AI Validation Service
 * Orchestrates the Curator + Judge pipeline for visual validation
 * of algorithmic projections using satellite imagery
 */

import { processImage } from './sentinel1.service'
import { runCurator, type CuratorInput } from '@/lib/agents/curator'
import { runJudge, type JudgeInput } from '@/lib/agents/judge'
import { calculateCost, logCostReport, JUDGE_MODEL } from './ai-pricing.service'
import type { JudgePromptParams } from '@/lib/agents/judge-prompt'
import type {
  AgenticImageEntry,
  MultiSensorNdviEntry,
  RadarTimeSeriesEntry,
  CurationReport,
  CostReport,
  JudgeAnalysis,
  VisualFinding,
  HarvestReadiness,
  RiskAssessment,
  ImageType,
  SatelliteCollection,
} from '@/lib/agents/types'
import {
  EVALSCRIPT_TRUE_COLOR,
  EVALSCRIPT_NDVI,
  EVALSCRIPT_RADAR,
  EVALSCRIPT_LANDSAT_NDVI,
  EVALSCRIPT_S3_NDVI,
} from '@/lib/evalscripts'

// ==================== Types ====================

export interface AIValidationInput {
  // Field data
  fieldId: string
  workspaceId: string
  geometry: string   // GeoJSON string
  cropType: string
  areaHa: number

  // Algorithmic projections (Layer 1)
  plantingDate: string | null
  plantingSource: string
  sosDate: string | null
  eosDate: string | null
  eosMethod: string
  confidenceScore: number
  peakNdvi: number | null
  peakDate: string | null
  phenologyHealth: string | null

  // Enriched Merx data (optional)
  gddData?: JudgePromptParams['gddData']
  waterBalanceData?: JudgePromptParams['waterBalanceData']
  precipData?: JudgePromptParams['precipData']
  zarcData?: JudgePromptParams['zarcData']
  fusionMetrics?: JudgePromptParams['fusionMetrics']

  // Config
  curatorModel: string
}

export interface AIValidationResult {
  // Validation
  agreement: 'CONFIRMED' | 'QUESTIONED' | 'REJECTED'
  eosAdjustedDate: string | null
  eosAdjustmentReason: string | null
  stageAgreement: boolean

  // Visual anomalies
  visualAlerts: VisualFinding[]

  // Harvest
  harvestReadiness: HarvestReadiness

  // Risks
  riskAssessment: RiskAssessment

  // Meta
  recommendations: string[]
  confidence: number
  curationReport: CurationReport
  costReport: CostReport

  // Evidence images (thumbnails base64 for UI — top 4 curated)
  evidenceImages: { date: string; type: string; base64: string }[]
}

// ==================== Image Fetching ====================

interface ImageFetchPlan {
  dateFrom: string
  dateTo: string
  collection: SatelliteCollection
  evalscript: string
  type: ImageType
}

/**
 * Build a bounding box from GeoJSON geometry
 */
function getBboxFromGeometry(geometryJson: string): [number, number, number, number] | null {
  try {
    const geojson = JSON.parse(geometryJson)
    let coords: number[][][] = []

    if (geojson.type === 'FeatureCollection') {
      coords = geojson.features[0]?.geometry?.coordinates || []
    } else if (geojson.type === 'Feature') {
      coords = geojson.geometry?.coordinates || []
    } else if (geojson.type === 'Polygon') {
      coords = geojson.coordinates || []
    }

    if (coords.length === 0 || coords[0].length === 0) return null

    const ring = coords[0]
    let minLon = Infinity, maxLon = -Infinity
    let minLat = Infinity, maxLat = -Infinity

    for (const point of ring) {
      minLon = Math.min(minLon, point[0])
      maxLon = Math.max(maxLon, point[0])
      minLat = Math.min(minLat, point[1])
      maxLat = Math.max(maxLat, point[1])
    }

    return [minLon, minLat, maxLon, maxLat]
  } catch {
    return null
  }
}

/**
 * Generate date ranges for image fetching (every ~10 days from season start to now)
 */
function generateDateRanges(seasonStart: string): Array<{ from: string; to: string }> {
  const start = new Date(seasonStart)
  const now = new Date()
  const ranges: Array<{ from: string; to: string }> = []

  const current = new Date(start)
  while (current < now) {
    const rangeEnd = new Date(current)
    rangeEnd.setDate(rangeEnd.getDate() + 5)
    if (rangeEnd > now) rangeEnd.setTime(now.getTime())

    ranges.push({
      from: current.toISOString().split('T')[0] + 'T00:00:00Z',
      to: rangeEnd.toISOString().split('T')[0] + 'T23:59:59Z',
    })

    current.setDate(current.getDate() + 10)
  }

  return ranges
}

/**
 * Fetch satellite images from CDSE Process API
 */
async function fetchImages(
  workspaceId: string,
  bbox: [number, number, number, number],
  seasonStart: string,
  areaHa: number,
): Promise<AgenticImageEntry[]> {
  const dateRanges = generateDateRanges(seasonStart)
  const images: AgenticImageEntry[] = []

  // Build fetch plans: for each date range, fetch S2 true color + NDVI, and radar
  const fetchPlans: ImageFetchPlan[] = []

  for (const range of dateRanges) {
    // S2 True Color
    fetchPlans.push({
      dateFrom: range.from,
      dateTo: range.to,
      collection: 'sentinel-2-l2a',
      evalscript: EVALSCRIPT_TRUE_COLOR,
      type: 'truecolor',
    })
    // S2 NDVI
    fetchPlans.push({
      dateFrom: range.from,
      dateTo: range.to,
      collection: 'sentinel-2-l2a',
      evalscript: EVALSCRIPT_NDVI,
      type: 'ndvi',
    })
    // Radar
    fetchPlans.push({
      dateFrom: range.from,
      dateTo: range.to,
      collection: 'sentinel-1-grd',
      evalscript: EVALSCRIPT_RADAR,
      type: 'radar',
    })
  }

  // For large fields, also add Landsat NDVI and S3 NDVI at sparser intervals
  if (areaHa > 200) {
    for (let i = 0; i < dateRanges.length; i += 2) {
      const range = dateRanges[i]
      fetchPlans.push({
        dateFrom: range.from,
        dateTo: range.to,
        collection: 'landsat-ot-l1',
        evalscript: EVALSCRIPT_LANDSAT_NDVI,
        type: 'landsat-ndvi',
      })
    }
  }
  if (areaHa > 500) {
    for (let i = 0; i < dateRanges.length; i += 3) {
      const range = dateRanges[i]
      fetchPlans.push({
        dateFrom: range.from,
        dateTo: range.to,
        collection: 'sentinel-3-olci',
        evalscript: EVALSCRIPT_S3_NDVI,
        type: 's3-ndvi',
      })
    }
  }

  console.log(`[AI-VALIDATION] Fetching ${fetchPlans.length} images from CDSE...`)

  // Process in batches of 5 to respect rate limits
  const BATCH_SIZE = 5
  for (let i = 0; i < fetchPlans.length; i += BATCH_SIZE) {
    const batch = fetchPlans.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map(async (plan) => {
        const buffer = await processImage(workspaceId, {
          bbox,
          dateFrom: plan.dateFrom,
          dateTo: plan.dateTo,
          evalscript: plan.evalscript,
          dataCollection: plan.collection,
          width: 512,
          height: 512,
        })
        if (!buffer) return null

        const base64 = buffer.toString('base64')
        const date = plan.dateFrom.split('T')[0]

        return {
          date,
          type: plan.type,
          base64,
          metadata: {
            collection: plan.collection,
            bbox: [...bbox],
          },
        } as AgenticImageEntry
      })
    )

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        images.push(result.value)
      }
    }

    // Small delay between batches to respect rate limits
    if (i + BATCH_SIZE < fetchPlans.length) {
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  console.log(`[AI-VALIDATION] Fetched ${images.length}/${fetchPlans.length} images successfully`)
  return images
}

// ==================== Main Orchestrator ====================

/**
 * Run the full AI validation pipeline: Fetch Images -> Curator -> Judge -> Cost Report
 */
export async function runAIValidation(input: AIValidationInput): Promise<AIValidationResult> {
  const totalStart = Date.now()

  console.log(`[AI-VALIDATION] Starting validation for field ${input.fieldId}`)

  // 1. Parse geometry and get bbox
  const bbox = getBboxFromGeometry(input.geometry)
  if (!bbox) {
    throw new Error('Could not extract bounding box from field geometry')
  }

  // Determine season start from planting date or SOS, fallback to 6 months ago
  const seasonStart = input.plantingDate
    || input.sosDate
    || new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // 2. Fetch images from CDSE
  const fetchStart = Date.now()
  const images = await fetchImages(input.workspaceId, bbox, seasonStart, input.areaHa)
  const fetchMs = Date.now() - fetchStart

  if (images.length === 0) {
    throw new Error('No satellite images could be fetched from CDSE')
  }

  // 3. Run Curator
  const curatorStart = Date.now()
  const curatorInput: CuratorInput = {
    images,
    multiSensorNdvi: [], // Time series data would be populated from Merx data in Phase 3
    radarTimeSeries: [],
    fieldArea: input.areaHa,
    model: input.curatorModel,
  }
  const curatorOutput = await runCurator(curatorInput)
  const curatorMs = Date.now() - curatorStart

  console.log(`[AI-VALIDATION] Curator: ${curatorOutput.curatedImages.length}/${images.length} images curated`)

  // 4. Run Judge
  const judgeStart = Date.now()
  const judgeInput: JudgeInput = {
    curatedImages: curatorOutput.curatedImages,
    multiSensorNdvi: [],
    radarTimeSeries: [],
    fieldArea: input.areaHa,
    curatorContextSummary: curatorOutput.curationReport.contextSummary,
    cropType: input.cropType,
    plantingDate: input.plantingDate,
    plantingSource: input.plantingSource,
    sosDate: input.sosDate,
    eosDate: input.eosDate,
    eosMethod: input.eosMethod,
    confidence: input.confidenceScore,
    peakNdvi: input.peakNdvi,
    peakDate: input.peakDate,
    phenologyHealth: input.phenologyHealth,
    gddData: input.gddData,
    waterBalanceData: input.waterBalanceData,
    precipData: input.precipData,
    zarcData: input.zarcData,
    fusionMetrics: input.fusionMetrics,
  }
  const judgeOutput = await runJudge(judgeInput)
  const judgeMs = Date.now() - judgeStart

  console.log(`[AI-VALIDATION] Judge: agreement=${judgeOutput.analysis.algorithmicValidation.eosAgreement}, confidence=${judgeOutput.analysis.confidence}%`)

  // 5. Calculate costs
  const curatorCost = calculateCost(
    curatorOutput.tokenUsage.model,
    curatorOutput.tokenUsage.inputTokens,
    curatorOutput.tokenUsage.outputTokens
  )
  const judgeCost = calculateCost(
    judgeOutput.tokenUsage.model,
    judgeOutput.tokenUsage.inputTokens,
    judgeOutput.tokenUsage.outputTokens
  )

  const costReport: CostReport = {
    curator: curatorCost,
    judge: judgeCost,
    totalInputTokens: curatorCost.inputTokens + judgeCost.inputTokens,
    totalOutputTokens: curatorCost.outputTokens + judgeCost.outputTokens,
    totalCost: curatorCost.totalCost + judgeCost.totalCost,
    durations: {
      fetchMs,
      timeseriesMs: 0,
      curatorMs,
      judgeMs,
      totalMs: Date.now() - totalStart,
    },
  }

  logCostReport(costReport)

  // 6. Select top 4 evidence images for UI thumbnails
  const topScores = curatorOutput.curationReport.scores
    .filter((s) => s.included)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)

  const evidenceImages = topScores
    .map((score) => {
      const img = curatorOutput.curatedImages.find(
        (i) => i.date === score.date && i.type === score.type
      )
      if (!img) return null
      return {
        date: img.date,
        type: img.type,
        base64: img.base64.substring(0, 500) + '...',  // Truncated for DB storage; full in memory
      }
    })
    .filter(Boolean) as { date: string; type: string; base64: string }[]

  // 7. Normalize Judge output (handle old/new schema, Portuguese/English)
  const analysis = judgeOutput.analysis

  // Normalize harvestReadiness (isReady → ready, add notes)
  // Cast to flexible type for backward-compat with old AI schema fields (isReady, etc.)
  const rawHarvest = (analysis.harvestReadiness || {}) as HarvestReadiness & { isReady?: boolean }
  const normalizedHarvest: AIValidationResult['harvestReadiness'] = {
    ready: rawHarvest.ready ?? rawHarvest.isReady ?? false,
    estimatedDate: rawHarvest.estimatedDate || null,
    delayRisk: rawHarvest.delayRisk || 'NONE',
    delayDays: rawHarvest.delayDays || 0,
    notes: rawHarvest.notes || '',
  }

  // Normalize riskAssessment (overall → overallRisk, Portuguese → English, add factors)
  const RISK_MAP: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
    'BAIXO': 'LOW', 'MODERADO': 'MEDIUM', 'ALTO': 'HIGH', 'CRITICO': 'CRITICAL',
    'LOW': 'LOW', 'MEDIUM': 'MEDIUM', 'HIGH': 'HIGH', 'CRITICAL': 'CRITICAL'
  }
  // Cast to flexible type for backward-compat with old schema fields (overall, climatic, etc.)
  const rawRisk = (analysis.riskAssessment || {}) as RiskAssessment & {
    overall?: string; climatic?: string; phytosanitary?: string; operational?: string
  }
  let riskFactors: AIValidationResult['riskAssessment']['factors'] = rawRisk.factors || []
  // If old schema (climatic/phytosanitary/operational strings), convert to factors
  if (riskFactors.length === 0 && (rawRisk.climatic || rawRisk.phytosanitary || rawRisk.operational)) {
    if (rawRisk.climatic) riskFactors.push({ category: 'CLIMATIC', severity: 'MEDIUM', description: rawRisk.climatic })
    if (rawRisk.phytosanitary) riskFactors.push({ category: 'PHYTOSANITARY', severity: 'MEDIUM', description: rawRisk.phytosanitary })
    if (rawRisk.operational) riskFactors.push({ category: 'OPERATIONAL', severity: 'MEDIUM', description: rawRisk.operational })
  }
  const normalizedRisk: AIValidationResult['riskAssessment'] = {
    overallRisk: RISK_MAP[rawRisk.overallRisk || rawRisk.overall || ''] || 'MEDIUM',
    factors: riskFactors,
  }

  // Validate eosAdjustedDate format
  let normalizedEosAdjusted = analysis.algorithmicValidation.eosAdjustedDate
  if (normalizedEosAdjusted && !/^\d{4}-\d{2}-\d{2}$/.test(normalizedEosAdjusted)) {
    // Try to parse and reformat
    try {
      const parsed = new Date(normalizedEosAdjusted)
      if (!isNaN(parsed.getTime())) {
        normalizedEosAdjusted = parsed.toISOString().split('T')[0]
      } else {
        normalizedEosAdjusted = null
      }
    } catch {
      normalizedEosAdjusted = null
    }
  }

  return {
    agreement: analysis.algorithmicValidation.eosAgreement,
    eosAdjustedDate: normalizedEosAdjusted,
    eosAdjustmentReason: analysis.algorithmicValidation.eosAdjustmentReason,
    stageAgreement: analysis.algorithmicValidation.stageAgreement,
    visualAlerts: analysis.visualFindings,
    harvestReadiness: normalizedHarvest,
    riskAssessment: normalizedRisk,
    recommendations: analysis.recommendations,
    confidence: analysis.confidence,
    curationReport: curatorOutput.curationReport,
    costReport,
    evidenceImages,
  }
}
