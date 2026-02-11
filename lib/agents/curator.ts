/**
 * Curator Agent
 * Evaluates image quality and curates data for the Judge
 * Uses batching to ensure ALL images are evaluated
 * Rewritten for @google/genai SDK (Merx standard)
 * Adapted from POC Image Analysis server/agents/curator.ts
 */

import { GoogleGenAI, type Part } from '@google/genai'
import { buildCuratorPrompt } from './curator-prompt'
import type {
  AgenticImageEntry,
  CurationReport,
  CurationImageScore,
  MultiSensorNdviEntry,
  RadarTimeSeriesEntry,
  TokenUsage,
} from './types'

// ==================== Types ====================

export interface CuratorInput {
  images: AgenticImageEntry[]
  multiSensorNdvi: MultiSensorNdviEntry[]
  radarTimeSeries: RadarTimeSeriesEntry[]
  fieldArea: number
  model: string // "gemini-3-flash-preview" or "gemini-2.5-flash-lite"
}

export interface CuratorOutput {
  curationReport: CurationReport
  curatedImages: AgenticImageEntry[]
  tokenUsage: TokenUsage
}

// ==================== Constants ====================

// Max images per batch to ensure model evaluates all of them
const BATCH_SIZE = 20

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

// Normalize key for matching (case-insensitive, trim)
function makeKey(date: string, type: string): string {
  return `${date.trim().toLowerCase()}-${type.trim().toLowerCase()}`
}

interface ParsedCuratorResponse {
  scores: Array<{ date: string; type: string; score: number; included: boolean; reason: string }>
  timeSeriesFlags?: Array<{ date: string; source: string; issue: string; recommendation: string }>
  contextSummary?: string
  timeSeriesCleaningSummary?: string
}

// ==================== Batch Processing ====================

/**
 * Run a single batch of images through the Curator model.
 * Uses @google/genai SDK (Merx standard).
 */
async function runCuratorBatch(
  batchImages: AgenticImageEntry[],
  batchIndex: number,
  totalBatches: number,
  input: CuratorInput,
  multiSensorNdviTable: string,
  radarTable: string,
): Promise<{ parsed: ParsedCuratorResponse; tokenUsage: TokenUsage }> {
  const apiKey = process.env.GEMINI_API_KEY!

  // Build image list for this batch only
  const imageList = batchImages
    .map(
      (img) =>
        `- [${img.date}] ${img.type} (collection: ${img.metadata.collection}${
          img.metadata.cloudCover !== undefined ? `, cloud: ${img.metadata.cloudCover}%` : ''
        })`
    )
    .join('\n')

  const textPrompt = buildCuratorPrompt({
    fieldArea: input.fieldArea,
    totalImages: batchImages.length,
    imageList,
    multiSensorNdviTable,
    radarTable,
  })

  // Add batch context instruction
  const batchInstruction = totalBatches > 1
    ? `\n\n## BATCH INFO\nThis is batch ${batchIndex + 1} of ${totalBatches}. You are evaluating ${batchImages.length} images in this batch. You MUST provide a score for EVERY SINGLE image listed above -- there are exactly ${batchImages.length} images. Do not skip any. The "scores" array in your response MUST have exactly ${batchImages.length} entries.`
    : `\n\n## IMPORTANT\nYou MUST provide a score for EVERY SINGLE image listed above -- there are exactly ${batchImages.length} images. The "scores" array MUST have exactly ${batchImages.length} entries. Do not skip any image.`

  const fullPrompt = textPrompt + batchInstruction

  // Build multimodal content parts for @google/genai SDK
  const parts: Part[] = [
    { text: fullPrompt },
  ]

  for (const img of batchImages) {
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

  console.log(`[CURATOR] Batch ${batchIndex + 1}/${totalBatches}: sending ${batchImages.length} images (${fullPrompt.length} chars) to ${input.model}`)

  const ai = new GoogleGenAI({ apiKey })
  const result = await ai.models.generateContent({
    model: input.model,
    contents: [{ role: 'user', parts }],
  })

  const responseText = result.text ?? ''

  const usageMetadata = result.usageMetadata
  const tokenUsage: TokenUsage = {
    inputTokens: usageMetadata?.promptTokenCount ?? 0,
    outputTokens: usageMetadata?.candidatesTokenCount ?? 0,
    model: input.model,
  }

  console.log(`[CURATOR] Batch ${batchIndex + 1}/${totalBatches}: response received. Tokens: input=${tokenUsage.inputTokens}, output=${tokenUsage.outputTokens}`)

  // Parse response
  let parsed: ParsedCuratorResponse
  try {
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : responseText.trim()
    parsed = JSON.parse(jsonStr)
    if (!parsed.scores) parsed.scores = []
  } catch {
    console.warn(`[CURATOR] Batch ${batchIndex + 1}: failed to parse JSON, using defaults`)
    parsed = {
      scores: batchImages.map((img) => ({
        date: img.date,
        type: img.type,
        score: 50,
        included: true,
        reason: 'Could not parse curator response for this batch, including by default',
      })),
      contextSummary: 'Curator batch response could not be parsed.',
    }
  }

  const scoredCount = parsed.scores?.length ?? 0
  const expectedCount = batchImages.length
  if (scoredCount < expectedCount) {
    console.warn(`[CURATOR] Batch ${batchIndex + 1}: model scored ${scoredCount}/${expectedCount} images`)
  }

  return { parsed, tokenUsage }
}

// ==================== Main Function ====================

export async function runCurator(input: CuratorInput): Promise<CuratorOutput> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  console.log(`[CURATOR] Starting curation of ${input.images.length} images with model ${input.model} (batch size: ${BATCH_SIZE})`)

  const multiSensorNdviTable = formatMultiSensorNdviTable(input.multiSensorNdvi)
  const radarTable = formatRadarTable(input.radarTimeSeries)

  // Split images into batches
  const batches: AgenticImageEntry[][] = []
  for (let i = 0; i < input.images.length; i += BATCH_SIZE) {
    batches.push(input.images.slice(i, i + BATCH_SIZE))
  }

  console.log(`[CURATOR] Split ${input.images.length} images into ${batches.length} batches`)

  // Process batches sequentially (to avoid rate limits)
  const allScores: CurationImageScore[] = []
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let combinedContextSummary = ''
  let combinedTimeSeriesCleaningSummary = ''

  for (let i = 0; i < batches.length; i++) {
    const { parsed, tokenUsage } = await runCuratorBatch(
      batches[i],
      i,
      batches.length,
      input,
      multiSensorNdviTable,
      radarTable,
    )

    totalInputTokens += tokenUsage.inputTokens
    totalOutputTokens += tokenUsage.outputTokens

    // Collect scores from this batch
    for (const s of parsed.scores || []) {
      allScores.push({
        date: s.date,
        type: s.type as AgenticImageEntry['type'],
        score: s.score,
        included: s.included,
        reason: s.reason,
      })
    }

    // Merge context summaries (use first batch as primary)
    if (parsed.contextSummary) {
      if (i === 0) {
        combinedContextSummary = parsed.contextSummary
      } else {
        combinedContextSummary += ` [Batch ${i + 1}]: ${parsed.contextSummary}`
      }
    }
    if (parsed.timeSeriesCleaningSummary) {
      combinedTimeSeriesCleaningSummary += (combinedTimeSeriesCleaningSummary ? ' ' : '') + parsed.timeSeriesCleaningSummary
    }
  }

  // Match scored results back to images using case-insensitive keys
  const scoredKeys = new Set(allScores.map((s) => makeKey(s.date, s.type)))

  // Log how many were actually matched
  let matchedCount = 0
  for (const img of input.images) {
    if (scoredKeys.has(makeKey(img.date, img.type))) {
      matchedCount++
    }
  }
  console.log(`[CURATOR] Matched ${matchedCount}/${input.images.length} images to curator scores`)

  // For any images not scored, include them by default
  for (const img of input.images) {
    const key = makeKey(img.date, img.type)
    if (!scoredKeys.has(key)) {
      console.warn(`[CURATOR] Image not scored: ${img.date} ${img.type} (key: ${key})`)
      allScores.push({
        date: img.date,
        type: img.type,
        score: 50,
        included: true,
        reason: 'Not evaluated by curator, included by default',
      })
    }
  }

  const selectedScores = allScores.filter((s) => s.included)
  const discardedScores = allScores.filter((s) => !s.included)

  const curationReport: CurationReport = {
    totalImages: input.images.length,
    selectedImages: selectedScores.length,
    discardedImages: discardedScores.length,
    scores: allScores,
    contextSummary: combinedContextSummary || 'No context summary provided.',
    timeSeriesCleaningSummary: combinedTimeSeriesCleaningSummary || undefined,
  }

  // Filter images to curated subset using case-insensitive matching
  const includedKeys = new Set(
    selectedScores.map((s) => makeKey(s.date, s.type))
  )
  const curatedImages = input.images.filter(
    (img) => includedKeys.has(makeKey(img.date, img.type))
  )

  const combinedTokenUsage: TokenUsage = {
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    model: input.model,
  }

  console.log(`[CURATOR] Curation complete: ${curatedImages.length}/${input.images.length} images selected (${discardedScores.length} discarded)`)

  return {
    curationReport,
    curatedImages,
    tokenUsage: combinedTokenUsage,
  }
}
