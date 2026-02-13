'use client'

import { useState, useCallback, useEffect } from 'react'
import { calculateFusedEos, EosFusionInput, EosFusionResult } from '@/lib/services/eos-fusion.service'

export interface CycleAnalysis {
  currentCycle: any
  historicalCycles: any[]
  envelope: any[]
  avgCycleDays: number
  projectedEosDate: string | null
  correlationScore: number
  adherenceScore: number
}

export interface Template {
  id: string
  name: string
  description: string
  icon: string
  color: string
}

export function useReportData(fieldId: string) {
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
  const [isSarFusionActive, setIsSarFusionActive] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [subFieldComparison, setSubFieldComparison] = useState<any>(null)

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

      // Buscar comparação de subtalhões se o pai tem filhos e a flag está ativa
      const subFieldCount = fieldData.field?._count?.subFields ?? 0
      const comparisonEnabled = settingsData?.featureFlags?.enableSubFieldComparison !== false
        && settingsData?.featureFlags?.enableSubFields === true
      if (subFieldCount > 0 && comparisonEnabled) {
        try {
          const compRes = await fetch(`/api/fields/${fieldId}/subfields/comparison`)
          if (compRes.ok) {
            setSubFieldComparison(await compRes.json())
          }
        } catch { /* silently ignore comparison errors */ }
      }

      const agroData = fieldData.field?.agroData

      if (agroData?.rawPrecipData) {
        try {
          const precip = JSON.parse(agroData.rawPrecipData)
          if (precip.points) {
            setPrecipitationData(precip)
          }
        } catch {
          setPrecipitationData(null)
        }
      }

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

          if (areaData.radar) {
            const radar = typeof areaData.radar === 'string'
              ? JSON.parse(areaData.radar)
              : areaData.radar
            setRadarData(radar)
          }
        } catch {
          setHarvestAdjustment(null)
          setWaterBalanceData(null)
          setEosAdjustment(null)
          setThermalData(null)
          setClimateEnvelopeData(null)
          setRadarData(null)
        }
      }

      if (agroData?.rawSoilData) {
        try {
          const soil = JSON.parse(agroData.rawSoilData)
          const soilInfo = Array.isArray(soil) ? soil[0] : (soil['talhao_0']?.[0] || soil)
          setSoilData(soilInfo)
        } catch {
          setSoilData(null)
        }
      }

      try {
        const ndviPoints = fieldData.field?.ndviData || []
        const currentSeasonNdvi = ndviPoints.filter((p: any) => !p.isHistorical)

        let currentNdvi = 0
        let peakNdvi = 0
        let ndviDeclineRate = 0

        if (currentSeasonNdvi.length > 0) {
          const lastPt = currentSeasonNdvi[currentSeasonNdvi.length - 1]
          currentNdvi = lastPt?.ndviSmooth || lastPt?.ndviRaw || 0

          for (const pt of currentSeasonNdvi) {
            const val = pt.ndviSmooth || pt.ndviRaw || 0
            if (val > peakNdvi) peakNdvi = val
          }

          if (currentSeasonNdvi.length >= 5) {
            const recentPoints = currentSeasonNdvi.slice(-5)
            const firstVal = recentPoints[0]?.ndviSmooth || recentPoints[0]?.ndviRaw || 0
            const lastVal = recentPoints[recentPoints.length - 1]?.ndviSmooth || recentPoints[recentPoints.length - 1]?.ndviRaw || 0
            ndviDeclineRate = firstVal > 0 ? ((firstVal - lastVal) / firstVal) * 100 / 5 : 0
          }
        }

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

              if (wbParsed.totalDeficit > 300) yieldImpact = -30
              else if (wbParsed.totalDeficit > 150) yieldImpact = -15
              else if (wbParsed.totalDeficit > 50) yieldImpact = -5
            }
          } catch { /* ignore */ }
        }

        let fusionMetricsForEos: { gapsFilled: number, maxGapDays: number, radarContribution: number, continuityScore: number, isBeta?: boolean } | undefined
        if (agroData?.rawAreaData) {
          try {
            const areaDataForFusion = JSON.parse(agroData.rawAreaData)
            if (areaDataForFusion.fusionMetrics) {
              fusionMetricsForEos = areaDataForFusion.fusionMetrics
              setIsSarFusionActive(fusionMetricsForEos?.isBeta === true)
            }
          } catch { /* ignore */ }
        }

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

          if (fieldData.fusedEos?.date) {
            const serverEos = new Date(fieldData.fusedEos.date)
            fusionResult.eos = serverEos
            fusionResult.method = (fieldData.fusedEos.method || fusionResult.method) as EosFusionResult['method']
            fusionResult.confidence = fieldData.fusedEos.confidence ?? fusionResult.confidence
            fusionResult.passed = serverEos < new Date(new Date().toISOString().split('T')[0])
          }

          setEosFusion(fusionResult)
        }
      } catch {
        setEosFusion(null)
      }

      const ndviPoints = fieldData.field?.ndviData || []
      const currentSeasonNdvi = ndviPoints.filter((p: any) => !p.isHistorical)
      if (currentSeasonNdvi.length > 0) {
        const lastNdviDate = currentSeasonNdvi[currentSeasonNdvi.length - 1]?.date
        if (lastNdviDate) {
          const lastDate = new Date(lastNdviDate)
          const today = new Date()
          today.setHours(0, 0, 0, 0)

          const s2RevisitDays = 5
          const s1RevisitDays = 6

          const nextS2 = new Date(lastDate)
          while (nextS2 <= today) {
            nextS2.setDate(nextS2.getDate() + s2RevisitDays)
          }

          let lastRadarDate: string | null = null
          if (agroData?.rawAreaData) {
            try {
              const areaDataForRadar = JSON.parse(agroData.rawAreaData)
              if (areaDataForRadar.radar) {
                const radarParsed = typeof areaDataForRadar.radar === 'string'
                  ? JSON.parse(areaDataForRadar.radar)
                  : areaDataForRadar.radar
                if (radarParsed.scenes && radarParsed.scenes.length > 0) {
                  const sortedScenes = [...radarParsed.scenes].sort((a: any, b: any) =>
                    new Date(b.date || b.datetime).getTime() - new Date(a.date || a.datetime).getTime()
                  )
                  lastRadarDate = sortedScenes[0]?.date || sortedScenes[0]?.datetime || null
                }
              }
            } catch { /* ignore */ }
          }

          const lastS1 = lastRadarDate ? new Date(lastRadarDate) : lastDate
          const nextS1 = new Date(lastS1)
          while (nextS1 <= today) {
            nextS1.setDate(nextS1.getDate() + s1RevisitDays)
          }

          const daysUntilS2 = Math.ceil((nextS2.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          const daysUntilS1 = Math.ceil((nextS1.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

          const upcomingPasses: Array<{ date: string; satellite: string; daysAway: number }> = []

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldId])

  return {
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
  }
}
