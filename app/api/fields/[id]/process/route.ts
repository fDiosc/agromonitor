import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getFullReport, getComplementaryData } from '@/lib/services/merx.service'
import { calculatePhenology } from '@/lib/services/phenology.service'
import { calculateSphericalArea } from '@/lib/services/geometry.service'
import { calculateHistoricalCorrelation } from '@/lib/services/correlation.service'
import { analyzeZarc } from '@/lib/services/zarc.service'

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
          confidenceScore: phenology.confidenceScore,
          confidence: phenology.confidence,
          historicalCorrelation: finalCorrelation,
          detectedReplanting: phenology.detectedReplanting,
          replantingDate: phenology.replantingDate ? new Date(phenology.replantingDate) : null,
          yieldEstimateKgHa: phenology.yieldEstimateKgHa,
          phenologyHealth: phenology.phenologyHealth,
          peakNdvi: phenology.peakNdvi,
          rawNdviData: JSON.stringify(merxReport.ndvi),
          rawPrecipData: JSON.stringify(merxReport.precipitacao),
          rawSoilData: JSON.stringify(merxReport.solo),
          rawHistoricalData: JSON.stringify(merxReport.historical_ndvi),
          rawAreaData: JSON.stringify({ area_ha: areaHa }),
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
          confidenceScore: phenology.confidenceScore,
          confidence: phenology.confidence,
          historicalCorrelation: finalCorrelation,
          detectedReplanting: phenology.detectedReplanting,
          replantingDate: phenology.replantingDate ? new Date(phenology.replantingDate) : null,
          yieldEstimateKgHa: phenology.yieldEstimateKgHa,
          phenologyHealth: phenology.phenologyHealth,
          peakNdvi: phenology.peakNdvi,
          rawNdviData: JSON.stringify(merxReport.ndvi),
          rawPrecipData: JSON.stringify(merxReport.precipitacao),
          rawSoilData: JSON.stringify(merxReport.solo),
          rawHistoricalData: JSON.stringify(merxReport.historical_ndvi),
          rawAreaData: JSON.stringify({ area_ha: areaHa }),
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
