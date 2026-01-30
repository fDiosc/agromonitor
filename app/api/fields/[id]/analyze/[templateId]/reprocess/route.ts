import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { forceReprocess } from '@/lib/services/analysis-queue.service'

interface RouteParams {
  params: { id: string; templateId: string }
}

/**
 * POST /api/fields/[id]/analyze/[templateId]/reprocess
 * Força o reprocessamento manual de uma análise
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: fieldId, templateId } = params

    // Buscar análise existente
    const analysis = await prisma.analysis.findUnique({
      where: {
        fieldId_templateId: {
          fieldId,
          templateId
        }
      }
    })

    if (!analysis) {
      return NextResponse.json(
        { error: 'Análise não encontrada' },
        { status: 404 }
      )
    }

    // Verificar se já está em processamento
    if (analysis.reprocessStatus === 'PROCESSING') {
      return NextResponse.json(
        { error: 'Análise já está sendo reprocessada' },
        { status: 409 }
      )
    }

    // Forçar reprocessamento
    await forceReprocess(analysis.id)

    return NextResponse.json({
      success: true,
      message: 'Análise adicionada à fila de reprocessamento',
      analysisId: analysis.id
    })
  } catch (error) {
    console.error('Error triggering reprocess:', error)
    return NextResponse.json(
      { 
        error: 'Falha ao iniciar reprocessamento',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/fields/[id]/analyze/[templateId]/reprocess
 * Retorna o status de reprocessamento de uma análise
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: fieldId, templateId } = params

    const analysis = await prisma.analysis.findUnique({
      where: {
        fieldId_templateId: {
          fieldId,
          templateId
        }
      },
      select: {
        id: true,
        templateId: true,
        isStale: true,
        staleReason: true,
        reprocessStatus: true,
        reprocessError: true,
        reprocessedAt: true,
        dataVersion: true,
        updatedAt: true
      }
    })

    if (!analysis) {
      return NextResponse.json(
        { error: 'Análise não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(analysis)
  } catch (error) {
    console.error('Error getting reprocess status:', error)
    return NextResponse.json(
      { error: 'Falha ao obter status' },
      { status: 500 }
    )
  }
}
