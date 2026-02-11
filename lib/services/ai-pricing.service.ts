/**
 * AI Pricing Service
 * Model pricing constants and cost calculation helpers for the AI validation pipeline
 * Based on: https://ai.google.dev/gemini-api/docs/pricing
 * Adapted from POC Image Analysis lib/pricing.ts
 */

import type { TokenUsage, AgentCostReport, CostReport } from '@/lib/agents/types'

// ==================== Pricing ====================

export interface ModelPricing {
  inputPer1M: number   // USD per 1M input tokens
  outputPer1M: number  // USD per 1M output tokens (including thinking tokens)
  label: string        // Human-readable model name
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  'gemini-3-flash-preview': {
    inputPer1M: 0.50,   // $0.50 per 1M input tokens (text/image/video)
    outputPer1M: 3.00,  // $3.00 per 1M output tokens (incl. thinking)
    label: 'Gemini 3 Flash',
  },
  'gemini-2.5-flash-lite': {
    inputPer1M: 0.10,   // $0.10 per 1M input tokens
    outputPer1M: 0.40,  // $0.40 per 1M output tokens
    label: 'Gemini 2.5 Flash-Lite',
  },
}

export const CURATOR_MODEL_OPTIONS = [
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite (cheaper)' },
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (best quality)' },
] as const

export const JUDGE_MODEL = 'gemini-3-flash-preview'

// ==================== Cost Calculation ====================

/**
 * Calculate cost for a given model and token usage.
 */
export function calculateCost(model: string, inputTokens: number, outputTokens: number): AgentCostReport {
  const pricing = MODEL_PRICING[model]
  if (!pricing) {
    throw new Error(`Unknown model: ${model}. Available: ${Object.keys(MODEL_PRICING).join(', ')}`)
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M

  return {
    model,
    modelLabel: pricing.label,
    inputTokens,
    outputTokens,
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
  }
}

/**
 * Log a detailed cost report to the console.
 */
export function logCostReport(report: CostReport): void {
  const fmt = (n: number) => n.toLocaleString()
  const fmtUsd = (n: number) => `$${n.toFixed(6)}`

  console.log('\n' + '='.repeat(80))
  console.log('[AI-VALIDATION] === COST REPORT ===')
  console.log(`[AI-VALIDATION] --- Curator Agent (${report.curator.modelLabel}) ---`)
  console.log(`[AI-VALIDATION]   Input tokens:  ${fmt(report.curator.inputTokens)}`)
  console.log(`[AI-VALIDATION]   Output tokens: ${fmt(report.curator.outputTokens)}`)
  console.log(`[AI-VALIDATION]   Cost: ${fmtUsd(report.curator.totalCost)} (input: ${fmtUsd(report.curator.inputCost)}, output: ${fmtUsd(report.curator.outputCost)})`)
  console.log('[AI-VALIDATION]')
  console.log(`[AI-VALIDATION] --- Judge Agent (${report.judge.modelLabel}) ---`)
  console.log(`[AI-VALIDATION]   Input tokens:  ${fmt(report.judge.inputTokens)}`)
  console.log(`[AI-VALIDATION]   Output tokens: ${fmt(report.judge.outputTokens)}`)
  console.log(`[AI-VALIDATION]   Cost: ${fmtUsd(report.judge.totalCost)} (input: ${fmtUsd(report.judge.inputCost)}, output: ${fmtUsd(report.judge.outputCost)})`)
  console.log('[AI-VALIDATION]')
  console.log('[AI-VALIDATION] --- TOTAL ---')
  console.log(`[AI-VALIDATION]   Total input tokens:  ${fmt(report.totalInputTokens)}`)
  console.log(`[AI-VALIDATION]   Total output tokens: ${fmt(report.totalOutputTokens)}`)
  console.log(`[AI-VALIDATION]   Total cost: ${fmtUsd(report.totalCost)}`)
  console.log(`[AI-VALIDATION]   Total duration: ${(report.durations.totalMs / 1000).toFixed(1)}s (fetch: ${(report.durations.fetchMs / 1000).toFixed(1)}s, timeseries: ${(report.durations.timeseriesMs / 1000).toFixed(1)}s, curator: ${(report.durations.curatorMs / 1000).toFixed(1)}s, judge: ${(report.durations.judgeMs / 1000).toFixed(1)}s)`)
  console.log('='.repeat(80) + '\n')
}
