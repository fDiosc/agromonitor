'use client'

import { Tractor, Leaf, Activity } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface PhenologyTimelineProps {
  plantingDate: string | null
  sosDate: string | null
  eosDate: string | null
  method: string | null
}

export function PhenologyTimeline({
  plantingDate,
  sosDate,
  eosDate,
  method
}: PhenologyTimelineProps) {
  const stages = [
    {
      label: 'Plantio Estimado',
      date: plantingDate,
      sublabel: 'Ref: SOS - 8 Dias',
      icon: <Tractor size={14} />,
      bgClass: 'bg-blue-50',
      borderClass: 'border-blue-100',
      textClass: 'text-blue-400',
      valueClass: 'text-blue-900'
    },
    {
      label: 'Emergência Detectada (SOS)',
      date: sosDate,
      sublabel: 'Monitoramento Satelital',
      icon: <Leaf size={14} />,
      bgClass: 'bg-emerald-50',
      borderClass: 'border-emerald-100',
      textClass: 'text-emerald-400',
      valueClass: 'text-emerald-900'
    },
    {
      label: 'Previsão Colheita (EOS)',
      date: eosDate,
      sublabel: `Status: ${method === 'ALGORITHM' ? 'DETECÇÃO REAL' : 'PROJEÇÃO CICLO'}`,
      icon: <Activity size={14} />,
      bgClass: 'bg-amber-50',
      borderClass: 'border-amber-100',
      textClass: 'text-amber-500',
      valueClass: 'text-amber-900'
    }
  ]

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {stages.map((stage, idx) => (
        <div
          key={idx}
          className={`${stage.bgClass} border ${stage.borderClass} p-6 rounded-[24px] shadow-inner`}
        >
          <p className={`text-[10px] font-black ${stage.textClass} uppercase tracking-widest mb-2 flex items-center gap-2`}>
            {stage.icon} {stage.label}
          </p>
          <h4 className={`text-2xl font-black ${stage.valueClass}`}>
            {stage.date ? formatDate(stage.date) : '---'}
          </h4>
          <p className={`text-[10px] ${stage.textClass} font-bold mt-2 uppercase`}>
            {stage.sublabel}
          </p>
        </div>
      ))}
    </div>
  )
}
