/**
 * EOS Fusion Service - Helper Functions
 */

import type { EosFusionResult, FusionMetrics } from './types'
import {
  NDVI_THRESHOLDS,
  GDD_THRESHOLDS,
} from './types'

/**
 * Calcula boost de confiança baseado em métricas de fusão NDVI
 *
 * Referências científicas:
 * - Planet Fusion (2021): Confiança inversamente proporcional ao gap temporal
 * - MDPI Remote Sensing (2024): SAR-Optical fusion +6% acurácia
 * - arXiv 2020: 3x melhoria R² para gaps longos com SAR
 */
export function calculateFusionConfidenceBoost(
  baseConfidence: number,
  fusionMetrics: FusionMetrics | undefined,
  phenologicalStage: EosFusionResult['phenologicalStage']
): { adjustedConfidence: number, boostDetails: string[] } {
  if (!fusionMetrics) {
    return { adjustedConfidence: baseConfidence, boostDetails: [] }
  }

  let boost = 0
  const details: string[] = []

  // 1. Bônus por continuidade da série (Planet Fusion methodology)
  // Séries com menos gaps são mais confiáveis
  if (fusionMetrics.maxGapDays <= 5) {
    boost += 10
    details.push('Série contínua (max gap 5d): +10%')
  } else if (fusionMetrics.maxGapDays <= 10) {
    boost += 5
    details.push('Série moderadamente contínua: +5%')
  } else if (fusionMetrics.gapsFilled > 0) {
    // Gap longo, mas preenchido por radar (arXiv 2020: 3x melhoria)
    boost += 8
    details.push(`${fusionMetrics.gapsFilled} gap(s) preenchidos por radar: +8%`)
  }
  // Se gap longo e não preenchido: sem bônus

  // 2. Bônus por contribuição do radar em fase crítica
  // Radar é mais valioso na senescência (detecta mudanças estruturais)
  if (fusionMetrics.radarContribution > 0) {
    const radarBonus = Math.min(5, fusionMetrics.radarContribution * 10)

    // Multiplicador para fases críticas
    let stageMultiplier = 1.0
    if (phenologicalStage === 'SENESCENCE' || phenologicalStage === 'MATURITY') {
      stageMultiplier = 1.5 // Radar mais valioso na maturação
    }

    const finalRadarBonus = Math.round(radarBonus * stageMultiplier)
    if (finalRadarBonus > 0) {
      boost += finalRadarBonus
      const stageNote = stageMultiplier > 1 ? ' (fase crítica)' : ''
      details.push(`Contribuição radar: +${finalRadarBonus}%${stageNote}`)
    }
  }

  const adjustedConfidence = Math.min(100, baseConfidence + boost)

  return { adjustedConfidence, boostDetails: details }
}

export function determinePhenologicalStage(
  currentNdvi: number,
  gddProgress: number,
  ndviDecline: number,
  declineRate: number
): EosFusionResult['phenologicalStage'] {
  // Maturidade: NDVI DEVE estar baixo para confirmar maturidade
  // GDD sozinho não é suficiente se NDVI contradiz (planta ainda verde)
  if (currentNdvi < NDVI_THRESHOLDS.MATURITY) {
    return 'MATURITY'
  }

  // Se GDD diz maturidade mas NDVI está alto e sem declínio,
  // há inconsistência — GDD provavelmente foi calculado com data de plantio incorreta
  // Priorizar o que a planta realmente mostra (NDVI)
  if (gddProgress > 1.1 && currentNdvi >= NDVI_THRESHOLDS.VEGETATIVE_MIN && ndviDecline < 0.05) {
    // NDVI alto e sem declínio significativo = planta claramente ainda em crescimento
    // GDD inconsistente — provavelmente data de plantio errada
    return 'VEGETATIVE'
  }

  if (gddProgress > 1.1 && currentNdvi >= NDVI_THRESHOLDS.SENESCENCE_START) {
    // NDVI acima de senescência mas GDD altíssimo = possível fase reprodutiva tardia
    return 'REPRODUCTIVE'
  }

  if (gddProgress > 1.1) {
    // NDVI já começou a cair, GDD confirma
    return 'MATURITY'
  }

  // Senescência: NDVI em declínio significativo E GDD suporta
  // Não marcar senescência apenas por GDD se NDVI não confirma
  if (ndviDecline > 0.15 && gddProgress > GDD_THRESHOLDS.GRAIN_FILLING_START) {
    return 'SENESCENCE'
  }

  // Senescência por GDD alto, mas só se NDVI não está claramente em crescimento
  if (gddProgress > GDD_THRESHOLDS.SENESCENCE_START && ndviDecline > 0.05) {
    return 'SENESCENCE'
  }

  // Enchimento: GDD entre 70-90%
  if (gddProgress > GDD_THRESHOLDS.GRAIN_FILLING_START) {
    return 'GRAIN_FILLING'
  }

  // Reprodutivo: GDD entre 50-70%
  if (gddProgress > GDD_THRESHOLDS.REPRODUCTIVE_START) {
    return 'REPRODUCTIVE'
  }

  // Vegetativo
  return 'VEGETATIVE'
}

export function getProjectionStatus(eosDate: Date | null, today: Date): string {
  if (!eosDate) return 'Indisponível'

  const diffDays = Math.round((eosDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return `Passou (${Math.abs(diffDays)}d atrás)`
  } else if (diffDays === 0) {
    return 'Hoje'
  } else {
    return `Em ${diffDays}d`
  }
}

export function getGddProjectionStatus(gddProgress: number, eosGdd: Date | null, today: Date): string {
  if (gddProgress >= 1.0) {
    return `Maturação atingida (${(gddProgress * 100).toFixed(0)}%)`
  }

  if (!eosGdd) return 'Calculando...'

  const diffDays = Math.round((eosGdd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return 'Deveria ter maturado'
  } else if (diffDays === 0) {
    return 'Maturação hoje'
  } else {
    return `Em ${diffDays}d (${(gddProgress * 100).toFixed(0)}%)`
  }
}

export function formatDate(date: Date | null): string {
  if (!date) return 'N/A'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
