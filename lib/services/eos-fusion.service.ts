/**
 * EOS Fusion Service
 * 
 * Implementa fusão de múltiplas fontes de dados para previsão de EOS (End of Season / Colheita)
 * 
 * Baseado em metodologias científicas:
 * - PhenoCrop Framework (Sakamoto et al., 2020)
 * - GDD Model for Soybean (Mourtzinis et al., 2017)
 * - NDVI Senescence Detection (Kumudini et al., 2021)
 * - Water Stress Impact (Desclaux et al., 2003)
 * 
 * Referências:
 * - NSF/USDA 2024: Fusão NDVI + GDD fornece 77% acurácia em milho, 71% em soja
 * - Threshold EOS: 40% da amplitude sazonal NDVI (MDPI Remote Sensing)
 * - Estresse hídrico acelera senescência (Crop Science 2003)
 */

// ==================== Types ====================

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
  
  // Metadados
  plantingDate: Date
  cropType: string
}

export interface EosFusionResult {
  // Resultado principal
  eos: Date                      // Data de colheita estimada
  confidence: number             // 0-100
  method: 'NDVI' | 'GDD' | 'FUSION' | 'NDVI_ADJUSTED' | 'GDD_ADJUSTED'
  
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
    // Maturação fisiológica atingida, usar EOS NDVI ou hoje
    eos = input.eosNdvi && input.eosNdvi > today ? input.eosNdvi : today
    confidence = Math.max(input.ndviConfidence, GDD_CONFIDENCE_MAP[input.gddConfidence] || 70)
    method = 'FUSION'
    explanation = 'Maturação fisiológica atingida (GDD 100%), senescência ativa confirmada por NDVI'
    factors.push('GDD: 100% - maturação fisiológica')
    factors.push(`NDVI: ${(input.currentNdvi * 100).toFixed(0)}% - em declínio`)
    factors.push(`Taxa declínio: ${input.ndviDeclineRate.toFixed(2)}%/pt`)
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
    eos = new Date(input.eosGdd.getTime() + waterAdjustment * 24 * 60 * 60 * 1000)
    confidence = GDD_CONFIDENCE_MAP[input.gddConfidence as unknown as string] || 70
    method = waterAdjustment !== 0 ? 'GDD_ADJUSTED' : 'GDD'
    explanation = 'Projeção baseada em soma térmica (GDD).'
    factors.push(`Progresso GDD: ${(gddProgress * 100).toFixed(0)}%`)
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
  
  return {
    eos,
    confidence,
    method,
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
  // Maturidade: NDVI baixo ou GDD ultrapassado
  if (currentNdvi < NDVI_THRESHOLDS.MATURITY || gddProgress > 1.1) {
    return 'MATURITY'
  }
  
  // Senescência: NDVI em declínio significativo ou GDD > 90%
  if (ndviDecline > 0.15 || gddProgress > GDD_THRESHOLDS.SENESCENCE_START) {
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
