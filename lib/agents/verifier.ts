/**
 * Verifier Agent
 * Intermediate agent between Curator and Judge.
 * Sole purpose: verify if the declared crop is actually present.
 * Uses gemini-2.5-flash-lite (fast and cheap).
 * Only called when crop-pattern.service detects ANOMALOUS or ATYPICAL patterns.
 * 
 * If Verifier returns NO_CROP or MISMATCH → pipeline short-circuits before Judge
 * If Verifier returns CROP_FAILURE → Judge runs with loss-assessment context
 * If Verifier returns CONFIRMED/SUSPICIOUS → Judge runs normally
 */

import { GoogleGenAI, type Part } from '@google/genai'
import { buildVerifierPrompt, type VerifierPromptParams } from './verifier-prompt'
import type {
  AgenticImageEntry,
  MultiSensorNdviEntry,
  TokenUsage,
  CropVerification,
  VerifierAnalysis,
} from './types'
import type { CropPatternResult } from '@/lib/services/crop-pattern.service'

// ==================== Types ====================

export interface VerifierInput {
  curatedImages: AgenticImageEntry[]
  multiSensorNdvi: MultiSensorNdviEntry[]
  fieldArea: number
  cropType: string
  cropCategory: 'ANNUAL' | 'SEMI_PERENNIAL' | 'PERENNIAL'
  cropPatternResult: CropPatternResult
  model: string  // e.g. "gemini-2.5-flash-lite"
}

export interface VerifierOutput {
  verification: CropVerification
  tokenUsage: TokenUsage
}

// ==================== Helpers ====================

function formatNdviTable(data: MultiSensorNdviEntry[]): string {
  if (data.length === 0) return 'Nenhum dado NDVI disponível.'
  const rows = data.map((e) => {
    const d = e.dateFrom.split('T')[0]
    const mean = Number(e.mean)
    return `${d} | ${e.source.padEnd(7)} | ${mean.toFixed(3)} | ${Number(e.stDev).toFixed(3)}`
  })
  return (
    `Data       | Fonte   | Media | StDev\n` +
    `---------- | ------- | ----- | -----\n` +
    rows.join('\n')
  )
}

// ==================== Main Function ====================

export async function runVerifier(input: VerifierInput): Promise<VerifierOutput> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  const model = input.model || 'gemini-2.5-flash-lite'

  console.log(`[VERIFIER] Starting crop verification for ${input.cropType} (${input.cropCategory}) with ${model}`)
  console.log(`[VERIFIER] Algorithmic status: ${input.cropPatternResult.status}, ${input.curatedImages.length} curated images`)

  // Build image list description
  const imageList = input.curatedImages
    .map(
      (img) =>
        `- [${img.date}] ${img.type.toUpperCase()} (${img.metadata.collection})`
    )
    .join('\n')

  const ndviTable = formatNdviTable(input.multiSensorNdvi)

  const textPrompt = buildVerifierPrompt({
    cropType: input.cropType,
    cropCategory: input.cropCategory,
    cropPatternResult: input.cropPatternResult,
    imageList,
    ndviTable,
    fieldArea: input.fieldArea,
  })

  // Build multimodal content: text + curated images
  const parts: Part[] = [
    { text: textPrompt },
  ]

  // Send only the best images to keep Verifier fast and cheap
  const maxImages = 8  // Fewer images than Judge -- speed over thoroughness
  const selectedImages = input.curatedImages.slice(0, maxImages)

  for (const img of selectedImages) {
    parts.push({
      text: `\n--- Imagem: ${img.date} - ${img.type} ---`,
    })
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: img.base64.replace(/^data:image\/\w+;base64,/, ''),
      },
    })
  }

  console.log(`[VERIFIER] Sending ${selectedImages.length} images + prompt (${textPrompt.length} chars) to ${model}`)

  const ai = new GoogleGenAI({ apiKey })
  const result = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts }],
  })

  const responseText = result.text ?? ''

  const usageMetadata = result.usageMetadata
  const tokenUsage: TokenUsage = {
    inputTokens: usageMetadata?.promptTokenCount ?? 0,
    outputTokens: usageMetadata?.candidatesTokenCount ?? 0,
    model,
  }

  console.log(`[VERIFIER] Response received. Tokens: input=${tokenUsage.inputTokens}, output=${tokenUsage.outputTokens}`)

  // Parse response
  let verification: CropVerification
  try {
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : responseText.trim()
    const parsed = JSON.parse(jsonStr)

    const cv = parsed.cropVerification || parsed

    verification = {
      status: cv.status || 'SUSPICIOUS',
      declaredCrop: cv.declaredCrop || input.cropType,
      cropCategory: cv.cropCategory || input.cropCategory,
      visualAssessment: cv.visualAssessment || '',
      alternativeHypotheses: Array.isArray(cv.alternativeHypotheses) ? cv.alternativeHypotheses : [],
      confidenceInDeclaredCrop: typeof cv.confidenceInDeclaredCrop === 'number' ? cv.confidenceInDeclaredCrop : 50,
      evidence: cv.evidence || '',
    }
  } catch {
    console.warn('[VERIFIER] Failed to parse JSON response, using algorithmic fallback')
    // Fallback: trust the algorithmic classification
    verification = {
      status: input.cropPatternResult.status === 'NO_CROP' ? 'NO_CROP'
        : input.cropPatternResult.status === 'ANOMALOUS' ? 'MISMATCH'
        : 'SUSPICIOUS',
      declaredCrop: input.cropType,
      cropCategory: input.cropCategory,
      visualAssessment: 'Não foi possível analisar as imagens (erro de parsing do modelo)',
      alternativeHypotheses: input.cropPatternResult.hypotheses,
      confidenceInDeclaredCrop: 20,
      evidence: `Baseado em análise algorítmica: ${input.cropPatternResult.reason}`,
    }
  }

  console.log(`[VERIFIER] Crop verification: status=${verification.status}, confidence=${verification.confidenceInDeclaredCrop}%`)

  return {
    verification,
    tokenUsage,
  }
}
