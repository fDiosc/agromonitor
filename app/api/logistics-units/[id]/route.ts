import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession, unauthorizedResponse } from '@/lib/auth'
import { processUnitDistances } from '@/lib/services/logistics-distance.service'

interface RouteParams {
  params: { id: string }
}

// GET - Detalhes de uma caixa logística
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    const logisticsUnit = await prisma.logisticsUnit.findFirst({
      where: {
        id: params.id,
        workspaceId: session.workspaceId
      },
      include: {
        producers: {
          select: {
            id: true,
            name: true,
            _count: { select: { fields: true } }
          }
        },
        fields: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
            latitude: true,
            longitude: true,
            areaHa: true,
            status: true
          }
        },
        _count: {
          select: {
            producers: true,
            fields: true
          }
        }
      }
    })

    if (!logisticsUnit) {
      return NextResponse.json(
        { error: 'Caixa logística não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({ logisticsUnit })
  } catch (error) {
    console.error('Error fetching logistics unit:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar caixa logística' },
      { status: 500 }
    )
  }
}

// PUT - Atualizar caixa logística
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    // Verificar permissão
    if (!['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Sem permissão para editar caixas logísticas' },
        { status: 403 }
      )
    }

    // Verificar se existe e pertence ao workspace
    const existing = await prisma.logisticsUnit.findFirst({
      where: {
        id: params.id,
        workspaceId: session.workspaceId
      }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Caixa logística não encontrada' },
        { status: 404 }
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
      storageCapacityTons,
      isActive
    } = body

    // Validações
    if (name !== undefined && name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Nome não pode ser vazio' },
        { status: 400 }
      )
    }

    const logisticsUnit = await prisma.logisticsUnit.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(latitude !== undefined && { latitude: latitude ? parseFloat(latitude) : null }),
        ...(longitude !== undefined && { longitude: longitude ? parseFloat(longitude) : null }),
        ...(address !== undefined && { address: address?.trim() || null }),
        ...(city !== undefined && { city: city?.trim() || null }),
        ...(state !== undefined && { state: state?.trim() || null }),
        ...(coverageRadiusKm !== undefined && { coverageRadiusKm: coverageRadiusKm ? parseFloat(coverageRadiusKm) : null }),
        ...(dailyCapacityTons !== undefined && { dailyCapacityTons: dailyCapacityTons ? parseFloat(dailyCapacityTons) : null }),
        ...(storageCapacityTons !== undefined && { storageCapacityTons: storageCapacityTons ? parseFloat(storageCapacityTons) : null }),
        ...(isActive !== undefined && { isActive })
      }
    })

    // Reprocessar distâncias se coordenadas ou raio mudaram
    const locationChanged = latitude !== undefined || longitude !== undefined || coverageRadiusKm !== undefined
    if (locationChanged && logisticsUnit.latitude && logisticsUnit.longitude) {
      processUnitDistances(logisticsUnit.id).catch(err => {
        console.error('Erro ao reprocessar distâncias:', err)
      })
    }

    return NextResponse.json({ logisticsUnit })
  } catch (error) {
    console.error('Error updating logistics unit:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar caixa logística' },
      { status: 500 }
    )
  }
}

// DELETE - Desativar/excluir caixa logística
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    // Verificar permissão
    if (!['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Sem permissão para excluir caixas logísticas' },
        { status: 403 }
      )
    }

    // Verificar se existe e pertence ao workspace
    const existing = await prisma.logisticsUnit.findFirst({
      where: {
        id: params.id,
        workspaceId: session.workspaceId
      },
      include: {
        _count: {
          select: {
            producers: true,
            fields: true
          }
        }
      }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Caixa logística não encontrada' },
        { status: 404 }
      )
    }

    // Se tem produtores ou talhões vinculados, apenas desativar
    if (existing._count.producers > 0 || existing._count.fields > 0) {
      await prisma.logisticsUnit.update({
        where: { id: params.id },
        data: { isActive: false }
      })

      return NextResponse.json({
        message: 'Caixa logística desativada (possui vínculos)',
        deactivated: true
      })
    }

    // Sem vínculos, pode excluir
    await prisma.logisticsUnit.delete({
      where: { id: params.id }
    })

    return NextResponse.json({
      message: 'Caixa logística excluída',
      deleted: true
    })
  } catch (error) {
    console.error('Error deleting logistics unit:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir caixa logística' },
      { status: 500 }
    )
  }
}
