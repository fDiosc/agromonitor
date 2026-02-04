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
  Scatter
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Thermometer, Cloud, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react'

interface ClimateEnvelopePoint {
  date: string
  mean: number
  upper: number
  lower: number
  current?: number
  isAnomaly?: boolean
}

interface ClimateEnvelopeSummary {
  daysAboveNormal: number
  daysBelowNormal: number
  extremeEvents: number
  avgDeviation: number
}

interface ClimateEnvelopeChartProps {
  type: 'PRECIPITATION' | 'TEMPERATURE'
  data: ClimateEnvelopePoint[]
  summary: ClimateEnvelopeSummary
  historicalYears: number
  riskLevel?: 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO'
  explanation?: string
}

export function ClimateEnvelopeChart({
  type,
  data,
  summary,
  historicalYears,
  riskLevel = 'BAIXO',
  explanation
}: ClimateEnvelopeChartProps) {
  const isPrecip = type === 'PRECIPITATION'
  const Icon = isPrecip ? Cloud : Thermometer
  const title = isPrecip ? 'Envelope de Precipitação' : 'Envelope de Temperatura'
  const unit = isPrecip ? 'mm' : '°C'
  const primaryColor = isPrecip ? '#3b82f6' : '#f59e0b'
  const areaColor = isPrecip ? '#dbeafe' : '#fef3c7'

  // Formatar dados para o gráfico
  const chartData = useMemo(() => {
    return data.map(point => ({
      ...point,
      // Calcular área do envelope (para preenchimento)
      envelopeRange: [point.lower, point.upper]
    }))
  }, [data])

  // Determinar cor do risco
  const riskColor = {
    BAIXO: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    MEDIO: 'bg-amber-100 text-amber-700 border-amber-200',
    ALTO: 'bg-orange-100 text-orange-700 border-orange-200',
    CRITICO: 'bg-red-100 text-red-700 border-red-200'
  }[riskLevel]

  // Formatar data para exibição
  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const [year, month, day] = dateStr.split('-')
    return `${day}/${month}`
  }

  // Tooltip customizado
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const mean = payload.find((p: any) => p.dataKey === 'mean')?.value
      const upper = payload.find((p: any) => p.dataKey === 'upper')?.value
      const lower = payload.find((p: any) => p.dataKey === 'lower')?.value
      const current = payload.find((p: any) => p.dataKey === 'current')?.value
      
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
          <p className="text-xs text-slate-500 mb-2">{formatDate(label)}</p>
          <div className="space-y-1 text-sm">
            {current !== undefined && (
              <div className="flex items-center justify-between gap-4">
                <span className="font-medium text-slate-700">Atual:</span>
                <span className={`font-bold ${current > upper || current < lower ? 'text-red-600' : 'text-emerald-600'}`}>
                  {current.toFixed(1)} {unit}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500">Média hist.:</span>
              <span className="text-slate-700">{mean?.toFixed(1)} {unit}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-400 text-xs">Banda:</span>
              <span className="text-slate-500 text-xs">{lower?.toFixed(1)} - {upper?.toFixed(1)} {unit}</span>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  if (!data || data.length === 0) {
    return (
      <Card className="bg-slate-50 border-dashed">
        <CardContent className="p-6 text-center">
          <Icon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Dados históricos insuficientes</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Icon className={`w-5 h-5 ${isPrecip ? 'text-blue-500' : 'text-amber-500'}`} />
            {title}
            <span className="text-xs font-normal text-slate-400">
              ({historicalYears} anos)
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={riskColor}>
              Risco: {riskLevel}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Estatísticas resumidas */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className={`p-3 rounded-lg ${summary.daysAboveNormal > 5 ? 'bg-amber-50' : 'bg-slate-50'}`}>
            <p className="text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Acima Normal
            </p>
            <p className={`text-lg font-black ${summary.daysAboveNormal > 5 ? 'text-amber-700' : 'text-slate-700'}`}>
              {summary.daysAboveNormal} dias
            </p>
          </div>
          <div className={`p-3 rounded-lg ${summary.daysBelowNormal > 5 ? 'bg-blue-50' : 'bg-slate-50'}`}>
            <p className="text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1">
              <TrendingDown className="w-3 h-3" />
              Abaixo Normal
            </p>
            <p className={`text-lg font-black ${summary.daysBelowNormal > 5 ? 'text-blue-700' : 'text-slate-700'}`}>
              {summary.daysBelowNormal} dias
            </p>
          </div>
          <div className={`p-3 rounded-lg ${summary.extremeEvents > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
            <p className="text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Extremos
            </p>
            <p className={`text-lg font-black ${summary.extremeEvents > 0 ? 'text-red-700' : 'text-slate-700'}`}>
              {summary.extremeEvents}
            </p>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg">
            <p className="text-[10px] font-bold text-slate-600 uppercase">Desvio Médio</p>
            <p className="text-lg font-black text-slate-700">
              {Math.abs(summary.avgDeviation).toFixed(1)}σ
            </p>
          </div>
        </div>

        {/* Gráfico */}
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`envelope-${type}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={primaryColor} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={primaryColor} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                interval="preserveStartEnd"
              />
              <YAxis 
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                domain={['auto', 'auto']}
                label={{ 
                  value: unit, 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { fontSize: 10, fill: '#94a3b8' }
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Área do envelope (banda) */}
              <Area
                type="monotone"
                dataKey="upper"
                stroke="none"
                fill={`url(#envelope-${type})`}
                connectNulls
              />
              <Area
                type="monotone"
                dataKey="lower"
                stroke="none"
                fill="white"
                connectNulls
              />
              
              {/* Linha média histórica */}
              <Line 
                type="monotone" 
                dataKey="mean" 
                stroke="#94a3b8" 
                strokeWidth={2} 
                dot={false}
                strokeDasharray="4 2"
                name="Média"
                connectNulls
              />
              
              {/* Linhas de banda superior e inferior */}
              <Line 
                type="monotone" 
                dataKey="upper" 
                stroke={primaryColor} 
                strokeWidth={1} 
                dot={false}
                strokeDasharray="2 2"
                opacity={0.5}
                connectNulls
              />
              <Line 
                type="monotone" 
                dataKey="lower" 
                stroke={primaryColor} 
                strokeWidth={1} 
                dot={false}
                strokeDasharray="2 2"
                opacity={0.5}
                connectNulls
              />
              
              {/* Linha safra atual */}
              <Line 
                type="monotone" 
                dataKey="current" 
                stroke={primaryColor} 
                strokeWidth={2.5} 
                dot={false}
                name="Atual"
                connectNulls
              />
              
              {/* Pontos de anomalia */}
              <Scatter
                dataKey="current"
                fill="#dc2626"
                shape={(props: any) => {
                  if (!props.payload?.isAnomaly) return <circle cx={0} cy={0} r={0} />
                  return (
                    <circle
                      cx={props.cx}
                      cy={props.cy}
                      r={4}
                      fill="#dc2626"
                      stroke="white"
                      strokeWidth={2}
                    />
                  )
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legenda */}
        <div className="flex items-center justify-center gap-6 mt-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-6 h-3 rounded" style={{ backgroundColor: areaColor }}></div>
            <span>Banda histórica (±1.5σ)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 border-t-2 border-dashed border-slate-400"></div>
            <span>Média ({historicalYears} anos)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5" style={{ backgroundColor: primaryColor }}></div>
            <span>Safra atual</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
            <span>Anomalia</span>
          </div>
        </div>

        {/* Explicação do impacto */}
        {explanation && riskLevel !== 'BAIXO' && (
          <div className={`mt-4 p-3 rounded-lg ${
            riskLevel === 'CRITICO' ? 'bg-red-50 border border-red-200' :
            riskLevel === 'ALTO' ? 'bg-orange-50 border border-orange-200' :
            'bg-amber-50 border border-amber-200'
          }`}>
            <div className="flex items-start gap-2">
              <AlertTriangle className={`w-4 h-4 mt-0.5 ${
                riskLevel === 'CRITICO' ? 'text-red-600' :
                riskLevel === 'ALTO' ? 'text-orange-600' :
                'text-amber-600'
              }`} />
              <p className={`text-sm ${
                riskLevel === 'CRITICO' ? 'text-red-700' :
                riskLevel === 'ALTO' ? 'text-orange-700' :
                'text-amber-700'
              }`}>
                {explanation}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
