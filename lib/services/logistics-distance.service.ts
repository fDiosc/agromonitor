/**
 * Serviço para calcular e persistir distâncias entre talhões e caixas logísticas
 */

import prisma from '@/lib/prisma'
import { calculateStraightLineDistance, calculateRoadDistance } from './distance.service'

type CalculationMethod = 'straight_line' | 'road_distance'

interface WorkspaceSettings {
  distanceCalculationMethod?: CalculationMethod
  googleMapsApiKey?: string
}

/**
 * Obtém o método de cálculo de distância configurado no workspace
 */
async function getWorkspaceDistanceMethod(workspaceId: string): Promise<{
  method: CalculationMethod
  apiKey?: string
}> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { settings: true }
  })

  let settings: WorkspaceSettings = {}
  if (workspace?.settings) {
    try {
      settings = JSON.parse(workspace.settings) as WorkspaceSettings
    } catch {
      // Ignore parse error
    }
  }

  return {
    method: settings.distanceCalculationMethod || 'straight_line',
    apiKey: settings.googleMapsApiKey
  }
}

/**
 * Calcula a distância entre um talhão e uma caixa logística
 */
async function calculateDistanceBetween(
  fieldLat: number,
  fieldLng: number,
  unitLat: number,
  unitLng: number,
  method: CalculationMethod,
  apiKey?: string
): Promise<number> {
  if (method === 'road_distance' && apiKey) {
    return await calculateRoadDistance(fieldLat, fieldLng, unitLat, unitLng, apiKey)
  }
  return calculateStraightLineDistance(fieldLat, fieldLng, unitLat, unitLng)
}

/**
 * Processa distâncias para um talhão específico (todas as caixas do workspace)
 */
export async function processFieldDistances(fieldId: string): Promise<number> {
  const field = await prisma.field.findUnique({
    where: { id: fieldId },
    select: {
      id: true,
      latitude: true,
      longitude: true,
      workspaceId: true
    }
  })

  if (!field || !field.latitude || !field.longitude || !field.workspaceId) {
    console.log(`[LOGISTICS] Campo ${fieldId} sem coordenadas ou workspace`)
    return 0
  }

  // Buscar todas as caixas logísticas ativas do workspace
  const units = await prisma.logisticsUnit.findMany({
    where: {
      workspaceId: field.workspaceId,
      isActive: true,
      latitude: { not: null },
      longitude: { not: null }
    }
  })

  if (units.length === 0) {
    console.log(`[LOGISTICS] Nenhuma caixa logística ativa no workspace`)
    return 0
  }

  // Obter configuração de distância
  const config = await getWorkspaceDistanceMethod(field.workspaceId)
  
  let processed = 0

  for (const unit of units) {
    if (!unit.latitude || !unit.longitude) continue

    const distanceKm = await calculateDistanceBetween(
      field.latitude,
      field.longitude,
      unit.latitude,
      unit.longitude,
      config.method,
      config.apiKey
    )

    // Verificar se está dentro do raio de cobertura
    const isWithinCoverage = unit.coverageRadiusKm === null || distanceKm <= unit.coverageRadiusKm

    // Upsert a distância
    await prisma.fieldLogisticsDistance.upsert({
      where: {
        fieldId_logisticsUnitId: {
          fieldId: field.id,
          logisticsUnitId: unit.id
        }
      },
      update: {
        distanceKm,
        isWithinCoverage,
        calculationMethod: config.method,
        updatedAt: new Date()
      },
      create: {
        fieldId: field.id,
        logisticsUnitId: unit.id,
        distanceKm,
        isWithinCoverage,
        calculationMethod: config.method
      }
    })

    processed++
  }

  console.log(`[LOGISTICS] Processadas ${processed} distâncias para talhão ${fieldId}`)
  return processed
}

/**
 * Processa distâncias para uma caixa logística específica (todos os talhões do workspace)
 */
export async function processUnitDistances(unitId: string): Promise<number> {
  const unit = await prisma.logisticsUnit.findUnique({
    where: { id: unitId },
    select: {
      id: true,
      latitude: true,
      longitude: true,
      coverageRadiusKm: true,
      workspaceId: true
    }
  })

  if (!unit || !unit.latitude || !unit.longitude) {
    console.log(`[LOGISTICS] Caixa ${unitId} sem coordenadas`)
    return 0
  }

  // Buscar todos os talhões com coordenadas do workspace
  const fields = await prisma.field.findMany({
    where: {
      workspaceId: unit.workspaceId,
      latitude: { not: null },
      longitude: { not: null }
    },
    select: {
      id: true,
      latitude: true,
      longitude: true
    }
  })

  if (fields.length === 0) {
    console.log(`[LOGISTICS] Nenhum talhão com coordenadas no workspace`)
    return 0
  }

  // Obter configuração de distância
  const config = await getWorkspaceDistanceMethod(unit.workspaceId)
  
  let processed = 0

  for (const field of fields) {
    if (!field.latitude || !field.longitude) continue

    const distanceKm = await calculateDistanceBetween(
      field.latitude,
      field.longitude,
      unit.latitude,
      unit.longitude,
      config.method,
      config.apiKey
    )

    // Verificar se está dentro do raio de cobertura
    const isWithinCoverage = unit.coverageRadiusKm === null || distanceKm <= unit.coverageRadiusKm

    // Upsert a distância
    await prisma.fieldLogisticsDistance.upsert({
      where: {
        fieldId_logisticsUnitId: {
          fieldId: field.id,
          logisticsUnitId: unit.id
        }
      },
      update: {
        distanceKm,
        isWithinCoverage,
        calculationMethod: config.method,
        updatedAt: new Date()
      },
      create: {
        fieldId: field.id,
        logisticsUnitId: unit.id,
        distanceKm,
        isWithinCoverage,
        calculationMethod: config.method
      }
    })

    processed++
  }

  console.log(`[LOGISTICS] Processadas ${processed} distâncias para caixa ${unitId}`)
  return processed
}

/**
 * Reprocessa todas as distâncias de um workspace
 * Útil quando o método de cálculo muda (linha reta → rodoviário)
 */
export async function reprocessWorkspaceDistances(workspaceId: string): Promise<{
  fieldsProcessed: number
  distancesCalculated: number
}> {
  console.log(`[LOGISTICS] Iniciando reprocessamento do workspace ${workspaceId}`)

  // Deletar todas as distâncias existentes do workspace
  const deleted = await prisma.fieldLogisticsDistance.deleteMany({
    where: {
      field: { workspaceId },
      logisticsUnit: { workspaceId }
    }
  })
  console.log(`[LOGISTICS] Removidas ${deleted.count} distâncias antigas`)

  // Buscar todas as caixas logísticas ativas
  const units = await prisma.logisticsUnit.findMany({
    where: {
      workspaceId,
      isActive: true,
      latitude: { not: null },
      longitude: { not: null }
    }
  })

  // Buscar todos os talhões com coordenadas
  const fields = await prisma.field.findMany({
    where: {
      workspaceId,
      latitude: { not: null },
      longitude: { not: null }
    },
    select: {
      id: true,
      latitude: true,
      longitude: true
    }
  })

  if (units.length === 0 || fields.length === 0) {
    console.log(`[LOGISTICS] Sem caixas ou talhões para processar`)
    return { fieldsProcessed: 0, distancesCalculated: 0 }
  }

  // Obter configuração de distância
  const config = await getWorkspaceDistanceMethod(workspaceId)
  
  let distancesCalculated = 0

  // Calcular todas as combinações
  for (const field of fields) {
    if (!field.latitude || !field.longitude) continue

    for (const unit of units) {
      if (!unit.latitude || !unit.longitude) continue

      const distanceKm = await calculateDistanceBetween(
        field.latitude,
        field.longitude,
        unit.latitude,
        unit.longitude,
        config.method,
        config.apiKey
      )

      const isWithinCoverage = unit.coverageRadiusKm === null || distanceKm <= unit.coverageRadiusKm

      await prisma.fieldLogisticsDistance.create({
        data: {
          fieldId: field.id,
          logisticsUnitId: unit.id,
          distanceKm,
          isWithinCoverage,
          calculationMethod: config.method
        }
      })

      distancesCalculated++
    }
  }

  console.log(`[LOGISTICS] Reprocessamento concluído: ${fields.length} talhões, ${distancesCalculated} distâncias`)
  
  return {
    fieldsProcessed: fields.length,
    distancesCalculated
  }
}

/**
 * Obtém as distâncias persistidas para um talhão
 */
export async function getFieldDistances(fieldId: string) {
  return prisma.fieldLogisticsDistance.findMany({
    where: { fieldId },
    include: {
      logisticsUnit: {
        select: {
          id: true,
          name: true,
          coverageRadiusKm: true
        }
      }
    },
    orderBy: { distanceKm: 'asc' }
  })
}

/**
 * Obtém estatísticas de cobertura do workspace
 */
export async function getWorkspaceCoverageStats(workspaceId: string) {
  // Talhões com pelo menos uma cobertura
  const fieldsWithCoverage = await prisma.fieldLogisticsDistance.groupBy({
    by: ['fieldId'],
    where: {
      isWithinCoverage: true,
      field: { workspaceId }
    }
  })

  // Talhões com múltiplas coberturas (interseção)
  const fieldsWithMultipleCoverage = await prisma.fieldLogisticsDistance.groupBy({
    by: ['fieldId'],
    where: {
      isWithinCoverage: true,
      field: { workspaceId }
    },
    _count: { logisticsUnitId: true },
    having: {
      logisticsUnitId: { _count: { gt: 1 } }
    }
  })

  // Total de talhões com coordenadas
  const totalFields = await prisma.field.count({
    where: {
      workspaceId,
      latitude: { not: null },
      longitude: { not: null }
    }
  })

  return {
    totalFields,
    fieldsWithCoverage: fieldsWithCoverage.length,
    fieldsWithIntersection: fieldsWithMultipleCoverage.length,
    fieldsWithoutCoverage: totalFields - fieldsWithCoverage.length
  }
}
