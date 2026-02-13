'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Settings, 
  Loader2, 
  Save,
  MapPin,
  Route,
  Check,
  Info,
  RefreshCw,
  Cloud,
  Droplets,
  Thermometer,
  Radar,
  Database,
  BarChart3,
  Calculator,
  Clock,
  Sparkles,
  Layers,
  Eye,
  BrainCircuit,
  FolderOpen,
  ScanEye
} from 'lucide-react'

interface WorkspaceSettings {
  distanceCalculationMethod: 'straight_line' | 'road_distance'
  googleMapsApiKey?: string
}

interface FeatureFlags {
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

  // Análise Visual
  enableVisualAnalysis: boolean
}

const DEFAULT_FLAGS: FeatureFlags = {
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
  enableVisualAnalysis: false,
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reprocessing, setReprocessing] = useState(false)
  const [reprocessResult, setReprocessResult] = useState<{ fieldsProcessed: number; distancesCalculated: number } | null>(null)
  
  // Legacy settings
  const [distanceMethod, setDistanceMethod] = useState<'straight_line' | 'road_distance'>('straight_line')
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState('')
  
  // Copernicus credentials
  const [copernicusClientId, setCopernicusClientId] = useState('')
  const [copernicusClientSecret, setCopernicusClientSecret] = useState('')
  
  // Feature flags
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS)
  const [activeTab, setActiveTab] = useState<'general' | 'modules' | 'visualizations' | 'calculations' | 'automation'>('general')

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch('/api/workspace/settings')
        if (res.ok) {
          const data = await res.json()
          const settings = data.settings as WorkspaceSettings | null
          if (settings) {
            setDistanceMethod(settings.distanceCalculationMethod || 'straight_line')
            setGoogleMapsApiKey(settings.googleMapsApiKey || '')
          }
          if (data.featureFlags) {
            // Load Copernicus credentials if available
            if (data.featureFlags.copernicusClientId) {
              setCopernicusClientId(data.featureFlags.copernicusClientId)
            }
            // Note: secret is not returned for security, only indicator if set
            if (data.featureFlags.hasCopernicusSecret) {
              setCopernicusClientSecret('********')
            }
          }
          if (data.featureFlags) {
            setFlags({ ...DEFAULT_FLAGS, ...data.featureFlags })
          }
        }
      } catch (err) {
        console.error('Error fetching settings:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])
  
  const updateFlag = <K extends keyof FeatureFlags>(key: K, value: FeatureFlags[K]) => {
    setFlags(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      // Preparar feature flags com valores atuais
      const featureFlags = {
        ...flags,
        distanceCalculationMethod: distanceMethod,
        googleMapsApiKey: googleMapsApiKey || null,
        copernicusClientId: copernicusClientId || null,
        // Só enviar secret se foi alterado (não é placeholder)
        copernicusClientSecret: copernicusClientSecret && copernicusClientSecret !== '********' 
          ? copernicusClientSecret 
          : undefined
      }

      const res = await fetch('/api/workspace/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featureFlags })
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Erro ao salvar')
        return
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError('Erro ao salvar configurações')
    } finally {
      setSaving(false)
    }
  }

  const handleReprocess = async () => {
    setReprocessing(true)
    setError(null)
    setReprocessResult(null)

    try {
      const res = await fetch('/api/logistics-units/reprocess', {
        method: 'POST'
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Erro ao reprocessar')
        return
      }

      const data = await res.json()
      setReprocessResult({
        fieldsProcessed: data.fieldsProcessed,
        distancesCalculated: data.distancesCalculated
      })
    } catch (err) {
      setError('Erro ao reprocessar distâncias')
    } finally {
      setReprocessing(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    )
  }

  // Helper component for toggle
  const FeatureToggle = ({ 
    label, 
    description, 
    checked, 
    onChange, 
    icon: Icon,
    badge 
  }: { 
    label: string
    description: string
    checked: boolean
    onChange: (checked: boolean) => void
    icon?: React.ElementType
    badge?: string
  }) => (
    <label className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
      checked ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
    }`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1"
      />
      <div className="flex-1">
        <div className="flex items-center gap-2 font-medium text-slate-900">
          {Icon && <Icon className="w-4 h-4 text-blue-600" />}
          {label}
          {badge && (
            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
              {badge}
            </Badge>
          )}
        </div>
        <p className="text-sm text-slate-500 mt-1">{description}</p>
      </div>
    </label>
  )

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
          <Settings className="w-8 h-8 text-slate-600" />
          Configurações
        </h1>
        <p className="text-slate-500 mt-1">
          Configurações do workspace e funcionalidades
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg mb-6 overflow-x-auto">
        {[
          { id: 'general', label: 'Geral', icon: Settings },
          { id: 'modules', label: 'Módulos de Dados', icon: Database },
          { id: 'visualizations', label: 'Visualizações', icon: BarChart3 },
          { id: 'calculations', label: 'Cálculos', icon: Calculator },
          { id: 'automation', label: 'Automação', icon: Clock }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Geral */}
      {activeTab === 'general' && (
        <>
          {/* Cálculo de Distância */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Route className="w-5 h-5 text-blue-500" />
                Cálculo de Distância para Caixas Logísticas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600">
                Define como a distância entre talhões e caixas logísticas é calculada.
              </p>

              <div className="space-y-3">
                <label className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                  distanceMethod === 'straight_line' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                }`}>
                  <input
                    type="radio"
                    name="distanceMethod"
                    value="straight_line"
                    checked={distanceMethod === 'straight_line'}
                    onChange={() => setDistanceMethod('straight_line')}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-medium text-slate-900">
                      <MapPin className="w-4 h-4 text-green-600" />
                      Linha Reta (Haversine)
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      Calcula a distância em linha reta. Mais rápido e não requer API externa.
                    </p>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                  distanceMethod === 'road_distance' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                }`}>
                  <input
                    type="radio"
                    name="distanceMethod"
                    value="road_distance"
                    checked={distanceMethod === 'road_distance'}
                    onChange={() => setDistanceMethod('road_distance')}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-medium text-slate-900">
                      <Route className="w-4 h-4 text-orange-600" />
                      Distância Rodoviária (Google Maps)
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      Calcula a distância real pelas estradas. Requer chave de API do Google Maps.
                    </p>
                  </div>
                </label>
              </div>

              {distanceMethod === 'road_distance' && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-800">Chave de API do Google Maps</p>
                      <input
                        type="password"
                        value={googleMapsApiKey}
                        onChange={(e) => setGoogleMapsApiKey(e.target.value)}
                        placeholder="Cole sua chave de API aqui"
                        className="mt-2 w-full px-3 py-2 border border-amber-300 rounded-md text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Credenciais Copernicus */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Radar className="w-5 h-5 text-purple-500" />
                Integração Sentinel-1 (Radar)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 mb-4">
                Configure as credenciais do Copernicus Data Space para habilitar dados de radar Sentinel-1.
                O radar permite preencher gaps de NDVI causados por nuvens.
              </p>
              
              <div className="space-y-4">
                <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-purple-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-purple-800 mb-2">
                        Como obter credenciais:
                      </p>
                      <ol className="text-xs text-purple-700 list-decimal ml-4 space-y-1">
                        <li>Acesse <a href="https://dataspace.copernicus.eu" target="_blank" rel="noopener" className="underline">dataspace.copernicus.eu</a></li>
                        <li>Crie uma conta gratuita</li>
                        <li>Vá em User Settings → OAuth clients</li>
                        <li>Clique em &quot;Create&quot; e copie o Client ID e Secret</li>
                      </ol>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Client ID
                  </label>
                  <input
                    type="text"
                    value={copernicusClientId}
                    onChange={(e) => setCopernicusClientId(e.target.value)}
                    placeholder="ex: sh-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Client Secret
                  </label>
                  <input
                    type="password"
                    value={copernicusClientSecret}
                    onChange={(e) => setCopernicusClientSecret(e.target.value)}
                    placeholder={copernicusClientSecret === '********' ? 'Já configurado (deixe em branco para manter)' : 'Cole o secret aqui'}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  />
                  {copernicusClientSecret === '********' && (
                    <p className="text-xs text-slate-500 mt-1">
                      Secret já configurado. Deixe em branco para manter ou insira um novo para substituir.
                    </p>
                  )}
                </div>

                {copernicusClientId && copernicusClientSecret && (
                  <div className="flex items-center gap-2 text-emerald-600 text-sm">
                    <Check className="w-4 h-4" />
                    <span>Credenciais configuradas. Habilite &quot;Sentinel-1 Radar&quot; nos módulos para usar.</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Reprocessar Distâncias */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-green-500" />
                Reprocessar Distâncias
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 mb-4">
                Recalcula as distâncias entre todos os talhões e caixas logísticas.
              </p>
              <Button onClick={handleReprocess} disabled={reprocessing} variant="outline" className="border-green-500 text-green-600 hover:bg-green-50">
                {reprocessing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Reprocessando...</> : <><RefreshCw className="w-4 h-4 mr-2" />Reprocessar</>}
              </Button>
              {reprocessResult && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                  <Check className="w-4 h-4 inline mr-2" />
                  {reprocessResult.fieldsProcessed} talhões, {reprocessResult.distancesCalculated} distâncias.
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Tab: Módulos de Dados */}
      {activeTab === 'modules' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="w-5 h-5 text-purple-500" />
              Módulos de Dados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600 mb-4">
              Habilite ou desabilite a coleta de dados adicionais durante o processamento.
            </p>
            
            <FeatureToggle
              label="Precipitação"
              description="Coleta dados diários de precipitação para análise de condições de colheita"
              checked={flags.enablePrecipitation}
              onChange={(v) => updateFlag('enablePrecipitation', v)}
              icon={Cloud}
            />
            
            <FeatureToggle
              label="Balanço Hídrico"
              description="Calcula déficit/excedente hídrico para detectar estresse na planta"
              checked={flags.enableWaterBalance}
              onChange={(v) => updateFlag('enableWaterBalance', v)}
              icon={Droplets}
            />
            
            <FeatureToggle
              label="Radar (Sentinel-1)"
              description="Usa dados de radar para preencher gaps de NDVI causados por nuvens"
              checked={flags.enableRadarNdvi}
              onChange={(v) => updateFlag('enableRadarNdvi', v)}
              icon={Radar}
            />
            
            <FeatureToggle
              label="Soma Térmica (GDD)"
              description="Calcula graus-dia acumulados para projeção de maturação"
              checked={flags.enableThermalSum}
              onChange={(v) => updateFlag('enableThermalSum', v)}
              icon={Thermometer}
            />
            
            <FeatureToggle
              label="Dados de Solo"
              description="Coleta tipo e textura do solo para contexto"
              checked={flags.enableSoilData}
              onChange={(v) => updateFlag('enableSoilData', v)}
              icon={Layers}
            />
            
            <FeatureToggle
              label="Bandas Históricas Climáticas"
              description="Calcula envelope histórico de 5 anos para detectar anomalias"
              checked={flags.enableClimateEnvelope}
              onChange={(v) => updateFlag('enableClimateEnvelope', v)}
              icon={BarChart3}
            />
            
            <FeatureToggle
              label="Validação Visual IA"
              description="Usa agentes de IA multimodais (Gemini) para validar projeções algorítmicas com imagens de satélite"
              checked={flags.enableAIValidation}
              onChange={(v) => updateFlag('enableAIValidation', v)}
              icon={BrainCircuit}
              badge="NOVO"
            />
            
            <FeatureToggle
              label="Subtalhões"
              description="Permite subdividir talhões em subtalhões com análise individual. Cada subtalhão herda propriedades do pai."
              checked={flags.enableSubFields}
              onChange={(v) => updateFlag('enableSubFields', v)}
              icon={FolderOpen}
              badge="NOVO"
            />
            
            <FeatureToggle
              label="Análise Visual de Satélite"
              description="Módulo para navegação e comparação visual de imagens de satélite com slider antes/depois"
              checked={flags.enableVisualAnalysis}
              onChange={(v) => updateFlag('enableVisualAnalysis', v)}
              icon={ScanEye}
              badge="NOVO"
            />
            
            {flags.enableAIValidation && (
              <div className="ml-7 space-y-4 p-4 bg-violet-50 rounded-lg border border-violet-200">
                <p className="text-xs text-violet-700">
                  <strong>Pipeline IA:</strong> Dois agentes (Curador + Juiz) analisam imagens de satélite 
                  para validar datas de colheita, estágio fenológico e identificar anomalias visuais. 
                  Requer credenciais Copernicus configuradas.
                </p>
                
                <div>
                  <label className="text-sm font-medium text-slate-700">Quando executar</label>
                  <select
                    value={flags.aiValidationTrigger}
                    onChange={(e) => updateFlag('aiValidationTrigger', e.target.value as 'MANUAL' | 'ON_PROCESS' | 'ON_LOW_CONFIDENCE')}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  >
                    <option value="MANUAL">Manual (sob demanda)</option>
                    <option value="ON_PROCESS">Automático ao processar talhão</option>
                    <option value="ON_LOW_CONFIDENCE">Automático quando confiança &lt; 50%</option>
                  </select>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-slate-700">Modelo do Curador</label>
                  <select
                    value={flags.aiCuratorModel}
                    onChange={(e) => updateFlag('aiCuratorModel', e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  >
                    <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (mais rápido, menor custo)</option>
                    <option value="gemini-3-flash-preview">Gemini 3 Flash Preview (maior precisão)</option>
                  </select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Visualizações */}
      {activeTab === 'visualizations' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              Visualizações no Relatório
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600 mb-4">
              Escolha quais gráficos e informações aparecem no relatório do talhão.
            </p>
            
            <FeatureToggle
              label="Gráfico de Precipitação"
              description="Mostra barras de precipitação diária abaixo do gráfico NDVI"
              checked={flags.showPrecipitationChart}
              onChange={(v) => updateFlag('showPrecipitationChart', v)}
              icon={Cloud}
            />
            
            <FeatureToggle
              label="Gráfico de Balanço Hídrico"
              description="Mostra área de déficit/excedente hídrico"
              checked={flags.showWaterBalanceChart}
              onChange={(v) => updateFlag('showWaterBalanceChart', v)}
              icon={Droplets}
            />
            
            <FeatureToggle
              label="Overlay de NDVI Radar"
              description="Mostra linha pontilhada do NDVI estimado por radar"
              checked={flags.showRadarOverlay}
              onChange={(v) => updateFlag('showRadarOverlay', v)}
              icon={Radar}
            />
            
            <FeatureToggle
              label="Gráfico de Graus-Dia"
              description="Mostra GDD acumulado vs requerido para maturação"
              checked={flags.showGddChart}
              onChange={(v) => updateFlag('showGddChart', v)}
              icon={Thermometer}
            />
            
            <FeatureToggle
              label="Card de Informações do Solo"
              description="Mostra tipo e textura do solo no relatório"
              checked={flags.showSoilInfo}
              onChange={(v) => updateFlag('showSoilInfo', v)}
              icon={Layers}
            />
            
            <FeatureToggle
              label="Envelope Climático Histórico"
              description="Mostra bandas de média ± desvio padrão de 5 anos"
              checked={flags.showClimateEnvelope}
              onChange={(v) => updateFlag('showClimateEnvelope', v)}
              icon={BarChart3}
            />
            
            <FeatureToggle
              label="Próximas Passagens de Satélite"
              description="Mostra quando novos dados estarão disponíveis"
              checked={flags.showSatelliteSchedule}
              onChange={(v) => updateFlag('showSatelliteSchedule', v)}
              icon={Sparkles}
            />
            
            <FeatureToggle
              label="Validação Visual IA"
              description="Mostra seção de validação visual IA no relatório (concordância, alertas visuais, colheita)"
              checked={flags.showAIValidation}
              onChange={(v) => updateFlag('showAIValidation', v)}
              icon={BrainCircuit}
            />
          </CardContent>
        </Card>
      )}

      {/* Tab: Cálculos */}
      {activeTab === 'calculations' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator className="w-5 h-5 text-green-500" />
              Cálculos Avançados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600 mb-4">
              Configure quais algoritmos são usados para calcular métricas e projeções.
            </p>
            
            <FeatureToggle
              label="Usar Radar para Preencher Gaps"
              description="Quando NDVI óptico não está disponível, usa Sentinel-1 para estimar"
              checked={flags.useRadarForGaps}
              onChange={(v) => updateFlag('useRadarForGaps', v)}
              icon={Radar}
            />
            
            {flags.useRadarForGaps && (
              <div className="ml-7 space-y-2">
                <FeatureToggle
                  label="Fusão Adaptativa SAR-NDVI"
                  description="Usa modelos GPR/KNN para predizer NDVI a partir de Sentinel-1 (VV/VH). Seleciona automaticamente as melhores features e treina modelo específico por talhão."
                  checked={flags.enableSarNdviFusion}
                  onChange={(v) => {
                    updateFlag('enableSarNdviFusion', v)
                    // Se ativar fusão adaptativa, ativar calibração local automaticamente
                    if (v) updateFlag('useLocalCalibration', true)
                  }}
                  icon={Sparkles}
                  badge="BETA"
                />
                
                {flags.enableSarNdviFusion ? (
                  <div className="ml-7 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      <strong>Funcionalidade BETA:</strong> Usa técnicas avançadas de Machine Learning 
                      (GPR, KNN) para estimar NDVI a partir de dados SAR. Inclui calibração local por talhão 
                      de forma automática. Melhora precisão em períodos nublados.
                    </p>
                  </div>
                ) : (
                  <FeatureToggle
                    label="Calibração Local (Regressão Linear)"
                    description="Treina modelo RVI→NDVI por talhão. Alternativa mais simples à fusão adaptativa."
                    checked={flags.useLocalCalibration}
                    onChange={(v) => updateFlag('useLocalCalibration', v)}
                    icon={Sparkles}
                  />
                )}
              </div>
            )}
            
            <FeatureToggle
              label="Usar GDD para Projeção de EOS"
              description="Projeta data de colheita usando soma térmica ao invés de dias fixos"
              checked={flags.useGddForEos}
              onChange={(v) => updateFlag('useGddForEos', v)}
              icon={Thermometer}
            />
            
            <FeatureToggle
              label="Ajustar EOS por Balanço Hídrico"
              description="Antecipa ou atrasa EOS baseado em déficit/excedente hídrico"
              checked={flags.useWaterBalanceAdjust}
              onChange={(v) => updateFlag('useWaterBalanceAdjust', v)}
              icon={Droplets}
            />
            
            <FeatureToggle
              label="Ajustar Colheita por Precipitação"
              description="Atrasa início de colheita se houver chuva recente significativa"
              checked={flags.usePrecipitationAdjust}
              onChange={(v) => updateFlag('usePrecipitationAdjust', v)}
              icon={Cloud}
            />
          </CardContent>
        </Card>
      )}

      {/* Tab: Automação */}
      {activeTab === 'automation' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              Reprocessamento Automático
              <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                Em breve
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              Configure o reprocessamento automático de talhões quando novos dados de satélite estiverem disponíveis.
            </p>
            
            <FeatureToggle
              label="Habilitar Reprocessamento Automático"
              description="Reprocessa automaticamente quando novos dados estão disponíveis"
              checked={flags.enableAutoReprocess}
              onChange={(v) => updateFlag('enableAutoReprocess', v)}
              icon={RefreshCw}
            />
            
            {flags.enableAutoReprocess && (
              <div className="ml-7 space-y-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <label className="text-sm font-medium text-slate-700">Frequência</label>
                  <select
                    value={flags.autoReprocessFrequency}
                    onChange={(e) => updateFlag('autoReprocessFrequency', e.target.value as 'ON_NEW_DATA' | 'DAILY' | 'WEEKLY')}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  >
                    <option value="ON_NEW_DATA">Quando novos dados disponíveis</option>
                    <option value="DAILY">Diariamente (06:00)</option>
                    <option value="WEEKLY">Semanalmente (Segunda 06:00)</option>
                  </select>
                </div>
                
                <FeatureToggle
                  label="Notificar por Email"
                  description="Envia email após reprocessamento"
                  checked={flags.autoReprocessNotify}
                  onChange={(v) => updateFlag('autoReprocessNotify', v)}
                />
                
                <div>
                  <label className="text-sm font-medium text-slate-700">URL do Webhook (opcional)</label>
                  <input
                    type="text"
                    value={flags.autoReprocessWebhookUrl || ''}
                    onChange={(e) => updateFlag('autoReprocessWebhookUrl', e.target.value || null)}
                    placeholder="https://seu-servidor.com/webhook"
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Save Button */}
      <div className="flex items-center gap-3 sticky bottom-4 bg-white p-4 rounded-lg shadow-lg border">
        <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          {saving ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
          ) : saved ? (
            <><Check className="w-4 h-4 mr-2" />Salvo!</>
          ) : (
            <><Save className="w-4 h-4 mr-2" />Salvar Configurações</>
          )}
        </Button>
        {saved && <span className="text-sm text-green-600">Configurações salvas com sucesso!</span>}
      </div>
    </div>
  )
}
