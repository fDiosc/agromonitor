'use client'

import { Layers, Package, Activity, Target } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { formatNumber, formatPercentage, formatTons } from '@/lib/utils'

interface MetricCardsProps {
  areaHa: number | null
  volumeEstimatedKg: number | null
  historicalCorrelation: number | null
  confidenceScore: number | null
  confidence: string | null
}

export function MetricCards({
  areaHa,
  volumeEstimatedKg,
  historicalCorrelation,
  confidenceScore,
  confidence
}: MetricCardsProps) {
  const metrics = [
    {
      label: 'Área Processada',
      value: areaHa ? `${formatNumber(areaHa)} ha` : '---',
      sublabel: 'Geometria Validada',
      icon: <Layers size={12} />,
      color: 'slate'
    },
    {
      label: 'Volume Estimado (5t/ha)',
      value: volumeEstimatedKg ? formatTons(volumeEstimatedKg) : '---',
      sublabel: 'Produto Disponível',
      icon: <Package size={12} />,
      color: 'emerald'
    },
    {
      label: 'Aderência Histórica',
      value: historicalCorrelation ? formatPercentage(historicalCorrelation) : '---',
      sublabel: 'Probabilidade Seguimento',
      icon: <Activity size={12} />,
      color: 'indigo'
    },
    {
      label: 'Confiança Modelo',
      value: confidenceScore ? formatPercentage(confidenceScore) : '---',
      sublabel: confidence ? `${confidence} PRECISÃO` : '---',
      icon: <Target size={12} />,
      color: 'blue'
    }
  ]

  const colorClasses: Record<string, { text: string; bg: string; bgLight: string }> = {
    slate: { text: 'text-slate-800', bg: 'bg-slate-50', bgLight: 'bg-slate-50' },
    emerald: { text: 'text-emerald-600', bg: 'bg-emerald-50', bgLight: 'bg-emerald-50' },
    indigo: { text: 'text-indigo-600', bg: 'bg-indigo-50', bgLight: 'bg-indigo-50' },
    blue: { text: 'text-blue-600', bg: 'bg-blue-50', bgLight: 'bg-blue-50' }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {metrics.map((metric, idx) => {
        const colors = colorClasses[metric.color]
        return (
          <Card key={idx} className="p-6 hover:shadow-md transition-all">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {metric.label}
            </span>
            <h3 className={`text-3xl font-black mt-2 ${colors.text}`}>
              {metric.value}
            </h3>
            <span className={`text-[9px] font-bold ${colors.text} opacity-60 flex items-center gap-1 ${colors.bgLight} w-fit px-2 py-0.5 rounded-full mt-2`}>
              {metric.icon} {metric.sublabel}
            </span>
          </Card>
        )
      })}
    </div>
  )
}
