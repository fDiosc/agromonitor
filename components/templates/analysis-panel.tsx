'use client'

import { useState, useEffect, useRef } from 'react'
import { Shield, Truck, AlertTriangle, CheckCircle, AlertCircle, RefreshCw, Clock, Loader2, Sparkles, Info } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/Tooltip'

interface Analysis {
  templateId: string
  status: string
  statusLabel?: string
  statusColor?: string
  aiSummary?: string
  aiMetrics?: string
  aiRisks?: string
  aiRecommendations?: string
  // Campos de reprocessamento
  isStale?: boolean
  staleReason?: string
  reprocessStatus?: string | null  // PENDING | PROCESSING | COMPLETED | FAILED
  reprocessError?: string | null
  updatedAt?: string
}

interface AnalysisPanelProps {
  analysis: Analysis
  templateName: string
  templateIcon: string
  templateColor: string
  fieldId?: string
  onReprocessed?: () => void
}

const iconMap: Record<string, React.ReactNode> = {
  Shield: <Shield size={20} />,
  Truck: <Truck size={20} />,
  AlertTriangle: <AlertTriangle size={20} />
}

const statusColorMap: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  green: {
    bg: 'bg-emerald-500',
    text: 'text-white',
    icon: <CheckCircle size={20} />
  },
  yellow: {
    bg: 'bg-amber-500',
    text: 'text-white',
    icon: <AlertTriangle size={20} />
  },
  red: {
    bg: 'bg-red-600',
    text: 'text-white',
    icon: <AlertCircle size={20} />
  }
}

// Métricas algorítmicas (calculadas pelo sistema, sem IA)
const ALGORITHMIC_METRICS = ['harvestStart', 'harvestEnd', 'peakStart', 'peakEnd', 'dailyVolume', 'trucksNeeded', 'daysToHarvest']

// Métricas de análise qualitativa (geradas por IA ou fallback)
const AI_METRICS = ['weatherRisk', 'grainQualityRisk']

export function AnalysisPanel({
  analysis,
  templateName,
  templateIcon,
  templateColor,
  fieldId,
  onReprocessed
}: AnalysisPanelProps) {
  const [isReprocessing, setIsReprocessing] = useState(false)
  const [pollingCount, setPollingCount] = useState(0)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Polling para verificar status do reprocessamento
  useEffect(() => {
    // Se está reprocessando, iniciar polling
    if (isReprocessing && fieldId) {
      let attempts = 0
      const maxAttempts = 30 // 1 minuto com intervalo de 2s
      
      pollingIntervalRef.current = setInterval(async () => {
        attempts++
        setPollingCount(attempts)
        
        try {
          // Usar endpoint específico de status (mais leve)
          const res = await fetch(`/api/fields/${fieldId}/analyze/${analysis.templateId}/reprocess`)
          if (res.ok) {
            const data = await res.json()
            const status = data.reprocessStatus
            
            // Se completou ou falhou, parar polling e atualizar
            if (status === 'COMPLETED' || status === 'FAILED' || status === null) {
              setIsReprocessing(false)
              setPollingCount(0)
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current)
                pollingIntervalRef.current = null
              }
              // Pequeno delay para garantir que o DB atualizou
              setTimeout(() => onReprocessed?.(), 300)
              return
            }
          }
        } catch (error) {
          console.error('Polling error:', error)
        }
        
        // Limite de tentativas
        if (attempts >= maxAttempts) {
          setIsReprocessing(false)
          setPollingCount(0)
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
          onReprocessed?.()
        }
      }, 2000)
    }
    
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [isReprocessing, fieldId, analysis.templateId, onReprocessed])
  
  const statusStyle = statusColorMap[analysis.statusColor || 'yellow']
  const risks = analysis.aiRisks ? JSON.parse(analysis.aiRisks) : []
  const recommendations = analysis.aiRecommendations ? JSON.parse(analysis.aiRecommendations) : []
  const metrics = analysis.aiMetrics ? JSON.parse(analysis.aiMetrics) : {}
  
  // Separar métricas algorítmicas das geradas por IA
  const algorithmicMetrics: Record<string, any> = {}
  const aiQualitativeMetrics: Record<string, any> = {}
  
  Object.entries(metrics).forEach(([key, value]) => {
    // Ignorar campos de metadados
    if (key === 'metricsSource' || key === 'analysisSource') return
    
    if (ALGORITHMIC_METRICS.includes(key)) {
      algorithmicMetrics[key] = value
    } else if (AI_METRICS.includes(key)) {
      aiQualitativeMetrics[key] = value
    }
  })
  
  // Verificar se é análise de logística (para layout específico)
  const isLogistics = analysis.templateId === 'LOGISTICS'
  
  // Detectar fonte da análise (compatibilidade com registros antigos)
  const analysisSource: 'AI' | 'FALLBACK' = metrics.analysisSource || 
    (analysis.aiSummary?.includes('regras') || analysis.aiSummary?.includes('indisponível') 
      ? 'FALLBACK' 
      : 'AI')

  const handleReprocess = async () => {
    if (!fieldId) return
    
    setIsReprocessing(true)
    setPollingCount(0)
    
    try {
      const res = await fetch(`/api/fields/${fieldId}/analyze/${analysis.templateId}/reprocess`, {
        method: 'POST'
      })
      
      if (!res.ok) {
        setIsReprocessing(false)
        alert('Erro ao iniciar reprocessamento')
      }
      // Se ok, o polling no useEffect vai monitorar o status
    } catch (error) {
      setIsReprocessing(false)
      console.error('Erro:', error)
    }
  }

  // Explicação de como a análise qualitativa é gerada
  const getAIExplanation = () => {
    const sourceLabel = analysisSource === 'AI' 
      ? 'Gerado por modelo de linguagem (IA)' 
      : 'Gerado por regras automáticas (IA indisponível)'
    
    switch (analysis.templateId) {
      case 'LOGISTICS':
        return (
          <div className="text-left">
            <p className="font-semibold mb-1">Análise Qualitativa</p>
            <p className="text-xs mb-2 opacity-75">{sourceLabel}</p>
            <ul className="text-xs space-y-1">
              <li>• <strong>Risco Clima:</strong> Mês da colheita vs período chuvoso (Jan-Mar = Alto)</li>
              <li>• <strong>Risco Qualidade:</strong> Clima + tempo de colheita</li>
              <li>• <strong>Riscos/Recomendações:</strong> Contexto regional</li>
            </ul>
            <p className="mt-2 text-xs opacity-75">As métricas de datas e volumes são calculadas algoritmicamente.</p>
          </div>
        )
      case 'CREDIT':
        return (
          <div className="text-left">
            <p className="font-semibold mb-1">Como é calculado:</p>
            <ul className="text-xs space-y-1">
              <li>• <strong>Score:</strong> Correlação histórica + confiança fenológica</li>
              <li>• <strong>Garantia:</strong> Volume estimado × preço de mercado</li>
              <li>• <strong>Riscos:</strong> Histórico + clima + fase atual do ciclo</li>
            </ul>
            <p className="mt-2 text-xs opacity-75">Análise baseada em dados satelitais.</p>
          </div>
        )
      case 'RISK_MATRIX':
        return (
          <div className="text-left">
            <p className="font-semibold mb-1">Como é calculado:</p>
            <ul className="text-xs space-y-1">
              <li>• <strong>Risco Climático:</strong> Janela de colheita vs período chuvoso</li>
              <li>• <strong>Risco Operacional:</strong> Área, acesso, logística</li>
              <li>• <strong>Risco de Crédito:</strong> Performance histórica</li>
            </ul>
            <p className="mt-2 text-xs opacity-75">Matriz consolidada de múltiplos fatores.</p>
          </div>
        )
      default:
        return (
          <div className="text-left">
            <p>Análise gerada por modelo de linguagem (LLM) com base nos dados do talhão, histórico e indicadores fenológicos.</p>
          </div>
        )
    }
  }

  // Determinar badge de status de atualização
  const getStaleStatusBadge = () => {
    if (!analysis.isStale) {
      return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
          <CheckCircle size={12} className="mr-1" />
          Atualizado
        </Badge>
      )
    }
    
    switch (analysis.reprocessStatus) {
      case 'PENDING':
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            <Clock size={12} className="mr-1" />
            Na fila
          </Badge>
        )
      case 'PROCESSING':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Loader2 size={12} className="mr-1 animate-spin" />
            Processando
          </Badge>
        )
      case 'FAILED':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <AlertCircle size={12} className="mr-1" />
            Falhou
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            <AlertTriangle size={12} className="mr-1" />
            Desatualizado
          </Badge>
        )
    }
  }

  return (
    <Card className="p-8 rounded-[48px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl bg-${templateColor}-100 text-${templateColor}-600`}>
            {iconMap[templateIcon] || <Shield size={20} />}
          </div>
          <h4 className="text-sm font-black uppercase text-slate-400 tracking-widest">
            {templateName}
          </h4>
          {/* Badge de status de atualização */}
          {getStaleStatusBadge()}
        </div>

        <div className="flex items-center gap-3">
          {/* Botão de reprocessar manual (se falhou ou está stale) */}
          {(analysis.reprocessStatus === 'FAILED' || (analysis.isStale && !analysis.reprocessStatus)) && fieldId && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReprocess}
              disabled={isReprocessing}
              className="text-xs"
            >
              {isReprocessing ? (
                <Loader2 size={14} className="mr-1 animate-spin" />
              ) : (
                <RefreshCw size={14} className="mr-1" />
              )}
              Reprocessar
            </Button>
          )}
          
          <div className={`px-6 py-2.5 rounded-2xl ${statusStyle.bg} ${statusStyle.text} font-black text-xs flex items-center gap-2 shadow-xl`}>
            {statusStyle.icon}
            {analysis.statusLabel || analysis.status}
          </div>
        </div>
      </div>
      
      {/* Mensagem de erro de reprocessamento */}
      {analysis.reprocessStatus === 'FAILED' && analysis.reprocessError && (
        <div className="mb-6 p-4 bg-red-50 rounded-xl border border-red-200">
          <p className="text-sm text-red-700">
            <strong>Erro no reprocessamento:</strong> {analysis.reprocessError}
          </p>
        </div>
      )}

      {/* SEÇÃO 1: Métricas Algorítmicas (sem badge IA) */}
      {isLogistics && Object.keys(algorithmicMetrics).length > 0 && (
        <div className="mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(algorithmicMetrics).map(([key, value]) => {
              const explanation = getMetricExplanation(key)
              return (
                <div key={key} className="bg-slate-50 p-4 rounded-xl">
                  <div className="flex items-center gap-1 mb-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      {formatMetricLabel(key)}
                    </p>
                    {explanation && (
                      <Tooltip content={<span className="text-xs">{explanation}</span>}>
                        <Info size={12} className="text-slate-400 cursor-help" />
                      </Tooltip>
                    )}
                  </div>
                  <p className="text-lg font-black text-slate-700">
                    {formatMetricValue(value)}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Métricas para outros templates (layout original) */}
      {!isLogistics && Object.keys(metrics).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {Object.entries(metrics).filter(([key]) => key !== 'metricsSource' && key !== 'analysisSource').map(([key, value]) => (
            <div key={key} className="bg-slate-50 p-4 rounded-xl">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                {formatMetricLabel(key)}
              </p>
              <p className="text-lg font-black text-slate-700">
                {formatMetricValue(value)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* SEÇÃO 2: Análise Qualitativa (com badge IA) */}
      {isLogistics && (
        <div className="mb-8 p-6 bg-purple-50/30 rounded-[24px] border border-purple-100">
          {/* Header da seção IA */}
          <div className="flex items-center gap-2 mb-4">
            <Tooltip content={getAIExplanation()}>
              <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200 cursor-help">
                <Sparkles size={12} className="mr-1" />
                {analysisSource === 'AI' ? 'Análise por IA' : 'Análise por Regras'}
              </Badge>
            </Tooltip>
          </div>
          
          {/* Summary */}
          {analysis.aiSummary && (
            <p className="text-slate-700 font-medium leading-relaxed mb-4 italic">
              &ldquo;{analysis.aiSummary}&rdquo;
            </p>
          )}
          
          {/* Métricas qualitativas */}
          {Object.keys(aiQualitativeMetrics).length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(aiQualitativeMetrics).map(([key, value]) => {
                const explanation = getMetricExplanation(key)
                return (
                  <div key={key} className="bg-white p-4 rounded-xl border border-purple-100">
                    <div className="flex items-center gap-1 mb-1">
                      <p className="text-[10px] font-bold text-purple-400 uppercase">
                        {formatMetricLabel(key)}
                      </p>
                      {explanation && (
                        <Tooltip content={<span className="text-xs">{explanation}</span>}>
                          <Info size={12} className="text-purple-400 cursor-help" />
                        </Tooltip>
                      )}
                    </div>
                    <p className={`text-lg font-black ${
                      value === 'ALTO' ? 'text-red-600' : 
                      value === 'MEDIO' ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                      {formatMetricValue(value)}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Summary para outros templates */}
      {!isLogistics && analysis.aiSummary && (
        <p className="text-slate-700 font-medium leading-relaxed text-lg mb-8 bg-slate-50 p-6 rounded-[24px] border border-slate-100 shadow-inner italic">
          &ldquo;{analysis.aiSummary}&rdquo;
        </p>
      )}

      {/* Risks and Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Risks */}
        <div className="bg-red-50/50 p-6 rounded-[24px] border border-red-100">
          <h5 className="text-[10px] font-black uppercase text-red-500 tracking-widest mb-4 flex items-center gap-2">
            <AlertTriangle size={16} /> Riscos Identificados
          </h5>
          <ul className="space-y-2">
            {risks.length > 0 ? (
              risks.map((risk: string, i: number) => (
                <li
                  key={i}
                  className="text-xs font-bold text-red-700 flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm border border-red-100/50"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  {risk}
                </li>
              ))
            ) : (
              <li className="text-xs text-red-400 italic">Nenhum risco identificado</li>
            )}
          </ul>
        </div>

        {/* Recommendations */}
        <div className="bg-emerald-50/50 p-6 rounded-[24px] border border-emerald-100">
          <h5 className="text-[10px] font-black uppercase text-emerald-600 tracking-widest mb-4 flex items-center gap-2">
            <CheckCircle size={16} /> Recomendações
          </h5>
          <ul className="space-y-2">
            {recommendations.length > 0 ? (
              recommendations.map((rec: string, i: number) => (
                <li
                  key={i}
                  className="text-xs font-bold text-emerald-800 flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm border border-emerald-100/50"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  {rec}
                </li>
              ))
            ) : (
              <li className="text-xs text-emerald-400 italic">Sem recomendações no momento</li>
            )}
          </ul>
        </div>
      </div>
    </Card>
  )
}

function formatMetricLabel(key: string): string {
  const labels: Record<string, string> = {
    washoutRisk: 'Risco Washout',
    guaranteeHealth: 'Saúde Garantia',
    deliveryProbability: 'Prob. Entrega',
    cprAdherence: 'Aderência CPR',
    harvestStart: 'Início Colheita',
    harvestEnd: 'Fim Colheita',
    dailyVolume: 'Volume Diário',
    peakStart: 'Início Pico',
    peakEnd: 'Fim Pico',
    weatherRisk: 'Risco Clima',
    grainQualityRisk: 'Risco Qualidade',
    trucksNeeded: 'Carretas',
    daysToHarvest: 'Dias p/ Colheita',
    overallScore: 'Score Geral',
    climaticRisk: 'Risco Climático',
    phenologicalRisk: 'Risco Fenológico',
    operationalRisk: 'Risco Operacional',
    commercialRisk: 'Risco Comercial',
    trend: 'Tendência'
  }
  return labels[key] || key
}

function getMetricExplanation(key: string): string {
  const explanations: Record<string, string> = {
    harvestStart: 'EOS - 5 dias (preparação para colheita)',
    harvestEnd: 'Início + duração baseada na área',
    peakStart: 'Início da colheita + 2 dias',
    peakEnd: 'Fim da colheita - 2 dias',
    dailyVolume: '(Volume total ÷ Área) × 80 ha/dia',
    trucksNeeded: 'Volume total ÷ 35 ton por carreta',
    daysToHarvest: 'max(5, área ÷ 80 × 2) dias',
    weatherRisk: 'Período da colheita vs estação chuvosa',
    grainQualityRisk: 'Clima + área + duração da colheita'
  }
  return explanations[key] || ''
}

function formatMetricValue(value: any): string {
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (typeof value === 'number') {
    if (value > 1000) return `${(value / 1000).toFixed(0)}k`
    return String(value)
  }
  if (typeof value === 'string') {
    // Format dates
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-')
      return `${d}/${m}`
    }
    // Translate common values
    const translations: Record<string, string> = {
      BAIXO: 'Baixo',
      MEDIO: 'Médio',
      ALTO: 'Alto',
      CRITICO: 'Crítico',
      IMPROVING: '↑ Melhorando',
      STABLE: '→ Estável',
      WORSENING: '↓ Piorando'
    }
    return translations[value] || value
  }
  return String(value)
}
