import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { analyzeCycles, prepareHistoricalOverlayData } from '@/lib/services/cycle-analysis.service'
import { calculateHistoricalCorrelation, getCorrelationDiagnosis } from '@/lib/services/correlation.service'
import type { NdviPoint } from '@/lib/services/merx.service'

interface RouteParams {
  params: { id: string }
}

/**
 * GET /api/fields/[id]
 * Retorna um talhão com todos os dados
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
        analyses: {
          orderBy: { createdAt: 'desc' }
        },
        ndviData: {
          orderBy: { date: 'asc' },
          where: { isHistorical: false }
        }
      }
    })

    if (!field) {
      return NextResponse.json(
        { error: 'Talhão não encontrado' },
        { status: 404 }
      )
    }

    // Buscar dados históricos separadamente para organizar por safra
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

    // Converter dados para formato esperado pelo cycle-analysis
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

    // Análise de ciclo
    let cycleAnalysis = null
    if (currentNdviPoints.length > 0) {
      cycleAnalysis = analyzeCycles(
        currentNdviPoints,
        historicalNdviPoints,
        field.crop || 'SOJA'
      )
    }

    // Calcular correlação detalhada
    let correlationDetails = null
    if (currentNdviPoints.length > 0 && historicalNdviPoints.length > 0) {
      const correlation = calculateHistoricalCorrelation(
        currentNdviPoints,
        historicalNdviPoints
      )
      const diagnosis = getCorrelationDiagnosis(correlation)
      correlationDetails = {
        ...correlation,
        diagnosis
      }
    }

    // Calcular janela de colheita
    let harvestEndDate: string | null = null
    if (field.agroData?.eosDate) {
      const areaHa = field.agroData.areaHa || 100
      const harvestCapacityHaPerDay = 50 // Capacidade média: 50 ha/dia
      const harvestDays = Math.ceil(areaHa / harvestCapacityHaPerDay)
      
      const harvestEnd = new Date(field.agroData.eosDate)
      harvestEnd.setDate(harvestEnd.getDate() + harvestDays)
      harvestEndDate = harvestEnd.toISOString().split('T')[0]
    }

    // Preparar dados de overlay para gráfico
    let chartOverlayData = null
    if (currentNdviPoints.length > 0) {
      chartOverlayData = prepareHistoricalOverlayData(
        currentNdviPoints,
        historicalNdviPoints,
        field.agroData?.sosDate?.toISOString().split('T')[0] || null,
        field.crop || 'SOJA',
        field.agroData?.eosDate?.toISOString().split('T')[0] || null,
        field.agroData?.plantingDate?.toISOString().split('T')[0] || null,
        harvestEndDate
      )
    }

    // Calcular informações da janela de colheita para retornar
    let harvestWindowInfo = null
    if (field.agroData?.eosDate) {
      const areaHa = field.agroData.areaHa || 100
      const harvestCapacityHaPerDay = 50
      const harvestDays = Math.ceil(areaHa / harvestCapacityHaPerDay)
      
      const harvestStart = new Date(field.agroData.eosDate)
      const harvestEnd = new Date(field.agroData.eosDate)
      harvestEnd.setDate(harvestEnd.getDate() + harvestDays)
      
      harvestWindowInfo = {
        startDate: harvestStart.toISOString().split('T')[0],
        endDate: harvestEnd.toISOString().split('T')[0],
        daysToHarvest: harvestDays,
        areaHa
      }
    }

    return NextResponse.json({
      field,
      historicalNdvi: historicalBySeasonArray,
      cycleAnalysis,
      correlationDetails,
      chartOverlayData,
      harvestWindow: harvestWindowInfo
    })
  } catch (error) {
    console.error('Error fetching field:', error)
    return NextResponse.json(
      { error: 'Failed to fetch field' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/fields/[id]
 * Remove um talhão e todos os dados relacionados
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    await prisma.field.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting field:', error)
    return NextResponse.json(
      { error: 'Failed to delete field' },
      { status: 500 }
    )
  }
}
