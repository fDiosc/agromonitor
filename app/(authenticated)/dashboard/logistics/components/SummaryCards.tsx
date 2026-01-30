'use client'

import { Card, CardContent } from '@/components/ui/card'
import { MapPin, Truck, Wheat, Scale } from 'lucide-react'

interface SummaryCardsProps {
  summary: {
    totalFields: number
    totalAreaHa: number
    totalVolumeTon: number
    totalTrucks: number
  }
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const cards = [
    {
      title: 'Talhões Monitorados',
      value: summary.totalFields,
      unit: 'talhões',
      icon: MapPin,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10'
    },
    {
      title: 'Área Total',
      value: summary.totalAreaHa.toLocaleString('pt-BR'),
      unit: 'hectares',
      icon: Wheat,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10'
    },
    {
      title: 'Volume Estimado',
      value: summary.totalVolumeTon.toLocaleString('pt-BR'),
      unit: 'toneladas',
      icon: Scale,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10'
    },
    {
      title: 'Carretas Previstas',
      value: summary.totalTrucks.toLocaleString('pt-BR'),
      unit: 'viagens',
      icon: Truck,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10'
    }
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon
        return (
          <Card key={index} className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-slate-400 text-sm font-medium">
                    {card.title}
                  </p>
                  <p className="text-3xl font-bold text-white mt-2">
                    {card.value}
                  </p>
                  <p className="text-slate-500 text-sm mt-1">
                    {card.unit}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${card.bgColor}`}>
                  <Icon className={`w-6 h-6 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
