'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Radar, Thermometer, Droplets, Cloud, Sparkles, Calculator } from 'lucide-react'
import type { FeatureFlags } from '@/lib/types/settings'
import { FeatureToggle } from './FeatureToggle'

interface CalculationsSettingsTabProps {
  flags: FeatureFlags
  updateFlag: <K extends keyof FeatureFlags>(key: K, value: FeatureFlags[K]) => void
}

export function CalculationsSettingsTab({ flags, updateFlag }: CalculationsSettingsTabProps) {
  return (
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
  )
}
