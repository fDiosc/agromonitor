import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getTemplate, templateExists } from '@/lib/templates'
import { runAnalysis } from '@/lib/services/ai.service'
import type { AnalysisContext } from '@/lib/templates/types'

interface RouteParams {
  params: { id: string; templateId: string }
}

/**
 * POST /api/fields/[id]/analyze/[templateId]
 * Executa análise de IA para um template específico
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: fieldId, templateId } = params

    // Verificar se template existe
    if (!templateExists(templateId)) {
      return NextResponse.json(
        { error: `Template não encontrado: ${templateId}` },
        { status: 400 }
      )
    }

    // Buscar talhão com dados agro
    const field = await prisma.field.findUnique({
      where: { id: fieldId },
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

    // Extrair EOS fusionado (NDVI + GDD + balanço hídrico) se disponível
    let bestEosDate = field.agroData.eosDate?.toISOString().split('T')[0] || null
    if (field.agroData.rawAreaData) {
      try {
        const areaData = JSON.parse(field.agroData.rawAreaData)
        if (areaData.fusedEos?.date) {
          bestEosDate = areaData.fusedEos.date
        }
      } catch { /* ignore */ }
    }

    // Montar contexto para análise
    const context: AnalysisContext = {
      field: {
        id: field.id,
        name: field.name,
        city: field.city || 'Desconhecida',
        state: field.state || 'Desconhecido',
        cropType: field.cropType,
        areaHa: field.areaHa || 0,
        seasonStartDate: field.seasonStartDate.toISOString().split('T')[0]
      },
      agroData: {
        areaHa: field.agroData.areaHa,
        volumeEstimatedKg: field.agroData.volumeEstimatedKg,
        plantingDate: field.agroData.plantingDate?.toISOString().split('T')[0] || null,
        sosDate: field.agroData.sosDate?.toISOString().split('T')[0] || null,
        eosDate: bestEosDate,
        peakDate: field.agroData.peakDate?.toISOString().split('T')[0] || null,
        cycleDays: field.agroData.cycleDays,
        confidenceScore: field.agroData.confidenceScore,
        confidence: field.agroData.confidence,
        historicalCorrelation: field.agroData.historicalCorrelation,
        phenologyHealth: field.agroData.phenologyHealth,
        peakNdvi: field.agroData.peakNdvi,
        detectedReplanting: field.agroData.detectedReplanting
      },
      phenology: {
        plantingDate: field.agroData.plantingDate?.toISOString().split('T')[0] || null,
        sosDate: field.agroData.sosDate?.toISOString().split('T')[0] || null,
        eosDate: bestEosDate,
        peakDate: field.agroData.peakDate?.toISOString().split('T')[0] || null,
        cycleDays: field.agroData.cycleDays || 120,
        detectedReplanting: field.agroData.detectedReplanting,
        replantingDate: field.agroData.replantingDate?.toISOString().split('T')[0] || null,
        yieldEstimateKg: field.agroData.volumeEstimatedKg || 0,
        yieldEstimateKgHa: field.agroData.yieldEstimateKgHa || 0,
        phenologyHealth: (field.agroData.phenologyHealth as any) || 'FAIR',
        peakNdvi: field.agroData.peakNdvi || 0,
        confidence: (field.agroData.confidence as any) || 'MEDIUM',
        confidenceScore: field.agroData.confidenceScore || 50,
        method: (field.agroData.phenologyMethod as any) || 'PROJECTION',
        historicalCorrelation: field.agroData.historicalCorrelation || 50,
        diagnostics: field.agroData.diagnostics 
          ? JSON.parse(field.agroData.diagnostics) 
          : []
      },
      // AI Visual Validation (if available)
      aiValidation: field.agroData.aiValidationResult ? (() => {
        try {
          const agreement = field.agroData.aiValidationAgreement
            ? JSON.parse(field.agroData.aiValidationAgreement)
            : {}
          const alerts = field.agroData.aiVisualAlerts
            ? JSON.parse(field.agroData.aiVisualAlerts)
            : []
          return {
            agreement: field.agroData.aiValidationResult as 'CONFIRMED' | 'QUESTIONED' | 'REJECTED',
            confidence: field.agroData.aiValidationConfidence || 0,
            eosAdjustedDate: agreement.eosAdjustedDate || null,
            eosAdjustmentReason: agreement.eosAdjustmentReason || null,
            stageAgreement: agreement.stageAgreement ?? true,
            visualAlerts: alerts,
            harvestReadiness: agreement.harvestReadiness || { ready: false, estimatedDate: null, notes: '' },
            riskAssessment: agreement.riskAssessment || { overallRisk: 'MEDIUM', factors: [] },
            recommendations: agreement.recommendations || [],
          }
        } catch {
          return null
        }
      })() : null
    }

    // Executar análise
    const template = getTemplate(templateId)!
    const { result, fallbackUsed, processingTimeMs, modelUsed } = await runAnalysis(
      templateId,
      context
    )

    // Salvar ou atualizar análise
    await prisma.analysis.upsert({
      where: {
        fieldId_templateId: {
          fieldId,
          templateId
        }
      },
      update: {
        status: result.status,
        statusLabel: result.statusLabel,
        statusColor: result.statusColor,
        aiSummary: result.summary,
        aiMetrics: JSON.stringify(result.metrics),
        aiRisks: JSON.stringify(result.risks),
        aiRecommendations: JSON.stringify(result.recommendations),
        aiFullResponse: JSON.stringify(result),
        templateVersion: template.config.version,
        modelUsed,
        processingTimeMs,
        fallbackUsed,
        aiValidationUsed: !!context.aiValidation,
        aiValidationAgreement: context.aiValidation?.agreement || null,
        createdAt: new Date()
      },
      create: {
        fieldId,
        templateId,
        templateVersion: template.config.version,
        status: result.status,
        statusLabel: result.statusLabel,
        statusColor: result.statusColor,
        aiSummary: result.summary,
        aiMetrics: JSON.stringify(result.metrics),
        aiRisks: JSON.stringify(result.risks),
        aiRecommendations: JSON.stringify(result.recommendations),
        aiFullResponse: JSON.stringify(result),
        modelUsed,
        processingTimeMs,
        fallbackUsed,
        aiValidationUsed: !!context.aiValidation,
        aiValidationAgreement: context.aiValidation?.agreement || null,
      }
    })

    return NextResponse.json({
      success: true,
      analysis: {
        templateId,
        templateName: template.config.name,
        templateColor: template.config.color,
        templateIcon: template.config.icon,
        ...result
      },
      meta: {
        fallbackUsed,
        processingTimeMs,
        modelUsed
      }
    })
  } catch (error) {
    console.error('Error running analysis:', error)
    return NextResponse.json(
      { 
        error: 'Failed to run analysis',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
