/**
 * Climate Envelope Service
 * Calcula bandas históricas (tipo Bollinger) para precipitação e temperatura
 * para detectar anomalias climáticas e ajustar projeções
 *
 * Barrel re-export - all exports available from original path
 */

export type {
  DailyClimatePoint,
  ClimateEnvelopePoint,
  ClimateEnvelope,
  ClimateAnomaly,
  ClimateComparisonResult
} from './climate-envelope/types'

export {
  fetchHistoricalPrecipitation,
  fetchHistoricalTemperature,
  fetchHistoricalClimateData
} from './climate-envelope/api'

export {
  calculateClimateEnvelope,
  detectAnomalies,
  compareWithEnvelope,
  formatEnvelopeForChart,
  calculateClimateImpact,
  getClimateEnvelopeForField,
  serializeClimateEnvelope
} from './climate-envelope/analysis'
