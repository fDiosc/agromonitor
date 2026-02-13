import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { analyzeCycles, prepareHistoricalOverlayData } from '@/lib/services/cycle-analysis.service'
import { calculateHistoricalCorrelation, getCorrelationDiagnosis } from '@/lib/services/correlation.service'
import { getSession, unauthorizedResponse } from '@/lib/auth'
import { processFieldDistances } from '@/lib/services/logistics-distance.service'
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
        },
        _count: {
          select: { subFields: true }
        },
        subFields: {
          select: { id: true, name: true, geometryJson: true }
        },
        parentField: {
          select: { id: true, name: true }
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

    // Extrair EOS fusionado (NDVI + GDD + balanço hídrico) se disponível
    let bestEosDate: string | null = field.agroData?.eosDate?.toISOString().split('T')[0] || null
    let fusedEosInfo: { date: string, method: string, confidence: number, passed?: boolean } | null = null
    if (field.agroData?.rawAreaData) {
      try {
        const areaData = JSON.parse(field.agroData.rawAreaData)
        if (areaData.fusedEos?.date) {
          bestEosDate = areaData.fusedEos.date
          fusedEosInfo = areaData.fusedEos
        }
      } catch { /* ignore */ }
    }

    // Calcular janela de colheita usando EOS fusionado
    let harvestEndDate: string | null = null
    if (bestEosDate) {
      const areaHa = field.agroData?.areaHa || 100
      const harvestCapacityHaPerDay = 50 // Capacidade média: 50 ha/dia
      const harvestDays = Math.ceil(areaHa / harvestCapacityHaPerDay)
      
      const harvestEnd = new Date(bestEosDate)
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
        bestEosDate,
        field.agroData?.plantingDate?.toISOString().split('T')[0] || null,
        harvestEndDate
      )
    }

    // Calcular informações da janela de colheita para retornar
    let harvestWindowInfo = null
    if (bestEosDate) {
      const areaHa = field.agroData?.areaHa || 100
      const harvestCapacityHaPerDay = 50
      const harvestDays = Math.ceil(areaHa / harvestCapacityHaPerDay)
      
      const harvestStart = new Date(bestEosDate)
      const harvestEnd = new Date(bestEosDate)
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
      zarcInfo,
      fusedEos: fusedEosInfo
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

/**
 * PATCH /api/fields/[id]
 * Atualiza campos específicos de um talhão (nome, produtor, caixa logística)
 * e campos agronômicos (plantingDateInput, cropType, seasonStartDate, geometryJson)
 * 
 * Quando campos agronômicos são alterados:
 * - Os valores detectados automaticamente (detectedXxx) são PRESERVADOS no AgroData
 * - Um registro de editHistory é adicionado ao Field
 * - Um reprocessamento é automaticamente disparado
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    // Verificar permissão
    if (session.role === 'VIEWER') {
      return NextResponse.json(
        { error: 'Sem permissão para atualizar talhões' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { 
      logisticsUnitId, name, producerId,
      // Campos agronômicos editáveis
      plantingDateInput, cropType, seasonStartDate, geometryJson
    } = body

    // Verificar se o talhão existe e pertence ao workspace
    const existingField = await prisma.field.findFirst({
      where: {
        id: params.id,
        workspaceId: session.workspaceId
      }
    })

    if (!existingField) {
      return NextResponse.json(
        { error: 'Talhão não encontrado' },
        { status: 404 }
      )
    }

    // Validar nome se fornecido
    if (name !== undefined && (!name || name.trim() === '')) {
      return NextResponse.json(
        { error: 'Nome não pode ser vazio' },
        { status: 400 }
      )
    }

    // Validar produtor se fornecido (pode ser null para desvincular)
    if (producerId !== undefined && producerId !== null) {
      const producer = await prisma.producer.findFirst({
        where: {
          id: producerId,
          workspaceId: session.workspaceId
        }
      })

      if (!producer) {
        return NextResponse.json(
          { error: 'Produtor não encontrado' },
          { status: 400 }
        )
      }
    }

    // Se logisticsUnitId foi fornecido, validar que pertence ao workspace
    if (logisticsUnitId !== undefined && logisticsUnitId !== null) {
      const unit = await prisma.logisticsUnit.findFirst({
        where: {
          id: logisticsUnitId,
          workspaceId: session.workspaceId,
          isActive: true
        }
      })

      if (!unit) {
        return NextResponse.json(
          { error: 'Caixa logística não encontrada' },
          { status: 400 }
        )
      }
    }

    // Validar cropType se fornecido
    if (cropType !== undefined && !['SOJA', 'MILHO'].includes(cropType)) {
      return NextResponse.json(
        { error: 'Cultura inválida. Valores aceitos: SOJA, MILHO' },
        { status: 400 }
      )
    }

    // Validar geometryJson se fornecido
    if (geometryJson !== undefined) {
      try {
        JSON.parse(geometryJson)
      } catch {
        return NextResponse.json(
          { error: 'geometryJson inválido' },
          { status: 400 }
        )
      }
    }

    // Detectar se houve alteração em campos agronômicos
    const agroChanges: { field: string; oldValue: string; newValue: string }[] = []
    let needsReprocess = false

    if (plantingDateInput !== undefined) {
      const oldVal = existingField.plantingDateInput?.toISOString().split('T')[0] || 'null'
      const newVal = plantingDateInput || 'null'
      if (oldVal !== newVal) {
        agroChanges.push({ field: 'plantingDateInput', oldValue: oldVal, newValue: newVal })
        needsReprocess = true
      }
    }

    if (cropType !== undefined && cropType !== existingField.cropType) {
      agroChanges.push({ field: 'cropType', oldValue: existingField.cropType, newValue: cropType })
      needsReprocess = true
    }

    if (seasonStartDate !== undefined) {
      const oldVal = existingField.seasonStartDate.toISOString().split('T')[0]
      const newVal = new Date(seasonStartDate).toISOString().split('T')[0]
      if (oldVal !== newVal) {
        agroChanges.push({ field: 'seasonStartDate', oldValue: oldVal, newValue: newVal })
        needsReprocess = true
      }
    }

    if (geometryJson !== undefined && geometryJson !== existingField.geometryJson) {
      agroChanges.push({ field: 'geometryJson', oldValue: '(polígono anterior)', newValue: '(polígono atualizado)' })
      needsReprocess = true
    }

    // Construir editHistory
    let editHistory = existingField.editHistory
    if (agroChanges.length > 0) {
      const history = editHistory ? JSON.parse(editHistory) : []
      history.push({
        date: new Date().toISOString(),
        changes: agroChanges,
        editedBy: session.userId,
        editedByName: session.name || session.email
      })
      editHistory = JSON.stringify(history)
    }

    // Atualizar talhão
    const updatedField = await prisma.field.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(producerId !== undefined && { producerId: producerId || null }),
        ...(logisticsUnitId !== undefined && { 
          logisticsUnitId: logisticsUnitId || null 
        }),
        // Campos agronômicos
        ...(plantingDateInput !== undefined && { 
          plantingDateInput: plantingDateInput ? new Date(plantingDateInput) : null 
        }),
        ...(cropType !== undefined && { cropType }),
        ...(seasonStartDate !== undefined && { 
          seasonStartDate: new Date(seasonStartDate) 
        }),
        ...(geometryJson !== undefined && { geometryJson }),
        // Edit history
        ...(agroChanges.length > 0 && { editHistory }),
      },
      include: {
        logisticsUnit: {
          select: { id: true, name: true }
        },
        producer: {
          select: { id: true, name: true }
        }
      }
    })

    // Reprocessar distâncias se necessário
    if (existingField.latitude && existingField.longitude) {
      processFieldDistances(params.id).catch(err => {
        console.error('Erro ao reprocessar distâncias:', err)
      })
    }

    // Se houve alteração agronômica, disparar reprocessamento automático
    let reprocessTriggered = false
    if (needsReprocess) {
      console.log(`[PATCH] Alteração agronômica detectada em ${params.id}: ${agroChanges.map(c => c.field).join(', ')}. Disparando reprocessamento.`)
      
      // Fire-and-forget reprocessamento
      fetch(new URL(`/api/fields/${params.id}/process`, request.url).toString(), {
        method: 'POST',
        headers: {
          'Cookie': request.headers.get('cookie') || ''
        }
      }).catch(err => {
        console.error('Erro ao disparar reprocessamento:', err)
      })
      
      reprocessTriggered = true
    }

    return NextResponse.json({ 
      success: true, 
      field: updatedField,
      reprocessTriggered,
      agroChanges: agroChanges.length > 0 ? agroChanges : undefined
    })
  } catch (error) {
    console.error('Error updating field:', error)
    return NextResponse.json(
      { error: 'Failed to update field' },
      { status: 500 }
    )
  }
}
