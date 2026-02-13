'use client'

import { useState } from 'react'
import { Tractor, Leaf, Activity, CheckCircle, AlertTriangle, XCircle, Info, Thermometer, TrendingDown, Droplets } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface ZarcInfo {
  windowStart: string
  windowEnd: string
  optimalStart?: string
  optimalEnd?: string
  plantingRisk?: number
  plantingStatus?: 'IDEAL' | 'MODERATE' | 'HIGH_RISK' | 'OUT_OF_WINDOW' | 'UNKNOWN'
}

interface EosFusionInfo {
  method: 'NDVI' | 'GDD' | 'FUSION' | 'NDVI_ADJUSTED' | 'GDD_ADJUSTED'
  confidence: number
  phenologicalStage?: 'VEGETATIVE' | 'REPRODUCTIVE' | 'GRAIN_FILLING' | 'SENESCENCE' | 'MATURITY'
  explanation?: string
  factors?: string[]
  projections?: {
    ndvi: { date: string | null, confidence: number, status: string }
    gdd: { date: string | null, confidence: number, status: string }
    waterAdjustment: number
  }
  warnings?: string[]
}

interface PhenologyTimelineProps {
  plantingDate: string | null
  sosDate: string | null
  eosDate: string | null
  method: string | null
  zarcInfo?: ZarcInfo | null
  eosFusion?: EosFusionInfo | null
  /** Whether the planting date was manually confirmed by the user */
  isPlantingConfirmed?: boolean
  /** The automatically detected planting date (preserved for reference) */
  detectedPlantingDate?: string | null
}

export function PhenologyTimeline({
  plantingDate,
  sosDate,
  eosDate,
  method,
  zarcInfo,
  eosFusion,
  isPlantingConfirmed,
  detectedPlantingDate
}: PhenologyTimelineProps) {
  const [showEosTooltip, setShowEosTooltip] = useState(false)
  const [showPlantingTooltip, setShowPlantingTooltip] = useState(false)
  // Formatar janela ZARC
  const formatZarcDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  // Obter ícone e cor do status ZARC
  const getZarcStatusInfo = () => {
    if (!zarcInfo?.plantingStatus || zarcInfo.plantingStatus === 'UNKNOWN') {
      return null
    }
    
    switch (zarcInfo.plantingStatus) {
      case 'IDEAL':
        return {
          icon: <CheckCircle size={12} />,
          text: 'Janela ideal',
          className: 'text-emerald-600 bg-emerald-100'
        }
      case 'MODERATE':
        return {
          icon: <AlertTriangle size={12} />,
          text: 'Risco moderado',
          className: 'text-amber-600 bg-amber-100'
        }
      case 'HIGH_RISK':
        return {
          icon: <AlertTriangle size={12} />,
          text: 'Risco alto',
          className: 'text-red-600 bg-red-100'
        }
      case 'OUT_OF_WINDOW':
        return {
          icon: <XCircle size={12} />,
          text: 'Fora da janela',
          className: 'text-red-700 bg-red-200'
        }
      default:
        return null
    }
  }

  const zarcStatus = getZarcStatusInfo()

  // Helpers para EOS Fusion
  const getMethodLabel = (m: EosFusionInfo['method']) => {
    const labels: Record<EosFusionInfo['method'], string> = {
      'NDVI': 'NDVI Histórico',
      'GDD': 'Soma Térmica',
      'FUSION': 'NDVI + GDD',
      'NDVI_ADJUSTED': 'NDVI + Hídrico',
      'GDD_ADJUSTED': 'GDD + Hídrico'
    }
    return labels[m] || m
  }

  const getConfidenceColor = (conf: number) => {
    if (conf >= 75) return 'text-emerald-600 bg-emerald-100'
    if (conf >= 50) return 'text-amber-600 bg-amber-100'
    return 'text-red-600 bg-red-100'
  }

  const getConfidenceLabel = (conf: number) => {
    if (conf >= 75) return 'Alta'
    if (conf >= 50) return 'Média'
    return 'Baixa'
  }

  const getStageLabel = (stage: EosFusionInfo['phenologicalStage']) => {
    const labels: Record<NonNullable<EosFusionInfo['phenologicalStage']>, string> = {
      'VEGETATIVE': 'Vegetativo',
      'REPRODUCTIVE': 'Reprodutivo',
      'GRAIN_FILLING': 'Enchimento',
      'SENESCENCE': 'Senescência',
      'MATURITY': 'Maturação'
    }
    return stage ? labels[stage] : null
  }

  const getMethodIcon = (m: EosFusionInfo['method']) => {
    if (m === 'GDD' || m === 'GDD_ADJUSTED') return <Thermometer size={10} />
    if (m === 'NDVI_ADJUSTED' || m === 'FUSION') return <Droplets size={10} />
    return <TrendingDown size={10} />
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {/* Plantio - Estimado ou Confirmado */}
      <div className={`${isPlantingConfirmed ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-100'} border p-6 rounded-[24px] shadow-inner`}>
        <div className="flex items-center justify-between mb-2">
          <p className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${isPlantingConfirmed ? 'text-emerald-500' : 'text-blue-400'}`}>
            <Tractor size={14} /> {isPlantingConfirmed ? 'Plantio Confirmado' : 'Plantio Estimado'}
          </p>
          {isPlantingConfirmed && (
            <div 
              className="relative"
              onMouseEnter={() => setShowPlantingTooltip(true)}
              onMouseLeave={() => setShowPlantingTooltip(false)}
            >
              <button className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold text-emerald-600 bg-emerald-100">
                <CheckCircle size={10} />
                Manual
                <Info size={10} className="opacity-60" />
              </button>
              {showPlantingTooltip && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-4 z-50 text-left">
                  <div className="text-xs space-y-2">
                    <div className="flex items-center gap-2 border-b pb-2">
                      <CheckCircle size={14} className="text-emerald-500" />
                      <span className="font-bold text-slate-700">Data informada pelo produtor</span>
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      A data exibida foi definida manualmente pelo usuário e é utilizada como referência para todos os cálculos agronômicos.
                    </p>
                    {detectedPlantingDate && (
                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 mt-1">
                        <span className="text-[10px] font-bold text-blue-500 uppercase block">Data automática anterior</span>
                        <span className="text-[12px] font-bold text-blue-800">{formatDate(detectedPlantingDate)}</span>
                        <span className="text-[10px] text-blue-400 block">Detecção via SOS - 8 dias</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <h4 className={`text-2xl font-black ${isPlantingConfirmed ? 'text-emerald-900' : 'text-blue-900'}`}>
          {plantingDate ? formatDate(plantingDate) : '---'}
        </h4>
        <p className={`text-[10px] font-bold mt-2 uppercase ${isPlantingConfirmed ? 'text-emerald-400' : 'text-blue-400'}`}>
          {isPlantingConfirmed ? 'Informado pelo produtor' : 'Ref: SOS - 8 Dias'}
        </p>
        
        {/* ZARC Info integrado */}
        {zarcInfo && (
          <div className={`mt-3 pt-3 border-t ${isPlantingConfirmed ? 'border-emerald-200' : 'border-blue-200'}`}>
            <div className="flex items-center gap-1.5 text-[10px] text-blue-500 font-bold uppercase tracking-wider">
              <span className="bg-blue-200 text-blue-700 px-1.5 py-0.5 rounded text-[9px]">ZARC</span>
              <span>Janela: {formatZarcDate(zarcInfo.windowStart)} - {formatZarcDate(zarcInfo.windowEnd)}</span>
            </div>
            {zarcStatus && (
              <div className={`mt-1.5 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${zarcStatus.className}`}>
                {zarcStatus.icon}
                {zarcStatus.text}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Emergência Detectada */}
      <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[24px] shadow-inner">
        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-2">
          <Leaf size={14} /> Emergência Detectada (SOS)
        </p>
        <h4 className="text-2xl font-black text-emerald-900">
          {sosDate ? formatDate(sosDate) : '---'}
        </h4>
        <p className="text-[10px] text-emerald-400 font-bold mt-2 uppercase">
          Monitoramento Satelital
        </p>
      </div>

      {/* Previsão Colheita */}
      <div className="bg-amber-50 border border-amber-100 p-6 rounded-[24px] shadow-inner relative">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-2">
            <Activity size={14} /> Previsão Colheita (EOS)
          </p>
          
          {/* Badge de confiança com tooltip trigger */}
          {eosFusion && (
            <div 
              className="relative"
              onMouseEnter={() => setShowEosTooltip(true)}
              onMouseLeave={() => setShowEosTooltip(false)}
            >
              <button
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${getConfidenceColor(eosFusion.confidence)}`}
              >
                {getMethodIcon(eosFusion.method)}
                {getConfidenceLabel(eosFusion.confidence)}
                <Info size={10} className="opacity-60" />
              </button>
              
              {/* Tooltip */}
              {showEosTooltip && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl p-4 z-50 text-left">
                  <div className="text-xs space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="font-bold text-slate-700">Método de Projeção</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getConfidenceColor(eosFusion.confidence)}`}>
                        {eosFusion.confidence}% confiança
                      </span>
                    </div>
                    
                    {/* Método */}
                    <div className="flex items-center gap-2">
                      {getMethodIcon(eosFusion.method)}
                      <span className="font-medium text-slate-800">{getMethodLabel(eosFusion.method)}</span>
                    </div>
                    
                    {/* Explicação */}
                    {eosFusion.explanation && (
                      <p className="text-slate-600 text-[11px] leading-relaxed">
                        {eosFusion.explanation}
                      </p>
                    )}
                    
                    {/* Fatores */}
                    {eosFusion.factors && eosFusion.factors.length > 0 && (
                      <div className="bg-slate-50 rounded-lg p-2 space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Fatores</span>
                        {eosFusion.factors.map((factor, i) => (
                          <div key={i} className="text-[11px] text-slate-600 flex items-start gap-1">
                            <span className="text-slate-400">•</span>
                            {factor}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Projeções individuais */}
                    {eosFusion.projections && (
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                        <div className="text-center">
                          <div className="text-[9px] text-slate-400 uppercase">NDVI</div>
                          <div className="text-[11px] font-medium text-slate-700">
                            {eosFusion.projections.ndvi.date 
                              ? formatDate(eosFusion.projections.ndvi.date)
                              : 'N/A'}
                          </div>
                          <div className="text-[9px] text-slate-400">
                            {eosFusion.projections.ndvi.status}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-[9px] text-slate-400 uppercase">GDD</div>
                          <div className="text-[11px] font-medium text-slate-700">
                            {eosFusion.projections.gdd.date 
                              ? formatDate(eosFusion.projections.gdd.date)
                              : 'N/A'}
                          </div>
                          <div className="text-[9px] text-slate-400">
                            {eosFusion.projections.gdd.status}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Warnings */}
                    {eosFusion.warnings && eosFusion.warnings.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 space-y-1">
                        {eosFusion.warnings.map((warning, i) => (
                          <div key={i} className="text-[10px] text-amber-700 flex items-start gap-1">
                            <AlertTriangle size={10} className="mt-0.5 flex-shrink-0" />
                            {warning}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        <h4 className="text-2xl font-black text-amber-900">
          {eosDate ? formatDate(eosDate) : '---'}
        </h4>
        
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {eosDate ? (
            <>
              <p className="text-[10px] text-amber-500 font-bold uppercase">
                Status: {method === 'ALGORITHM' ? 'DETECÇÃO REAL' : 'PROJEÇÃO CICLO'}
              </p>
              
              {/* Estágio fenológico */}
              {eosFusion?.phenologicalStage && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-200 text-amber-700 font-medium">
                  {getStageLabel(eosFusion.phenologicalStage)}
                </span>
              )}
            </>
          ) : (
            <p className="text-[10px] text-amber-400 font-bold uppercase">
              Sem projeção disponível
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
