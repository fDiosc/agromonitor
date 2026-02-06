import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getFullReport, getComplementaryData } from '@/lib/services/merx.service'
import { calculatePhenology } from '@/lib/services/phenology.service'
import { calculateSphericalArea } from '@/lib/services/geometry.service'
import { calculateHistoricalCorrelation } from '@/lib/services/correlation.service'
import { analyzeZarc } from '@/lib/services/zarc.service'
import { getPrecipitationForField, serializePrecipitation } from '@/lib/services/precipitation.service'
import { getWaterBalanceForField, serializeWaterBalance } from '@/lib/services/water-balance.service'
import { getThermalDataForField, serializeThermalData } from '@/lib/services/thermal.service'
import { getClimateEnvelopeForField, serializeClimateEnvelope } from '@/lib/services/climate-envelope.service'
import { getS1DataForField, serializeS1Data } from '@/lib/services/sentinel1.service'
import { getFusedNdviForField, serializeFusionResult, calculateFusionQuality, FusionResult } from '@/lib/services/ndvi-fusion.service'
import { findCoincidentPairs, collectRviNdviPairs, trainLocalModel, getCalibrationStats } from '@/lib/services/rvi-calibration.service'
import { isFeatureEnabled } from '@/lib/services/feature-flags.service'
import { 
  fuseSarNdvi, 
  isSarFusionEnabled, 
  calculateHarvestConfidence,
  FusionResult as AdaptiveFusionResult 
} from '@/lib/services/sar-ndvi-adaptive.service'

interface RouteParams {
  params: { id: string }
}

/**
 * POST /api/fields/[id]/process
 * Processa os dados agronômicos de um talhão
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const startTime = Date.now()

  try {
    // Buscar talhão
    const field = await prisma.field.findUnique({
      where: { id: params.id }
    })

    if (!field) {
      return NextResponse.json(
        { error: 'Talhão não encontrado' },
        { status: 404 }
      )
    }

    // Atualizar status para PROCESSING
    await prisma.field.update({
      where: { id: params.id },
      data: { status: 'PROCESSING' }
    })

    try {
      // Buscar dados da API Merx
      const merxReport = await getFullReport(
        field.geometryJson,
        field.seasonStartDate.toISOString().split('T')[0],
        field.cropType
      )

      // Calcular área local se Merx não retornou
      let areaHa = merxReport.area_ha
      if (!areaHa || areaHa <= 0) {
        const geojson = JSON.parse(field.geometryJson)
        const coords = geojson.features?.[0]?.geometry?.coordinates?.[0] || []
        areaHa = calculateSphericalArea(coords)
      }

      // Calcular fenologia
      // Se o produtor informou a data de plantio, passar para o serviço
      const plantingDateInput = field.plantingDateInput 
        ? field.plantingDateInput.toISOString().split('T')[0] 
        : null
      
      const phenology = calculatePhenology(
        merxReport.ndvi,
        merxReport.historical_ndvi,
        { 
          crop: field.cropType, 
          areaHa,
          plantingDateInput 
        }
      )
      
      // Log se plantio foi informado
      if (plantingDateInput) {
        console.log(`[PROCESS] Data de plantio informada pelo produtor: ${plantingDateInput}`)
      }

      // Calcular correlação histórica robusta
      const correlation = calculateHistoricalCorrelation(
        merxReport.ndvi,
        merxReport.historical_ndvi,
        { sosThreshold: 0.35, minPointsForCorrelation: 5 }
      )

      console.log('Correlation analysis:', {
        pearson: correlation.pearsonScore,
        rmse: correlation.rmseScore,
        adherence: correlation.adherenceScore,
        composite: correlation.compositeScore,
        method: correlation.alignmentMethod,
        points: correlation.numPointsCompared,
        years: correlation.numHistoricalYears,
        warnings: correlation.warnings
      })

      // Usar correlação robusta se disponível, senão fallback para phenology
      const finalCorrelation = correlation.numPointsCompared >= 5 
        ? correlation.compositeScore 
        : phenology.historicalCorrelation

      // Buscar dados complementares
      const complementary = await getComplementaryData(
        field.geometryJson,
        phenology.plantingDate || field.seasonStartDate.toISOString().split('T')[0],
        field.cropType
      )

      // Analisar ZARC para determinar janela de plantio e risco
      const plantingDateForZarc = phenology.plantingDate 
        ? new Date(phenology.plantingDate) 
        : (field.plantingDateInput || null)
      
      const zarcAnalysis = analyzeZarc(
        complementary.zarc_anual,
        plantingDateForZarc
      )

      // Log ZARC se disponível
      if (zarcAnalysis.window) {
        console.log(`[PROCESS] ZARC: Janela ${zarcAnalysis.window.windowStart.toISOString().split('T')[0]} - ${zarcAnalysis.window.windowEnd.toISOString().split('T')[0]}, Status: ${zarcAnalysis.plantingStatus}`)
      }

      // =======================================================
      // BUSCAR DADOS DE PRECIPITAÇÃO (se feature habilitada)
      // =======================================================
      let precipitationData: string | null = null
      let harvestAdjustment: any = null
      
      if (field.workspaceId) {
        try {
          const geometry = JSON.parse(field.geometryJson)
          const harvestStart = phenology.eosDate ? new Date(phenology.eosDate) : undefined
          
          const precipResult = await getPrecipitationForField(
            field.workspaceId,
            geometry,
            field.seasonStartDate,
            harvestStart
          )
          
          if (precipResult) {
            precipitationData = serializePrecipitation(precipResult.data)
            harvestAdjustment = precipResult.adjustment
            
            console.log('[PROCESS] Precipitação:', {
              totalMm: precipResult.data.totalMm.toFixed(1),
              rainyDays: precipResult.data.rainyDays,
              source: precipResult.data.source,
              adjustment: harvestAdjustment?.delayDays || 0
            })
          }
        } catch (precipError) {
          console.warn('[PROCESS] Erro ao buscar precipitação (continuando):', precipError)
        }
      }

      // =======================================================
      // BUSCAR DADOS DE BALANÇO HÍDRICO (se feature habilitada)
      // =======================================================
      let waterBalanceData: string | null = null
      let eosAdjustment: any = null
      
      if (field.workspaceId) {
        try {
          const geometry = JSON.parse(field.geometryJson)
          const eosDate = phenology.eosDate ? new Date(phenology.eosDate) : undefined
          const plantingDate = phenology.plantingDate 
            ? new Date(phenology.plantingDate) 
            : field.seasonStartDate
          
          const waterBalanceResult = await getWaterBalanceForField(
            field.workspaceId,
            geometry,
            plantingDate,
            field.cropType,
            eosDate
          )
          
          if (waterBalanceResult) {
            waterBalanceData = serializeWaterBalance(waterBalanceResult.data)
            eosAdjustment = waterBalanceResult.adjustment
            
            console.log('[PROCESS] Balanço Hídrico:', {
              totalDeficit: waterBalanceResult.data.totalDeficit.toFixed(1),
              stressDays: waterBalanceResult.data.stressDays,
              source: waterBalanceResult.data.source,
              stressLevel: eosAdjustment?.stressLevel || 'N/A'
            })
          }
        } catch (waterBalanceError) {
          console.warn('[PROCESS] Erro ao buscar balanço hídrico (continuando):', waterBalanceError)
        }
      }

      // =======================================================
      // BUSCAR DADOS TÉRMICOS / GDD (se feature habilitada)
      // =======================================================
      let thermalData: string | null = null
      
      if (field.workspaceId) {
        try {
          const geometry = JSON.parse(field.geometryJson)
          const plantingDate = phenology.plantingDate 
            ? new Date(phenology.plantingDate) 
            : field.seasonStartDate
          
          const thermalResult = await getThermalDataForField(
            field.workspaceId,
            geometry,
            plantingDate,
            field.cropType
          )
          
          if (thermalResult) {
            thermalData = serializeThermalData(thermalResult)
            
            console.log('[PROCESS] Soma Térmica (GDD):', {
              accumulatedGdd: thermalResult.gddAnalysis.accumulatedGdd.toFixed(0),
              requiredGdd: thermalResult.gddAnalysis.requiredGdd,
              progressPercent: thermalResult.gddAnalysis.progressPercent.toFixed(1),
              daysToMaturity: thermalResult.gddAnalysis.daysToMaturity,
              confidence: thermalResult.gddAnalysis.confidence
            })
          }
        } catch (thermalError) {
          console.warn('[PROCESS] Erro ao buscar dados térmicos (continuando):', thermalError)
        }
      }

      // =======================================================
      // BUSCAR ENVELOPE CLIMÁTICO HISTÓRICO (se feature habilitada)
      // =======================================================
      let climateEnvelopeData: { precipitation: string | null, temperature: string | null } = {
        precipitation: null,
        temperature: null
      }
      
      if (field.workspaceId) {
        try {
          const geometry = JSON.parse(field.geometryJson)
          
          const envelopeResult = await getClimateEnvelopeForField(
            field.workspaceId,
            geometry,
            field.seasonStartDate
          )
          
          if (envelopeResult) {
            if (envelopeResult.precipitation) {
              climateEnvelopeData.precipitation = serializeClimateEnvelope(envelopeResult.precipitation)
              console.log('[PROCESS] Envelope Precipitação:', {
                historicalYears: envelopeResult.precipitation.envelope.historicalYears,
                anomalies: envelopeResult.precipitation.anomalies.length,
                summary: envelopeResult.precipitation.summary
              })
            }
            if (envelopeResult.temperature) {
              climateEnvelopeData.temperature = serializeClimateEnvelope(envelopeResult.temperature)
              console.log('[PROCESS] Envelope Temperatura:', {
                historicalYears: envelopeResult.temperature.envelope.historicalYears,
                anomalies: envelopeResult.temperature.anomalies.length,
                summary: envelopeResult.temperature.summary
              })
            }
          }
        } catch (envelopeError) {
          console.warn('[PROCESS] Erro ao calcular envelope climático (continuando):', envelopeError)
        }
      }

      // =======================================================
      // BUSCAR DADOS SENTINEL-1 / RADAR (se feature habilitada)
      // =======================================================
      let radarData: string | null = null
      
      if (field.workspaceId) {
        try {
          const geometry = JSON.parse(field.geometryJson)
          const endDate = new Date()
          
          const radarResult = await getS1DataForField(
            field.workspaceId,
            geometry,
            field.seasonStartDate,
            endDate
          )
          
          if (radarResult && radarResult.source !== 'UNAVAILABLE') {
            radarData = serializeS1Data(radarResult)
            
            console.log('[PROCESS] Sentinel-1 Radar:', {
              scenes: radarResult.scenes.length,
              rviPoints: radarResult.rviTimeSeries.length,
              dataPoints: radarResult.data.length,
              source: radarResult.source
            })
          }
        } catch (radarError) {
          console.warn('[PROCESS] Erro ao buscar dados Sentinel-1 (continuando):', radarError)
        }
      }

      // =======================================================
      // CALIBRAÇÃO RVI-NDVI LOCAL (coleta de pares e treinamento)
      // =======================================================
      let calibrationStats: { pairsCount: number, hasModel: boolean, modelR2: number | null, modelRmse: number | null, lastTrainingDate: Date | null } | null = null
      
      if (field.workspaceId && radarData) {
        try {
          const radarParsed = JSON.parse(radarData)
          
          // Converter NDVI do Merx para formato de coleta
          const opticalForCalibration = merxReport.ndvi.map((pt: any) => ({
            date: pt.date,
            ndvi: pt.ndvi_smooth || pt.ndvi_raw || pt.ndvi_interp,
            cloudCover: pt.cloud_cover
          }))
          
          // Encontrar pares coincidentes NDVI-RVI (tolerância de 1 dia)
          const coincidentPairs = findCoincidentPairs(
            opticalForCalibration,
            radarParsed.rviTimeSeries || [],
            1  // tolerância em dias
          )
          
          // Coletar pares no banco de dados
          let pairsCollected = 0
          if (coincidentPairs.length > 0) {
            pairsCollected = await collectRviNdviPairs(params.id, coincidentPairs)
          }
          
          console.log(`[PROCESS] RVI Calibration: ${pairsCollected} pares coletados`)
          
          // Verificar se podemos treinar modelo local
          const useLocalCalibration = await isFeatureEnabled(field.workspaceId, 'useLocalCalibration')
          
          if (useLocalCalibration && pairsCollected > 0) {
            calibrationStats = await getCalibrationStats(params.id)
            
            // Treinar modelo se temos dados suficientes e não temos modelo ainda
            const minPairsForTraining = 15
            if (calibrationStats && calibrationStats.pairsCount >= minPairsForTraining && !calibrationStats.hasModel) {
              console.log('[PROCESS] Treinando modelo local de calibração RVI-NDVI...')
              const trainingResult = await trainLocalModel(params.id, field.cropType || 'SOJA')
              
              if (trainingResult) {
                console.log('[PROCESS] Modelo local treinado com sucesso:', {
                  a: trainingResult.coefficientA.toFixed(4),
                  b: trainingResult.coefficientB.toFixed(4),
                  r2: trainingResult.rSquared.toFixed(3),
                  samples: trainingResult.sampleCount
                })
                // Atualizar stats
                calibrationStats = await getCalibrationStats(params.id)
              } else {
                console.log('[PROCESS] Treinamento falhou - dados insuficientes ou R² muito baixo')
              }
            } else if (calibrationStats?.hasModel) {
              console.log('[PROCESS] Modelo local já existe com R²:', calibrationStats.modelR2?.toFixed(3))
            }
          }
        } catch (calibrationError) {
          console.warn('[PROCESS] Erro na calibração RVI (continuando):', calibrationError)
        }
      }

      // =======================================================
      // FUSÃO NDVI ÓPTICO + RADAR (se feature habilitada e dados disponíveis)
      // =======================================================
      let fusionData: string | null = null
      let fusionMetrics: { 
        gapsFilled: number, 
        maxGapDays: number, 
        radarContribution: number, 
        continuityScore: number, 
        calibrationR2?: number,
        fusionMethod?: string,
        featureUsed?: string,
        isBeta?: boolean
      } | null = null
      let adaptiveFusionResult: AdaptiveFusionResult | null = null
      
      if (field.workspaceId && radarData) {
        try {
          const radarParsed = JSON.parse(radarData)
          
          // Converter NDVI do Merx para formato do serviço de fusão
          const opticalData = merxReport.ndvi.map((pt: any) => ({
            date: pt.date,
            ndvi: pt.ndvi_smooth || pt.ndvi_raw || pt.ndvi_interp,
            cloudCover: pt.cloud_cover
          }))
          
          // Verificar se fusão adaptativa (BETA) está habilitada
          const useAdaptiveFusion = await isSarFusionEnabled(field.workspaceId)
          
          if (useAdaptiveFusion) {
            // ==========================================
            // FUSÃO ADAPTATIVA (BETA) - GPR/KNN
            // ==========================================
            console.log('[PROCESS] Using BETA SAR-NDVI Adaptive Fusion')
            
            // Preparar dados SAR (usar dados históricos se disponíveis)
            const sarData = radarParsed.radarHistorical?.data || radarParsed.data || []
            const sarPoints = sarData.map((d: any) => ({
              date: d.date,
              vv: d.vv,
              vh: d.vh
            })).filter((d: any) => d.vv !== undefined && d.vh !== undefined)
            
            if (sarPoints.length >= 5) {
              adaptiveFusionResult = await fuseSarNdvi(
                params.id,
                opticalData,
                sarPoints
              )
              
              if (adaptiveFusionResult && adaptiveFusionResult.gapsFilled > 0) {
                fusionData = JSON.stringify(adaptiveFusionResult)
                
                // Calcular maior gap
                const sortedPoints = adaptiveFusionResult.points
                  .map(p => new Date(p.date).getTime())
                  .sort((a, b) => a - b)
                
                let maxGapDays = 0
                for (let i = 0; i < sortedPoints.length - 1; i++) {
                  const gap = (sortedPoints[i + 1] - sortedPoints[i]) / (1000 * 60 * 60 * 24)
                  maxGapDays = Math.max(maxGapDays, gap)
                }
                
                const sarRatio = adaptiveFusionResult.sarFusedPoints / 
                  (adaptiveFusionResult.opticalPoints + adaptiveFusionResult.sarFusedPoints)
                
                fusionMetrics = {
                  gapsFilled: adaptiveFusionResult.gapsFilled,
                  maxGapDays,
                  radarContribution: sarRatio,
                  continuityScore: adaptiveFusionResult.modelR2 > 0.5 ? 0.9 : 0.8,
                  calibrationR2: adaptiveFusionResult.modelR2,
                  fusionMethod: adaptiveFusionResult.fusionMethod,
                  featureUsed: adaptiveFusionResult.featureUsed,
                  isBeta: true
                }
                
                console.log('[PROCESS] BETA Adaptive Fusion:', {
                  opticalPoints: adaptiveFusionResult.opticalPoints,
                  sarFusedPoints: adaptiveFusionResult.sarFusedPoints,
                  gapsFilled: adaptiveFusionResult.gapsFilled,
                  method: adaptiveFusionResult.fusionMethod,
                  feature: adaptiveFusionResult.featureUsed,
                  r2: adaptiveFusionResult.modelR2
                })
              }
            } else {
              console.log('[PROCESS] Not enough SAR data for adaptive fusion, falling back')
            }
          }
          
          // Fallback para fusão clássica se adaptativa não executou
          if (!adaptiveFusionResult || adaptiveFusionResult.gapsFilled === 0) {
            // ==========================================
            // FUSÃO CLÁSSICA (RVI-based)
            // ==========================================
            const fusionResult = await getFusedNdviForField(
              field.workspaceId,
              opticalData,
              radarParsed.rviTimeSeries || [],
              field.cropType || 'SOJA',
              params.id
            )
            
            if (fusionResult && fusionResult.gapsFilled > 0) {
              fusionData = serializeFusionResult(fusionResult)
              
              const quality = calculateFusionQuality(fusionResult)
              
              const sortedPoints = fusionResult.points
                .map(p => new Date(p.date).getTime())
                .sort((a, b) => a - b)
              
              let maxGapDays = 0
              for (let i = 0; i < sortedPoints.length - 1; i++) {
                const gap = (sortedPoints[i + 1] - sortedPoints[i]) / (1000 * 60 * 60 * 24)
                maxGapDays = Math.max(maxGapDays, gap)
              }
              
              fusionMetrics = {
                gapsFilled: fusionResult.gapsFilled,
                maxGapDays,
                radarContribution: quality.radarContribution,
                continuityScore: quality.continuityScore,
                calibrationR2: fusionResult.calibrationR2,
                isBeta: false
              }
              
              console.log('[PROCESS] Classic NDVI Fusion:', {
                opticalPoints: fusionResult.opticalPoints,
                radarPoints: fusionResult.radarPoints,
                gapsFilled: fusionResult.gapsFilled,
                method: fusionResult.fusionMethod
              })
            } else {
              console.log('[PROCESS] Fusion not executed or no gaps to fill')
            }
          }
        } catch (fusionError) {
          console.warn('[PROCESS] Erro na fusão NDVI (continuando sem fusão):', fusionError)
          // Fallback gracioso: continua sem fusão, usando apenas dados ópticos
        }
      }

      // =======================================================
      // AJUSTE DE CONFIANÇA BASEADO NA FUSÃO SAR-NDVI
      // =======================================================
      let adjustedConfidence = phenology.confidenceScore
      let confidenceNote = ''
      
      if (adaptiveFusionResult && adaptiveFusionResult.calibrationUsed) {
        // Calcular ajuste de confiança baseado na fusão adaptativa
        const harvestConfidence = calculateHarvestConfidence(
          adaptiveFusionResult,
          phenology.confidenceScore
        )
        adjustedConfidence = harvestConfidence.confidence
        confidenceNote = harvestConfidence.note
        
        console.log('[PROCESS] Harvest confidence adjusted:', {
          original: phenology.confidenceScore,
          adjusted: adjustedConfidence,
          source: harvestConfidence.source,
          note: confidenceNote
        })
      }
      
      // Atualizar phenology com confiança ajustada (mantém original se não há fusão)
      const finalConfidenceScore = Math.round(adjustedConfidence)
      
      // Adicionar nota de fusão às métricas
      if (fusionMetrics && confidenceNote) {
        fusionMetrics = { ...fusionMetrics, confidenceNote } as any
      }

      // Salvar ou atualizar AgroData
      await prisma.agroData.upsert({
        where: { fieldId: params.id },
        update: {
          areaHa,
          volumeEstimatedKg: phenology.yieldEstimateKg,
          plantingDate: phenology.plantingDate ? new Date(phenology.plantingDate) : null,
          sosDate: phenology.sosDate ? new Date(phenology.sosDate) : null,
          eosDate: phenology.eosDate ? new Date(phenology.eosDate) : null,
          peakDate: phenology.peakDate ? new Date(phenology.peakDate) : null,
          cycleDays: phenology.cycleDays,
          phenologyMethod: phenology.method,
          confidenceScore: finalConfidenceScore,
          confidence: phenology.confidence,
          historicalCorrelation: finalCorrelation,
          detectedReplanting: phenology.detectedReplanting,
          replantingDate: phenology.replantingDate ? new Date(phenology.replantingDate) : null,
          yieldEstimateKgHa: phenology.yieldEstimateKgHa,
          phenologyHealth: phenology.phenologyHealth,
          peakNdvi: phenology.peakNdvi,
          rawNdviData: JSON.stringify(merxReport.ndvi),
          rawPrecipData: precipitationData || JSON.stringify(merxReport.precipitacao),
          rawSoilData: JSON.stringify(merxReport.solo),
          rawHistoricalData: JSON.stringify(merxReport.historical_ndvi),
          rawAreaData: JSON.stringify({ area_ha: areaHa, harvestAdjustment, waterBalance: waterBalanceData, eosAdjustment, thermal: thermalData, climateEnvelope: climateEnvelopeData, radar: radarData, fusion: fusionData, fusionMetrics, calibrationStats, confidenceNote }),
          rawZarcData: JSON.stringify(complementary.zarc_anual),
          zarcWindowStart: zarcAnalysis.window?.windowStart || null,
          zarcWindowEnd: zarcAnalysis.window?.windowEnd || null,
          zarcOptimalStart: zarcAnalysis.window?.optimalStart || null,
          zarcOptimalEnd: zarcAnalysis.window?.optimalEnd || null,
          zarcPlantingRisk: zarcAnalysis.plantingRisk,
          zarcPlantingStatus: zarcAnalysis.plantingStatus !== 'UNKNOWN' ? zarcAnalysis.plantingStatus : null,
          diagnostics: JSON.stringify(phenology.diagnostics),
          updatedAt: new Date()
        },
        create: {
          fieldId: params.id,
          areaHa,
          volumeEstimatedKg: phenology.yieldEstimateKg,
          plantingDate: phenology.plantingDate ? new Date(phenology.plantingDate) : null,
          sosDate: phenology.sosDate ? new Date(phenology.sosDate) : null,
          eosDate: phenology.eosDate ? new Date(phenology.eosDate) : null,
          peakDate: phenology.peakDate ? new Date(phenology.peakDate) : null,
          cycleDays: phenology.cycleDays,
          phenologyMethod: phenology.method,
          confidenceScore: finalConfidenceScore,
          confidence: phenology.confidence,
          historicalCorrelation: finalCorrelation,
          detectedReplanting: phenology.detectedReplanting,
          replantingDate: phenology.replantingDate ? new Date(phenology.replantingDate) : null,
          yieldEstimateKgHa: phenology.yieldEstimateKgHa,
          phenologyHealth: phenology.phenologyHealth,
          peakNdvi: phenology.peakNdvi,
          rawNdviData: JSON.stringify(merxReport.ndvi),
          rawPrecipData: precipitationData || JSON.stringify(merxReport.precipitacao),
          rawSoilData: JSON.stringify(merxReport.solo),
          rawHistoricalData: JSON.stringify(merxReport.historical_ndvi),
          rawAreaData: JSON.stringify({ area_ha: areaHa, harvestAdjustment, waterBalance: waterBalanceData, eosAdjustment, thermal: thermalData, climateEnvelope: climateEnvelopeData, radar: radarData, fusion: fusionData, fusionMetrics, calibrationStats, confidenceNote }),
          rawZarcData: JSON.stringify(complementary.zarc_anual),
          zarcWindowStart: zarcAnalysis.window?.windowStart || null,
          zarcWindowEnd: zarcAnalysis.window?.windowEnd || null,
          zarcOptimalStart: zarcAnalysis.window?.optimalStart || null,
          zarcOptimalEnd: zarcAnalysis.window?.optimalEnd || null,
          zarcPlantingRisk: zarcAnalysis.plantingRisk,
          zarcPlantingStatus: zarcAnalysis.plantingStatus !== 'UNKNOWN' ? zarcAnalysis.plantingStatus : null,
          diagnostics: JSON.stringify(phenology.diagnostics)
        }
      })

      // Salvar pontos NDVI atuais
      if (merxReport.ndvi.length > 0) {
        // Limpar dados anteriores
        await prisma.ndviDataPoint.deleteMany({
          where: { fieldId: params.id, isHistorical: false }
        })

        // Inserir novos
        await prisma.ndviDataPoint.createMany({
          data: merxReport.ndvi.map(point => ({
            fieldId: params.id,
            date: new Date(point.date),
            ndviRaw: point.ndvi_raw,
            ndviSmooth: point.ndvi_smooth,
            ndviInterp: point.ndvi_interp,
            cloudCover: point.cloud_cover,
            isHistorical: false,
            seasonYear: new Date(point.date).getFullYear()
          }))
        })
      }

      // Salvar pontos NDVI históricos
      for (let i = 0; i < merxReport.historical_ndvi.length; i++) {
        const historicalSeason = merxReport.historical_ndvi[i]
        const yearOffset = i + 1

        if (historicalSeason.length > 0) {
          const seasonYear = new Date(historicalSeason[0].date).getFullYear()

          // Limpar dados anteriores dessa safra
          await prisma.ndviDataPoint.deleteMany({
            where: { fieldId: params.id, seasonYear, isHistorical: true }
          })

          // Inserir novos
          await prisma.ndviDataPoint.createMany({
            data: historicalSeason.map(point => ({
              fieldId: params.id,
              date: new Date(point.date),
              ndviRaw: point.ndvi_raw,
              ndviSmooth: point.ndvi_smooth,
              ndviInterp: point.ndvi_interp,
              cloudCover: point.cloud_cover,
              isHistorical: true,
              seasonYear
            }))
          })
        }
      }

      // =======================================================
      // VALIDAÇÃO DE DADOS CRÍTICOS
      // =======================================================
      const warnings: string[] = []
      let finalStatus: 'SUCCESS' | 'PARTIAL' | 'ERROR' = 'SUCCESS'
      
      // Verificar dados NDVI
      if (!merxReport.ndvi || merxReport.ndvi.length === 0) {
        warnings.push('Sem dados NDVI da API')
        finalStatus = 'PARTIAL'
      } else if (merxReport.ndvi.length < 5) {
        warnings.push(`Poucos pontos NDVI (${merxReport.ndvi.length})`)
      }
      
      // Verificar fenologia crítica
      if (!phenology.sosDate) {
        warnings.push('Não foi possível detectar emergência (SOS)')
        finalStatus = 'PARTIAL'
      }
      
      if (!phenology.eosDate) {
        warnings.push('Não foi possível detectar/projetar colheita (EOS)')
        finalStatus = 'PARTIAL'
      }
      
      // Verificar confiança
      if (phenology.confidenceScore < 30) {
        warnings.push(`Confiança muito baixa (${phenology.confidenceScore}%)`)
        if (finalStatus === 'SUCCESS') finalStatus = 'PARTIAL'
      }
      
      // Verificar área muito grande (pode causar problemas na API)
      if (areaHa > 1000) {
        warnings.push(`Área muito grande (${areaHa} ha) - pode afetar precisão`)
      }
      
      // Logging estruturado
      const logEntry = {
        timestamp: new Date().toISOString(),
        fieldId: params.id,
        fieldName: field.name,
        areaHa,
        status: finalStatus,
        processingTimeMs: Date.now() - startTime,
        phenology: {
          method: phenology.method,
          confidence: phenology.confidenceScore,
          sosDate: phenology.sosDate,
          eosDate: phenology.eosDate,
          peakDate: phenology.peakDate
        },
        ndviPoints: merxReport.ndvi.length,
        historicalYears: merxReport.historical_ndvi.length,
        warnings
      }
      
      if (finalStatus === 'PARTIAL') {
        console.warn('[PROCESS] Processamento parcial:', JSON.stringify(logEntry, null, 2))
      } else {
        console.log('[PROCESS] Processamento completo:', JSON.stringify(logEntry, null, 2))
      }

      // Construir mensagem de erro/warning
      const errorMessage = warnings.length > 0 ? warnings.join('; ') : null

      // Atualizar status do talhão e incrementar versão dos dados
      const updatedField = await prisma.field.update({
        where: { id: params.id },
        data: {
          status: finalStatus,
          errorMessage,
          areaHa,
          processedAt: new Date(),
          dataVersion: { increment: 1 }
        }
      })

      // Marcar análises existentes como desatualizadas e enfileirar reprocessamento
      const staleAnalyses = await prisma.analysis.findMany({
        where: { fieldId: params.id }
      })

      if (staleAnalyses.length > 0) {
        // Importar dinamicamente para evitar problemas de circular dependency
        const { enqueueAnalysis } = await import('@/lib/services/analysis-queue.service')
        
        await prisma.analysis.updateMany({
          where: { fieldId: params.id },
          data: {
            isStale: true,
            staleReason: 'Talhão reprocessado',
            reprocessStatus: 'PENDING'
          }
        })

        // Enfileirar cada análise para reprocessamento
        for (const analysis of staleAnalyses) {
          enqueueAnalysis(params.id, analysis.templateId, analysis.id)
        }

        console.log(`[PROCESS] ${staleAnalyses.length} análises marcadas para reprocessamento`)
      }

      return NextResponse.json({
        success: finalStatus === 'SUCCESS',
        status: finalStatus,
        processingTimeMs: Date.now() - startTime,
        warnings,
        agroData: {
          areaHa,
          volumeEstimatedKg: phenology.yieldEstimateKg,
          phenology
        },
        diagnostics: phenology.diagnostics
      })
    } catch (processingError) {
      // Atualizar status para ERROR
      await prisma.field.update({
        where: { id: params.id },
        data: {
          status: 'ERROR',
          errorMessage: processingError instanceof Error 
            ? processingError.message 
            : 'Erro desconhecido'
        }
      })

      throw processingError
    }
  } catch (error) {
    console.error('Error processing field:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process field',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
