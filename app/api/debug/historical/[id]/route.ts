import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { detectCycle } from '@/lib/services/cycle-analysis.service'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Buscar campo
    const field = await prisma.field.findUnique({
      where: { id: params.id },
      include: {
        agroData: true,
        ndviData: {
          orderBy: { date: 'asc' }
        }
      }
    })

    if (!field) {
      return NextResponse.json({ error: 'Talhão não encontrado' }, { status: 404 })
    }

    // Separar dados atuais e históricos
    const currentData = field.ndviData.filter(d => !d.isHistorical)
    const historicalData = field.ndviData.filter(d => d.isHistorical)

    // Agrupar históricos por seasonYear
    const historicalBySeason: Record<number, typeof historicalData> = {}
    historicalData.forEach(point => {
      const year = point.seasonYear || 0
      if (!historicalBySeason[year]) {
        historicalBySeason[year] = []
      }
      historicalBySeason[year].push(point)
    })
    
    // Converter para NdviPoint format
    const getNdvi = (p: typeof currentData[0]) => p.ndviSmooth || p.ndviInterp || p.ndviRaw || 0
    const toNdviPoint = (p: typeof currentData[0]) => ({
      date: p.date.toISOString().split('T')[0],
      ndvi_smooth: p.ndviSmooth ?? undefined,
      ndvi_interp: p.ndviInterp ?? undefined,
      ndvi_raw: p.ndviRaw ?? undefined
    })
    
    // Detectar SOS da safra atual
    const currentPoints = currentData.map(toNdviPoint)
    const currentCycle = detectCycle(currentPoints, field.cropType || 'SOJA')
    const currentSosTime = currentCycle.sosDate ? new Date(currentCycle.sosDate).getTime() : null
    
    // Determinar ano base da safra atual (alinhamento por calendário agrícola)
    const firstCurrentDate = new Date(currentData[0].date)
    const currentSeasonYear = firstCurrentDate.getMonth() >= 7 
      ? firstCurrentDate.getFullYear() 
      : firstCurrentDate.getFullYear() - 1
    
    // Analisar cada histórico com alinhamento por calendário
    const historicalAnalysis = Object.entries(historicalBySeason).map(([year, points]) => {
      const hPoints = points.map(toNdviPoint)
      const hCycle = detectCycle(hPoints, field.cropType || 'SOJA')
      
      // Alinhamento por calendário: mesma data do ano + yearDiff
      const firstHDate = new Date(points[0].date)
      const hSeasonYear = firstHDate.getMonth() >= 7 
        ? firstHDate.getFullYear() 
        : firstHDate.getFullYear() - 1
      const yearDiff = currentSeasonYear - hSeasonYear
      
      const firstMapped = new Date(points[0].date)
      firstMapped.setFullYear(firstMapped.getFullYear() + yearDiff)
      
      const lastMapped = new Date(points[points.length - 1].date)
      lastMapped.setFullYear(lastMapped.getFullYear() + yearDiff)
      
      return {
        seasonYear: parseInt(year),
        totalPoints: points.length,
        firstDate: points[0].date.toISOString().split('T')[0],
        lastDate: points[points.length - 1].date.toISOString().split('T')[0],
        sosDetectedOld: hCycle.sosDate, // para referência
        yearDiff,
        mappedRange: {
          firstMapped: firstMapped.toISOString().split('T')[0],
          lastMapped: lastMapped.toISOString().split('T')[0]
        }
      }
    })

    // Dados do agroData
    const agroInfo = field.agroData ? {
      sosDate: field.agroData.sosDate?.toISOString().split('T')[0],
      eosDate: field.agroData.eosDate?.toISOString().split('T')[0],
      plantingDate: field.agroData.plantingDate?.toISOString().split('T')[0],
      method: field.agroData.method
    } : null

    return NextResponse.json({
      fieldId: params.id,
      fieldName: field.name,
      cropType: field.cropType,
      agroInfo,
      currentCycle: {
        sosDetected: currentCycle.sosDate,
        eosDetected: currentCycle.eosDate,
        peakDate: currentCycle.peakDate,
        totalPoints: currentData.length,
        firstDate: currentData[0]?.date.toISOString().split('T')[0],
        lastDate: currentData[currentData.length - 1]?.date.toISOString().split('T')[0],
      },
      historicalSeasons: historicalAnalysis.sort((a, b) => b.seasonYear - a.seasonYear),
      summary: {
        totalHistoricalSeasons: Object.keys(historicalBySeason).length,
        totalHistoricalPoints: historicalData.length
      }
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
