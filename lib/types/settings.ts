export interface WorkspaceSettings {
  distanceCalculationMethod: 'straight_line' | 'road_distance'
  googleMapsApiKey?: string
}

export interface FeatureFlags {
  // Módulos de dados
  enablePrecipitation: boolean
  enableWaterBalance: boolean
  enableRadarNdvi: boolean
  enableThermalSum: boolean
  enableSoilData: boolean
  enableClimateEnvelope: boolean

  // Visualizações
  showPrecipitationChart: boolean
  showWaterBalanceChart: boolean
  showRadarOverlay: boolean
  showGddChart: boolean
  showSoilInfo: boolean
  showClimateEnvelope: boolean
  showSatelliteSchedule: boolean

  // Cálculos avançados
  useRadarForGaps: boolean
  useLocalCalibration: boolean
  enableSarNdviFusion: boolean  // [BETA] Fusão adaptativa SAR-NDVI
  useGddForEos: boolean
  useWaterBalanceAdjust: boolean
  usePrecipitationAdjust: boolean

  // Validação Visual IA
  enableAIValidation: boolean
  aiValidationTrigger: 'MANUAL' | 'ON_PROCESS' | 'ON_LOW_CONFIDENCE'
  aiCuratorModel: string
  showAIValidation: boolean  // Show AI validation section in reports

  // Auto-reprocessamento
  enableAutoReprocess: boolean
  autoReprocessFrequency: 'ON_NEW_DATA' | 'DAILY' | 'WEEKLY'
  autoReprocessNotify: boolean
  autoReprocessWebhookUrl: string | null

  // Configurações gerais
  distanceCalculationMethod: 'straight_line' | 'road_distance'
  googleMapsApiKey: string | null

  // Credenciais externas
  copernicusClientId: string | null
  copernicusClientSecret: string | null

  // Subtalhões
  enableSubFields: boolean
  enableSubFieldComparison: boolean  // Aba comparativa pai vs filhos no relatório

  // Análise Visual
  enableVisualAnalysis: boolean
}

export const DEFAULT_FLAGS: FeatureFlags = {
  enablePrecipitation: true,
  enableWaterBalance: false,
  enableRadarNdvi: false,
  enableThermalSum: false,
  enableSoilData: false,
  enableClimateEnvelope: false,
  showPrecipitationChart: true,
  showWaterBalanceChart: false,
  showRadarOverlay: false,
  showGddChart: false,
  showSoilInfo: true,
  showClimateEnvelope: false,
  showSatelliteSchedule: true,
  useRadarForGaps: false,
  useLocalCalibration: false,
  enableSarNdviFusion: false,
  useGddForEos: false,
  useWaterBalanceAdjust: false,
  usePrecipitationAdjust: true,
  enableAIValidation: false,
  aiValidationTrigger: 'MANUAL',
  aiCuratorModel: 'gemini-2.5-flash-lite',
  showAIValidation: true,
  enableAutoReprocess: false,
  autoReprocessFrequency: 'ON_NEW_DATA',
  autoReprocessNotify: true,
  autoReprocessWebhookUrl: null,
  distanceCalculationMethod: 'straight_line',
  googleMapsApiKey: null,
  copernicusClientId: null,
  copernicusClientSecret: null,
  enableSubFields: false,
  enableSubFieldComparison: true,
  enableVisualAnalysis: false,
}
