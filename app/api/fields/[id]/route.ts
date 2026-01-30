import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { analyzeCycles, prepareHistoricalOverlayData } from '@/lib/services/cycle-analysis.service'
import { calculateHistoricalCorrelation, getCorrelationDiagnosis } from '@/lib/services/correlation.service'
import { getSession, unauthorizedResponse } from '@/lib/auth'
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
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    const field = await prisma.field.findUnique({
      where: { 
        id: params.id,
        workspaceId: session.workspaceId // Garantir isolamento
      },
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
      ndvi_raw: d.ndviRaw ?? undefined,
      ndvi_interp: d.ndviInterp ?? undefined,
      ndvi_smooth: d.ndviSmooth ?? undefined
    }))

    const historicalNdviPoints: NdviPoint[][] = historicalBySeasonArray.map(season =>
      season.map(d => ({
        date: d.date.toISOString().split('T')[0],
        ndvi_raw: d.ndviRaw ?? undefined,
        ndvi_interp: d.ndviInterp ?? undefined,
        ndvi_smooth: d.ndviSmooth ?? undefined
      }))
    )

    // Análise de ciclo
    let cycleAnalysis = null
    if (currentNdviPoints.length > 0) {
      cycleAnalysis = analyzeCycles(
        currentNdviPoints,
        historicalNdviPoints,
        field.cropType || 'SOJA'
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
        field.cropType || 'SOJA',
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

    // Preparar informações ZARC para UI
    let zarcInfo = null
    if (field.agroData?.zarcWindowStart) {
      zarcInfo = {
        windowStart: field.agroData.zarcWindowStart,
        windowEnd: field.agroData.zarcWindowEnd,
        optimalStart: field.agroData.zarcOptimalStart,
        optimalEnd: field.agroData.zarcOptimalEnd,
        plantingRisk: field.agroData.zarcPlantingRisk,
        plantingStatus: field.agroData.zarcPlantingStatus
      }
    }

    return NextResponse.json({
      field,
      historicalNdvi: historicalBySeasonArray,
      cycleAnalysis,
      correlationDetails,
      chartOverlayData,
      harvestWindow: harvestWindowInfo,
      zarcInfo
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
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    // Verificar permissão (VIEWER não pode deletar)
    if (session.role === 'VIEWER') {
      return NextResponse.json(
        { error: 'Sem permissão para deletar talhões' },
        { status: 403 }
      )
    }

    // Deletar apenas se pertencer ao workspace
    await prisma.field.delete({
      where: { 
        id: params.id,
        workspaceId: session.workspaceId
      }
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
