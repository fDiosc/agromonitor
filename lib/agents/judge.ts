/**
 * Judge Agent
 * Performs the final agronomic validation on curated data
 * Uses Merx-enriched data (GDD, water balance, ZARC, fusion metrics)
 * Always uses gemini-3-flash-preview
 * Rewritten for @google/genai SDK (Merx standard)
 * Adapted from POC Image Analysis server/agents/judge.ts
 */

import { GoogleGenAI, type Part } from '@google/genai'
import { buildJudgePrompt, type JudgePromptParams } from './judge-prompt'
import { JUDGE_MODEL } from '@/lib/services/ai-pricing.service'
import type {
  AgenticImageEntry,
  MultiSensorNdviEntry,
  RadarTimeSeriesEntry,
  TokenUsage,
  JudgeAnalysis,
} from './types'

// ==================== Types ====================

export interface JudgeInput {
  curatedImages: AgenticImageEntry[]
  multiSensorNdvi: MultiSensorNdviEntry[]
  radarTimeSeries: RadarTimeSeriesEntry[]
  fieldArea: number
  curatorContextSummary: string

  // Merx-specific enrichment data
  cropType: string
  plantingDate: string | null
  plantingSource: string
  sosDate: string | null
  eosDate: string | null
  eosMethod: string
  confidence: number
  peakNdvi: number | null
  peakDate: string | null
  phenologyHealth: string | null

  // Optional enrichment
  gddData?: JudgePromptParams['gddData']
  waterBalanceData?: JudgePromptParams['waterBalanceData']
  precipData?: JudgePromptParams['precipData']
  zarcData?: JudgePromptParams['zarcData']
  fusionMetrics?: JudgePromptParams['fusionMetrics']
}

export interface JudgeOutput {
  analysis: JudgeAnalysis
  tokenUsage: TokenUsage
}

// ==================== Helpers ====================

function formatMultiSensorNdviTable(data: MultiSensorNdviEntry[]): string {
  if (data.length === 0) return 'No NDVI statistical data available.'
  const rows = data.map((e) => {
    const d = e.dateFrom.split('T')[0]
    const mean = Number(e.mean)
    const min = Number(e.min)
    const max = Number(e.max)
    const stDev = Number(e.stDev)
    return `${d} | ${e.source.padEnd(7)} | ${e.resolution.padEnd(4)} | ${e.confidence}% | ${mean.toFixed(3)} | ${min.toFixed(3)} | ${max.toFixed(3)} | ${stDev.toFixed(3)} | ${e.sampleCount}`
  })
  return (
    `Date       | Source  | Res  | Conf | Mean  | Min   | Max   | StDev | Samples\n` +
    `---------- | ------- | ---- | ---- | ----- | ----- | ----- | ----- | -------\n` +
    rows.join('\n')
  )
}

function formatRadarTable(data: RadarTimeSeriesEntry[]): string {
  if (data.length === 0) return 'No radar statistical data available.'
  const rows = data.map((e) => {
    const d = e.dateFrom.split('T')[0]
    return `${d} | ${Number(e.vvMean).toFixed(6)} | ${Number(e.vhMean).toFixed(6)} | ${Number(e.vvStDev).toFixed(6)} | ${Number(e.vhStDev).toFixed(6)} | ${e.sampleCount}`
  })
  return (
    `Date       | VV Mean  | VH Mean  | VV StDev | VH StDev | Samples\n` +
    `---------- | -------- | -------- | -------- | -------- | -------\n` +
    rows.join('\n')
  )
}

// ==================== Main Function ====================

export async function runJudge(input: JudgeInput): Promise<JudgeOutput> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  console.log(`[JUDGE] Starting validation of ${input.curatedImages.length} curated images with ${JUDGE_MODEL}`)

  const imageList = input.curatedImages
    .map(
      (img) =>
        `- [${img.date}] ${img.type.toUpperCase()} (collection: ${img.metadata.collection}${
          img.metadata.cloudCover !== undefined ? `, cloud: ${img.metadata.cloudCover}%` : ''
        })`
    )
    .join('\n')

  const multiSensorNdviTable = formatMultiSensorNdviTable(input.multiSensorNdvi)
  const radarTable = formatRadarTable(input.radarTimeSeries)

  const textPrompt = buildJudgePrompt({
    fieldArea: input.fieldArea,
    cropType: input.cropType,
    plantingDate: input.plantingDate,
    plantingSource: input.plantingSource,
    sosDate: input.sosDate,
    eosDate: input.eosDate,
    eosMethod: input.eosMethod,
    confidence: input.confidence,
    peakNdvi: input.peakNdvi,
    peakDate: input.peakDate,
    phenologyHealth: input.phenologyHealth,
    curatorContextSummary: input.curatorContextSummary,
    imageList,
    multiSensorNdviTable,
    radarTable,
    gddData: input.gddData,
    waterBalanceData: input.waterBalanceData,
    precipData: input.precipData,
    zarcData: input.zarcData,
    fusionMetrics: input.fusionMetrics,
  })

  // Build multimodal content: text + curated images
  const parts: Part[] = [
    { text: textPrompt },
  ]

  for (const img of input.curatedImages) {
    parts.push({
      text: `\n--- Image: ${img.date} - ${img.type} ---`,
    })
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: img.base64.replace(/^data:image\/\w+;base64,/, ''),
      },
    })
  }

  console.log(`[JUDGE] Sending ${input.curatedImages.length} images + prompt (${textPrompt.length} chars) to ${JUDGE_MODEL}`)

  const ai = new GoogleGenAI({ apiKey })
  const result = await ai.models.generateContent({
    model: JUDGE_MODEL,
    contents: [{ role: 'user', parts }],
  })

  const responseText = result.text ?? ''

  const usageMetadata = result.usageMetadata
  const tokenUsage: TokenUsage = {
    inputTokens: usageMetadata?.promptTokenCount ?? 0,
    outputTokens: usageMetadata?.candidatesTokenCount ?? 0,
    model: JUDGE_MODEL,
  }

  console.log(`[JUDGE] Response received. Tokens: input=${tokenUsage.inputTokens}, output=${tokenUsage.outputTokens}`)

  // Parse response
  let analysis: JudgeAnalysis
  try {
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : responseText.trim()
    const parsed = JSON.parse(jsonStr)

    // Validate required structure
    analysis = {
      algorithmicValidation: {
        eosAgreement: parsed.algorithmicValidation?.eosAgreement ?? 'QUESTIONED',
        eosAdjustedDate: parsed.algorithmicValidation?.eosAdjustedDate ?? null,
        eosAdjustmentReason: parsed.algorithmicValidation?.eosAdjustmentReason ?? null,
        stageAgreement: parsed.algorithmicValidation?.stageAgreement ?? false,
        stageComment: parsed.algorithmicValidation?.stageComment ?? '',
      },
      visualFindings: Array.isArray(parsed.visualFindings) ? parsed.visualFindings : [],
      harvestReadiness: {
        ready: parsed.harvestReadiness?.ready ?? parsed.harvestReadiness?.isReady ?? false,
        estimatedDate: parsed.harvestReadiness?.estimatedDate ?? null,
        delayRisk: parsed.harvestReadiness?.delayRisk ?? 'NONE',
        delayDays: parsed.harvestReadiness?.delayDays ?? 0,
        notes: parsed.harvestReadiness?.notes ?? '',
      },
      riskAssessment: {
        overallRisk: parsed.riskAssessment?.overallRisk ?? parsed.riskAssessment?.overall ?? 'MEDIUM',
        factors: Array.isArray(parsed.riskAssessment?.factors) ? parsed.riskAssessment.factors : [],
        // Preserve old-schema fields for normalization in ai-validation.service.ts
        ...(parsed.riskAssessment?.climatic ? { climatic: parsed.riskAssessment.climatic } : {}),
        ...(parsed.riskAssessment?.phytosanitary ? { phytosanitary: parsed.riskAssessment.phytosanitary } : {}),
        ...(parsed.riskAssessment?.operational ? { operational: parsed.riskAssessment.operational } : {}),
      } as any,
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
    }
  } catch {
    console.warn('[JUDGE] Failed to parse JSON response, returning fallback')
    analysis = {
      algorithmicValidation: {
        eosAgreement: 'QUESTIONED',
        eosAdjustedDate: null,
        eosAdjustmentReason: 'Could not parse judge response',
        stageAgreement: false,
        stageComment: 'Judge response parsing failed',
      },
      visualFindings: [],
      harvestReadiness: {
        ready: false,
        estimatedDate: null,
        delayRisk: 'NONE',
        delayDays: 0,
        notes: '',
      },
      riskAssessment: {
        overallRisk: 'MEDIUM',
        factors: [{ category: 'OPERATIONAL', severity: 'MEDIUM', description: 'Unable to assess - parsing error' }],
      },
      recommendations: ['Rerun AI validation - previous attempt had a parsing error'],
      confidence: 0,
    }
  }

  console.log(`[JUDGE] Validation complete. Agreement: ${analysis.algorithmicValidation.eosAgreement}, Confidence: ${analysis.confidence}%`)

  return {
    analysis,
    tokenUsage,
  }
}
