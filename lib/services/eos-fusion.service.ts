/**
 * EOS Fusion Service - Barrel Re-export
 * Fusão de múltiplas fontes para previsão de EOS (End of Season / Colheita)
 */

export {
  calculateFusedEos,
  getConfidenceLabel,
  getMethodLabel,
  getPhenologicalStageLabel,
} from './eos-fusion/calculate'
export type {
  FusionMetrics,
  EosFusionInput,
  EosFusionResult,
} from './eos-fusion/types'
