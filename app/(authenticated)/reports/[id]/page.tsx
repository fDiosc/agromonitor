'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { MetricCards } from '@/components/agro/metric-cards'
import { PhenologyTimeline } from '@/components/agro/phenology-timeline'
import { TemplateSelector } from '@/components/templates/template-selector'
import { AnalysisPanel } from '@/components/templates/analysis-panel'
import { PrecipitationChart } from '@/components/charts/PrecipitationChart'
import { ClimateEnvelopeChart } from '@/components/charts/ClimateEnvelopeChart'
import { WaterBalanceChart } from '@/components/charts/WaterBalanceChart'
import { GddChart } from '@/components/charts/GddChart'
import { SoilInfoCard } from '@/components/cards/SoilInfoCard'
import { SatelliteScheduleCard } from '@/components/satellite/SatelliteScheduleCard'
import { calculateFusedEos, EosFusionInput, EosFusionResult } from '@/lib/services/eos-fusion.service'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ArrowLeft, Loader2, TrendingUp, RefreshCw, CloudRain, Droplets, Satellite, Thermometer } from 'lucide-react'
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

// ==================== Analysis Tabs Component ====================
interface AnalysisTabsProps {
  featureFlags: any
  precipitationData: any
  harvestWindow: any
  harvestAdjustment: any
  waterBalanceData: any
  eosAdjustment: any
  thermalData: any
  climateEnvelopeData: any
  soilData: any
  satelliteSchedule: any
  fieldId: string
  cropType: string
  plantingDate?: string | null
  sosDate?: string | null
}

function AnalysisTabs({
  featureFlags,
  precipitationData,
  harvestWindow,
  harvestAdjustment,
  waterBalanceData,
  eosAdjustment,
  thermalData,
  climateEnvelopeData,
  soilData,
  satelliteSchedule,
  fieldId,
  cropType,
  plantingDate,
  sosDate
}: AnalysisTabsProps) {
  // Determinar quais tabs mostrar
  const showClima = (
    (precipitationData?.points?.length > 0 && featureFlags?.showPrecipitationChart !== false) ||
    (thermalData?.temperature?.points?.length > 0 && featureFlags?.showGddChart === true) ||
    (climateEnvelopeData?.precipitation && featureFlags?.showClimateEnvelope === true) ||
    (climateEnvelopeData?.temperature && featureFlags?.showClimateEnvelope === true)
  )
  
  const showBalancoHidrico = (
    waterBalanceData?.points?.length > 0 && featureFlags?.showWaterBalanceChart === true
  )
  
  const showSatelite = (
    (satelliteSchedule && featureFlags?.showSatelliteSchedule !== false) ||
    (soilData && featureFlags?.showSoilInfo !== false)
  )

  // Se não há nenhum dado adicional, não mostrar tabs
  if (!showClima && !showBalancoHidrico && !showSatelite) {
    return null
  }

  return (
    <Card className="p-6 rounded-[32px]">
      <Tabs defaultValue="clima" className="w-full">
        <TabsList className="w-full flex justify-start gap-2 bg-slate-100/50 p-2 rounded-2xl mb-6">
          {showClima && (
            <TabsTrigger 
              value="clima" 
              className="flex items-center gap-2 px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-xl"
            >
              <CloudRain size={16} />
              <span>Clima</span>
            </TabsTrigger>
          )}
          
          {showBalancoHidrico && (
            <TabsTrigger 
              value="balanco" 
              className="flex items-center gap-2 px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-xl"
            >
              <Droplets size={16} />
              <span>Balanço Hídrico</span>
            </TabsTrigger>
          )}
          
          {showSatelite && (
            <TabsTrigger 
              value="satelite" 
              className="flex items-center gap-2 px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-xl"
            >
              <Satellite size={16} />
              <span>Satélite & Solo</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Tab Clima: Precipitação + Temperatura/GDD + Envelope Climático */}
        {showClima && (
          <TabsContent value="clima" className="space-y-6 mt-0">
            {/* Precipitação */}
            {precipitationData?.points?.length > 0 && featureFlags?.showPrecipitationChart !== false && (
              <PrecipitationChart
                data={precipitationData.points}
                totalMm={precipitationData.totalMm || 0}
                avgDailyMm={precipitationData.avgDailyMm || 0}
                rainyDays={precipitationData.rainyDays || 0}
                harvestStart={harvestWindow?.startDate}
                harvestEnd={harvestWindow?.endDate}
                plantingDate={plantingDate ? new Date(plantingDate).toISOString().split('T')[0] : undefined}
                sosDate={sosDate ? new Date(sosDate).toISOString().split('T')[0] : undefined}
                grainQualityRisk={harvestAdjustment?.grainQualityRisk}
                recentPrecipMm={harvestAdjustment?.recentPrecipMm}
                delayDays={harvestAdjustment?.delayDays}
              />
            )}

            {/* GDD Chart */}
            {thermalData?.temperature?.points?.length > 0 && featureFlags?.showGddChart === true && (
              <GddChart
                data={thermalData.temperature.points}
                accumulatedGdd={thermalData.gddAnalysis?.accumulatedGdd || 0}
                requiredGdd={thermalData.gddAnalysis?.requiredGdd || 1300}
                progressPercent={thermalData.gddAnalysis?.progressPercent || 0}
                daysToMaturity={thermalData.gddAnalysis?.daysToMaturity}
                projectedEos={thermalData.gddAnalysis?.projectedEos}
                confidence={thermalData.gddAnalysis?.confidence || 'LOW'}
                crop={cropType}
              />
            )}

            {/* Climate Envelope - Precipitação */}
            {climateEnvelopeData?.precipitation?.envelope?.points?.length > 0 && featureFlags?.showClimateEnvelope === true && (
              <ClimateEnvelopeChart
                type="PRECIPITATION"
                data={formatEnvelopeForChartFn(climateEnvelopeData.precipitation)}
                summary={climateEnvelopeData.precipitation.summary}
                historicalYears={climateEnvelopeData.precipitation.envelope?.historicalYears || 5}
                riskLevel={getRiskLevelFn(climateEnvelopeData.precipitation.summary)}
              />
            )}

            {/* Climate Envelope - Temperatura */}
            {climateEnvelopeData?.temperature?.envelope?.points?.length > 0 && featureFlags?.showClimateEnvelope === true && (
              <ClimateEnvelopeChart
                type="TEMPERATURE"
                data={formatEnvelopeForChartFn(climateEnvelopeData.temperature)}
                summary={climateEnvelopeData.temperature.summary}
                historicalYears={climateEnvelopeData.temperature.envelope?.historicalYears || 3}
                riskLevel={getRiskLevelFn(climateEnvelopeData.temperature.summary)}
              />
            )}

            {/* Mensagem se não há envelope climático */}
            {(!climateEnvelopeData?.precipitation?.envelope?.points?.length && 
              !climateEnvelopeData?.temperature?.envelope?.points?.length && 
              featureFlags?.showClimateEnvelope === true) && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
                <div className="font-medium">Envelope Climático Indisponível</div>
                <p className="text-xs mt-1">
                  Dados históricos insuficientes para gerar o envelope climático. 
                  É necessário ao menos 2 anos de dados históricos.
                </p>
              </div>
            )}
          </TabsContent>
        )}

        {/* Tab Balanço Hídrico */}
        {showBalancoHidrico && (
          <TabsContent value="balanco" className="space-y-6 mt-0">
            <WaterBalanceChart
              data={waterBalanceData.points}
              totalDeficit={waterBalanceData.totalDeficit || 0}
              totalExcess={waterBalanceData.totalExcess || 0}
              stressDays={waterBalanceData.stressDays || 0}
              excessDays={waterBalanceData.excessDays || 0}
              stressLevel={eosAdjustment?.stressLevel}
              yieldImpact={eosAdjustment?.yieldImpact}
              adjustmentReason={eosAdjustment?.reason}
            />
          </TabsContent>
        )}

        {/* Tab Satélite & Solo */}
        {showSatelite && (
          <TabsContent value="satelite" className="space-y-6 mt-0">
            {/* Satellite Schedule */}
            {satelliteSchedule && featureFlags?.showSatelliteSchedule !== false && (
              <SatelliteScheduleCard
                fieldId={fieldId}
                lastS2Date={satelliteSchedule.lastS2Date}
                nextS2Date={satelliteSchedule.nextS2Date}
                lastS1Date={satelliteSchedule.lastS1Date}
                nextS1Date={satelliteSchedule.nextS1Date}
                daysUntilNextData={satelliteSchedule.daysUntilNextData}
                upcomingPasses={satelliteSchedule.upcomingPasses}
              />
            )}

            {/* Soil Info */}
            {soilData && featureFlags?.showSoilInfo !== false && (
              <SoilInfoCard data={soilData} />
            )}
          </TabsContent>
        )}
      </Tabs>
    </Card>
  )
}

// Helper functions for AnalysisTabs
function formatEnvelopeForChartFn(envelopeResult: any): any[] {
  if (!envelopeResult?.envelope?.points) return []
  
  const currentYear = new Date().getFullYear()
  const points = envelopeResult.envelope.points || []
  const currentSeason = envelopeResult.currentSeason || []
  
  const currentMap = new Map<number, number>()
  for (const pt of currentSeason) {
    const doy = pt.dayOfYear || getDayOfYearFn(pt.date)
    currentMap.set(doy, pt.value)
  }
  
  const daysWithData = new Set(currentSeason.map((pt: any) => pt.dayOfYear || getDayOfYearFn(pt.date)))
  
  return points
    .filter((p: any) => daysWithData.has(p.dayOfYear))
    .map((p: any) => ({
      date: getDateFromDayOfYearFn(p.dayOfYear, currentYear),
      mean: p.mean,
      upper: p.upper,
      lower: p.lower,
      current: currentMap.get(p.dayOfYear),
      isAnomaly: currentMap.has(p.dayOfYear) && 
        (currentMap.get(p.dayOfYear)! > p.upper || currentMap.get(p.dayOfYear)! < p.lower)
    }))
}

function getDayOfYearFn(date: string | Date): number {
  const d = typeof date === 'string' ? new Date(date) : date
  const start = new Date(d.getFullYear(), 0, 0)
  const diff = d.getTime() - start.getTime()
  const oneDay = 1000 * 60 * 60 * 24
  return Math.floor(diff / oneDay)
}

function getDateFromDayOfYearFn(dayOfYear: number, year: number): string {
  const date = new Date(year, 0, dayOfYear)
  return date.toISOString().split('T')[0]
}

function getRiskLevelFn(summary: any): 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO' {
  if (!summary) return 'BAIXO'
  if (summary.extremeEvents >= 5) return 'CRITICO'
  if (summary.extremeEvents >= 2 || Math.abs(summary.avgDeviation) > 2) return 'ALTO'
  if (summary.daysAboveNormal + summary.daysBelowNormal > 10) return 'MEDIO'
  return 'BAIXO'
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
  const [precipitationData, setPrecipitationData] = useState<any>(null)
  const [harvestAdjustment, setHarvestAdjustment] = useState<any>(null)
  const [waterBalanceData, setWaterBalanceData] = useState<any>(null)
  const [eosAdjustment, setEosAdjustment] = useState<any>(null)
  const [thermalData, setThermalData] = useState<any>(null)
  const [soilData, setSoilData] = useState<any>(null)
  const [climateEnvelopeData, setClimateEnvelopeData] = useState<any>(null)
  const [radarData, setRadarData] = useState<any>(null)
  const [featureFlags, setFeatureFlags] = useState<any>(null)
  const [satelliteSchedule, setSatelliteSchedule] = useState<any>(null)
  const [eosFusion, setEosFusion] = useState<EosFusionResult | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyzingTemplate, setAnalyzingTemplate] = useState<string | null>(null)
  const [isReprocessing, setIsReprocessing] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [fieldRes, templatesRes, settingsRes] = await Promise.all([
        fetch(`/api/fields/${fieldId}`),
        fetch('/api/templates'),
        fetch('/api/workspace/settings')
      ])

      const fieldData = await fieldRes.json()
      const templatesData = await templatesRes.json()
      const settingsData = settingsRes.ok ? await settingsRes.json() : null

      setField(fieldData.field)
      setHistoricalNdvi(fieldData.historicalNdvi || [])
      setCycleAnalysis(fieldData.cycleAnalysis || null)
      setCorrelationDetails(fieldData.correlationDetails || null)
      setChartOverlayData(fieldData.chartOverlayData || [])
      setHarvestWindowData(fieldData.harvestWindow || null)
      setZarcInfo(fieldData.zarcInfo || null)
      setTemplates(templatesData.templates || [])
      setFeatureFlags(settingsData?.featureFlags || null)

      // Parse precipitation data from rawPrecipData
      const agroData = fieldData.field?.agroData
      if (agroData?.rawPrecipData) {
        try {
          const precip = JSON.parse(agroData.rawPrecipData)
          if (precip.points) {
            // Novo formato (precipitation.service)
            setPrecipitationData(precip)
          }
        } catch {
          setPrecipitationData(null)
        }
      }

      // Parse harvest adjustment and water balance from rawAreaData
      if (agroData?.rawAreaData) {
        try {
          const areaData = JSON.parse(agroData.rawAreaData)
          
          if (areaData.harvestAdjustment) {
            setHarvestAdjustment(areaData.harvestAdjustment)
          }
          if (areaData.waterBalance) {
            const wb = typeof areaData.waterBalance === 'string' 
              ? JSON.parse(areaData.waterBalance) 
              : areaData.waterBalance
            setWaterBalanceData(wb)
          }
          if (areaData.eosAdjustment) {
            setEosAdjustment(areaData.eosAdjustment)
          }
          if (areaData.thermal) {
            const thermal = typeof areaData.thermal === 'string' 
              ? JSON.parse(areaData.thermal) 
              : areaData.thermal
            setThermalData(thermal)
          }
          if (areaData.climateEnvelope) {
            const envelope = areaData.climateEnvelope
            
            const parsed: any = {}
            if (envelope.precipitation) {
              parsed.precipitation = typeof envelope.precipitation === 'string'
                ? JSON.parse(envelope.precipitation)
                : envelope.precipitation
            }
            if (envelope.temperature) {
              parsed.temperature = typeof envelope.temperature === 'string'
                ? JSON.parse(envelope.temperature)
                : envelope.temperature
            }
            setClimateEnvelopeData(parsed)
          }
          
          // Parse radar data
          if (areaData.radar) {
            const radar = typeof areaData.radar === 'string'
              ? JSON.parse(areaData.radar)
              : areaData.radar
            setRadarData(radar)
          }
        } catch {
          // Silently handle parsing errors
          setHarvestAdjustment(null)
          setWaterBalanceData(null)
          setEosAdjustment(null)
          setThermalData(null)
          setClimateEnvelopeData(null)
          setRadarData(null)
        }
      }

      // Parse soil data from rawSoilData
      if (agroData?.rawSoilData) {
        try {
          const soil = JSON.parse(agroData.rawSoilData)
          // Pode vir como array (talhao_0) ou objeto direto
          const soilInfo = Array.isArray(soil) ? soil[0] : (soil['talhao_0']?.[0] || soil)
          setSoilData(soilInfo)
        } catch {
          setSoilData(null)
        }
      }

      // Calculate EOS Fusion (combine NDVI + GDD + Water Balance)
      try {
        const ndviPoints = fieldData.field?.ndviData || []
        const currentSeasonNdvi = ndviPoints.filter((p: any) => !p.isHistorical)
        
        // Get current and peak NDVI
        let currentNdvi = 0
        let peakNdvi = 0
        let ndviDeclineRate = 0
        
        if (currentSeasonNdvi.length > 0) {
          const lastPt = currentSeasonNdvi[currentSeasonNdvi.length - 1]
          currentNdvi = lastPt?.ndviSmooth || lastPt?.ndviRaw || 0
          
          // Find peak
          for (const pt of currentSeasonNdvi) {
            const val = pt.ndviSmooth || pt.ndviRaw || 0
            if (val > peakNdvi) peakNdvi = val
          }
          
          // Calculate decline rate (last 5 points)
          if (currentSeasonNdvi.length >= 5) {
            const recentPoints = currentSeasonNdvi.slice(-5)
            const firstVal = recentPoints[0]?.ndviSmooth || recentPoints[0]?.ndviRaw || 0
            const lastVal = recentPoints[recentPoints.length - 1]?.ndviSmooth || recentPoints[recentPoints.length - 1]?.ndviRaw || 0
            ndviDeclineRate = firstVal > 0 ? ((firstVal - lastVal) / firstVal) * 100 / 5 : 0
          }
        }
        
        // Parse GDD data
        let gddAccumulated = 0
        let gddRequired = 1300
        let gddConfidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW'
        let eosGdd: Date | null = null
        
        if (agroData?.rawAreaData) {
          try {
            const areaData = JSON.parse(agroData.rawAreaData)
            const thermal = areaData.thermal
            if (thermal) {
              const thermalParsed = typeof thermal === 'string' ? JSON.parse(thermal) : thermal
              if (thermalParsed.gddAnalysis) {
                gddAccumulated = thermalParsed.gddAnalysis.accumulatedGdd || 0
                gddRequired = thermalParsed.gddAnalysis.requiredGdd || 1300
                gddConfidence = thermalParsed.gddAnalysis.confidence || 'LOW'
                if (thermalParsed.gddAnalysis.projectedEos) {
                  eosGdd = new Date(thermalParsed.gddAnalysis.projectedEos)
                }
              }
            }
          } catch {
            // Silently handle GDD parsing errors
          }
        }
        
        // Parse water balance
        let waterStressLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'NONE'
        let stressDays = 0
        let yieldImpact = 0
        
        if (agroData?.rawAreaData) {
          try {
            const areaData = JSON.parse(agroData.rawAreaData)
            const wb = areaData.waterBalance
            if (wb) {
              const wbParsed = typeof wb === 'string' ? JSON.parse(wb) : wb
              stressDays = wbParsed.stressDays || 0
              if (stressDays >= 20) waterStressLevel = 'CRITICAL'
              else if (stressDays >= 10) waterStressLevel = 'HIGH'
              else if (stressDays >= 5) waterStressLevel = 'MEDIUM'
              else if (stressDays > 0) waterStressLevel = 'LOW'
              
              // Estimate yield impact
              if (wbParsed.totalDeficit > 300) yieldImpact = -30
              else if (wbParsed.totalDeficit > 150) yieldImpact = -15
              else if (wbParsed.totalDeficit > 50) yieldImpact = -5
            }
          } catch {}
        }
        
        // Extract fusion metrics from areaData (if available)
        let fusionMetricsForEos: { gapsFilled: number, maxGapDays: number, radarContribution: number, continuityScore: number } | undefined
        if (agroData?.rawAreaData) {
          try {
            const areaDataForFusion = JSON.parse(agroData.rawAreaData)
            if (areaDataForFusion.fusionMetrics) {
              fusionMetricsForEos = areaDataForFusion.fusionMetrics
            }
          } catch { /* ignore */ }
        }
        
        // Calculate fusion
        if (agroData?.eosDate || eosGdd) {
          const fusionInput: EosFusionInput = {
            eosNdvi: agroData?.eosDate ? new Date(agroData.eosDate) : null,
            ndviConfidence: agroData?.confidenceScore || 50,
            currentNdvi,
            peakNdvi,
            ndviDeclineRate,
            eosGdd,
            gddConfidence,
            gddAccumulated,
            gddRequired,
            waterStressLevel,
            stressDays,
            yieldImpact,
            fusionMetrics: fusionMetricsForEos,
            plantingDate: agroData?.plantingDate ? new Date(agroData.plantingDate) : new Date(),
            cropType: fieldData.field?.cropType || 'SOJA'
          }
          
          const fusionResult = calculateFusedEos(fusionInput)
          setEosFusion(fusionResult)
        }
      } catch (e) {
        // EOS fusion calculation failed - using fallback
        setEosFusion(null)
      }

      // Calculate satellite schedule from NDVI data
      const ndviPoints = fieldData.field?.ndviData || []
      const currentSeasonNdvi = ndviPoints.filter((p: any) => !p.isHistorical)
      if (currentSeasonNdvi.length > 0) {
        const lastNdviDate = currentSeasonNdvi[currentSeasonNdvi.length - 1]?.date
        if (lastNdviDate) {
          const lastDate = new Date(lastNdviDate)
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          
          // CORREÇÃO: Calcular próxima passagem que seja FUTURA (após hoje)
          const s2RevisitDays = 5
          const s1RevisitDays = 6
          
          // Loop até encontrar a próxima passagem S2 que seja >= hoje
          const nextS2 = new Date(lastDate)
          while (nextS2 <= today) {
            nextS2.setDate(nextS2.getDate() + s2RevisitDays)
          }
          
          // Extrair último dado de radar do rawAreaData
          let lastRadarDate: string | null = null
          if (agroData?.rawAreaData) {
            try {
              const areaDataForRadar = JSON.parse(agroData.rawAreaData)
              if (areaDataForRadar.radar) {
                const radarParsed = typeof areaDataForRadar.radar === 'string' 
                  ? JSON.parse(areaDataForRadar.radar) 
                  : areaDataForRadar.radar
                if (radarParsed.scenes && radarParsed.scenes.length > 0) {
                  // Ordenar cenas por data e pegar a mais recente
                  const sortedScenes = [...radarParsed.scenes].sort((a: any, b: any) => 
                    new Date(b.date || b.datetime).getTime() - new Date(a.date || a.datetime).getTime()
                  )
                  lastRadarDate = sortedScenes[0]?.date || sortedScenes[0]?.datetime || null
                }
              }
            } catch { /* ignore */ }
          }
          
          // Loop até encontrar a próxima passagem S1 que seja >= hoje
          const lastS1 = lastRadarDate ? new Date(lastRadarDate) : lastDate
          const nextS1 = new Date(lastS1)
          while (nextS1 <= today) {
            nextS1.setDate(nextS1.getDate() + s1RevisitDays)
          }
          
          const daysUntilS2 = Math.ceil((nextS2.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          const daysUntilS1 = Math.ceil((nextS1.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          
          // Gerar próximas 4 passagens
          const upcomingPasses: Array<{ date: string; satellite: string; daysAway: number }> = []
          
          // Próximas 2 passagens S2
          let s2Pass = new Date(nextS2)
          for (let i = 0; i < 2; i++) {
            const daysAway = Math.ceil((s2Pass.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            upcomingPasses.push({
              date: s2Pass.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
              satellite: 'S2A',
              daysAway
            })
            s2Pass.setDate(s2Pass.getDate() + s2RevisitDays)
          }
          
          // Próximas 2 passagens S1
          let s1Pass = new Date(nextS1)
          for (let i = 0; i < 2; i++) {
            const daysAway = Math.ceil((s1Pass.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            upcomingPasses.push({
              date: s1Pass.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
              satellite: 'S1A',
              daysAway
            })
            s1Pass.setDate(s1Pass.getDate() + s1RevisitDays)
          }
          
          // Ordenar por data mais próxima
          upcomingPasses.sort((a, b) => a.daysAway - b.daysAway)
          
          setSatelliteSchedule({
            lastS2Date: lastNdviDate,
            nextS2Date: nextS2.toISOString(),
            lastS1Date: lastRadarDate,
            nextS1Date: nextS1.toISOString(),
            daysUntilNextData: Math.min(daysUntilS2, daysUntilS1),
            upcomingPasses
          })
        }
      }

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
      .catch(() => { /* Request sent, processing in background */ })

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
  const baseChartData = chartOverlayData.length > 0 
    ? chartOverlayData 
    : prepareChartData(ndviData, historicalNdvi, agroData)
  
  // Enriquecer chartData com dados de radar (se disponíveis e flag habilitada)
  const chartData = useMemo(() => {
    if (!featureFlags?.showRadarOverlay || !radarData?.rviTimeSeries?.length) {
      return baseChartData
    }
    
    // Modelo de conversão RVI -> NDVI (mesmo usado no backend)
    // NDVI = a * RVI + b (SOJA: a=1.15, b=-0.15)
    const cropType = field?.cropType || 'SOJA'
    const params: Record<string, { a: number, b: number }> = {
      'SOJA': { a: 1.15, b: -0.15 },
      'MILHO': { a: 1.10, b: -0.12 },
      'ALGODAO': { a: 1.20, b: -0.18 }
    }
    const { a, b } = params[cropType] || { a: 1.12, b: -0.14 }
    
    // Criar mapa de datas -> radarNdvi
    const radarMap = new Map<string, number>()
    for (const pt of radarData.rviTimeSeries) {
      const ndviEstimate = Math.max(0, Math.min(1, a * pt.rvi + b))
      radarMap.set(pt.date, ndviEstimate)
    }
    
    // Adicionar radarNdvi aos pontos existentes
    return baseChartData.map((pt: any) => {
      const radarNdvi = radarMap.get(pt.date)
      return radarNdvi !== undefined ? { ...pt, radarNdvi } : pt
    })
  }, [baseChartData, radarData, featureFlags?.showRadarOverlay, field?.cropType])
  
  // Calcular informações do ciclo para exibição
  const hasHistoricalCycles = (cycleAnalysis?.historicalCycles?.length ?? 0) > 0
  const numHistoricalYears = cycleAnalysis?.historicalCycles?.length ?? 0

  // Calcular janela de colheita
  // SEMPRE usar eosFusion.eos quando disponível (é o mais preciso), senão usar harvestWindowData da API ou calcular
  const harvestWindow = (() => {
    // Se temos eosFusion, SEMPRE usar essa data (sobrescreve dados da API)
    if (eosFusion?.eos) {
      const areaHa = agroData?.areaHa || 100
      const harvestCapacityHaPerDay = 50
      const harvestDays = Math.ceil(areaHa / harvestCapacityHaPerDay)
      
      const harvestStartDate = new Date(eosFusion.eos)
      const harvestEndDate = new Date(eosFusion.eos)
      harvestEndDate.setDate(harvestEndDate.getDate() + harvestDays)
      
      return {
        startDate: harvestStartDate.toISOString().split('T')[0],
        endDate: harvestEndDate.toISOString().split('T')[0],
        source: 'fusion'
      }
    }
    
    // Fallback para dados da API
    if (harvestWindowData) {
      return harvestWindowData
    }
    
    // Fallback para cálculo local com agroData.eosDate
    if (agroData?.eosDate) {
      const areaHa = agroData.areaHa || 100
      const harvestCapacityHaPerDay = 50
      const harvestDays = Math.ceil(areaHa / harvestCapacityHaPerDay)
      
      const harvestStartDate = new Date(agroData.eosDate)
      const harvestEndDate = new Date(agroData.eosDate)
      harvestEndDate.setDate(harvestEndDate.getDate() + harvestDays)
      
      return {
        startDate: harvestStartDate.toISOString().split('T')[0],
        endDate: harvestEndDate.toISOString().split('T')[0],
        daysToHarvest: harvestDays,
        areaHa,
        source: 'agroData'
      }
    }
    
    return null
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
        {/* Usa confiança da fusão EOS quando disponível, senão usa NDVI (default) */}
        <MetricCards
          areaHa={agroData?.areaHa}
          volumeEstimatedKg={agroData?.volumeEstimatedKg}
          historicalCorrelation={agroData?.historicalCorrelation}
          confidenceScore={eosFusion ? eosFusion.confidence : agroData?.confidenceScore}
          confidence={eosFusion ? (eosFusion.confidence >= 75 ? 'HIGH' : eosFusion.confidence >= 50 ? 'MEDIUM' : 'LOW') : agroData?.confidence}
        />

        {/* Phenology Timeline - com ZARC e EOS Fusion integrados */}
        <PhenologyTimeline
          plantingDate={agroData?.plantingDate}
          sosDate={agroData?.sosDate}
          eosDate={eosFusion ? eosFusion.eos.toISOString() : agroData?.eosDate}
          method={agroData?.phenologyMethod}
          zarcInfo={zarcInfo}
          eosFusion={eosFusion ? {
            method: eosFusion.method,
            confidence: eosFusion.confidence,
            phenologicalStage: eosFusion.phenologicalStage,
            explanation: eosFusion.explanation,
            factors: eosFusion.factors,
            projections: {
              ndvi: {
                date: eosFusion.projections.ndvi.date?.toISOString() || null,
                confidence: eosFusion.projections.ndvi.confidence,
                status: eosFusion.projections.ndvi.status
              },
              gdd: {
                date: eosFusion.projections.gdd.date?.toISOString() || null,
                confidence: eosFusion.projections.gdd.confidence,
                status: eosFusion.projections.gdd.status
              },
              waterAdjustment: eosFusion.projections.waterAdjustment
            },
            warnings: eosFusion.warnings
          } : null}
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
                  
                  {/* Radar NDVI overlay - when enabled and data available */}
                  {featureFlags?.showRadarOverlay && radarData?.rviTimeSeries?.length > 0 && (
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
                
                {/* Radar Sentinel-1 */}
                {featureFlags?.showRadarOverlay && chartData.some((d: any) => d.radarNdvi !== undefined) && (
                  <div className="flex items-center gap-2">
                    <div className="w-8 border-t-2 border-dashed border-violet-500"></div>
                    <span className="text-violet-600 font-medium">Radar (Sentinel-1)</span>
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

        {/* Tabs de Dados */}
        <AnalysisTabs
          featureFlags={featureFlags}
          precipitationData={precipitationData}
          harvestWindow={harvestWindow}
          harvestAdjustment={harvestAdjustment}
          waterBalanceData={waterBalanceData}
          eosAdjustment={eosAdjustment}
          thermalData={thermalData}
          climateEnvelopeData={climateEnvelopeData}
          soilData={soilData}
          satelliteSchedule={satelliteSchedule}
          fieldId={fieldId}
          cropType={field?.cropType || 'SOJA'}
          plantingDate={agroData?.plantingDate}
          sosDate={agroData?.sosDate}
        />

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

// Helper function to format climate envelope data for chart
function formatEnvelopeForChart(envelopeResult: any): any[] {
  if (!envelopeResult?.envelope?.points) return []
  
  const currentYear = new Date().getFullYear()
  const points = envelopeResult.envelope.points || []
  const currentSeason = envelopeResult.currentSeason || []
  
  // Create a map of current season values by dayOfYear
  const currentMap = new Map<number, number>()
  for (const pt of currentSeason) {
    const doy = pt.dayOfYear || getDayOfYear(pt.date)
    currentMap.set(doy, pt.value)
  }
  
  // Filter to only include days with current data (for the chart range)
  const daysWithData = new Set(currentSeason.map((pt: any) => pt.dayOfYear || getDayOfYear(pt.date)))
  
  return points
    .filter((p: any) => daysWithData.has(p.dayOfYear))
    .map((p: any) => ({
      date: getDateFromDayOfYear(p.dayOfYear, currentYear),
      mean: p.mean,
      upper: p.upper,
      lower: p.lower,
      current: currentMap.get(p.dayOfYear),
      isAnomaly: currentMap.has(p.dayOfYear) && 
        (currentMap.get(p.dayOfYear)! > p.upper || currentMap.get(p.dayOfYear)! < p.lower)
    }))
}

function getDayOfYear(date: string | Date): number {
  const d = typeof date === 'string' ? new Date(date) : date
  const start = new Date(d.getFullYear(), 0, 0)
  const diff = d.getTime() - start.getTime()
  const oneDay = 1000 * 60 * 60 * 24
  return Math.floor(diff / oneDay)
}

function getDateFromDayOfYear(dayOfYear: number, year: number): string {
  const date = new Date(year, 0, dayOfYear)
  return date.toISOString().split('T')[0]
}

function getRiskLevel(summary: any): 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO' {
  if (!summary) return 'BAIXO'
  if (summary.extremeEvents >= 5) return 'CRITICO'
  if (summary.extremeEvents >= 2 || Math.abs(summary.avgDeviation) > 2) return 'ALTO'
  if (summary.daysAboveNormal + summary.daysBelowNormal > 10) return 'MEDIO'
  return 'BAIXO'
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
