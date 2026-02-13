/**
 * Determine final processing status based on data quality.
 */

import type { PipelineContext } from '../types'

export function determineStatus(ctx: PipelineContext): {
  status: 'SUCCESS' | 'PARTIAL' | 'ERROR'
  extraWarnings: string[]
} {
  const warnings: string[] = []
  let status: 'SUCCESS' | 'PARTIAL' | 'ERROR' = 'SUCCESS'

  // Short-circuit cases are always SUCCESS
  if (ctx.shortCircuited) {
    return { status: 'SUCCESS', extraWarnings: [] }
  }

  if (!ctx.phenology) {
    return { status: 'ERROR', extraWarnings: ['Fenologia não calculada'] }
  }

  const hasCropIssue =
    ctx.cropPatternResult?.status === 'NO_CROP' ||
    ctx.cropPatternResult?.status === 'ANOMALOUS' ||
    ctx.cropPatternResult?.status === 'ATYPICAL'

  // Check NDVI data
  if (!ctx.merxReport?.ndvi || ctx.merxReport.ndvi.length === 0) {
    warnings.push('Sem dados NDVI da API')
    status = 'PARTIAL'
  } else if (ctx.merxReport.ndvi.length < 5) {
    warnings.push(`Poucos pontos NDVI (${ctx.merxReport.ndvi.length})`)
  }

  // Check phenology — only PARTIAL if not caused by crop issue
  if (!ctx.phenology.sosDate) {
    warnings.push('Não foi possível detectar emergência (SOS)')
    if (!hasCropIssue) status = 'PARTIAL'
  }
  if (!ctx.phenology.eosDate) {
    warnings.push('Não foi possível detectar/projetar colheita (EOS)')
    if (!hasCropIssue) status = 'PARTIAL'
  }

  // Check confidence
  if (ctx.phenology.confidenceScore < 30) {
    warnings.push(`Confiança muito baixa (${ctx.phenology.confidenceScore}%)`)
    if (!hasCropIssue && status === 'SUCCESS') status = 'PARTIAL'
  }

  // Large area warning
  if (ctx.areaHa > 1000) {
    warnings.push(`Área muito grande (${ctx.areaHa} ha) - pode afetar precisão`)
  }

  return { status, extraWarnings: warnings }
}
