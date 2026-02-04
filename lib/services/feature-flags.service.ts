/**
 * Feature Flags Service
 * Gerencia flags de funcionalidades por workspace
 */

import { prisma } from '@/lib/prisma'

// ==================== Types ====================

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
  useGddForEos: boolean
  useWaterBalanceAdjust: boolean
  usePrecipitationAdjust: boolean

  // Auto-reprocessamento
  enableAutoReprocess: boolean
  autoReprocessFrequency: 'ON_NEW_DATA' | 'DAILY' | 'WEEKLY'
  autoReprocessNotify: boolean
  autoReprocessWebhookUrl: string | null

  // Configurações gerais
  distanceCalculationMethod: 'straight_line' | 'road_distance'
  googleMapsApiKey: string | null

  // Credenciais externas (não retornar secrets!)
  copernicusClientId: string | null
  hasCopernicusSecret: boolean  // Indicador se secret está configurado
}

export interface FeatureFlagsUpdate {
  // Módulos de dados
  enablePrecipitation?: boolean
  enableWaterBalance?: boolean
  enableRadarNdvi?: boolean
  enableThermalSum?: boolean
  enableSoilData?: boolean
  enableClimateEnvelope?: boolean

  // Visualizações
  showPrecipitationChart?: boolean
  showWaterBalanceChart?: boolean
  showRadarOverlay?: boolean
  showGddChart?: boolean
  showSoilInfo?: boolean
  showClimateEnvelope?: boolean
  showSatelliteSchedule?: boolean

  // Cálculos avançados
  useRadarForGaps?: boolean
  useGddForEos?: boolean
  useWaterBalanceAdjust?: boolean
  usePrecipitationAdjust?: boolean

  // Auto-reprocessamento
  enableAutoReprocess?: boolean
  autoReprocessFrequency?: 'ON_NEW_DATA' | 'DAILY' | 'WEEKLY'
  autoReprocessNotify?: boolean
  autoReprocessWebhookUrl?: string | null

  // Configurações gerais
  distanceCalculationMethod?: 'straight_line' | 'road_distance'
  googleMapsApiKey?: string | null

  // Credenciais externas
  copernicusClientId?: string | null
  copernicusClientSecret?: string | null  // Secret para update (não retornado)
}

// ==================== Default Values ====================

const DEFAULT_FLAGS: FeatureFlags = {
  // Módulos de dados - conservador por padrão
  enablePrecipitation: true,
  enableWaterBalance: false,
  enableRadarNdvi: false,
  enableThermalSum: false,
  enableSoilData: false,
  enableClimateEnvelope: false,

  // Visualizações
  showPrecipitationChart: true,
  showWaterBalanceChart: false,
  showRadarOverlay: false,
  showGddChart: false,
  showSoilInfo: true,
  showClimateEnvelope: false,
  showSatelliteSchedule: true,

  // Cálculos avançados
  useRadarForGaps: false,
  useGddForEos: false,
  useWaterBalanceAdjust: false,
  usePrecipitationAdjust: true,

  // Auto-reprocessamento
  enableAutoReprocess: false,
  autoReprocessFrequency: 'ON_NEW_DATA',
  autoReprocessNotify: true,
  autoReprocessWebhookUrl: null,

  // Configurações gerais
  distanceCalculationMethod: 'straight_line',
  googleMapsApiKey: null,

  // Credenciais externas (valores padrão)
  copernicusClientId: null,
  hasCopernicusSecret: false
}

// Campos virtuais que são calculados, não salvos no banco
const VIRTUAL_FIELDS = ['hasCopernicusSecret']

// ==================== Service Functions ====================

/**
 * Filtra campos virtuais do objeto de flags para envio ao banco
 */
function filterVirtualFields(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (!VIRTUAL_FIELDS.includes(key)) {
      result[key] = value
    }
  }
  return result
}

/**
 * Obtém as feature flags de um workspace
 * Cria com valores padrão se não existir
 */
export async function getFeatureFlags(workspaceId: string): Promise<FeatureFlags> {
  let settings = await prisma.workspaceSettings.findUnique({
    where: { workspaceId }
  })

  if (!settings) {
    // Criar com valores padrão (filtrando campos virtuais)
    const dbDefaults = filterVirtualFields(DEFAULT_FLAGS)
    settings = await prisma.workspaceSettings.create({
      data: {
        workspaceId,
        ...dbDefaults
      }
    })
  }

  return {
    enablePrecipitation: settings.enablePrecipitation,
    enableWaterBalance: settings.enableWaterBalance,
    enableRadarNdvi: settings.enableRadarNdvi,
    enableThermalSum: settings.enableThermalSum,
    enableSoilData: settings.enableSoilData,
    enableClimateEnvelope: settings.enableClimateEnvelope,

    showPrecipitationChart: settings.showPrecipitationChart,
    showWaterBalanceChart: settings.showWaterBalanceChart,
    showRadarOverlay: settings.showRadarOverlay,
    showGddChart: settings.showGddChart,
    showSoilInfo: settings.showSoilInfo,
    showClimateEnvelope: settings.showClimateEnvelope,
    showSatelliteSchedule: settings.showSatelliteSchedule,

    useRadarForGaps: settings.useRadarForGaps,
    useGddForEos: settings.useGddForEos,
    useWaterBalanceAdjust: settings.useWaterBalanceAdjust,
    usePrecipitationAdjust: settings.usePrecipitationAdjust,

    enableAutoReprocess: settings.enableAutoReprocess,
    autoReprocessFrequency: settings.autoReprocessFrequency as 'ON_NEW_DATA' | 'DAILY' | 'WEEKLY',
    autoReprocessNotify: settings.autoReprocessNotify,
    autoReprocessWebhookUrl: settings.autoReprocessWebhookUrl,

    distanceCalculationMethod: settings.distanceCalculationMethod as 'straight_line' | 'road_distance',
    googleMapsApiKey: settings.googleMapsApiKey,

    // Copernicus - não retornar secret, apenas indicador
    copernicusClientId: settings.copernicusClientId,
    hasCopernicusSecret: !!settings.copernicusClientSecret
  }
}

/**
 * Atualiza as feature flags de um workspace
 */
export async function updateFeatureFlags(
  workspaceId: string,
  updates: FeatureFlagsUpdate
): Promise<FeatureFlags> {
  // Filtrar updates para remover campos undefined e campos virtuais
  const filteredUpdates: Record<string, any> = {}
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && !VIRTUAL_FIELDS.includes(key)) {
      filteredUpdates[key] = value
    }
  }

  // Filtrar DEFAULT_FLAGS para remover campos virtuais
  const dbDefaults = filterVirtualFields(DEFAULT_FLAGS)

  const settings = await prisma.workspaceSettings.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      ...dbDefaults,
      ...filteredUpdates
    },
    update: filteredUpdates
  })

  return getFeatureFlags(workspaceId)
}

/**
 * Verifica se uma feature específica está habilitada
 */
export async function isFeatureEnabled(
  workspaceId: string,
  feature: keyof FeatureFlags
): Promise<boolean> {
  const flags = await getFeatureFlags(workspaceId)
  const value = flags[feature]
  return typeof value === 'boolean' ? value : false
}

/**
 * Obtém flags para um campo específico (via workspaceId do campo)
 */
export async function getFieldFeatureFlags(fieldId: string): Promise<FeatureFlags | null> {
  const field = await prisma.field.findUnique({
    where: { id: fieldId },
    select: { workspaceId: true }
  })

  if (!field?.workspaceId) {
    return null
  }

  return getFeatureFlags(field.workspaceId)
}

/**
 * Lista todos os workspaces com uma feature habilitada
 */
export async function getWorkspacesWithFeature(
  feature: keyof FeatureFlags
): Promise<string[]> {
  const settings = await prisma.workspaceSettings.findMany({
    where: {
      [feature]: true
    },
    select: { workspaceId: true }
  })

  return settings.map(s => s.workspaceId)
}

/**
 * Obtém flags resumidas para exibição
 */
export function getFlagsStatus(flags: FeatureFlags): {
  enabledModules: string[]
  enabledVisualizations: string[]
  enabledCalculations: string[]
} {
  const enabledModules: string[] = []
  const enabledVisualizations: string[] = []
  const enabledCalculations: string[] = []

  // Módulos
  if (flags.enablePrecipitation) enabledModules.push('Precipitação')
  if (flags.enableWaterBalance) enabledModules.push('Balanço Hídrico')
  if (flags.enableRadarNdvi) enabledModules.push('Radar (Sentinel-1)')
  if (flags.enableThermalSum) enabledModules.push('Soma Térmica')
  if (flags.enableSoilData) enabledModules.push('Dados de Solo')
  if (flags.enableClimateEnvelope) enabledModules.push('Bandas Históricas')

  // Visualizações
  if (flags.showPrecipitationChart) enabledVisualizations.push('Gráfico Precipitação')
  if (flags.showWaterBalanceChart) enabledVisualizations.push('Gráfico Balanço Hídrico')
  if (flags.showRadarOverlay) enabledVisualizations.push('Overlay Radar')
  if (flags.showGddChart) enabledVisualizations.push('Gráfico GDD')
  if (flags.showSoilInfo) enabledVisualizations.push('Info Solo')
  if (flags.showClimateEnvelope) enabledVisualizations.push('Envelope Climático')
  if (flags.showSatelliteSchedule) enabledVisualizations.push('Passagens Satélite')

  // Cálculos
  if (flags.useRadarForGaps) enabledCalculations.push('Radar para Gaps')
  if (flags.useGddForEos) enabledCalculations.push('GDD para EOS')
  if (flags.useWaterBalanceAdjust) enabledCalculations.push('Ajuste Hídrico')
  if (flags.usePrecipitationAdjust) enabledCalculations.push('Ajuste Precipitação')

  return { enabledModules, enabledVisualizations, enabledCalculations }
}
