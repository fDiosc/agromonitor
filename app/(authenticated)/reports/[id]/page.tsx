'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { MetricCards } from '@/components/agro/metric-cards'
import { PhenologyTimeline } from '@/components/agro/phenology-timeline'
import { TemplateSelector } from '@/components/templates/template-selector'
import { AnalysisPanel } from '@/components/templates/analysis-panel'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Loader2, TrendingUp, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

interface Template {
  id: string
  name: string
  description: string
  icon: string
  color: string
}

interface CycleAnalysis {
  currentCycle: any
  historicalCycles: any[]
  envelope: any[]
  avgCycleDays: number
  projectedEosDate: string | null
  correlationScore: number
  adherenceScore: number
}

export default function ReportPage() {
  const params = useParams()
  const fieldId = params.id as string

  const [field, setField] = useState<any>(null)
  const [historicalNdvi, setHistoricalNdvi] = useState<any[][]>([])
  const [cycleAnalysis, setCycleAnalysis] = useState<CycleAnalysis | null>(null)
  const [correlationDetails, setCorrelationDetails] = useState<any>(null)
  const [chartOverlayData, setChartOverlayData] = useState<any[]>([])
  const [harvestWindowData, setHarvestWindowData] = useState<any>(null)
  const [zarcInfo, setZarcInfo] = useState<any>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyzingTemplate, setAnalyzingTemplate] = useState<string | null>(null)
  const [isReprocessing, setIsReprocessing] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [fieldRes, templatesRes] = await Promise.all([
        fetch(`/api/fields/${fieldId}`),
        fetch('/api/templates')
      ])

      const fieldData = await fieldRes.json()
      const templatesData = await templatesRes.json()

      setField(fieldData.field)
      setHistoricalNdvi(fieldData.historicalNdvi || [])
      setCycleAnalysis(fieldData.cycleAnalysis || null)
      setCorrelationDetails(fieldData.correlationDetails || null)
      setChartOverlayData(fieldData.chartOverlayData || [])
      setHarvestWindowData(fieldData.harvestWindow || null)
      setZarcInfo(fieldData.zarcInfo || null)
      setTemplates(templatesData.templates || [])

      // Select first analyzed template or first template
      const analyzedIds = fieldData.field?.analyses?.map((a: any) => a.templateId) || []
      if (analyzedIds.length > 0) {
        setSelectedTemplate(analyzedIds[0])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }, [fieldId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleReprocess = async () => {
    if (!confirm('Reprocessar irá buscar novos dados de satélite e recalcular todas as análises. Continuar?')) return

    setIsReprocessing(true)
    
    // Iniciar processamento (fire and forget - não esperar resposta)
    // O processamento pode levar até 5 minutos
    fetch(`/api/fields/${fieldId}/process`, { method: 'POST' })
      .catch(err => console.log('Process request sent:', err.message))

    // Polling para verificar quando terminar
    const pollInterval = 10000 // 10 segundos
    const maxPolls = 36 // 6 minutos máximo
    let polls = 0

    const checkStatus = async (): Promise<void> => {
      polls++
      try {
        const res = await fetch(`/api/fields/${fieldId}`)
        if (res.ok) {
          const fieldData = await res.json()
          
          if (fieldData.status === 'SUCCESS' || fieldData.status === 'PARTIAL') {
            // Processamento concluído
            await fetchData()
            setIsReprocessing(false)
            return
          } else if (fieldData.status === 'ERROR') {
            // Processamento falhou
            alert(`Erro no processamento: ${fieldData.errorMessage || 'Erro desconhecido'}`)
            await fetchData()
            setIsReprocessing(false)
            return
          } else if (fieldData.status === 'PROCESSING' && polls < maxPolls) {
            // Ainda processando
            setTimeout(checkStatus, pollInterval)
            return
          }
        }
      } catch (error) {
        console.error('Error checking field status:', error)
      }

      // Timeout - atualizar dados de qualquer forma
      await fetchData()
      setIsReprocessing(false)
    }

    // Iniciar polling após 5 segundos
    setTimeout(checkStatus, 5000)
  }

  const handleSelectTemplate = async (templateId: string) => {
    const analyzedIds = field?.analyses?.map((a: any) => a.templateId) || []
    
    if (analyzedIds.includes(templateId)) {
      // Already analyzed, just select
      setSelectedTemplate(templateId)
      return
    }

    // Run analysis
    setIsAnalyzing(true)
    setAnalyzingTemplate(templateId)

    try {
      const res = await fetch(`/api/fields/${fieldId}/analyze/${templateId}`, {
        method: 'POST'
      })

      if (res.ok) {
        // Refresh data
        await fetchData()
        setSelectedTemplate(templateId)
      }
    } catch (error) {
      console.error('Error running analysis:', error)
    } finally {
      setIsAnalyzing(false)
      setAnalyzingTemplate(null)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-slate-400" />
      </div>
    )
  }

  if (!field) {
    return (
      <div className="p-8">
        <p className="text-slate-500">Talhão não encontrado</p>
      </div>
    )
  }

  const agroData = field.agroData
  const ndviData = field.ndviData || []
  const analyses = field.analyses || []
  const analyzedTemplates = analyses.map((a: any) => a.templateId)
  const selectedAnalysis = analyses.find((a: any) => a.templateId === selectedTemplate)
  const selectedTemplateConfig = templates.find(t => t.id === selectedTemplate)

  // Use os dados de overlay se disponíveis, senão prepare do jeito antigo
  const chartData = chartOverlayData.length > 0 
    ? chartOverlayData 
    : prepareChartData(ndviData, historicalNdvi, agroData)
  
  // Calcular informações do ciclo para exibição
  const hasHistoricalCycles = (cycleAnalysis?.historicalCycles?.length ?? 0) > 0
  const numHistoricalYears = cycleAnalysis?.historicalCycles?.length ?? 0

  // Usar dados da janela de colheita da API ou calcular localmente
  const harvestWindow = harvestWindowData || (() => {
    if (!agroData?.eosDate) return null
    
    const areaHa = agroData.areaHa || 100
    const harvestCapacityHaPerDay = 50 // Capacidade média de colheita: 50 ha/dia
    const harvestDays = Math.ceil(areaHa / harvestCapacityHaPerDay)
    
    const harvestStartDate = new Date(agroData.eosDate)
    const harvestEndDate = new Date(agroData.eosDate)
    harvestEndDate.setDate(harvestEndDate.getDate() + harvestDays)
    
    return {
      startDate: harvestStartDate.toISOString().split('T')[0],
      endDate: harvestEndDate.toISOString().split('T')[0],
      daysToHarvest: harvestDays,
      areaHa
    }
  })()

  return (
    <div className="p-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest transition-all"
          >
            <ArrowLeft size={16} /> Dashboard de Carteira
          </Link>

          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReprocess}
              disabled={isReprocessing}
              className="gap-2"
            >
              {isReprocessing ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Reprocessando...
                </>
              ) : (
                <>
                  <RefreshCw size={14} />
                  Reprocessar
                </>
              )}
            </Button>
            
            <div className="text-right">
              <h2 className="text-xl font-black text-slate-900">{field.name}</h2>
              <p className="text-xs text-slate-400">
                {field.city || 'Zona Rural'}, {field.state || '--'}
              </p>
            </div>
          </div>
        </div>

        {/* Metric Cards */}
        <MetricCards
          areaHa={agroData?.areaHa}
          volumeEstimatedKg={agroData?.volumeEstimatedKg}
          historicalCorrelation={agroData?.historicalCorrelation}
          confidenceScore={agroData?.confidenceScore}
          confidence={agroData?.confidence}
        />

        {/* Phenology Timeline - com ZARC integrado */}
        <PhenologyTimeline
          plantingDate={agroData?.plantingDate}
          sosDate={agroData?.sosDate}
          eosDate={agroData?.eosDate}
          method={agroData?.phenologyMethod}
          zarcInfo={zarcInfo}
        />

        {/* NDVI Chart */}
        {chartData.length > 0 && (
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
                  {agroData?.eosDate && (
                    <span>
                      Previsão colheita: <span className="font-bold text-amber-600">
                        {new Date(agroData.eosDate).toLocaleDateString('pt-BR')}
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

                  {/* Reference lines */}
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
                  {/* Janela de Colheita */}
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

                  {/* Historical lines - rendered FIRST (background) */}
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

                  {/* Current season - rendered after historical so it's on top */}
                  <Area
                    type="monotone"
                    dataKey="current"
                    stroke="#10b981"
                    strokeWidth={3}
                    fill="url(#colorCurrent)"
                    name="Safra Atual"
                    connectNulls
                  />

                  {/* Projection line - based on historical average (on top of everything) */}
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
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Legenda detalhada */}
            <div className="mt-6 pt-6 border-t border-slate-100">
              <div className="flex flex-wrap gap-4 text-xs items-center">
                {/* Safra Atual */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-0.5 bg-emerald-500"></div>
                  <span className="text-slate-600 font-medium">Safra Atual</span>
                </div>
                
                {/* Projeção */}
                {chartData.some((d: any) => d.projection !== undefined) && (
                  <div className="flex items-center gap-2">
                    <div className="w-8 border-t-2 border-dashed border-amber-500"></div>
                    <span className="text-amber-600 font-medium">Projeção até Colheita</span>
                  </div>
                )}
                
                {/* Separador */}
                <div className="w-px h-4 bg-slate-200"></div>
                
                {/* Anos Históricos */}
                {(cycleAnalysis?.historicalCycles?.length ?? 0) > 0 ? (
                  cycleAnalysis!.historicalCycles!.map((cycle: any, idx: number) => (
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
        )}

        {/* Template Selector */}
        <div>
          <h3 className="text-lg font-black text-slate-900 mb-4">Análises Disponíveis</h3>
          <TemplateSelector
            templates={templates}
            selectedTemplate={selectedTemplate}
            analyzedTemplates={analyzedTemplates}
            onSelect={handleSelectTemplate}
            isAnalyzing={isAnalyzing}
            analyzingTemplate={analyzingTemplate}
          />
        </div>

        {/* Selected Analysis Panel */}
        {selectedAnalysis && selectedTemplateConfig && (
          <AnalysisPanel
            analysis={selectedAnalysis}
            templateName={selectedTemplateConfig.name}
            templateIcon={selectedTemplateConfig.icon}
            templateColor={selectedTemplateConfig.color}
            fieldId={fieldId}
            onReprocessed={fetchData}
          />
        )}
    </div>
  )
}

function prepareChartData(ndviData: any[], historicalNdvi: any[][], agroData: any) {
  if (!ndviData || ndviData.length === 0) return []

  const chartData: any[] = []

  // Current season data
  ndviData.forEach((pt, idx) => {
    const entry: any = {
      date: pt.date,
      current: pt.ndviSmooth || pt.ndviInterp || pt.ndviRaw
    }

    // Add historical data
    historicalNdvi.forEach((season, i) => {
      if (season[idx]) {
        entry[`h${i + 1}`] = season[idx].ndviSmooth || season[idx].ndviInterp || season[idx].ndviRaw
      }
    })

    chartData.push(entry)
  })

  // Extend with historical projection (60 days)
  if (historicalNdvi.length > 0) {
    const lastDate = new Date(ndviData[ndviData.length - 1]?.date || new Date())
    const extensionLen = 12 // ~60 days at 5-day intervals

    for (let j = 0; j < extensionLen; j++) {
      const idx = ndviData.length + j
      const futureDate = new Date(lastDate)
      futureDate.setDate(futureDate.getDate() + (j + 1) * 5)

      const entry: any = {
        date: futureDate.toISOString().split('T')[0],
        isProjected: true
      }

      let hasData = false
      historicalNdvi.forEach((season, i) => {
        if (season[idx]) {
          entry[`h${i + 1}`] = season[idx].ndviSmooth || season[idx].ndviInterp || season[idx].ndviRaw
          hasData = true
        }
      })

      if (hasData) chartData.push(entry)
    }
  }

  return chartData
}

function formatChartDate(dateStr: string): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length < 3) return dateStr
  return `${parts[2]}/${parts[1]}`
}

function formatDateForChart(date: string | Date | null | undefined): string {
  if (!date) return ''
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return dateObj.toISOString().split('T')[0]
  } catch {
    return ''
  }
}
