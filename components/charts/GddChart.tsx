'use client'

import { useMemo } from 'react'
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Thermometer, TrendingUp, Calendar, Target } from 'lucide-react'

interface GddPoint {
  date: string
  value: number           // Temperatura média
  gdd?: number            // GDD diário
  accumulatedGdd?: number // GDD acumulado
}

interface GddChartProps {
  data: GddPoint[]
  accumulatedGdd: number
  requiredGdd: number
  progressPercent: number
  daysToMaturity: number | null
  projectedEos: string | null
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  crop: string
}

export function GddChart({
  data,
  accumulatedGdd,
  requiredGdd,
  progressPercent,
  daysToMaturity,
  projectedEos,
  confidence,
  crop
}: GddChartProps) {
  // Formatar dados para o gráfico
  const chartData = useMemo(() => {
    return data.map(point => ({
      date: point.date,
      temp: point.value,
      gdd: point.gdd || 0,
      accumulated: point.accumulatedGdd || 0
    }))
  }, [data])

  // Determinar cor do progresso
  const progressColor = progressPercent >= 80 
    ? 'text-emerald-600' 
    : progressPercent >= 50 
      ? 'text-amber-600' 
      : 'text-blue-600'

  // Cor da confiança
  const confidenceColor = {
    HIGH: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    MEDIUM: 'bg-amber-100 text-amber-700 border-amber-200',
    LOW: 'bg-slate-100 text-slate-600 border-slate-200'
  }[confidence]

  // Formatar data para exibição
  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    try {
      const [year, month, day] = dateStr.split('-')
      return `${day}/${month}`
    } catch {
      return dateStr
    }
  }

  // Formatar EOS projetado
  const formattedEos = projectedEos 
    ? new Date(projectedEos).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : 'N/A'

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Thermometer className="w-5 h-5 text-amber-500" />
            Soma Térmica (GDD)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Dados de temperatura não disponíveis.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Thermometer className="w-5 h-5 text-amber-500" />
            Soma Térmica (GDD) - {crop}
          </CardTitle>
          <Badge variant="outline" className={confidenceColor}>
            Confiança: {confidence === 'HIGH' ? 'Alta' : confidence === 'MEDIUM' ? 'Média' : 'Baixa'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Métricas principais */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="text-center p-3 bg-amber-50 rounded-lg">
            <p className="text-xs text-amber-600 font-medium">GDD Acumulado</p>
            <p className="text-xl font-bold text-amber-700">{accumulatedGdd.toFixed(0)}</p>
          </div>
          <div className="text-center p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-600 font-medium">GDD Necessário</p>
            <p className="text-xl font-bold text-slate-700">{requiredGdd}</p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-600 font-medium">Progresso</p>
            <p className={`text-xl font-bold ${progressColor}`}>{progressPercent.toFixed(0)}%</p>
          </div>
          <div className="text-center p-3 bg-emerald-50 rounded-lg">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Calendar className="w-3 h-3 text-emerald-600" />
              <p className="text-xs text-emerald-600 font-medium">EOS Projetado</p>
            </div>
            <p className="text-lg font-bold text-emerald-700">{formattedEos}</p>
            {daysToMaturity !== null && daysToMaturity > 0 && (
              <p className="text-[10px] text-emerald-500">({daysToMaturity} dias)</p>
            )}
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Plantio</span>
            <span className="flex items-center gap-1">
              <Target className="w-3 h-3" />
              Maturação
            </span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-amber-400 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, progressPercent)}%` }}
            />
          </div>
        </div>

        {/* Gráfico */}
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="gddGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.05} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                fontSize={10}
                tickFormatter={formatDate}
                stroke="#94a3b8"
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="left"
                fontSize={10}
                stroke="#94a3b8"
                label={{ value: 'GDD', angle: -90, position: 'insideLeft', fontSize: 10 }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                fontSize={10}
                stroke="#94a3b8"
                domain={[0, 'auto']}
                label={{ value: '°C', angle: 90, position: 'insideRight', fontSize: 10 }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '12px',
                  border: 'none',
                  boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)',
                  padding: '10px'
                }}
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    accumulated: 'GDD Acumulado',
                    gdd: 'GDD Diário',
                    temp: 'Temperatura'
                  }
                  const units: Record<string, string> = {
                    accumulated: '',
                    gdd: '',
                    temp: '°C'
                  }
                  return [`${value.toFixed(1)}${units[name]}`, labels[name] || name]
                }}
                labelFormatter={(label) => formatDate(label as string)}
              />

              {/* Reference line at required GDD */}
              <ReferenceLine
                yAxisId="left"
                y={requiredGdd}
                stroke="#10b981"
                strokeDasharray="5 5"
                strokeWidth={2}
                label={{ 
                  value: 'Meta GDD', 
                  position: 'insideTopRight',
                  fill: '#10b981',
                  fontSize: 10
                }}
              />

              {/* GDD acumulado (área) */}
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="accumulated"
                stroke="#f59e0b"
                strokeWidth={2}
                fill="url(#gddGradient)"
                name="GDD Acumulado"
              />

              {/* Temperatura média (linha) */}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="temp"
                stroke="#ef4444"
                strokeWidth={1.5}
                dot={false}
                name="Temperatura"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legenda */}
        <div className="flex items-center justify-center gap-6 mt-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <span>GDD Acumulado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <span>Temperatura</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0 border-t-2 border-dashed border-emerald-500" />
            <span>Meta ({requiredGdd} GDD)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
