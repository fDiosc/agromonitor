'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Cloud,
  Droplets,
  Radar,
  Thermometer,
  Layers,
  BarChart3,
  BrainCircuit,
  FolderOpen,
  ScanEye,
  Database
} from 'lucide-react'
import type { FeatureFlags } from '@/lib/types/settings'
import { FeatureToggle } from './FeatureToggle'

interface ModulesSettingsTabProps {
  flags: FeatureFlags
  updateFlag: <K extends keyof FeatureFlags>(key: K, value: FeatureFlags[K]) => void
}

export function ModulesSettingsTab({ flags, updateFlag }: ModulesSettingsTabProps) {
  return (
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

        {flags.enableSubFields && (
          <div className="ml-7 space-y-3 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
            <FeatureToggle
              label="Comparação Pai vs Subtalhões"
              description="Aba no relatório do pai com tabela comparativa e gráfico NDVI sobreposto de todos os subtalhões"
              checked={flags.enableSubFieldComparison}
              onChange={(v) => updateFlag('enableSubFieldComparison', v)}
              icon={BarChart3}
            />
          </div>
        )}

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
  )
}
