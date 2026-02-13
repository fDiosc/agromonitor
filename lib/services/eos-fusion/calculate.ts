/**
 * EOS Fusion Service - Main Calculation
 *
 * Implementa fusão de múltiplas fontes de dados para previsão de EOS (End of Season / Colheita)
 */

import type { EosFusionInput, EosFusionResult } from './types'
import {
  NDVI_THRESHOLDS,
  WATER_STRESS_ADJUSTMENT_DAYS,
  GDD_CONFIDENCE_MAP,
} from './types'
import {
  determinePhenologicalStage,
  getProjectionStatus,
  getGddProjectionStatus,
  formatDate,
  calculateFusionConfidenceBoost,
} from './helpers'

export function calculateFusedEos(input: EosFusionInput): EosFusionResult {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const warnings: string[] = []
  const factors: string[] = []

  // 1. Calcular indicadores
  const gddProgress = input.gddRequired > 0
    ? input.gddAccumulated / input.gddRequired
    : 0

  const ndviDecline = input.peakNdvi > 0
    ? (input.peakNdvi - input.currentNdvi) / input.peakNdvi
    : 0

  // 2. Determinar estágio fenológico
  const phenologicalStage = determinePhenologicalStage(
    input.currentNdvi,
    gddProgress,
    ndviDecline,
    input.ndviDeclineRate
  )

  // 3. Verificar consistência das projeções
  const ndviStatus = getProjectionStatus(input.eosNdvi, today)
  const gddStatus = getGddProjectionStatus(gddProgress, input.eosGdd, today)

  // 4. Calcular ajuste por estresse hídrico
  const waterAdjustment = WATER_STRESS_ADJUSTMENT_DAYS[input.waterStressLevel || 'NONE'] || 0

  if (waterAdjustment !== 0) {
    factors.push(`Ajuste hídrico: ${waterAdjustment > 0 ? '+' : ''}${waterAdjustment} dias`)
  }

  // 5. Selecionar método primário e calcular EOS
  let eos: Date
  let confidence: number
  let method: EosFusionResult['method']
  let explanation: string

  // Caso 1: GDD ultrapassou 100% E NDVI em declínio rápido = Maturação confirmada
  if (gddProgress >= 1.0 && input.currentNdvi < NDVI_THRESHOLDS.SENESCENCE_START && input.ndviDeclineRate > NDVI_THRESHOLDS.DECLINE_RATE_FAST) {
    // Maturação fisiológica atingida - usar a melhor data disponível (NDVI ou GDD)
    // NÃO usar "today" como fallback - o EOS é uma data fixa de quando a cultura maturou
    if (input.eosNdvi && input.eosGdd) {
      // Ambas disponíveis: média ponderada (mesmo que no passado)
      const ndviWeight = input.ndviConfidence / 100
      const gddWeight = (GDD_CONFIDENCE_MAP[input.gddConfidence] || 70) / 100
      const totalWeight = ndviWeight + gddWeight
      const avgTime = (input.eosNdvi.getTime() * ndviWeight + input.eosGdd.getTime() * gddWeight) / totalWeight
      eos = new Date(avgTime + waterAdjustment * 24 * 60 * 60 * 1000)
    } else if (input.eosNdvi) {
      // Apenas NDVI disponível (mesmo que no passado)
      eos = new Date(input.eosNdvi.getTime() + waterAdjustment * 24 * 60 * 60 * 1000)
    } else if (input.eosGdd) {
      // Apenas GDD disponível
      eos = new Date(input.eosGdd.getTime() + waterAdjustment * 24 * 60 * 60 * 1000)
    } else {
      // Nenhuma data disponível (raro com GDD >= 100%)
      eos = today
    }
    confidence = Math.max(input.ndviConfidence, GDD_CONFIDENCE_MAP[input.gddConfidence] || 70)
    method = 'FUSION'
    explanation = 'Maturação fisiológica atingida (GDD 100%), senescência ativa confirmada por NDVI'
    factors.push('GDD: 100% - maturação fisiológica')
    factors.push(`NDVI: ${(input.currentNdvi * 100).toFixed(0)}% - em declínio`)
    factors.push(`Taxa declínio: ${input.ndviDeclineRate.toFixed(2)}%/pt`)
    if (eos < today) {
      warnings.push(`Maturação já ocorreu em ${formatDate(eos)} - colheita deve ser imediata`)
    }
  }
  // Caso 2: EOS NDVI já passou MAS planta ainda verde = Usar GDD
  else if (input.eosNdvi && input.eosNdvi < today && input.currentNdvi > NDVI_THRESHOLDS.VEGETATIVE_MIN) {
    if (input.eosGdd && input.eosGdd > today) {
      eos = new Date(input.eosGdd.getTime() + waterAdjustment * 24 * 60 * 60 * 1000)
      confidence = GDD_CONFIDENCE_MAP[input.gddConfidence] || 70
      method = waterAdjustment !== 0 ? 'GDD_ADJUSTED' : 'GDD'
      explanation = 'Projeção NDVI histórica já passou, mas NDVI atual indica planta ainda verde. Usando soma térmica (GDD).'
      factors.push(`NDVI atual: ${(input.currentNdvi * 100).toFixed(0)}% (ainda alto)`)
      factors.push(`GDD: ${(gddProgress * 100).toFixed(0)}% concluído`)
      warnings.push(`EOS NDVI (${formatDate(input.eosNdvi)}) já passou - ajustado para GDD`)
    } else {
      // GDD também não disponível, usar projeção baseada em dias restantes
      const daysRemaining = Math.ceil((1 - gddProgress) * 10) // Estimativa simplificada
      eos = new Date(today.getTime() + daysRemaining * 24 * 60 * 60 * 1000)
      confidence = 50
      method = 'GDD'
      explanation = 'Projeção baseada em GDD restante. Dados limitados.'
      warnings.push('Projeção com incerteza elevada')
    }
  }
  // Caso 3: Projeções convergem (diferença < 7 dias) = Média ponderada
  else if (input.eosNdvi && input.eosGdd && Math.abs(input.eosNdvi.getTime() - input.eosGdd.getTime()) < 7 * 24 * 60 * 60 * 1000) {
    const ndviWeight = input.ndviConfidence / 100
    const gddWeight = (GDD_CONFIDENCE_MAP[input.gddConfidence] || 70) / 100
    const totalWeight = ndviWeight + gddWeight

    const avgTime = (input.eosNdvi.getTime() * ndviWeight + input.eosGdd.getTime() * gddWeight) / totalWeight
    eos = new Date(avgTime + waterAdjustment * 24 * 60 * 60 * 1000)
    confidence = Math.round((input.ndviConfidence * ndviWeight + (GDD_CONFIDENCE_MAP[input.gddConfidence] || 70) * gddWeight) / totalWeight)
    method = waterAdjustment !== 0 ? 'FUSION' : 'FUSION'
    explanation = 'Projeções NDVI e GDD convergentes. Usando média ponderada por confiança.'
    factors.push(`NDVI: ${formatDate(input.eosNdvi)} (${input.ndviConfidence}%)`)
    factors.push(`GDD: ${formatDate(input.eosGdd)} (${GDD_CONFIDENCE_MAP[input.gddConfidence] || 70}%)`)
  }
  // Caso 4: Fallback para NDVI
  else if (input.eosNdvi) {
    eos = new Date(input.eosNdvi.getTime() + waterAdjustment * 24 * 60 * 60 * 1000)
    confidence = input.ndviConfidence
    method = waterAdjustment !== 0 ? 'NDVI_ADJUSTED' : 'NDVI'
    explanation = 'Projeção baseada em curva NDVI histórica.'
    factors.push(`Correlação histórica: ${input.ndviConfidence}%`)
  }
  // Caso 5: Apenas GDD disponível
  else if (input.eosGdd) {
    const gddEosWithWater = new Date(input.eosGdd.getTime() + waterAdjustment * 24 * 60 * 60 * 1000)
    const gddEosInPast = gddEosWithWater < today
    const ndviStillHigh = input.currentNdvi >= NDVI_THRESHOLDS.VEGETATIVE_MIN
    const ndviStillGrowing = input.ndviDeclineRate <= 0 // Taxa negativa ou zero = sem declínio
    const ndviNearPeak = input.peakNdvi > 0 && (input.currentNdvi / input.peakNdvi) > 0.90

    // Caso 5a: GDD EOS no passado MAS NDVI contradiz (planta ainda verde/crescendo)
    // Isso indica que a data de plantio usada para GDD está incorreta
    // ou o ciclo real da cultura é diferente do esperado
    if (gddEosInPast && ndviStillHigh && (ndviStillGrowing || ndviNearPeak)) {
      // NÃO usar a data GDD — é claramente incorreta
      // Projetar a partir da tendência atual do NDVI
      // Estimar: planta está no pico ou pré-pico, faltam ~40-60 dias até colheita
      const estimatedDaysToEos = ndviStillGrowing ? 60 : 45
      eos = new Date(today.getTime() + estimatedDaysToEos * 24 * 60 * 60 * 1000)
      confidence = 35 // Confiança BAIXA - dados inconsistentes
      method = 'GDD_ADJUSTED'
      explanation = 'GDD indica maturação no passado, mas NDVI mostra planta ainda em crescimento ativo. Projeção GDD descartada — possível data de plantio incorreta ou ciclo diferente.'
      factors.push(`⚠️ GDD: ${(gddProgress * 100).toFixed(0)}% (${formatDate(input.eosGdd)}) — INCONSISTENTE`)
      factors.push(`NDVI atual: ${(input.currentNdvi * 100).toFixed(0)}% (pico: ${(input.peakNdvi * 100).toFixed(0)}%) — planta verde`)
      factors.push(`Taxa NDVI: ${input.ndviDeclineRate > 0 ? 'declínio' : 'crescimento'} (${input.ndviDeclineRate.toFixed(2)}%/pt)`)
      factors.push(`Estimativa conservadora: ~${estimatedDaysToEos} dias a partir de hoje`)
      warnings.push(`GDD EOS (${formatDate(input.eosGdd)}) descartado: NDVI a ${(input.currentNdvi * 100).toFixed(0)}% contradiz maturação`)
      warnings.push('Provável: data de plantio ausente/incorreta ou segundo ciclo não detectado')
    }
    // Caso 5b: GDD EOS normal (futuro ou passado com NDVI em declínio)
    else {
      eos = gddEosWithWater
      confidence = GDD_CONFIDENCE_MAP[input.gddConfidence as unknown as string] || 70
      method = waterAdjustment !== 0 ? 'GDD_ADJUSTED' : 'GDD'
      explanation = 'Projeção baseada em soma térmica (GDD).'
      factors.push(`Progresso GDD: ${(gddProgress * 100).toFixed(0)}%`)

      // Se GDD está no passado mas sem contradição forte, avisar mas manter
      if (gddEosInPast) {
        confidence = Math.min(confidence, 60) // Limitar confiança
        warnings.push(`GDD EOS (${formatDate(input.eosGdd)}) no passado — confiança reduzida`)
      }
    }
  }
  // Caso 6: Nenhum dado disponível
  else {
    eos = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 dias padrão
    confidence = 30
    method = 'NDVI'
    explanation = 'Dados insuficientes para projeção precisa.'
    warnings.push('Projeção estimada - dados limitados')
  }

  // 6. Adicionar alertas de estresse hídrico
  if (input.waterStressLevel === 'CRITICAL') {
    warnings.push(`Estresse hídrico crítico: ${input.stressDays} dias, impacto estimado ${input.yieldImpact}% na produtividade`)
    factors.push('⚠️ Estresse acelera senescência')
  } else if (input.waterStressLevel === 'HIGH') {
    warnings.push(`Estresse hídrico elevado: ${input.stressDays} dias de estresse`)
  }

  // 7. Aplicar boost de confiança por fusão NDVI (radar)
  const { adjustedConfidence, boostDetails } = calculateFusionConfidenceBoost(
    confidence,
    input.fusionMetrics,
    phenologicalStage
  )

  // Adicionar detalhes do boost aos fatores
  if (boostDetails.length > 0) {
    factors.push('📡 Radar Sentinel-1:')
    factors.push(...boostDetails.map(d => `  • ${d}`))
  }

  return {
    eos,
    confidence: adjustedConfidence,
    method,
    passed: eos < today,
    phenologicalStage,
    explanation,
    factors,
    projections: {
      ndvi: {
        date: input.eosNdvi,
        confidence: input.ndviConfidence,
        status: ndviStatus
      },
      gdd: {
        date: input.eosGdd,
        confidence: GDD_CONFIDENCE_MAP[input.gddConfidence] || 70,
        status: gddStatus
      },
      waterAdjustment
    },
    warnings
  }
}

// ==================== Export for use in processing ====================

export function getConfidenceLabel(confidence: number): 'ALTA' | 'MEDIA' | 'BAIXA' {
  if (confidence >= 75) return 'ALTA'
  if (confidence >= 50) return 'MEDIA'
  return 'BAIXA'
}

export function getMethodLabel(method: EosFusionResult['method']): string {
  const labels: Record<EosFusionResult['method'], string> = {
    'NDVI': 'NDVI Histórico',
    'GDD': 'Soma Térmica',
    'FUSION': 'NDVI + GDD',
    'NDVI_ADJUSTED': 'NDVI + Ajuste Hídrico',
    'GDD_ADJUSTED': 'GDD + Ajuste Hídrico'
  }
  return labels[method]
}

export function getPhenologicalStageLabel(stage: EosFusionResult['phenologicalStage']): string {
  const labels: Record<EosFusionResult['phenologicalStage'], string> = {
    'VEGETATIVE': 'Vegetativo',
    'REPRODUCTIVE': 'Reprodutivo',
    'GRAIN_FILLING': 'Enchimento',
    'SENESCENCE': 'Senescência',
    'MATURITY': 'Maturação'
  }
  return labels[stage]
}
