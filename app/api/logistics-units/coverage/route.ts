import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession, unauthorizedResponse } from '@/lib/auth'

interface FieldCoverage {
  fieldId: string
  fieldName: string
  latitude: number | null
  longitude: number | null
  city: string | null
  state: string | null
  areaHa: number | null
  cropType: string | null
  producerId: string | null
  producerName: string | null
  parentFieldId: string | null
  subFieldCount: number
  assignedUnitId: string | null
  assignedUnitName: string | null
  assignmentType: 'direct' | 'inherited' | 'automatic' | 'none'
  coveringUnits: {
    id: string
    name: string
    distance: number
  }[]
  hasIntersection: boolean
}

// GET - Relatório de cobertura e interseções (lendo do banco)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    // Buscar todas as caixas logísticas ativas
    const logisticsUnits = await prisma.logisticsUnit.findMany({
      where: {
        workspaceId: session.workspaceId,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        coverageRadiusKm: true
      }
    })

    // Buscar todos os talhões com suas distâncias persistidas
    const fields = await prisma.field.findMany({
      where: {
        workspaceId: session.workspaceId,
        status: 'SUCCESS'
      },
      include: {
        producer: {
          select: {
            id: true,
            name: true,
            defaultLogisticsUnitId: true
          }
        },
        logisticsUnit: {
          select: {
            id: true,
            name: true
          }
        },
        logisticsDistances: {
          where: {
            isWithinCoverage: true
          },
          include: {
            logisticsUnit: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: {
            distanceKm: 'asc'
          }
        },
        _count: {
          select: { subFields: true }
        }
      }
    })

    // Montar dados de cobertura
    const fieldCoverages: FieldCoverage[] = fields.map(field => {
      // Unidades que cobrem este talhão (do banco)
      const coveringUnits = field.logisticsDistances.map(d => ({
        id: d.logisticsUnit.id,
        name: d.logisticsUnit.name,
        distance: Math.round(d.distanceKm * 10) / 10
      }))

      // Determinar tipo de atribuição
      let assignmentType: 'direct' | 'inherited' | 'automatic' | 'none' = 'none'
      let assignedUnitId: string | null = null
      let assignedUnitName: string | null = null

      if (field.logisticsUnitId) {
        // Atribuição direta no talhão
        assignmentType = 'direct'
        assignedUnitId = field.logisticsUnit?.id || null
        assignedUnitName = field.logisticsUnit?.name || null
      } else if (field.producer?.defaultLogisticsUnitId) {
        // Herda do produtor
        assignmentType = 'inherited'
        const inheritedUnit = logisticsUnits.find(u => u.id === field.producer?.defaultLogisticsUnitId)
        assignedUnitId = inheritedUnit?.id || null
        assignedUnitName = inheritedUnit?.name || null
      } else if (coveringUnits.length > 0) {
        // Automático: mais próxima
        assignmentType = 'automatic'
        assignedUnitId = coveringUnits[0].id
        assignedUnitName = coveringUnits[0].name
      }

      return {
        fieldId: field.id,
        fieldName: field.name,
        latitude: field.latitude,
        longitude: field.longitude,
        city: field.city,
        state: field.state,
        areaHa: field.areaHa,
        cropType: field.cropType,
        producerId: field.producerId,
        producerName: field.producer?.name || null,
        parentFieldId: field.parentFieldId,
        subFieldCount: field._count?.subFields || 0,
        assignedUnitId,
        assignedUnitName,
        assignmentType,
        coveringUnits,
        hasIntersection: coveringUnits.length > 1
      }
    })

    // Estatísticas
    const stats = {
      totalFields: fieldCoverages.length,
      fieldsWithDirectAssignment: fieldCoverages.filter(f => f.assignmentType === 'direct').length,
      fieldsWithInheritedAssignment: fieldCoverages.filter(f => f.assignmentType === 'inherited').length,
      fieldsWithAutomaticAssignment: fieldCoverages.filter(f => f.assignmentType === 'automatic').length,
      fieldsWithNoAssignment: fieldCoverages.filter(f => f.assignmentType === 'none').length,
      fieldsWithIntersection: fieldCoverages.filter(f => f.hasIntersection).length,
      fieldsOutsideAllCoverage: fieldCoverages.filter(f => f.coveringUnits.length === 0).length
    }

    // Agrupar por caixa logística
    const byUnit: Record<string, {
      unit: { id: string; name: string }
      directFields: number
      inheritedFields: number
      automaticFields: number
      totalFields: number
      totalAreaHa: number
    }> = {}

    for (const unit of logisticsUnits) {
      byUnit[unit.id] = {
        unit: { id: unit.id, name: unit.name },
        directFields: 0,
        inheritedFields: 0,
        automaticFields: 0,
        totalFields: 0,
        totalAreaHa: 0
      }
    }

    for (const coverage of fieldCoverages) {
      if (coverage.assignedUnitId && byUnit[coverage.assignedUnitId]) {
        byUnit[coverage.assignedUnitId].totalFields++
        byUnit[coverage.assignedUnitId].totalAreaHa += coverage.areaHa || 0

        if (coverage.assignmentType === 'direct') {
          byUnit[coverage.assignedUnitId].directFields++
        } else if (coverage.assignmentType === 'inherited') {
          byUnit[coverage.assignedUnitId].inheritedFields++
        } else if (coverage.assignmentType === 'automatic') {
          byUnit[coverage.assignedUnitId].automaticFields++
        }
      }
    }

    return NextResponse.json({
      fields: fieldCoverages,
      stats,
      byUnit: Object.values(byUnit),
      logisticsUnits
    })
  } catch (error) {
    console.error('Error generating coverage report:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar relatório de cobertura' },
      { status: 500 }
    )
  }
}
