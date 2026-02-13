/**
 * EOS Fusion Service
 * 
 * Implementa fusão de múltiplas fontes de dados para previsão de EOS (End of Season / Colheita)
 * 
 * Baseado em metodologias científicas:
 * - PhenoCrop Framework (Diao et al., 2020) — Remote Sensing of Environment, 248
 * - GDD Model for Soybean (Mourtzinis et al., 2017) — Agric. Forest Meteorology, 239
 * - NDVI Senescence Detection (Kumudini et al., 2021) — Crop Science, 61(3)
 * - Water Stress Impact (Brevedan & Egli, 2003) — Crop Science, 43(6), 2083-2095
 * 
 * Referências:
 * - NSF/USDA 2024: Fusão NDVI + GDD fornece 77% acurácia em milho, 71% em soja
 * - Threshold EOS: 40% da amplitude sazonal NDVI (MDPI Remote Sensing)
 * - Estresse hídrico acelera senescência (Crop Science 2003)
 */

// ==================== Types ====================

export interface FusionMetrics {
  gapsFilled: number           // Número de gaps preenchidos por radar
  maxGapDays: number           // Maior gap na série temporal
  radarContribution: number    // 0-1, proporção de pontos de radar
  continuityScore: number      // 0-1, score de continuidade da série
}

export interface EosFusionInput {
  // Dados NDVI
  eosNdvi: Date | null           // Data projetada pelo método NDVI histórico
  ndviConfidence: number         // 0-100
  currentNdvi: number            // NDVI atual (0-1)
  peakNdvi: number               // NDVI máximo da safra (0-1)
  ndviDeclineRate: number        // Taxa de declínio por ponto (%)
  
  // Dados GDD
  eosGdd: Date | null            // Data projetada pelo método GDD
  gddConfidence: 'HIGH' | 'MEDIUM' | 'LOW'  // Nível de confiança do GDD
  gddAccumulated: number         // GDD acumulado
  gddRequired: number            // GDD necessário para maturidade
  
  // Dados de Balanço Hídrico
  waterStressLevel?: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  stressDays?: number            // Dias de estresse
  yieldImpact?: number           // Impacto estimado na produtividade (%)
  
  // Métricas de fusão NDVI (óptico + radar)
  fusionMetrics?: FusionMetrics
  
  // Metadados
  plantingDate: Date
  cropType: string
}

export interface EosFusionResult {
  // Resultado principal
  eos: Date                      // Data de colheita estimada
  confidence: number             // 0-100
  method: 'NDVI' | 'GDD' | 'FUSION' | 'NDVI_ADJUSTED' | 'GDD_ADJUSTED'
  
  // Indica se o EOS já passou (colheita deveria ter ocorrido)
  passed: boolean
  
  // Estágio fenológico atual
  phenologicalStage: 'VEGETATIVE' | 'REPRODUCTIVE' | 'GRAIN_FILLING' | 'SENESCENCE' | 'MATURITY'
  
  // Explicação para tooltip
  explanation: string
  factors: string[]
  
  // Projeções individuais para comparação
  projections: {
    ndvi: { date: Date | null, confidence: number, status: string }
    gdd: { date: Date | null, confidence: number, status: string }
    waterAdjustment: number      // Dias de ajuste por estresse
  }
  
  // Alertas
  warnings: string[]
}

// ==================== Constants ====================

// Thresholds baseados em literatura científica
const NDVI_THRESHOLDS = {
  VEGETATIVE_MIN: 0.7,           // NDVI mínimo para considerar vegetativo
  SENESCENCE_START: 0.65,        // NDVI que indica início de senescência
  MATURITY: 0.5,                 // NDVI que indica maturidade
  DECLINE_RATE_FAST: 0.5,        // Taxa de declínio rápida (%/ponto)
  DECLINE_RATE_SLOW: 0.1         // Taxa de declínio lenta (%/ponto)
}

const GDD_THRESHOLDS = {
  REPRODUCTIVE_START: 0.5,       // 50% do GDD = início reprodutivo
  GRAIN_FILLING_START: 0.7,      // 70% do GDD = enchimento
  SENESCENCE_START: 0.9,         // 90% do GDD = senescência
  MATURITY: 1.0                  // 100% do GDD = maturidade fisiológica
}

// Ajustes por estresse hídrico (baseado em Crop Science 2003)
// Estresse ACELERA senescência
const WATER_STRESS_ADJUSTMENT_DAYS: Record<string, number> = {
  'NONE': 0,
  'LOW': 0,
  'MEDIUM': -2,      // 2 dias mais cedo
  'HIGH': -4,        // 4 dias mais cedo
  'CRITICAL': -7     // 7 dias mais cedo
}

const GDD_CONFIDENCE_MAP: Record<string, number> = {
  'HIGH': 90,
  'MEDIUM': 70,
  'LOW': 50
}

// ==================== Confidence Boost Functions ====================

/**
 * Calcula boost de confiança baseado em métricas de fusão NDVI
 * 
 * Referências científicas:
 * - Planet Fusion (2021): Confiança inversamente proporcional ao gap temporal
 * - MDPI Remote Sensing (2024): SAR-Optical fusion +6% acurácia
 * - arXiv 2020: 3x melhoria R² para gaps longos com SAR
 */
function calculateFusionConfidenceBoost(
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

// ==================== Main Function ====================

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

// ==================== Helper Functions ====================

function determinePhenologicalStage(
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

function getProjectionStatus(eosDate: Date | null, today: Date): string {
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

function getGddProjectionStatus(gddProgress: number, eosGdd: Date | null, today: Date): string {
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

function formatDate(date: Date | null): string {
  if (!date) return 'N/A'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
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
