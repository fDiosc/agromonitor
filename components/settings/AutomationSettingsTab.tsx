'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, RefreshCw } from 'lucide-react'
import type { FeatureFlags } from '@/lib/types/settings'
import { FeatureToggle } from './FeatureToggle'

interface AutomationSettingsTabProps {
  flags: FeatureFlags
  updateFlag: <K extends keyof FeatureFlags>(key: K, value: FeatureFlags[K]) => void
}

export function AutomationSettingsTab({ flags, updateFlag }: AutomationSettingsTabProps) {
  return (
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
  )
}
