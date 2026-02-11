import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getFeatureFlags } from '@/lib/services/feature-flags.service'
import { runAIValidation, type AIValidationResult } from '@/lib/services/ai-validation.service'

interface RouteParams {
  params: { id: string }
}

/**
 * POST /api/fields/[id]/ai-validate
 * Executa validação visual IA sob demanda (trigger manual)
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const startTime = Date.now()

  try {
    // Buscar talhão com dados agro
    const field = await prisma.field.findUnique({
      where: { id: params.id },
      include: { agroData: true }
    })

    if (!field) {
      return NextResponse.json(
        { error: 'Talhão não encontrado' },
        { status: 404 }
      )
    }

    if (!field.agroData) {
      return NextResponse.json(
        { error: 'Dados agronômicos não processados. Execute /process primeiro.' },
        { status: 400 }
      )
    }

    if (!field.workspaceId) {
      return NextResponse.json(
        { error: 'Talhão sem workspace associado' },
        { status: 400 }
      )
    }

    // Verificar feature flag
    const featureFlags = await getFeatureFlags(field.workspaceId)
    if (!featureFlags.enableAIValidation) {
      return NextResponse.json(
        { error: 'Validação Visual IA não está habilitada. Ative em Configurações > Módulos.' },
        { status: 403 }
      )
    }

    // Preparar dados de enriquecimento a partir do rawAreaData
    let gddData = undefined
    let waterBalData = undefined
    let precipJudgeData = undefined
    let zarcData = undefined
    let fusionMetricsData = undefined

    if (field.agroData.rawAreaData) {
      try {
        const areaData = JSON.parse(field.agroData.rawAreaData)

        // GDD
        if (areaData.thermal) {
          const thermal = typeof areaData.thermal === 'string' ? JSON.parse(areaData.thermal) : areaData.thermal
          if (thermal?.gddAnalysis) {
            gddData = {
              accumulated: thermal.gddAnalysis.accumulatedGdd || 0,
              required: thermal.gddAnalysis.requiredGdd || 0,
              progress: thermal.gddAnalysis.progressPercent || 0,
              daysToMaturity: thermal.gddAnalysis.daysToMaturity ?? null,
              confidence: thermal.gddAnalysis.confidence || 'LOW'
            }
          }
        }

        // Water Balance
        if (areaData.waterBalance) {
          const wb = typeof areaData.waterBalance === 'string' ? JSON.parse(areaData.waterBalance) : areaData.waterBalance
          if (wb) {
            waterBalData = {
              deficit: wb.totalDeficit || 0,
              stressDays: wb.stressDays || 0,
              stressLevel: areaData.eosAdjustment?.stressLevel || 'LOW',
              waterAdjustment: areaData.eosAdjustment?.adjustmentDays || 0
            }
          }
        }

        // Precipitation
        if (areaData.harvestAdjustment) {
          precipJudgeData = {
            recentPrecipMm: areaData.harvestAdjustment.recentPrecipMm || 0,
            qualityRisk: areaData.harvestAdjustment.grainQualityRisk || 'LOW'
          }
        }

        // Fusion metrics
        if (areaData.fusionMetrics) {
          fusionMetricsData = {
            gapsFilled: areaData.fusionMetrics.gapsFilled || 0,
            radarContribution: areaData.fusionMetrics.radarContribution || 0,
            continuityScore: areaData.fusionMetrics.continuityScore || 0
          }
        }
      } catch {
        // Ignore parse errors, continue with what we have
      }
    }

    // ZARC
    if (field.agroData.zarcPlantingStatus) {
      zarcData = {
        plantingStatus: field.agroData.zarcPlantingStatus,
        plantingRisk: field.agroData.zarcPlantingRisk ?? 0,
        windowStart: field.agroData.zarcWindowStart?.toISOString().split('T')[0] || '',
        windowEnd: field.agroData.zarcWindowEnd?.toISOString().split('T')[0] || ''
      }
    }

    // Extrair EOS fusionado (NDVI + GDD + balanço hídrico) se disponível
    let bestEosDate = field.agroData.eosDate?.toISOString().split('T')[0] || null
    let bestEosMethod = field.agroData.phenologyMethod || 'ALGORITHM'
    if (field.agroData.rawAreaData) {
      try {
        const areaData = JSON.parse(field.agroData.rawAreaData)
        if (areaData.fusedEos?.date) {
          bestEosDate = areaData.fusedEos.date
          bestEosMethod = `FUSION_${areaData.fusedEos.method}`
        }
      } catch { /* ignore */ }
    }

    console.log(`[AI-VALIDATE] Manual trigger for field ${params.id}, EOS: ${bestEosDate} (raw: ${field.agroData.eosDate?.toISOString().split('T')[0]})`)

    // Executar validação
    const result = await runAIValidation({
      fieldId: params.id,
      workspaceId: field.workspaceId,
      geometry: field.geometryJson,
      cropType: field.cropType,
      areaHa: field.agroData.areaHa || field.areaHa || 100,
      plantingDate: field.agroData.plantingDate?.toISOString().split('T')[0] || null,
      plantingSource: field.agroData.phenologyMethod || 'ALGORITHM',
      sosDate: field.agroData.sosDate?.toISOString().split('T')[0] || null,
      eosDate: bestEosDate,
      eosMethod: bestEosMethod,
      confidenceScore: field.agroData.confidenceScore || 50,
      peakNdvi: field.agroData.peakNdvi,
      peakDate: field.agroData.peakDate?.toISOString().split('T')[0] || null,
      phenologyHealth: field.agroData.phenologyHealth,
      gddData,
      waterBalanceData: waterBalData,
      precipData: precipJudgeData,
      zarcData,
      fusionMetrics: fusionMetricsData,
      curatorModel: featureFlags.aiCuratorModel
    })

    // Persistir resultados no AgroData
    await prisma.agroData.update({
      where: { fieldId: params.id },
      data: {
        aiValidationResult: result.agreement,
        aiValidationDate: new Date(),
        aiValidationConfidence: result.confidence,
        aiValidationAgreement: JSON.stringify({
          eosAdjustedDate: result.eosAdjustedDate,
          eosAdjustmentReason: result.eosAdjustmentReason,
          stageAgreement: result.stageAgreement,
          harvestReadiness: result.harvestReadiness,
          riskAssessment: result.riskAssessment,
          recommendations: result.recommendations,
        }),
        aiEosAdjustedDate: result.eosAdjustedDate ? new Date(result.eosAdjustedDate) : null,
        aiVisualAlerts: JSON.stringify(result.visualAlerts),
        aiCurationReport: JSON.stringify(result.curationReport),
        aiCostReport: JSON.stringify(result.costReport),
        updatedAt: new Date()
      }
    })

    console.log(`[AI-VALIDATE] Completed in ${Date.now() - startTime}ms: ${result.agreement}`)

    return NextResponse.json({
      success: true,
      agreement: result.agreement,
      confidence: result.confidence,
      visualAlerts: result.visualAlerts.length,
      eosAdjusted: result.eosAdjustedDate,
      costUSD: result.costReport.totalCost,
      processingTimeMs: Date.now() - startTime
    })
  } catch (error) {
    console.error('[AI-VALIDATE] Error:', error)
    return NextResponse.json(
      {
        error: 'Erro na validação visual IA',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}
