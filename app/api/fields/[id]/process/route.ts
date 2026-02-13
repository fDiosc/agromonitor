import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { runPipeline, createInitialContext } from '@/lib/services/processing'

interface RouteParams {
  params: { id: string }
}

/**
 * POST /api/fields/[id]/process
 * Processa os dados agronômicos de um talhão via pipeline orquestrado.
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // 1. Fetch field and validate
    const field = await prisma.field.findUnique({
      where: { id: params.id },
      include: { _count: { select: { subFields: true } } },
    })

    if (!field) {
      return NextResponse.json({ error: 'Talhão não encontrado' }, { status: 404 })
    }

    if (field._count.subFields > 0) {
      return NextResponse.json({
        error: 'Este talhão possui subtalhões. A análise agronômica deve ser feita nos subtalhões individualmente.',
        hasSubFields: true,
        subFieldCount: field._count.subFields,
      }, { status: 400 })
    }

    // 2. Mark as processing
    await prisma.field.update({
      where: { id: params.id },
      data: { status: 'PROCESSING' },
    })

    try {
      // 3. Run pipeline
      const ctx = createInitialContext(params.id, {
        id: field.id,
        name: field.name,
        geometryJson: field.geometryJson,
        seasonStartDate: field.seasonStartDate,
        cropType: field.cropType,
        plantingDateInput: field.plantingDateInput,
        workspaceId: field.workspaceId,
        status: field.status,
      })

      const result = await runPipeline(ctx)

      // 4. Return response
      if (result.shortCircuited) {
        return NextResponse.json({
          success: true,
          cropPatternStatus: result.cropPatternResult?.status,
          reason: result.cropPatternResult?.reason,
          hypotheses: result.cropPatternResult?.hypotheses,
          warnings: [`Cultura não identificada: ${result.cropPatternResult?.reason}`],
          processingTimeMs: Date.now() - result.startTime,
        })
      }

      return NextResponse.json({
        success: result.finalStatus === 'SUCCESS',
        status: result.finalStatus,
        processingTimeMs: Date.now() - result.startTime,
        warnings: result.warnings,
        agroData: {
          areaHa: result.areaHa,
          volumeEstimatedKg: result.phenology?.yieldEstimateKg,
          phenology: result.phenology,
        },
        diagnostics: result.phenology?.diagnostics,
      })
    } catch (processingError) {
      await prisma.field.update({
        where: { id: params.id },
        data: {
          status: 'ERROR',
          errorMessage: processingError instanceof Error
            ? processingError.message
            : 'Erro desconhecido',
        },
      })
      throw processingError
    }
  } catch (error) {
    console.error('Error processing field:', error)
    return NextResponse.json(
      {
        error: 'Failed to process field',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
