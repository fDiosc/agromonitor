'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, ArrowRight, TrendingUp } from 'lucide-react'
import { format, parseISO, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface HarvestTimelineProps {
  summary: {
    firstHarvestDate: string
    lastHarvestDate: string
    peakStartDate: string
    peakEndDate: string
  }
}

export function HarvestTimeline({ summary }: HarvestTimelineProps) {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A'
    try {
      return format(parseISO(dateStr), "dd 'de' MMM", { locale: ptBR })
    } catch {
      return dateStr
    }
  }

  const totalDays = summary.firstHarvestDate && summary.lastHarvestDate
    ? differenceInDays(parseISO(summary.lastHarvestDate), parseISO(summary.firstHarvestDate))
    : 0

  const daysToStart = summary.firstHarvestDate
    ? differenceInDays(parseISO(summary.firstHarvestDate), new Date())
    : 0

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-400" />
          Janela de Colheita Agregada
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
          {/* Timeline visual */}
          <div className="flex-1 relative">
            <div className="flex items-center justify-between gap-2 p-4 bg-slate-900/50 rounded-lg">
              {/* First Harvest */}
              <div className="text-center flex-1">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                  Primeira Colheita
                </p>
                <p className="text-xl font-bold text-green-400">
                  {formatDate(summary.firstHarvestDate)}
                </p>
                {daysToStart > 0 && (
                  <p className="text-xs text-slate-400 mt-1">
                    em {daysToStart} dias
                  </p>
                )}
              </div>

              <ArrowRight className="w-5 h-5 text-slate-600 flex-shrink-0" />

              {/* Peak Period */}
              <div className="text-center flex-1 px-4 py-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                  Período de Pico
                </p>
                <div className="flex items-center justify-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                  <p className="text-lg font-bold text-amber-400">
                    {formatDate(summary.peakStartDate)} - {formatDate(summary.peakEndDate)}
                  </p>
                </div>
              </div>

              <ArrowRight className="w-5 h-5 text-slate-600 flex-shrink-0" />

              {/* Last Harvest */}
              <div className="text-center flex-1">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                  Última Colheita
                </p>
                <p className="text-xl font-bold text-blue-400">
                  {formatDate(summary.lastHarvestDate)}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {totalDays} dias total
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-3 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-500 via-amber-500 to-blue-500"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
