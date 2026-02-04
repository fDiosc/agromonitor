'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Satellite, Radar, Clock, CalendarDays, RefreshCw, CheckCircle } from 'lucide-react'

interface SatellitePass {
  date: string
  satellite: string
  daysAway: number
}

interface SatelliteScheduleCardProps {
  fieldId: string
  lastS2Date?: string | null
  nextS2Date?: string | null
  lastS1Date?: string | null
  nextS1Date?: string | null
  daysUntilNextData?: number | null
  upcomingPasses?: SatellitePass[]
  compact?: boolean
}

export function SatelliteScheduleCard({
  fieldId,
  lastS2Date,
  nextS2Date,
  lastS1Date,
  nextS1Date,
  daysUntilNextData,
  upcomingPasses = [],
  compact = false
}: SatelliteScheduleCardProps) {
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A'
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    } catch {
      return dateStr
    }
  }

  const getDaysAgo = (dateStr: string | null | undefined): string => {
    if (!dateStr) return ''
    try {
      const date = new Date(dateStr)
      const today = new Date()
      const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays === 0) return 'hoje'
      if (diffDays === 1) return 'ontem'
      return `${diffDays}d atrás`
    } catch {
      return ''
    }
  }

  const getDaysUntil = (dateStr: string | null | undefined): number => {
    if (!dateStr) return -1
    try {
      const date = new Date(dateStr)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    } catch {
      return -1
    }
  }

  const nextS2Days = getDaysUntil(nextS2Date)
  const nextS1Days = getDaysUntil(nextS1Date)

  if (compact) {
    // Versão compacta para exibição inline
    return (
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1">
          <Satellite className="w-3 h-3 text-emerald-600" />
          <span className="text-slate-500">S2:</span>
          <span className="font-medium text-slate-700">
            {nextS2Days === 0 ? 'Hoje' : nextS2Days > 0 ? `${nextS2Days}d` : 'N/A'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Radar className="w-3 h-3 text-purple-600" />
          <span className="text-slate-500">S1:</span>
          <span className="font-medium text-slate-700">
            {nextS1Days === 0 ? 'Hoje' : nextS1Days > 0 ? `${nextS1Days}d` : 'N/A'}
          </span>
        </div>
        {daysUntilNextData != null && daysUntilNextData >= 0 && (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Clock className="w-3 h-3 mr-1" />
            Próximo dado: {daysUntilNextData === 0 ? 'Hoje' : `${daysUntilNextData}d`}
          </Badge>
        )}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-blue-500" />
          Agenda de Satélites
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Status dos satélites */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Sentinel-2 */}
          <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
            <div className="flex items-center gap-2 mb-2">
              <Satellite className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-bold text-emerald-800">Sentinel-2 (NDVI)</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Último dado:</span>
                <span className="font-medium text-slate-700">
                  {formatDate(lastS2Date)}
                  {lastS2Date && (
                    <span className="text-slate-400 ml-1">({getDaysAgo(lastS2Date)})</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Próxima passagem:</span>
                <span className={`font-bold ${nextS2Days <= 1 ? 'text-emerald-600' : 'text-slate-700'}`}>
                  {formatDate(nextS2Date)}
                  {nextS2Days >= 0 && (
                    <span className="text-slate-400 ml-1">
                      ({nextS2Days === 0 ? 'hoje' : `em ${nextS2Days}d`})
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Sentinel-1 */}
          <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
            <div className="flex items-center gap-2 mb-2">
              <Radar className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-bold text-purple-800">Sentinel-1 (Radar)</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Último dado:</span>
                <span className="font-medium text-slate-700">
                  {lastS1Date ? formatDate(lastS1Date) : 'Não integrado'}
                  {lastS1Date && (
                    <span className="text-slate-400 ml-1">({getDaysAgo(lastS1Date)})</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Próxima passagem:</span>
                <span className={`font-bold ${nextS1Days <= 2 ? 'text-purple-600' : 'text-slate-700'}`}>
                  {nextS1Date ? formatDate(nextS1Date) : 'N/A'}
                  {nextS1Days >= 0 && (
                    <span className="text-slate-400 ml-1">
                      ({nextS1Days === 0 ? 'hoje' : `em ${nextS1Days}d`})
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Próximas passagens */}
        {upcomingPasses.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">
              Próximas Passagens
            </h4>
            <div className="flex flex-wrap gap-2">
              {upcomingPasses.map((pass, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className={`text-[10px] ${
                    pass.satellite.startsWith('S2') 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-purple-50 text-purple-700 border-purple-200'
                  }`}
                >
                  {pass.satellite.startsWith('S2') ? (
                    <Satellite className="w-2.5 h-2.5 mr-1" />
                  ) : (
                    <Radar className="w-2.5 h-2.5 mr-1" />
                  )}
                  {pass.date}
                  <span className="text-slate-400 ml-1">
                    ({pass.daysAway === 0 ? 'hoje' : `${pass.daysAway}d`})
                  </span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Dica de reprocessamento */}
        {daysUntilNextData != null && daysUntilNextData <= 1 && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <RefreshCw className="w-4 h-4 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-800">
                  Novos dados disponíveis em breve
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  {daysUntilNextData === 0 
                    ? 'Novos dados podem estar disponíveis. Considere reprocessar o talhão.'
                    : 'Amanhã haverá nova passagem de satélite. Os dados estarão disponíveis em 1-2 dias.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
