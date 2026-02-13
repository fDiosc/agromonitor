'use client'

import { Card } from '@/components/ui/card'
import { AlertCircle, AlertTriangle, XCircle, BrainCircuit } from 'lucide-react'

interface CropAlertCardProps {
  cropPatternData: {
    reason?: string
    metrics?: { peakNdvi?: number; amplitude?: number; meanNdvi?: number }
    hypotheses?: string[]
  } | null
  cropVerifData: {
    visualAssessment?: string
    hypotheses?: string[] | unknown
    evidence?: string[] | unknown
    confidence?: number
    confidenceInDeclaredCrop?: string
  } | null
  cropPatternStatus: string | null
  cropVerifStatus: string | null
}

export function CropAlertCard({
  cropPatternData,
  cropVerifData,
  cropPatternStatus,
  cropVerifStatus,
}: CropAlertCardProps) {
  const isCriticalCrop = cropPatternStatus === 'NO_CROP' || cropVerifStatus === 'NO_CROP' || cropVerifStatus === 'MISMATCH'
  const alertColors = isCriticalCrop
    ? { border: 'border-red-200', bg: 'from-red-50 to-orange-50', iconBg: 'bg-red-100', iconText: 'text-red-600', title: 'text-red-600', subtitle: 'text-red-400', badgeBg: 'bg-red-600', metricBg: 'bg-red-50', metricLabel: 'text-red-400', metricValue: 'text-red-700', explanationBorder: 'border-red-100', explanationText: 'text-red-800', warningBg: 'bg-red-100', warningText: 'text-red-800' }
    : { border: 'border-amber-200', bg: 'from-amber-50 to-orange-50', iconBg: 'bg-amber-100', iconText: 'text-amber-600', title: 'text-amber-600', subtitle: 'text-amber-400', badgeBg: 'bg-amber-500', metricBg: 'bg-amber-50', metricLabel: 'text-amber-400', metricValue: 'text-amber-700', explanationBorder: 'border-amber-100', explanationText: 'text-amber-800', warningBg: 'bg-amber-100', warningText: 'text-amber-800' }

  const cropAlertLabel = cropPatternStatus === 'NO_CROP' ? 'Sem Cultivo'
    : cropVerifStatus === 'MISMATCH' ? 'Cultura Divergente'
    : cropVerifStatus === 'SUSPICIOUS' ? 'Cultura Suspeita'
    : cropVerifStatus === 'CROP_FAILURE' ? 'Falha de Safra'
    : cropPatternStatus === 'ANOMALOUS' ? 'Padrão Anômalo'
    : 'Alerta'

  return (
    <Card className={`p-8 rounded-[48px] border-2 ${alertColors.border} bg-gradient-to-br ${alertColors.bg}`}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${alertColors.iconBg} ${alertColors.iconText}`}>
            <AlertCircle size={20} />
          </div>
          <div>
            <h4 className={`text-sm font-black uppercase ${alertColors.title} tracking-widest`}>
              Alerta de Cultura
            </h4>
            <p className={`text-xs ${alertColors.subtitle} mt-0.5`}>
              {cropVerifStatus && cropVerifStatus !== 'CONFIRMED' ? 'Verificação algorítmica + IA' : 'Verificação algorítmica'}
            </p>
          </div>
        </div>
        <div className={`px-6 py-2.5 rounded-2xl ${alertColors.badgeBg} text-white font-black text-xs flex items-center gap-2 shadow-xl`}>
          {isCriticalCrop ? <XCircle size={16} /> : <AlertTriangle size={16} />}
          {cropAlertLabel}
        </div>
      </div>

      {/* Explanation */}
      <div className={`p-4 bg-white/70 rounded-2xl border ${alertColors.explanationBorder} mb-4`}>
        <p className={`text-sm ${alertColors.explanationText} font-semibold mb-2`}>
          {cropPatternData?.reason || 'A análise NDVI não identificou a cultura declarada neste talhão.'}
        </p>
        {cropPatternData?.metrics && (
          <div className="grid grid-cols-3 gap-3 mt-3">
            <div className={`text-center p-2 ${alertColors.metricBg} rounded-xl`}>
              <div className={`text-xs ${alertColors.metricLabel} font-bold`}>Peak NDVI</div>
              <div className={`text-lg font-black ${alertColors.metricValue}`}>{cropPatternData.metrics.peakNdvi?.toFixed(2) || '—'}</div>
            </div>
            <div className={`text-center p-2 ${alertColors.metricBg} rounded-xl`}>
              <div className={`text-xs ${alertColors.metricLabel} font-bold`}>Amplitude</div>
              <div className={`text-lg font-black ${alertColors.metricValue}`}>{cropPatternData.metrics.amplitude?.toFixed(2) || '—'}</div>
            </div>
            <div className={`text-center p-2 ${alertColors.metricBg} rounded-xl`}>
              <div className={`text-xs ${alertColors.metricLabel} font-bold`}>Média NDVI</div>
              <div className={`text-lg font-black ${alertColors.metricValue}`}>{cropPatternData.metrics.meanNdvi?.toFixed(2) || '—'}</div>
            </div>
          </div>
        )}
      </div>

      {/* Hypotheses */}
      {cropPatternData?.hypotheses && cropPatternData.hypotheses.length > 0 && (
        <div className="p-4 bg-white/70 rounded-2xl border border-orange-100 mb-4">
          <h5 className="text-xs font-bold text-orange-700 uppercase tracking-wider mb-2">Hipóteses</h5>
          <ul className="space-y-1">
            {cropPatternData.hypotheses.map((h: string, i: number) => (
              <li key={i} className="text-sm text-orange-800 flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 flex-shrink-0" />
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Verifier results if available */}
      {cropVerifData && (
        <div className="p-4 bg-white/70 rounded-2xl border border-violet-100">
          <h5 className="text-xs font-bold text-violet-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <BrainCircuit size={12} />Verificação Visual IA
          </h5>
          <p className="text-sm text-slate-700">{cropVerifData.visualAssessment}</p>
          {Array.isArray(cropVerifData.hypotheses) && cropVerifData.hypotheses.length > 0 && (
            <div className="mt-2 text-xs text-violet-600">
              Hipóteses: {Array.isArray(cropVerifData.hypotheses) ? cropVerifData.hypotheses.join(', ') : cropVerifData.hypotheses}
            </div>
          )}
          {Array.isArray(cropVerifData.evidence) && cropVerifData.evidence.length > 0 && (
            <div className="mt-2 text-xs text-slate-600">
              Evidências: {Array.isArray(cropVerifData.evidence) ? cropVerifData.evidence.join('; ') : cropVerifData.evidence}
            </div>
          )}
          <div className="mt-2 text-xs text-slate-500">
            Confiança na cultura declarada: <strong>{cropVerifData.confidence ? `${Math.round(cropVerifData.confidence * 100)}%` : (cropVerifData.confidenceInDeclaredCrop ? `${cropVerifData.confidenceInDeclaredCrop}%` : '—')}</strong>
          </div>
        </div>
      )}

      {/* Warning message */}
      {isCriticalCrop && (
        <div className={`mt-4 p-3 ${alertColors.warningBg} rounded-xl ${alertColors.warningText} text-xs font-semibold flex items-start gap-2`}>
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            Nenhum cálculo de EOS, colheita ou volume foi gerado para este talhão.
            Verifique o tipo de cultura cadastrado ou realize uma vistoria em campo.
          </span>
        </div>
      )}
      {!isCriticalCrop && (
        <div className={`mt-4 p-3 ${alertColors.warningBg} rounded-xl ${alertColors.warningText} text-xs font-semibold flex items-start gap-2`}>
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            A cultura declarada apresenta indicadores atípicos. Os cálculos de EOS e volume podem ter precisão reduzida.
            Considere verificar o tipo de cultura cadastrado ou realizar uma vistoria em campo.
          </span>
        </div>
      )}
    </Card>
  )
}
