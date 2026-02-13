'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Settings,
  Loader2,
  Save,
  Check,
  Database,
  BarChart3,
  Calculator,
  Clock,
  Cloud,
  Droplets,
  Thermometer,
  Radar,
  Layers,
  Sparkles,
  BrainCircuit
} from 'lucide-react'
import { useWorkspaceSettings } from '@/hooks/useWorkspaceSettings'
import { FeatureToggle } from '@/components/settings/FeatureToggle'
import { GeneralSettingsTab } from '@/components/settings/GeneralSettingsTab'
import { ModulesSettingsTab } from '@/components/settings/ModulesSettingsTab'
import { CalculationsSettingsTab } from '@/components/settings/CalculationsSettingsTab'
import { AutomationSettingsTab } from '@/components/settings/AutomationSettingsTab'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'modules' | 'visualizations' | 'calculations' | 'automation'>('general')

  const {
    loading,
    saving,
    saved,
    error,
    reprocessing,
    reprocessResult,
    distanceMethod,
    setDistanceMethod,
    googleMapsApiKey,
    setGoogleMapsApiKey,
    copernicusClientId,
    setCopernicusClientId,
    copernicusClientSecret,
    setCopernicusClientSecret,
    flags,
    updateFlag,
    handleSave,
    handleReprocess,
  } = useWorkspaceSettings()

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    )
  }

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

      {activeTab === 'general' && (
        <GeneralSettingsTab
          distanceMethod={distanceMethod}
          setDistanceMethod={setDistanceMethod}
          googleMapsApiKey={googleMapsApiKey}
          setGoogleMapsApiKey={setGoogleMapsApiKey}
          copernicusClientId={copernicusClientId}
          setCopernicusClientId={setCopernicusClientId}
          copernicusClientSecret={copernicusClientSecret}
          setCopernicusClientSecret={setCopernicusClientSecret}
          reprocessing={reprocessing}
          reprocessResult={reprocessResult}
          onReprocess={handleReprocess}
        />
      )}

      {activeTab === 'modules' && (
        <ModulesSettingsTab flags={flags} updateFlag={updateFlag} />
      )}

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

      {activeTab === 'calculations' && (
        <CalculationsSettingsTab flags={flags} updateFlag={updateFlag} />
      )}

      {activeTab === 'automation' && (
        <AutomationSettingsTab flags={flags} updateFlag={updateFlag} />
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

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
