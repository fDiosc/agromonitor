'use client'

import { useMemo } from 'react'
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Label
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Cloud, Droplets, AlertTriangle } from 'lucide-react'

interface PrecipitationPoint {
  date: string
  precipMm: number
}

interface PrecipitationChartProps {
  data: PrecipitationPoint[]
  totalMm: number
  avgDailyMm: number
  rainyDays: number
  harvestStart?: string
  harvestEnd?: string
  grainQualityRisk?: 'BAIXO' | 'MEDIO' | 'ALTO'
  recentPrecipMm?: number
  delayDays?: number
}

export function PrecipitationChart({
  data,
  totalMm,
  avgDailyMm,
  rainyDays,
  harvestStart,
  harvestEnd,
  grainQualityRisk,
  recentPrecipMm,
  delayDays
}: PrecipitationChartProps) {
  // Preparar dados para o gráfico
  const chartData = useMemo(() => {
    return data.map(point => ({
      date: point.date,
      precip: point.precipMm,
      // Colorir baseado na intensidade
      fill: point.precipMm > 20 ? '#3b82f6' : 
            point.precipMm > 5 ? '#60a5fa' : 
            point.precipMm > 0 ? '#93c5fd' : '#e2e8f0'
    }))
  }, [data])

  // Formatar data para exibição
  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const [year, month, day] = dateStr.split('-')
    return `${day}/${month}`
  }

  // Tooltip customizado
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const value = payload[0].value
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
          <p className="text-xs text-slate-500">{formatDate(label)}</p>
          <p className="text-sm font-bold text-blue-600">
            <Droplets className="w-3 h-3 inline mr-1" />
            {value.toFixed(1)} mm
          </p>
          {value > 20 && (
            <p className="text-xs text-amber-600 mt-1">Chuva forte</p>
          )}
        </div>
      )
    }
    return null
  }

  // Determinar cor do badge de risco
  const riskColor = grainQualityRisk === 'ALTO' ? 'bg-red-100 text-red-700 border-red-200' :
                    grainQualityRisk === 'MEDIO' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                    'bg-emerald-100 text-emerald-700 border-emerald-200'

  if (!data || data.length === 0) {
    return (
      <Card className="bg-slate-50 border-dashed">
        <CardContent className="p-6 text-center">
          <Cloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Dados de precipitação não disponíveis</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Cloud className="w-5 h-5 text-blue-500" />
            Precipitação
          </CardTitle>
          <div className="flex items-center gap-2">
            {grainQualityRisk && (
              <Badge variant="outline" className={riskColor}>
                Risco Qualidade: {grainQualityRisk}
              </Badge>
            )}
            {delayDays !== undefined && delayDays > 0 && (
              <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">
                <AlertTriangle className="w-3 h-3 mr-1" />
                +{delayDays} dias
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Estatísticas resumidas */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-[10px] font-bold text-blue-600 uppercase">Total</p>
            <p className="text-lg font-black text-blue-700">{totalMm.toFixed(0)} mm</p>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg">
            <p className="text-[10px] font-bold text-slate-600 uppercase">Média/dia</p>
            <p className="text-lg font-black text-slate-700">{avgDailyMm.toFixed(1)} mm</p>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg">
            <p className="text-[10px] font-bold text-slate-600 uppercase">Dias Chuvosos</p>
            <p className="text-lg font-black text-slate-700">{rainyDays}</p>
          </div>
          {recentPrecipMm !== undefined && (
            <div className={`p-3 rounded-lg ${recentPrecipMm > 50 ? 'bg-amber-50' : 'bg-slate-50'}`}>
              <p className="text-[10px] font-bold text-slate-600 uppercase">Últimos 10 dias</p>
              <p className={`text-lg font-black ${recentPrecipMm > 50 ? 'text-amber-700' : 'text-slate-700'}`}>
                {recentPrecipMm.toFixed(0)} mm
              </p>
            </div>
          )}
        </div>

        {/* Gráfico */}
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                interval="preserveStartEnd"
              />
              <YAxis 
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                domain={[0, 'auto']}
                label={{ 
                  value: 'mm', 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { fontSize: 10, fill: '#94a3b8' }
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Linha de referência para colheita */}
              {harvestStart && (
                <ReferenceLine 
                  x={harvestStart} 
                  stroke="#dc2626" 
                  strokeDasharray="5 5"
                  strokeWidth={2}
                >
                  <Label 
                    value="Colheita" 
                    position="top" 
                    fill="#dc2626" 
                    fontSize={10}
                  />
                </ReferenceLine>
              )}
              
              <Bar 
                dataKey="precip" 
                fill="#3b82f6"
                radius={[2, 2, 0, 0]}
                maxBarSize={8}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legenda */}
        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-600"></div>
            <span>&gt;20mm (forte)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-400"></div>
            <span>5-20mm (moderada)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-200"></div>
            <span>&lt;5mm (fraca)</span>
          </div>
        </div>

        {/* Alerta se chuva recente significativa */}
        {recentPrecipMm && recentPrecipMm > 50 && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Chuva recente significativa
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  {recentPrecipMm.toFixed(0)}mm nos últimos 10 dias pode atrasar a colheita e 
                  afetar a qualidade do grão. Monitore a umidade antes de colher.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
