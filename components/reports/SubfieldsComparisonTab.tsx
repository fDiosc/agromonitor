'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FolderOpen, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'

// Cores consistentes com SubFieldMap
const SUB_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1'
]

interface AgroDataSummary {
  volumeEstimatedKg: number | null
  confidenceScore: number | null
  peakNdvi: number | null
  sosDate: string | null
  eosDate: string | null
  cropPatternStatus: string | null
  phenologyHealth: string | null
  yieldEstimateKgHa: number | null
}

interface ComparisonField {
  id: string
  name: string
  areaHa: number | null
  cropType: string
  status: string
  agroData: AgroDataSummary | null
}

interface NdviPoint {
  date: string
  ndviSmooth: number | null
  ndviRaw: number | null
}

interface ComparisonData {
  parent: ComparisonField
  parentNdvi: NdviPoint[]
  subFields: ComparisonField[]
  subFieldsNdvi: Record<string, NdviPoint[]>
  totals: {
    totalAreaHa: number
    totalVolumeKg: number
    avgConfidence: number
    avgPeakNdvi: number
    deltaAreaHa: number
    deltaVolumeKg: number
    deltaConfidence: number
  }
}

interface SubfieldsComparisonTabProps {
  data: ComparisonData
}

export function SubfieldsComparisonTab({ data }: SubfieldsComparisonTabProps) {
  const { parent, subFields, totals } = data

  // Preparar dados do gráfico NDVI sobreposto
  const chartData = useMemo(() => {
    const dateMap: Record<string, Record<string, number | null>> = {}

    // Pai
    for (const pt of data.parentNdvi) {
      if (!dateMap[pt.date]) dateMap[pt.date] = {}
      dateMap[pt.date]['parent'] = pt.ndviSmooth ?? pt.ndviRaw
    }

    // Filhos
    for (const sf of subFields) {
      const points = data.subFieldsNdvi[sf.id] || []
      for (const pt of points) {
        if (!dateMap[pt.date]) dateMap[pt.date] = {}
        dateMap[pt.date][sf.id] = pt.ndviSmooth ?? pt.ndviRaw
      }
    }

    return Object.entries(dateMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({ date, ...values }))
  }, [data, subFields])

  return (
    <div className="space-y-6">
      {/* Tabela comparativa */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-emerald-500" />
            Comparação Pai vs Subtalhões
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Nome</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-slate-600">Área (ha)</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-slate-600">Volume (ton)</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-slate-600">Confiança</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-slate-600">NDVI Pico</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-slate-600">SOS</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-slate-600">EOS</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {/* Linha do pai */}
                <ComparisonRow
                  field={parent}
                  variant="parent"
                />

                {/* Separador */}
                <tr>
                  <td colSpan={8} className="px-4 py-1.5 bg-slate-50">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Subtalhões ({subFields.length})
                    </span>
                  </td>
                </tr>

                {/* Linhas dos filhos */}
                {subFields.map((sf, idx) => (
                  <ComparisonRow
                    key={sf.id}
                    field={sf}
                    variant="child"
                    color={SUB_COLORS[idx % SUB_COLORS.length]}
                  />
                ))}

                {/* Linha de totais */}
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                  <td className="px-4 py-2.5 text-slate-700">Σ Subtalhões</td>
                  <td className="text-right px-3 py-2.5">
                    {totals.totalAreaHa}
                    <DeltaBadge value={totals.deltaAreaHa} unit="ha" />
                  </td>
                  <td className="text-right px-3 py-2.5">
                    {(totals.totalVolumeKg / 1000).toFixed(1)}
                    <DeltaBadge value={totals.deltaVolumeKg / 1000} unit="ton" />
                  </td>
                  <td className="text-right px-3 py-2.5">
                    {totals.avgConfidence}%
                    <DeltaBadge value={totals.deltaConfidence} unit="pp" />
                  </td>
                  <td className="text-right px-3 py-2.5">{totals.avgPeakNdvi}</td>
                  <td colSpan={3} />
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico NDVI sobreposto */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Curvas NDVI — Pai vs Subtalhões</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => {
                    const [, m, day] = d.split('-')
                    return `${day}/${m}`
                  }}
                  fontSize={10}
                />
                <YAxis domain={[0, 1]} fontSize={10} />
                <Tooltip
                  labelFormatter={(d: string) => {
                    const [y, m, day] = d.split('-')
                    return `${day}/${m}/${y}`
                  }}
                  formatter={(value: number) => [value?.toFixed(3), '']}
                />
                <Legend />

                {/* Pai - linha tracejada cinza */}
                <Line
                  type="monotone"
                  dataKey="parent"
                  name={parent.name}
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="8 4"
                  dot={false}
                  connectNulls
                />

                {/* Subtalhões */}
                {subFields.map((sf, idx) => (
                  <Line
                    key={sf.id}
                    type="monotone"
                    dataKey={sf.id}
                    name={sf.name}
                    stroke={SUB_COLORS[idx % SUB_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

function ComparisonRow({
  field,
  variant,
  color,
}: {
  field: ComparisonField
  variant: 'parent' | 'child'
  color?: string
}) {
  const agro = field.agroData
  const isParent = variant === 'parent'

  const bgClass = isParent ? 'bg-blue-50/50' : 'hover:bg-slate-50'
  const nameClass = isParent ? 'font-bold text-slate-900' : 'text-slate-700'

  return (
    <tr className={`border-b ${bgClass}`}>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          {color && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />}
          <span className={nameClass}>{field.name}</span>
          {isParent && <Badge variant="outline" className="text-[9px] px-1.5">PAI</Badge>}
        </div>
      </td>
      <td className="text-right px-3 py-2.5 tabular-nums">{field.areaHa?.toFixed(1) ?? '—'}</td>
      <td className="text-right px-3 py-2.5 tabular-nums">
        {agro?.volumeEstimatedKg ? (agro.volumeEstimatedKg / 1000).toFixed(1) : '—'}
      </td>
      <td className="text-right px-3 py-2.5 tabular-nums">
        {agro?.confidenceScore != null ? `${agro.confidenceScore}%` : '—'}
      </td>
      <td className="text-right px-3 py-2.5 tabular-nums">{agro?.peakNdvi?.toFixed(2) ?? '—'}</td>
      <td className="text-center px-3 py-2.5 text-xs">
        {agro?.sosDate ? new Date(agro.sosDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—'}
      </td>
      <td className="text-center px-3 py-2.5 text-xs">
        {agro?.eosDate ? new Date(agro.eosDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—'}
      </td>
      <td className="text-center px-3 py-2.5">
        <StatusBadge status={agro?.cropPatternStatus} />
      </td>
    </tr>
  )
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-slate-300">—</span>

  const config: Record<string, { label: string; className: string }> = {
    TYPICAL: { label: 'Típico', className: 'bg-emerald-100 text-emerald-700' },
    ATYPICAL: { label: 'Atípico', className: 'bg-amber-100 text-amber-700' },
    ANOMALOUS: { label: 'Anômalo', className: 'bg-red-100 text-red-700' },
    NO_CROP: { label: 'Sem cultura', className: 'bg-slate-100 text-slate-600' },
  }
  const c = config[status] || { label: status, className: 'bg-slate-100 text-slate-600' }

  return <Badge className={`text-[9px] px-1.5 ${c.className}`}>{c.label}</Badge>
}

function DeltaBadge({ value, unit }: { value: number; unit: string }) {
  if (Math.abs(value) < 0.1) {
    return <span className="ml-1 text-[10px] text-slate-400"><Minus size={10} className="inline" /></span>
  }

  const positive = value > 0
  const Icon = positive ? TrendingUp : TrendingDown
  const colorClass = positive ? 'text-emerald-600' : 'text-red-500'
  const sign = positive ? '+' : ''

  return (
    <span className={`ml-1.5 text-[10px] font-medium ${colorClass}`}>
      <Icon size={10} className="inline mr-0.5" />
      {sign}{value.toFixed(1)} {unit}
    </span>
  )
}
