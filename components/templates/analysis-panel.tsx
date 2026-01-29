'use client'

import { Shield, Truck, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Analysis {
  templateId: string
  status: string
  statusLabel?: string
  statusColor?: string
  aiSummary?: string
  aiMetrics?: string
  aiRisks?: string
  aiRecommendations?: string
}

interface AnalysisPanelProps {
  analysis: Analysis
  templateName: string
  templateIcon: string
  templateColor: string
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

export function AnalysisPanel({
  analysis,
  templateName,
  templateIcon,
  templateColor
}: AnalysisPanelProps) {
  const statusStyle = statusColorMap[analysis.statusColor || 'yellow']
  const risks = analysis.aiRisks ? JSON.parse(analysis.aiRisks) : []
  const recommendations = analysis.aiRecommendations ? JSON.parse(analysis.aiRecommendations) : []
  const metrics = analysis.aiMetrics ? JSON.parse(analysis.aiMetrics) : {}

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
        </div>

        <div className={`px-6 py-2.5 rounded-2xl ${statusStyle.bg} ${statusStyle.text} font-black text-xs flex items-center gap-2 shadow-xl`}>
          {statusStyle.icon}
          {analysis.statusLabel || analysis.status}
        </div>
      </div>

      {/* Summary */}
      {analysis.aiSummary && (
        <p className="text-slate-700 font-medium leading-relaxed text-lg mb-8 bg-slate-50 p-6 rounded-[24px] border border-slate-100 shadow-inner italic">
          &ldquo;{analysis.aiSummary}&rdquo;
        </p>
      )}

      {/* Metrics */}
      {Object.keys(metrics).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {Object.entries(metrics).map(([key, value]) => (
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
    overallScore: 'Score Geral',
    climaticRisk: 'Risco Climático',
    phenologicalRisk: 'Risco Fenológico',
    operationalRisk: 'Risco Operacional',
    commercialRisk: 'Risco Comercial',
    trend: 'Tendência'
  }
  return labels[key] || key
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
