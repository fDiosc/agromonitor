'use client'

import { useMemo } from 'react'
import {
  ComposedChart,
  Area,
  Bar,
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
import { Droplets, AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react'

interface WaterBalancePoint {
  date: string
  deficit: number
  excess: number
  balance: number
  soilMoisture?: number
}

interface WaterBalanceChartProps {
  data: WaterBalancePoint[]
  totalDeficit: number
  totalExcess: number
  stressDays: number
  excessDays: number
  stressLevel?: 'BAIXO' | 'MODERADO' | 'SEVERO' | 'CRITICO'
  yieldImpact?: number
  adjustmentReason?: string
}

export function WaterBalanceChart({
  data,
  totalDeficit,
  totalExcess,
  stressDays,
  excessDays,
  stressLevel = 'BAIXO',
  yieldImpact = 1.0,
  adjustmentReason
}: WaterBalanceChartProps) {
  // Formatar dados para o gráfico
  const chartData = useMemo(() => {
    return data.map(point => ({
      date: point.date,
      deficit: -point.deficit, // Negativo para mostrar abaixo do eixo
      excess: point.excess,
      balance: point.balance,
      soilMoisture: point.soilMoisture
    }))
  }, [data])

  // Determinar cor do stress level
  const stressColor = {
    BAIXO: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    MODERADO: 'bg-amber-100 text-amber-700 border-amber-200',
    SEVERO: 'bg-orange-100 text-orange-700 border-orange-200',
    CRITICO: 'bg-red-100 text-red-700 border-red-200'
  }[stressLevel]

  const stressIcon = stressLevel === 'BAIXO' || stressLevel === 'MODERADO' 
    ? <TrendingUp className="w-3 h-3" />
    : <TrendingDown className="w-3 h-3" />

  // Formatar data para exibição
  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const [year, month, day] = dateStr.split('-')
    return `${day}/${month}`
  }

  // Calcular impacto em porcentagem
  const yieldLossPercent = ((1 - yieldImpact) * 100).toFixed(0)

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Droplets className="w-5 h-5 text-cyan-500" />
            Balanço Hídrico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Dados de balanço hídrico não disponíveis.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Droplets className="w-5 h-5 text-cyan-500" />
            Balanço Hídrico
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={stressColor}>
              {stressIcon}
              <span className="ml-1">{stressLevel}</span>
            </Badge>
            {yieldImpact < 1 && (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                <AlertTriangle className="w-3 h-3 mr-1" />
                -{yieldLossPercent}% prod.
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Métricas resumidas */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="text-center p-2 bg-red-50 rounded-lg">
            <p className="text-xs text-red-600 font-medium">Déficit Total</p>
            <p className="text-lg font-bold text-red-700">{totalDeficit.toFixed(0)} mm</p>
          </div>
          <div className="text-center p-2 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-600 font-medium">Excedente Total</p>
            <p className="text-lg font-bold text-blue-700">{totalExcess.toFixed(0)} mm</p>
          </div>
          <div className="text-center p-2 bg-orange-50 rounded-lg">
            <p className="text-xs text-orange-600 font-medium">Dias Estresse</p>
            <p className="text-lg font-bold text-orange-700">{stressDays}</p>
          </div>
          <div className="text-center p-2 bg-cyan-50 rounded-lg">
            <p className="text-xs text-cyan-600 font-medium">Dias Excesso</p>
            <p className="text-lg font-bold text-cyan-700">{excessDays}</p>
          </div>
        </div>

        {/* Alerta se houver impacto */}
        {adjustmentReason && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800">{adjustmentReason}</p>
          </div>
        )}

        {/* Gráfico */}
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="deficitGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fecaca" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.3} />
                </linearGradient>
                <linearGradient id="excessGradient" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#bfdbfe" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.3} />
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
                fontSize={10}
                stroke="#94a3b8"
                tickFormatter={(v) => `${Math.abs(v)}`}
                label={{ value: 'mm', angle: -90, position: 'insideLeft', fontSize: 10 }}
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
                    deficit: 'Déficit',
                    excess: 'Excedente',
                    balance: 'Balanço'
                  }
                  return [`${Math.abs(value).toFixed(1)} mm`, labels[name] || name]
                }}
                labelFormatter={(label) => formatDate(label as string)}
              />

              {/* Reference line at 0 */}
              <ReferenceLine y={0} stroke="#64748b" strokeWidth={1} />

              {/* Deficit area (below 0) */}
              <Area
                type="monotone"
                dataKey="deficit"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#deficitGradient)"
                name="Déficit"
              />

              {/* Excess area (above 0) */}
              <Area
                type="monotone"
                dataKey="excess"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#excessGradient)"
                name="Excedente"
              />

              {/* Balance line */}
              <Line
                type="monotone"
                dataKey="balance"
                stroke="#06b6d4"
                strokeWidth={2}
                dot={false}
                name="Balanço"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legenda */}
        <div className="flex items-center justify-center gap-6 mt-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <span>Déficit Hídrico</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-400" />
            <span>Excedente Hídrico</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-cyan-400" />
            <span>Balanço</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
