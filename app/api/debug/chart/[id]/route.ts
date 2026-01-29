import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { prepareHistoricalOverlayData } from '@/lib/services/cycle-analysis.service'
import type { NdviPoint } from '@/lib/services/merx.service'

interface RouteParams {
  params: { id: string }
}

/**
 * GET /api/debug/chart/[id]
 * Debug endpoint para verificar dados do gráfico
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const field = await prisma.field.findUnique({
      where: { id: params.id },
      include: {
        agroData: true,
        ndviData: {
          orderBy: { date: 'asc' },
          where: { isHistorical: false }
        }
      }
    })

    if (!field) {
      return NextResponse.json({ error: 'Talhão não encontrado' }, { status: 404 })
    }

    // Buscar dados históricos
    const historicalNdvi = await prisma.ndviDataPoint.findMany({
      where: { 
        fieldId: params.id,
        isHistorical: true 
      },
      orderBy: { date: 'asc' }
    })

    // Agrupar por seasonYear
    const historicalBySeason: Record<number, typeof historicalNdvi> = {}
    historicalNdvi.forEach(point => {
      const year = point.seasonYear || 0
      if (!historicalBySeason[year]) {
        historicalBySeason[year] = []
      }
      historicalBySeason[year].push(point)
    })

    const historicalBySeasonArray = Object.values(historicalBySeason)

    // Converter dados
    const currentNdviPoints: NdviPoint[] = field.ndviData.map(d => ({
      date: d.date.toISOString().split('T')[0],
      ndvi_raw: d.ndviRaw,
      ndvi_interp: d.ndviInterp,
      ndvi_smooth: d.ndviSmooth
    }))

    const historicalNdviPoints: NdviPoint[][] = historicalBySeasonArray.map(season =>
      season.map(d => ({
        date: d.date.toISOString().split('T')[0],
        ndvi_raw: d.ndviRaw,
        ndvi_interp: d.ndviInterp,
        ndvi_smooth: d.ndviSmooth
      }))
    )

    // Preparar dados de overlay
    const chartOverlayData = prepareHistoricalOverlayData(
      currentNdviPoints,
      historicalNdviPoints,
      field.agroData?.sosDate?.toISOString().split('T')[0] || null,
      field.crop || 'SOJA',
      field.agroData?.eosDate?.toISOString().split('T')[0] || null,
      field.agroData?.plantingDate?.toISOString().split('T')[0] || null
    )

    // Estatísticas
    const stats = {
      totalPoints: chartOverlayData.length,
      withCurrent: chartOverlayData.filter((d: any) => d.current !== undefined).length,
      withH1: chartOverlayData.filter((d: any) => d.h1 !== undefined).length,
      withH2: chartOverlayData.filter((d: any) => d.h2 !== undefined).length,
      withH3: chartOverlayData.filter((d: any) => d.h3 !== undefined).length,
      withProjection: chartOverlayData.filter((d: any) => d.projection !== undefined).length,
      referenceDates: {
        planting: field.agroData?.plantingDate?.toISOString().split('T')[0],
        sos: field.agroData?.sosDate?.toISOString().split('T')[0],
        eos: field.agroData?.eosDate?.toISOString().split('T')[0]
      }
    }

    // Amostra dos dados
    const sampleFirst = chartOverlayData.slice(0, 5)
    const sampleLast = chartOverlayData.slice(-5)

    return NextResponse.json({
      fieldName: field.name,
      stats,
      sampleFirst,
      sampleLast,
      // Dados completos para debug
      fullData: chartOverlayData
    })
  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json(
      { error: 'Debug failed', details: String(error) },
      { status: 500 }
    )
  }
}
