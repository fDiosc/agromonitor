'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  Cloud, 
  Warehouse 
} from 'lucide-react'

interface CriticalAlertsProps {
  alerts: {
    daysToFirstHarvest: number
    peakDailyVolume: number
    peakDailyVolumeTon: number
    climateRisk: 'low' | 'medium' | 'high'
    storageUtilization: number
  }
}

const climateRiskConfig = {
  low: { 
    label: 'Baixo', 
    color: 'text-green-400', 
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30'
  },
  medium: { 
    label: 'Médio', 
    color: 'text-amber-400', 
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30'
  },
  high: { 
    label: 'Alto', 
    color: 'text-red-400', 
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30'
  }
}

export function CriticalAlerts({ alerts }: CriticalAlertsProps) {
  const getTimeColor = (days: number) => {
    if (days <= 3) return 'text-red-400'
    if (days <= 7) return 'text-amber-400'
    return 'text-green-400'
  }

  const getStorageColor = (pct: number) => {
    if (pct >= 90) return 'text-red-400'
    if (pct >= 75) return 'text-amber-400'
    return 'text-green-400'
  }

  const getStorageBarColor = (pct: number) => {
    if (pct >= 90) return 'bg-red-500'
    if (pct >= 75) return 'bg-amber-500'
    return 'bg-green-500'
  }

  const climateConfig = climateRiskConfig[alerts.climateRisk]

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          Indicadores Críticos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Days to first harvest */}
          <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
            <div className="flex items-start justify-between mb-3">
              <Clock className="w-5 h-5 text-slate-500" />
              <span className={`text-2xl font-bold ${getTimeColor(alerts.daysToFirstHarvest)}`}>
                {alerts.daysToFirstHarvest > 0 ? alerts.daysToFirstHarvest : 'Agora'}
              </span>
            </div>
            <p className="text-slate-400 text-sm">Dias até 1ª Colheita</p>
            {alerts.daysToFirstHarvest <= 7 && alerts.daysToFirstHarvest > 0 && (
              <p className="text-xs text-amber-400 mt-1">
                ⚠ Prepare a estrutura de recebimento
              </p>
            )}
          </div>

          {/* Peak daily volume */}
          <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
            <div className="flex items-start justify-between mb-3">
              <TrendingUp className="w-5 h-5 text-slate-500" />
              <span className="text-2xl font-bold text-blue-400">
                {alerts.peakDailyVolumeTon.toLocaleString('pt-BR')}
              </span>
            </div>
            <p className="text-slate-400 text-sm">Pico de Recebimento (ton/dia)</p>
            {alerts.peakDailyVolumeTon > 2000 && (
              <p className="text-xs text-amber-400 mt-1">
                ⚠ Acima da capacidade padrão
              </p>
            )}
          </div>

          {/* Climate risk */}
          <div className={`p-4 rounded-lg border ${climateConfig.bgColor} ${climateConfig.borderColor}`}>
            <div className="flex items-start justify-between mb-3">
              <Cloud className="w-5 h-5 text-slate-500" />
              <span className={`text-2xl font-bold ${climateConfig.color}`}>
                {climateConfig.label}
              </span>
            </div>
            <p className="text-slate-400 text-sm">Risco Climático</p>
            {alerts.climateRisk === 'high' && (
              <p className="text-xs text-red-400 mt-1">
                ⚠ Monitorar condições de secagem
              </p>
            )}
          </div>

          {/* Storage utilization */}
          <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
            <div className="flex items-start justify-between mb-3">
              <Warehouse className="w-5 h-5 text-slate-500" />
              <span className={`text-2xl font-bold ${getStorageColor(alerts.storageUtilization)}`}>
                {alerts.storageUtilization}%
              </span>
            </div>
            <p className="text-slate-400 text-sm">Utilização do Armazém</p>
            
            {/* Progress bar */}
            <div className="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className={`h-full ${getStorageBarColor(alerts.storageUtilization)} transition-all`}
                style={{ width: `${Math.min(alerts.storageUtilization, 100)}%` }}
              />
            </div>
            
            {alerts.storageUtilization >= 80 && (
              <p className="text-xs text-amber-400 mt-1">
                ⚠ Capacidade próxima do limite
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
