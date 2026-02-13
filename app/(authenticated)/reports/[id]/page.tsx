'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { MetricCards } from '@/components/agro/metric-cards'
import { PhenologyTimeline } from '@/components/agro/phenology-timeline'
import { TemplateSelector } from '@/components/templates/template-selector'
import { AnalysisPanel } from '@/components/templates/analysis-panel'
import { AIValidationPanel } from '@/components/ai-validation/AIValidationPanel'
import { FieldMapModal } from '@/components/modals/FieldMapModal'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ArrowLeft, Loader2, TrendingUp, RefreshCw, MapPin, ScanEye } from 'lucide-react'
import { VisualAnalysisTab } from '@/components/visual-analysis/VisualAnalysisTab'
import { Button } from '@/components/ui/button'
import { ProcessingModal } from '@/contexts/processing-context'
import { useReportData } from '@/hooks/useReportData'
import { useProcessingModal } from '@/hooks/useProcessingModal'
import { AnalysisTabs } from '@/components/reports/AnalysisTabs'
import { NdviChartCard } from '@/components/reports/NdviChartCard'
import { AIValidationSection } from '@/components/reports/AIValidationSection'
import { prepareChartData, computeHarvestWindow, enrichChartDataWithRadar } from '@/lib/utils/report-chart-utils'
import { SubfieldsComparisonTab } from '@/components/reports/SubfieldsComparisonTab'
import { FolderOpen } from 'lucide-react'

export default function ReportPage() {
  const params = useParams()
  const router = useRouter()
  const fieldId = params.id as string

  const {
    field,
    historicalNdvi,
    cycleAnalysis,
    correlationDetails,
    chartOverlayData,
    harvestWindowData,
    zarcInfo,
    precipitationData,
    harvestAdjustment,
    waterBalanceData,
    eosAdjustment,
    thermalData,
    soilData,
    climateEnvelopeData,
    radarData,
    featureFlags,
    satelliteSchedule,
    eosFusion,
    isSarFusionActive,
    templates,
    loading,
    selectedTemplate,
    setSelectedTemplate,
    setField,
    fetchData,
    subFieldComparison,
  } = useReportData(fieldId)

  const { processingSteps, processingStartTime, showProcessingModal, setShowProcessingModal, openForReprocess } =
    useProcessingModal(field?.status, fieldId, fetchData)

  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyzingTemplate, setAnalyzingTemplate] = useState<string | null>(null)
  const [isReprocessing, setIsReprocessing] = useState(false)
  const [isRunningAIValidation, setIsRunningAIValidation] = useState(false)
  const [aiValidationError, setAIValidationError] = useState<string | null>(null)
  const [showMapModal, setShowMapModal] = useState(false)

  const handleReprocess = async () => {
    if (!confirm('Reprocessar irá buscar novos dados de satélite e recalcular todas as análises. Continuar?')) return
    setIsReprocessing(true)
    setField((prev: any) => prev ? { ...prev, status: 'PROCESSING' } : prev)
    openForReprocess()
    fetch(`/api/fields/${fieldId}/process`, { method: 'POST' }).catch(() => {})
    setIsReprocessing(false)
  }

  const handleRunAIValidation = async () => {
    if (!fieldId) return
    setIsRunningAIValidation(true)
    setAIValidationError(null)
    try {
      const res = await fetch(`/api/fields/${fieldId}/ai-validate`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        setAIValidationError(data.error || data.details || 'Erro ao executar validação IA')
        return
      }
      await fetchData()
    } catch (err) {
      setAIValidationError('Erro de conexão ao executar validação IA')
    } finally {
      setIsRunningAIValidation(false)
    }
  }

  const handleSelectTemplate = async (templateId: string) => {
    const analyzedIds = field?.analyses?.map((a: any) => a.templateId) || []
    if (analyzedIds.includes(templateId)) {
      setSelectedTemplate(templateId)
      return
    }
    setIsAnalyzing(true)
    setAnalyzingTemplate(templateId)
    try {
      const res = await fetch(`/api/fields/${fieldId}/analyze/${templateId}`, { method: 'POST' })
      if (res.ok) {
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

  const baseChartData = chartOverlayData.length > 0 ? chartOverlayData : prepareChartData(ndviData, historicalNdvi, agroData)
  const chartData = featureFlags?.showRadarOverlay
    ? enrichChartDataWithRadar(baseChartData, radarData?.rviTimeSeries, field?.cropType || 'SOJA')
    : baseChartData

  const harvestWindow = computeHarvestWindow(eosFusion, harvestWindowData, agroData)
  const cropPattern = agroData?.cropPatternStatus
  const cropVerif = agroData?.aiCropVerificationStatus
  const hasCropIssue = cropPattern === 'NO_CROP' || cropPattern === 'ANOMALOUS' || cropPattern === 'ATYPICAL' ||
    (cropVerif && cropVerif !== 'CONFIRMED')
  const eosFusionProp = hasCropIssue ? null : (eosFusion ? {
    method: eosFusion.method,
    confidence: eosFusion.confidence,
    phenologicalStage: eosFusion.phenologicalStage,
    explanation: eosFusion.explanation,
    factors: eosFusion.factors,
    projections: {
      ndvi: { date: eosFusion.projections.ndvi.date?.toISOString() || null, confidence: eosFusion.projections.ndvi.confidence, status: eosFusion.projections.ndvi.status },
      gdd: { date: eosFusion.projections.gdd.date?.toISOString() || null, confidence: eosFusion.projections.gdd.confidence, status: eosFusion.projections.gdd.status },
      waterAdjustment: eosFusion.projections.waterAdjustment
    },
    warnings: eosFusion.warnings
  } : null)

  return (
    <>
      {showProcessingModal && (
        <ProcessingModal
          fieldName={field?.name || 'Talhão'}
          steps={processingSteps}
          startTime={processingStartTime}
          onClose={() => setShowProcessingModal(false)}
        />
      )}

      {showMapModal && field?.geometryJson && (
        <FieldMapModal
          isOpen={showMapModal}
          onClose={() => setShowMapModal(false)}
          geometryJson={field.geometryJson}
          fieldName={field.name || 'Talhão'}
          areaHa={agroData?.areaHa}
          siblings={field.subFields?.length > 0 ? field.subFields.map((sf: any) => ({
            id: sf.id,
            name: sf.name,
            geometryJson: sf.geometryJson,
            isSelected: false,
          })) : undefined}
        />
      )}

      <div className="p-8 space-y-8">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-xs font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest transition-all">
            <ArrowLeft size={16} /> Dashboard de Carteira
          </button>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={handleReprocess} disabled={isReprocessing || field?.status === 'PROCESSING'} className="gap-2">
              {isReprocessing || field?.status === 'PROCESSING' ? <><Loader2 size={14} className="animate-spin" />Processando...</> : <><RefreshCw size={14} />Reprocessar</>}
            </Button>
            {field.geometryJson && (
              <Button variant="outline" size="sm" onClick={() => setShowMapModal(true)} className="gap-2">
                <MapPin size={14} /> Ver no Mapa
              </Button>
            )}
            <div className="text-right">
              {field.parentField && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400 justify-end mb-0.5">
                  <FolderOpen size={12} />
                  <Link href={`/reports/${field.parentField.id}`} className="hover:text-blue-600 transition-colors">
                    {field.parentField.name}
                  </Link>
                  <span>/</span>
                  <span className="text-slate-600 font-medium">{field.name}</span>
                </div>
              )}
              <h2 className="text-xl font-black text-slate-900">{field.name}</h2>
              <p className="text-xs text-slate-400">{field.city || 'Zona Rural'}, {field.state || '--'}</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="relatorio" className="w-full">
          <TabsList className="w-auto bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
            <TabsTrigger value="relatorio" className="flex items-center gap-2 px-6 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm font-semibold">
              <TrendingUp size={16} /> Relatório
            </TabsTrigger>
            {featureFlags?.enableVisualAnalysis && (
              <TabsTrigger value="visual" className="flex items-center gap-2 px-6 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm font-semibold">
                <ScanEye size={16} /> Análise Visual
              </TabsTrigger>
            )}
            {subFieldComparison && (
              <TabsTrigger value="subtalhoes" className="flex items-center gap-2 px-6 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm font-semibold">
                <FolderOpen size={16} /> Subtalhões
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="relatorio" className="space-y-8 mt-6">
            {hasCropIssue && agroData && <AIValidationPanel agroData={agroData} />}

            <MetricCards
              areaHa={agroData?.areaHa}
              volumeEstimatedKg={hasCropIssue ? null : agroData?.volumeEstimatedKg}
              historicalCorrelation={hasCropIssue ? null : agroData?.historicalCorrelation}
              confidenceScore={hasCropIssue ? null : (eosFusion ? eosFusion.confidence : agroData?.confidenceScore)}
              confidence={hasCropIssue ? null : (eosFusion ? (eosFusion.confidence >= 75 ? 'HIGH' : eosFusion.confidence >= 50 ? 'MEDIUM' : 'LOW') : agroData?.confidence)}
            />

            <PhenologyTimeline
              plantingDate={agroData?.plantingDate}
              sosDate={agroData?.sosDate}
              eosDate={hasCropIssue ? null : (eosFusion ? eosFusion.eos.toISOString() : agroData?.eosDate)}
              method={agroData?.phenologyMethod}
              zarcInfo={zarcInfo}
              isPlantingConfirmed={!!field.plantingDateInput}
              detectedPlantingDate={agroData?.detectedPlantingDate}
              eosFusion={eosFusionProp}
            />

            {chartData.length > 0 && (
              <NdviChartCard
                chartData={chartData}
                correlationDetails={correlationDetails}
                agroData={agroData}
                cycleAnalysis={cycleAnalysis}
                historicalNdvi={historicalNdvi}
                eosFusion={eosFusion}
                harvestWindow={harvestWindow}
                featureFlags={featureFlags}
                radarData={radarData}
                isSarFusionActive={isSarFusionActive}
              />
            )}

            <AnalysisTabs
              featureFlags={featureFlags}
              precipitationData={precipitationData}
              harvestWindow={hasCropIssue ? null : harvestWindow}
              harvestAdjustment={hasCropIssue ? null : harvestAdjustment}
              waterBalanceData={waterBalanceData}
              eosAdjustment={hasCropIssue ? null : eosAdjustment}
              thermalData={hasCropIssue ? null : thermalData}
              climateEnvelopeData={climateEnvelopeData}
              soilData={soilData}
              satelliteSchedule={satelliteSchedule}
              fieldId={fieldId}
              cropType={field?.cropType || 'SOJA'}
              plantingDate={agroData?.plantingDate}
              sosDate={agroData?.sosDate}
            />

            {!hasCropIssue && (
              <AIValidationSection
                agroData={agroData}
                featureFlags={featureFlags}
                isRunningAIValidation={isRunningAIValidation}
                aiValidationError={aiValidationError}
                onRunValidation={handleRunAIValidation}
              />
            )}

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
          </TabsContent>

          {featureFlags?.enableVisualAnalysis && (
            <TabsContent value="visual" className="mt-6">
              <VisualAnalysisTab fieldId={fieldId} />
            </TabsContent>
          )}

          {subFieldComparison && (
            <TabsContent value="subtalhoes" className="mt-6">
              <SubfieldsComparisonTab data={subFieldComparison} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </>
  )
}
