import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession, unauthorizedResponse } from '@/lib/auth'

interface RouteParams {
  params: { id: string }
}

/**
 * GET /api/fields/[id]/subfields/comparison
 * Retorna dados comparativos entre o talhão pai e seus subtalhões.
 * Inclui agroData resumido + série NDVI de cada um para gráfico sobreposto.
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    // Buscar pai com agroData e NDVI
    const parentField = await prisma.field.findFirst({
      where: {
        id: params.id,
        workspaceId: session.workspaceId,
      },
      select: {
        id: true,
        name: true,
        areaHa: true,
        cropType: true,
        status: true,
        agroData: {
          select: {
            volumeEstimatedKg: true,
            confidenceScore: true,
            peakNdvi: true,
            sosDate: true,
            eosDate: true,
            cropPatternStatus: true,
            phenologyHealth: true,
            yieldEstimateKgHa: true,
          }
        },
      }
    })

    if (!parentField) {
      return NextResponse.json(
        { error: 'Talhão não encontrado' },
        { status: 404 }
      )
    }

    // NDVI do pai (apenas safra atual)
    const parentNdvi = await prisma.ndviDataPoint.findMany({
      where: { fieldId: params.id, isHistorical: false },
      orderBy: { date: 'asc' },
      select: { date: true, ndviSmooth: true, ndviRaw: true },
    })

    // Buscar subtalhões com agroData
    const subFields = await prisma.field.findMany({
      where: { parentFieldId: params.id },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        areaHa: true,
        cropType: true,
        status: true,
        agroData: {
          select: {
            volumeEstimatedKg: true,
            confidenceScore: true,
            peakNdvi: true,
            sosDate: true,
            eosDate: true,
            cropPatternStatus: true,
            phenologyHealth: true,
            yieldEstimateKgHa: true,
          }
        },
      }
    })

    if (subFields.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum subtalhão encontrado' },
        { status: 404 }
      )
    }

    // NDVI de cada subtalhão (em paralelo)
    const subFieldsNdvi: Record<string, Array<{ date: string; ndviSmooth: number | null; ndviRaw: number | null }>> = {}
    const ndviPromises = subFields.map(async (sf) => {
      const points = await prisma.ndviDataPoint.findMany({
        where: { fieldId: sf.id, isHistorical: false },
        orderBy: { date: 'asc' },
        select: { date: true, ndviSmooth: true, ndviRaw: true },
      })
      subFieldsNdvi[sf.id] = points.map(p => ({
        date: p.date.toISOString().split('T')[0],
        ndviSmooth: p.ndviSmooth,
        ndviRaw: p.ndviRaw,
      }))
    })
    await Promise.all(ndviPromises)

    // Calcular totais agregados dos filhos
    const processedSubs = subFields.filter(sf => sf.agroData)
    const totalAreaHa = subFields.reduce((sum, sf) => sum + (sf.areaHa ?? 0), 0)
    const totalVolumeKg = processedSubs.reduce((sum, sf) => sum + (sf.agroData?.volumeEstimatedKg ?? 0), 0)
    const avgConfidence = processedSubs.length > 0
      ? processedSubs.reduce((sum, sf) => sum + (sf.agroData?.confidenceScore ?? 0), 0) / processedSubs.length
      : 0
    const avgPeakNdvi = processedSubs.length > 0
      ? processedSubs.reduce((sum, sf) => sum + (sf.agroData?.peakNdvi ?? 0), 0) / processedSubs.length
      : 0

    const parentAreaHa = parentField.areaHa ?? 0
    const parentVolumeKg = parentField.agroData?.volumeEstimatedKg ?? 0
    const parentConfidence = parentField.agroData?.confidenceScore ?? 0

    return NextResponse.json({
      parent: parentField,
      parentNdvi: parentNdvi.map(p => ({
        date: p.date.toISOString().split('T')[0],
        ndviSmooth: p.ndviSmooth,
        ndviRaw: p.ndviRaw,
      })),
      subFields,
      subFieldsNdvi,
      totals: {
        totalAreaHa: Math.round(totalAreaHa * 10) / 10,
        totalVolumeKg: Math.round(totalVolumeKg),
        avgConfidence: Math.round(avgConfidence),
        avgPeakNdvi: Math.round(avgPeakNdvi * 100) / 100,
        // Deltas: positivo = filhos > pai, negativo = filhos < pai
        deltaAreaHa: Math.round((totalAreaHa - parentAreaHa) * 10) / 10,
        deltaVolumeKg: Math.round(totalVolumeKg - parentVolumeKg),
        deltaConfidence: Math.round(avgConfidence - parentConfidence),
      }
    })
  } catch (error) {
    console.error('Error fetching subfield comparison:', error)
    return NextResponse.json(
      { error: 'Erro ao carregar dados comparativos' },
      { status: 500 }
    )
  }
}
