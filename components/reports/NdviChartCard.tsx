'use client'

import { Card } from '@/components/ui/card'
import { TrendingUp } from 'lucide-react'
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Label
} from 'recharts'
import { formatChartDate, formatDateForChart } from '@/lib/utils/report-chart-utils'

export interface NdviChartCardProps {
  chartData: any[]
  correlationDetails: any
  agroData: any
  cycleAnalysis: { historicalCycles?: any[] } | null
  historicalNdvi: any[][]
  eosFusion: { eos: Date } | null
  harvestWindow: { startDate: string; endDate: string } | null
  featureFlags: any
  radarData: { rviTimeSeries?: any[] } | null
  isSarFusionActive: boolean
}

export function NdviChartCard({
  chartData,
  correlationDetails,
  agroData,
  cycleAnalysis,
  historicalNdvi,
  eosFusion,
  harvestWindow,
  featureFlags,
  radarData,
  isSarFusionActive
}: NdviChartCardProps) {
  return (
    <Card className="p-10 rounded-[48px]">
      <div className="flex justify-between items-end mb-10">
        <div>
          <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2 flex items-center gap-2">
            <TrendingUp size={16} /> Análise Comparativa e Projeção
          </h4>
          <p className="text-2xl font-black text-slate-900 tracking-tighter">
            Vigor (NDVI) com Histórico Alinhado
          </p>
          <div className="text-xs text-slate-400 mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {correlationDetails ? (
              <>
                <span>
                  Correlação: <span className={`font-bold ${
                    correlationDetails.compositeScore >= 70 ? 'text-emerald-600' :
                    correlationDetails.compositeScore >= 50 ? 'text-amber-600' : 'text-red-500'
                  }`}>{correlationDetails.compositeScore}%</span>
                  <span className="text-slate-300 ml-1">
                    (Pearson: {correlationDetails.pearsonScore}% | Aderência: {correlationDetails.adherenceScore}%)
                  </span>
                </span>
                <span className="text-slate-400">
                  Alinhamento: {correlationDetails.alignmentMethod === 'SOS' ? 'Fenológico' : 'Temporal'}
                </span>
                <span className="text-slate-400">
                  {correlationDetails.numPointsCompared} pontos • {correlationDetails.numHistoricalYears} anos
                </span>
              </>
            ) : agroData?.historicalCorrelation ? (
              <span>
                Aderência ao histórico: <span className="font-bold text-emerald-600">{agroData.historicalCorrelation}%</span>
              </span>
            ) : null}
            {(eosFusion || agroData?.eosDate) && (
              <span>
                Previsão colheita: <span className="font-bold text-amber-600">
                  {eosFusion
                    ? eosFusion.eos.toLocaleDateString('pt-BR')
                    : agroData?.eosDate
                      ? new Date(agroData.eosDate).toLocaleDateString('pt-BR')
                      : '---'
                }
              </span>
            </span>
            )}
          </div>
          {correlationDetails?.warnings?.length > 0 && (
            <div className="text-[10px] text-amber-500 mt-1">
              {correlationDetails.warnings.slice(0, 2).join(' • ')}
            </div>
          )}
        </div>
        <div className="flex gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500">
            <span className="w-4 h-0.5 bg-emerald-500" /> Atual
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase text-amber-500">
            <span className="w-4 h-0.5 bg-amber-500 border-dashed" style={{ borderTop: '2px dashed' }} /> Projeção
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400">
            <span className="w-4 h-0.5 bg-slate-400 border-dashed" style={{ borderTop: '2px dashed' }} /> Histórico
          </div>
        </div>
      </div>

      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <defs>
              <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="colorEnvelope" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="date"
              fontSize={11}
              tickFormatter={v => formatChartDate(v)}
              stroke="#94a3b8"
              interval="preserveStartEnd"
            />
            <YAxis domain={[0, 1]} fontSize={11} stroke="#94a3b8" />
            <Tooltip
              contentStyle={{
                borderRadius: '16px',
                border: 'none',
                boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                padding: '12px'
              }}
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = {
                  current: 'Safra Atual',
                  projection: 'Projeção',
                  h1: 'Histórico -1',
                  h2: 'Histórico -2',
                  h3: 'Histórico -3'
                }
                return [value?.toFixed(2), labels[name] || name]
              }}
            />

            {agroData?.plantingDate && (
              <ReferenceLine x={formatDateForChart(agroData.plantingDate)} stroke="#3b82f6" strokeDasharray="3 3">
                <Label value="Plantio" position="top" fill="#3b82f6" fontSize={10} fontWeight="900" dy={-10} />
              </ReferenceLine>
            )}
            {agroData?.sosDate && (
              <ReferenceLine x={formatDateForChart(agroData.sosDate)} stroke="#10b981" strokeDasharray="3 3">
                <Label value="SOS" position="top" fill="#10b981" fontSize={10} fontWeight="900" dy={-10} />
              </ReferenceLine>
            )}
            {harvestWindow && (
              <>
                <ReferenceLine x={harvestWindow.startDate} stroke="#dc2626" strokeDasharray="5 5" strokeWidth={2}>
                  <Label value="Início Colheita" position="insideTopRight" fill="#dc2626" fontSize={9} fontWeight="700" />
                </ReferenceLine>
                <ReferenceLine x={harvestWindow.endDate} stroke="#dc2626" strokeDasharray="5 5" strokeWidth={2}>
                  <Label value="Fim Colheita" position="insideTopRight" fill="#dc2626" fontSize={9} fontWeight="700" />
                </ReferenceLine>
              </>
            )}

            <Line
              type="monotone"
              dataKey="h3"
              stroke="#a3a3a3"
              strokeWidth={2}
              dot={false}
              strokeDasharray="6 3"
              name="Histórico -3"
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="h2"
              stroke="#737373"
              strokeWidth={2}
              dot={false}
              strokeDasharray="6 3"
              name="Histórico -2"
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="h1"
              stroke="#525252"
              strokeWidth={2}
              dot={false}
              strokeDasharray="6 3"
              name="Histórico -1"
              connectNulls
            />

            <Area
              type="monotone"
              dataKey="current"
              stroke="#10b981"
              strokeWidth={3}
              fill="url(#colorCurrent)"
              name="Safra Atual"
              connectNulls
            />

            <Line
              type="monotone"
              dataKey="projection"
              stroke="#f59e0b"
              strokeWidth={3}
              dot={false}
              strokeDasharray="6 4"
              name="Projeção"
              connectNulls
            />

            {featureFlags?.showRadarOverlay && (radarData?.rviTimeSeries?.length ?? 0) > 0 && !isSarFusionActive && (
              <Line
                type="monotone"
                dataKey="radarNdvi"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ fill: '#8b5cf6', r: 3 }}
                strokeDasharray="4 4"
                name="Radar (S1)"
                connectNulls
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-6 pt-6 border-t border-slate-100">
        <div className="flex flex-wrap gap-4 text-xs items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-emerald-500"></div>
            <span className="text-slate-600 font-medium">Safra Atual</span>
          </div>

          {chartData.some((d: any) => d.projection !== undefined) && (
            <div className="flex items-center gap-2">
              <div className="w-8 border-t-2 border-dashed border-amber-500"></div>
              <span className="text-amber-600 font-medium">Projeção até Colheita</span>
            </div>
          )}

          {featureFlags?.showRadarOverlay && chartData.some((d: any) => d.radarNdvi !== undefined) && !isSarFusionActive && (
            <div className="flex items-center gap-2">
              <div className="w-8 border-t-2 border-dashed border-violet-500"></div>
              <span className="text-violet-600 font-medium">Radar (Sentinel-1)</span>
            </div>
          )}

          <div className="w-px h-4 bg-slate-200"></div>

          {(cycleAnalysis?.historicalCycles?.length ?? 0) > 0 ? (
            (cycleAnalysis?.historicalCycles ?? []).map((cycle: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2">
                <div className={`w-8 border-t-2 border-dashed`} style={{
                  borderColor: idx === 0 ? '#525252' : idx === 1 ? '#737373' : '#a3a3a3'
                }}></div>
                <span className="text-slate-500">
                  {cycle.year}/{cycle.year + 1}
                  {cycle.cycleDays && <span className="text-slate-400 ml-1">({cycle.cycleDays}d)</span>}
                </span>
              </div>
            ))
          ) : historicalNdvi.length > 0 ? (
            historicalNdvi.map((_, idx: number) => {
              const year = new Date().getFullYear() - (idx + 1)
              return (
                <div key={idx} className="flex items-center gap-2">
                  <div className={`w-8 border-t-2 border-dashed`} style={{
                    borderColor: idx === 0 ? '#525252' : idx === 1 ? '#737373' : '#a3a3a3'
                  }}></div>
                  <span className="text-slate-500">
                    {year}/{year + 1}
                  </span>
                </div>
              )
            })
          ) : null}
        </div>
      </div>
    </Card>
  )
}
