/**
 * EOS Fusion Service - Types and Constants
 *
 * Baseado em metodologias científicas:
 * - PhenoCrop Framework (Diao et al., 2020) — Remote Sensing of Environment, 248
 * - GDD Model for Soybean (Mourtzinis et al., 2017) — Agric. Forest Meteorology, 239
 * - NDVI Senescence Detection (Kumudini et al., 2021) — Crop Science, 61(3)
 * - Water Stress Impact (Brevedan & Egli, 2003) — Crop Science, 43(6), 2083-2095
 */

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
export const NDVI_THRESHOLDS = {
  VEGETATIVE_MIN: 0.7,           // NDVI mínimo para considerar vegetativo
  SENESCENCE_START: 0.65,        // NDVI que indica início de senescência
  MATURITY: 0.5,                 // NDVI que indica maturidade
  DECLINE_RATE_FAST: 0.5,        // Taxa de declínio rápida (%/ponto)
  DECLINE_RATE_SLOW: 0.1         // Taxa de declínio lenta (%/ponto)
}

export const GDD_THRESHOLDS = {
  REPRODUCTIVE_START: 0.5,       // 50% do GDD = início reprodutivo
  GRAIN_FILLING_START: 0.7,      // 70% do GDD = enchimento
  SENESCENCE_START: 0.9,         // 90% do GDD = senescência
  MATURITY: 1.0                  // 100% do GDD = maturidade fisiológica
}

// Ajustes por estresse hídrico (baseado em Crop Science 2003)
// Estresse ACELERA senescência
export const WATER_STRESS_ADJUSTMENT_DAYS: Record<string, number> = {
  'NONE': 0,
  'LOW': 0,
  'MEDIUM': -2,      // 2 dias mais cedo
  'HIGH': -4,        // 4 dias mais cedo
  'CRITICAL': -7     // 7 dias mais cedo
}

export const GDD_CONFIDENCE_MAP: Record<string, number> = {
  'HIGH': 90,
  'MEDIUM': 70,
  'LOW': 50
}
