'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp } from 'lucide-react'
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface ReceiptCurveProps {
  dailyForecast: {
    date: string
    volumeKg: number
    cumulativeKg: number
    fieldsHarvesting: number
  }[]
}

// Storage capacity in kg (50,000 tons)
const STORAGE_CAPACITY_KG = 50000 * 1000
const DAILY_RECEIVING_CAPACITY_KG = 2000 * 1000 // 2,000 tons/day

export function ReceiptCurve({ dailyForecast }: ReceiptCurveProps) {
  if (dailyForecast.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-6 text-center text-slate-400">
          Sem dados de previsão disponíveis
        </CardContent>
      </Card>
    )
  }

  // Transform data for chart (convert to tons)
  const chartData = dailyForecast.map(d => ({
    date: d.date,
    dateFormatted: format(parseISO(d.date), 'dd/MM', { locale: ptBR }),
    volumeTon: Math.round(d.volumeKg / 1000),
    cumulativeTon: Math.round(d.cumulativeKg / 1000),
    fieldsHarvesting: d.fieldsHarvesting,
    capacity: Math.round(DAILY_RECEIVING_CAPACITY_KG / 1000)
  }))

  // Find peak
  const peakDay = chartData.reduce((max, d) => 
    d.volumeTon > max.volumeTon ? d : max, chartData[0]
  )

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg">
          <p className="text-white font-medium mb-2">
            {format(parseISO(data.date), "dd 'de' MMMM", { locale: ptBR })}
          </p>
          <div className="space-y-1 text-sm">
            <p className="text-blue-400">
              Volume Diário: <span className="font-bold">{data.volumeTon.toLocaleString('pt-BR')} ton</span>
            </p>
            <p className="text-green-400">
              Acumulado: <span className="font-bold">{data.cumulativeTon.toLocaleString('pt-BR')} ton</span>
            </p>
            <p className="text-slate-400">
              Talhões Colhendo: <span className="font-bold">{data.fieldsHarvesting}</span>
            </p>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-400" />
          Curva de Recebimento Previsto
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <defs>
                <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              
              <XAxis 
                dataKey="dateFormatted" 
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                interval="preserveStartEnd"
              />
              
              <YAxis 
                yAxisId="left"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                label={{ 
                  value: 'Volume Diário (ton)', 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { fill: '#94a3b8', fontSize: 12 }
                }}
              />
              
              <YAxis 
                yAxisId="right"
                orientation="right"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                label={{ 
                  value: 'Acumulado (ton)', 
                  angle: 90, 
                  position: 'insideRight',
                  style: { fill: '#94a3b8', fontSize: 12 }
                }}
              />
              
              <Tooltip content={<CustomTooltip />} />
              
              <Legend 
                wrapperStyle={{ paddingTop: 20 }}
                formatter={(value) => <span className="text-slate-300">{value}</span>}
              />

              {/* Capacity line */}
              <ReferenceLine 
                yAxisId="left"
                y={DAILY_RECEIVING_CAPACITY_KG / 1000} 
                stroke="#ef4444" 
                strokeDasharray="5 5"
                label={{ 
                  value: 'Capacidade Diária', 
                  fill: '#ef4444', 
                  fontSize: 11,
                  position: 'top'
                }}
              />

              {/* Peak line */}
              <ReferenceLine 
                yAxisId="left"
                x={peakDay.dateFormatted} 
                stroke="#f59e0b" 
                strokeDasharray="3 3"
                label={{ 
                  value: 'Pico', 
                  fill: '#f59e0b', 
                  fontSize: 11,
                  position: 'top'
                }}
              />

              {/* Volume area (bell curve effect) */}
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="volumeTon"
                name="Volume Diário"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#volumeGradient)"
              />

              {/* Cumulative line */}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulativeTon"
                name="Acumulado"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legend info */}
        <div className="flex flex-wrap items-center justify-center gap-6 mt-4 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-red-500" style={{ borderStyle: 'dashed' }} />
            <span>Capacidade de Recebimento: 2.000 ton/dia</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-amber-500" />
            <span>Pico: {peakDay.volumeTon.toLocaleString('pt-BR')} ton/dia</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
