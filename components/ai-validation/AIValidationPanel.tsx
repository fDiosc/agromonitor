'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  BrainCircuit, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Eye, 
  ShieldCheck, 
  Calendar, 
  TrendingUp,
  Info,
  AlertCircle
} from 'lucide-react'
import { Tooltip } from '@/components/ui/Tooltip'

interface AIValidationPanelProps {
  agroData: {
    aiValidationResult?: string | null
    aiValidationDate?: string | null
    aiValidationConfidence?: number | null
    aiValidationAgreement?: string | null
    aiVisualAlerts?: string | null
    aiEosAdjustedDate?: string | null
    aiCostReport?: string | null
    // Crop verification
    cropPatternStatus?: string | null
    cropPatternData?: string | null
    aiCropVerificationStatus?: string | null
    aiCropVerificationData?: string | null
  }
}

const AGREEMENT_CONFIG = {
  CONFIRMED: {
    label: 'Confirmado',
    description: 'As projeções algorítmicas foram confirmadas visualmente',
    icon: CheckCircle,
    bg: 'bg-emerald-500',
    text: 'text-emerald-700',
    lightBg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  QUESTIONED: {
    label: 'Questionado',
    description: 'Divergências parciais foram identificadas visualmente',
    icon: AlertTriangle,
    bg: 'bg-amber-500',
    text: 'text-amber-700',
    lightBg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  REJECTED: {
    label: 'Rejeitado',
    description: 'As projeções algorítmicas não correspondem às imagens',
    icon: XCircle,
    bg: 'bg-red-600',
    text: 'text-red-700',
    lightBg: 'bg-red-50',
    border: 'border-red-200',
  },
}

export function AIValidationPanel({ agroData }: AIValidationPanelProps) {
  const result = agroData.aiValidationResult as keyof typeof AGREEMENT_CONFIG | null

  // Parse crop pattern data
  let cropPatternData: any = null
  if (agroData.cropPatternData) {
    try { cropPatternData = JSON.parse(agroData.cropPatternData) } catch { /* ignore */ }
  }

  // Parse crop verification data
  let cropVerifData: any = null
  if (agroData.aiCropVerificationData) {
    try { cropVerifData = JSON.parse(agroData.aiCropVerificationData) } catch { /* ignore */ }
  }

  const cropPatternStatus = agroData.cropPatternStatus
  const cropVerifStatus = agroData.aiCropVerificationStatus
  const hasCropIssue = cropPatternStatus === 'NO_CROP' || cropPatternStatus === 'ANOMALOUS' ||
    cropVerifStatus === 'NO_CROP' || cropVerifStatus === 'MISMATCH' || cropVerifStatus === 'CROP_FAILURE' || cropVerifStatus === 'SUSPICIOUS'

  // Determine crop alert severity: red for critical, amber/orange for suspicious
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

  // Build the crop alert card (reusable for standalone and inline)
  const CropAlertCard = () => (
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
          {cropVerifData.hypotheses?.length > 0 && (
            <div className="mt-2 text-xs text-violet-600">
              Hipóteses: {Array.isArray(cropVerifData.hypotheses) ? cropVerifData.hypotheses.join(', ') : cropVerifData.hypotheses}
            </div>
          )}
          {cropVerifData.evidence?.length > 0 && (
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

  // If we have a crop issue, ALWAYS show only the CropAlertCard
  // The full AI validation panel (Judge results) is not relevant when the crop identity itself is in question
  if (hasCropIssue) {
    return <CropAlertCard />
  }

  // Also show the CropAlertCard for ATYPICAL (even without verifier issues)
  // This ensures the algorithmic alert is visible immediately after processing
  if (cropPatternStatus === 'ATYPICAL') {
    return <CropAlertCard />
  }

  if (!result || !AGREEMENT_CONFIG[result]) return null

  const config = AGREEMENT_CONFIG[result]
  const StatusIcon = config.icon

  // Parse agreement details
  let agreementData: any = {}
  if (agroData.aiValidationAgreement) {
    try {
      agreementData = JSON.parse(agroData.aiValidationAgreement)
    } catch { /* ignore */ }
  }

  // Parse visual alerts
  let visualAlerts: any[] = []
  if (agroData.aiVisualAlerts) {
    try {
      visualAlerts = JSON.parse(agroData.aiVisualAlerts)
    } catch { /* ignore */ }
  }

  // Parse cost report
  let costData: any = null
  if (agroData.aiCostReport) {
    try {
      costData = JSON.parse(agroData.aiCostReport)
    } catch { /* ignore */ }
  }

  const confidence = agroData.aiValidationConfidence || 0
  const validationDate = agroData.aiValidationDate
    ? new Date(agroData.aiValidationDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    : null
  const eosAdjusted = agroData.aiEosAdjustedDate
    ? new Date(agroData.aiEosAdjustedDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    : null

  // Normalizar campos (suporte a ambos formatos: antigo e novo schema do Judge)
  const rawHarvest = agreementData.harvestReadiness || {}
  const harvestReadiness = {
    ready: rawHarvest.ready ?? rawHarvest.isReady ?? false,
    estimatedDate: rawHarvest.estimatedDate || null,
    delayRisk: rawHarvest.delayRisk || 'NONE',
    delayDays: rawHarvest.delayDays || 0,
    notes: rawHarvest.notes || null,
  }

  const rawRisk = agreementData.riskAssessment || {}
  // Mapear valores portugueses para inglês
  const RISK_MAP: Record<string, string> = {
    'BAIXO': 'LOW', 'MODERADO': 'MEDIUM', 'ALTO': 'HIGH', 'CRITICO': 'CRITICAL',
    'LOW': 'LOW', 'MEDIUM': 'MEDIUM', 'HIGH': 'HIGH', 'CRITICAL': 'CRITICAL'
  }
  const overallRisk = RISK_MAP[rawRisk.overallRisk || rawRisk.overall || ''] || 'MEDIUM'
  
  // Normalizar factors: novo schema usa factors[], antigo usa climatic/phytosanitary/operational
  let riskFactors: { category: string, severity: string, description: string }[] = rawRisk.factors || []
  if (riskFactors.length === 0 && (rawRisk.climatic || rawRisk.phytosanitary || rawRisk.operational)) {
    if (rawRisk.climatic) riskFactors.push({ category: 'CLIMATIC', severity: 'MEDIUM', description: rawRisk.climatic })
    if (rawRisk.phytosanitary) riskFactors.push({ category: 'PHYTOSANITARY', severity: 'MEDIUM', description: rawRisk.phytosanitary })
    if (rawRisk.operational) riskFactors.push({ category: 'OPERATIONAL', severity: 'MEDIUM', description: rawRisk.operational })
  }
  
  const riskAssessment = { overallRisk, factors: riskFactors }
  const recommendations = agreementData.recommendations || []

  return (
    <Card className="p-8 rounded-[48px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-violet-100 text-violet-600">
            <BrainCircuit size={20} />
          </div>
          <div>
            <h4 className="text-sm font-black uppercase text-slate-400 tracking-widest">
              Validação Visual IA
            </h4>
            {validationDate && (
              <p className="text-xs text-slate-400 mt-0.5">{validationDate}</p>
            )}
          </div>
          <Tooltip content={
            <div className="text-left max-w-xs">
              <p className="font-semibold mb-1">Como funciona</p>
              <ul className="text-xs space-y-1">
                <li>1. Curador seleciona as melhores imagens de satélite</li>
                <li>2. Juiz IA analisa visualmente estágio da lavoura</li>
                <li>3. Compara com projeções algorítmicas (NDVI, EOS)</li>
                <li>4. Identifica divergências e anomalias visuais</li>
              </ul>
              {costData && (
                <p className="mt-2 text-xs opacity-75">
                  Custo: ${costData.totalCost?.toFixed(4)} USD | Tempo: {((costData.durations?.totalMs || 0) / 1000).toFixed(1)}s
                </p>
              )}
            </div>
          }>
            <Info size={14} className="text-slate-400 cursor-help" />
          </Tooltip>
        </div>
        
        {/* Status badge */}
        <div className={`px-6 py-2.5 rounded-2xl ${config.bg} text-white font-black text-xs flex items-center gap-2 shadow-xl`}>
          <StatusIcon size={16} />
          {config.label}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Confidence */}
        <div className="bg-slate-50 p-4 rounded-xl">
          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Confiança IA</p>
          <p className={`text-lg font-black ${
            confidence >= 70 ? 'text-emerald-600' : confidence >= 40 ? 'text-amber-600' : 'text-red-600'
          }`}>
            {confidence}%
          </p>
        </div>

        {/* Stage Agreement */}
        <div className="bg-slate-50 p-4 rounded-xl">
          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Estágio Fenológico</p>
          <p className={`text-lg font-black ${
            agreementData.stageAgreement ? 'text-emerald-600' : 'text-red-600'
          }`}>
            {agreementData.stageAgreement ? 'Concorda' : 'Diverge'}
          </p>
        </div>

        {/* EOS Adjusted */}
        <div className="bg-slate-50 p-4 rounded-xl">
          <div className="flex items-center gap-1 mb-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase">EOS Ajustado</p>
            {agreementData.eosAdjustmentReason && (
              <Tooltip content={<span className="text-xs">{agreementData.eosAdjustmentReason}</span>}>
                <Info size={12} className="text-slate-400 cursor-help" />
              </Tooltip>
            )}
          </div>
          <p className="text-lg font-black text-slate-700">
            {eosAdjusted || 'Sem ajuste'}
          </p>
        </div>

        {/* Harvest Readiness */}
        <div className="bg-slate-50 p-4 rounded-xl">
          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Colheita Pronta</p>
          <p className={`text-lg font-black ${
            harvestReadiness.ready ? 'text-emerald-600' : 'text-amber-600'
          }`}>
            {harvestReadiness.ready ? 'Sim' : 'Não'}
          </p>
        </div>
      </div>

      {/* Risk Assessment */}
      {riskAssessment && (
        <div className="mb-6 p-4 bg-violet-50/30 rounded-[24px] border border-violet-100">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline" className="bg-violet-100 text-violet-700 border-violet-200">
              <ShieldCheck size={12} className="mr-1" />
              Risco Visual: {riskAssessment.overallRisk === 'LOW' ? 'Baixo' : riskAssessment.overallRisk === 'HIGH' ? 'Alto' : 'Médio'}
            </Badge>
          </div>
          
          {riskAssessment.factors && riskAssessment.factors.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {riskAssessment.factors.map((factor: any, i: number) => {
                const severity = factor.severity || factor.level || 'MEDIUM'
                const CATEGORY_LABELS: Record<string, string> = {
                  'CLIMATIC': 'Climático', 'PHYTOSANITARY': 'Fitossanitário', 'OPERATIONAL': 'Operacional'
                }
                return (
                  <div key={i} className="bg-white p-3 rounded-xl border border-violet-100 flex items-start gap-2">
                    <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                      severity === 'HIGH' || severity === 'CRITICAL' ? 'bg-red-500' : severity === 'MEDIUM' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`} />
                    <div>
                      <p className="text-xs font-bold text-slate-700">
                        {CATEGORY_LABELS[factor.category] || factor.factor || factor.category || 'Risco'}
                      </p>
                      <p className="text-xs text-slate-500">{factor.description || factor.detail || ''}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Visual Alerts + Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Visual Alerts */}
        <div className="bg-amber-50/50 p-6 rounded-[24px] border border-amber-100">
          <h5 className="text-[10px] font-black uppercase text-amber-600 tracking-widest mb-4 flex items-center gap-2">
            <Eye size={16} /> Alertas Visuais
          </h5>
          <ul className="space-y-2">
            {visualAlerts.length > 0 ? (
              visualAlerts.map((alert: any, i: number) => (
                <li key={i} className="text-xs font-bold flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm border border-amber-100/50">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    alert.severity === 'HIGH' ? 'bg-red-500' : alert.severity === 'MEDIUM' ? 'bg-amber-500' : 'bg-yellow-400'
                  }`} />
                  <div>
                    <span className={`${
                      alert.severity === 'HIGH' ? 'text-red-700' : alert.severity === 'MEDIUM' ? 'text-amber-700' : 'text-yellow-700'
                    }`}>
                      [{alert.severity}] {alert.type}
                    </span>
                    <p className="text-slate-500 font-normal mt-0.5">{alert.description}</p>
                  </div>
                </li>
              ))
            ) : (
              <li className="text-xs text-amber-400 italic">Nenhum alerta visual identificado</li>
            )}
          </ul>
        </div>

        {/* Recommendations */}
        <div className="bg-emerald-50/50 p-6 rounded-[24px] border border-emerald-100">
          <h5 className="text-[10px] font-black uppercase text-emerald-600 tracking-widest mb-4 flex items-center gap-2">
            <CheckCircle size={16} /> Recomendações IA
          </h5>
          <ul className="space-y-2">
            {recommendations.length > 0 ? (
              recommendations.map((rec: string, i: number) => (
                <li key={i} className="text-xs font-bold text-emerald-800 flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm border border-emerald-100/50">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  {rec}
                </li>
              ))
            ) : (
              <li className="text-xs text-emerald-400 italic">Sem recomendações</li>
            )}
          </ul>
        </div>
      </div>

      {/* Harvest note */}
      {harvestReadiness?.notes && (
        <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-xs text-slate-500 italic">
            <Calendar size={12} className="inline mr-1" />
            {harvestReadiness.notes}
          </p>
        </div>
      )}
    </Card>
  )
}
