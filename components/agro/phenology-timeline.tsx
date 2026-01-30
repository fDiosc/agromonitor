'use client'

import { Tractor, Leaf, Activity, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface ZarcInfo {
  windowStart: string
  windowEnd: string
  optimalStart?: string
  optimalEnd?: string
  plantingRisk?: number
  plantingStatus?: 'IDEAL' | 'MODERATE' | 'HIGH_RISK' | 'OUT_OF_WINDOW' | 'UNKNOWN'
}

interface PhenologyTimelineProps {
  plantingDate: string | null
  sosDate: string | null
  eosDate: string | null
  method: string | null
  zarcInfo?: ZarcInfo | null
}

export function PhenologyTimeline({
  plantingDate,
  sosDate,
  eosDate,
  method,
  zarcInfo
}: PhenologyTimelineProps) {
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

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {/* Plantio Estimado - com ZARC integrado */}
      <div className="bg-blue-50 border border-blue-100 p-6 rounded-[24px] shadow-inner">
        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
          <Tractor size={14} /> Plantio Estimado
        </p>
        <h4 className="text-2xl font-black text-blue-900">
          {plantingDate ? formatDate(plantingDate) : '---'}
        </h4>
        <p className="text-[10px] text-blue-400 font-bold mt-2 uppercase">
          Ref: SOS - 8 Dias
        </p>
        
        {/* ZARC Info integrado */}
        {zarcInfo && (
          <div className="mt-3 pt-3 border-t border-blue-200">
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
      <div className="bg-amber-50 border border-amber-100 p-6 rounded-[24px] shadow-inner">
        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-2">
          <Activity size={14} /> Previsão Colheita (EOS)
        </p>
        <h4 className="text-2xl font-black text-amber-900">
          {eosDate ? formatDate(eosDate) : '---'}
        </h4>
        <p className="text-[10px] text-amber-500 font-bold mt-2 uppercase">
          Status: {method === 'ALGORITHM' ? 'DETECÇÃO REAL' : 'PROJEÇÃO CICLO'}
        </p>
      </div>
    </div>
  )
}
