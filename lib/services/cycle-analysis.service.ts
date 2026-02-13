/**
 * Cycle Analysis Service
 * Análise e alinhamento de ciclos fenológicos para comparação histórica
 *
 * Re-exports from cycle-analysis module for backward compatibility.
 * Import from '@/lib/services/cycle-analysis.service' continues to work.
 */

export type {
  CycleDetection,
  AlignedCyclePoint,
  AlignedCycle,
  HistoricalEnvelope,
  CycleAnalysisResult
} from './cycle-analysis/types'

export { CROP_THRESHOLDS } from './cycle-analysis/types'

export {
  detectCycle,
  alignCycleData,
  calculateEnvelope,
  calculateAdherence,
  projectEos,
  analyzeCycles
} from './cycle-analysis/detection'

export {
  prepareAlignedChartData,
  prepareHistoricalOverlayData
} from './cycle-analysis/chart-data'
