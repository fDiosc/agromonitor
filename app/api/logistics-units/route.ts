import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession, unauthorizedResponse } from '@/lib/auth'
import { processUnitDistances } from '@/lib/services/logistics-distance.service'

// GET - Listar caixas logísticas do workspace
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const logisticsUnits = await prisma.logisticsUnit.findMany({
      where: {
        workspaceId: session.workspaceId,
        ...(includeInactive ? {} : { isActive: true })
      },
      include: {
        _count: {
          select: {
            producers: true,
            fields: true
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({ logisticsUnits })
  } catch (error) {
    console.error('Error fetching logistics units:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar caixas logísticas' },
      { status: 500 }
    )
  }
}

// POST - Criar nova caixa logística
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    // Verificar permissão (apenas ADMIN ou superior)
    if (!['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Sem permissão para criar caixas logísticas' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      name,
      latitude,
      longitude,
      address,
      city,
      state,
      coverageRadiusKm,
      dailyCapacityTons,
      storageCapacityTons
    } = body

    // Validações
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Nome é obrigatório' },
        { status: 400 }
      )
    }

    // Validar que tem pelo menos coordenadas ou endereço
    if (!latitude && !longitude && !address) {
      return NextResponse.json(
        { error: 'Informe coordenadas (lat/lng) ou endereço' },
        { status: 400 }
      )
    }

    const logisticsUnit = await prisma.logisticsUnit.create({
      data: {
        name: name.trim(),
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        address: address?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
        coverageRadiusKm: coverageRadiusKm ? parseFloat(coverageRadiusKm) : null,
        dailyCapacityTons: dailyCapacityTons ? parseFloat(dailyCapacityTons) : null,
        storageCapacityTons: storageCapacityTons ? parseFloat(storageCapacityTons) : null,
        workspaceId: session.workspaceId
      }
    })

    // Processar distâncias para todos os talhões do workspace
    if (logisticsUnit.latitude && logisticsUnit.longitude) {
      processUnitDistances(logisticsUnit.id).catch(err => {
        console.error('Erro ao processar distâncias:', err)
      })
    }

    return NextResponse.json({ logisticsUnit }, { status: 201 })
  } catch (error) {
    console.error('Error creating logistics unit:', error)
    return NextResponse.json(
      { error: 'Erro ao criar caixa logística' },
      { status: 500 }
    )
  }
}
