import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'

interface RouteParams {
  params: { id: string }
}

/**
 * GET /api/producers/[id]
 * Retorna um produtor específico
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

    const producer = await prisma.producer.findFirst({
      where: {
        id: params.id,
        workspaceId: session.workspaceId,
      },
      include: {
        fields: {
          select: {
            id: true,
            name: true,
            cropType: true,
            status: true,
            areaHa: true,
            city: true,
            state: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { fields: true },
        },
      },
    })

    if (!producer) {
      return NextResponse.json(
        { error: 'Produtor não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({ producer })
  } catch (error) {
    console.error('Erro ao buscar produtor:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/producers/[id]
 * Atualiza um produtor
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    if (!['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(session.role)) {
      return forbiddenResponse()
    }

    // Verificar se produtor existe no workspace
    const existing = await prisma.producer.findFirst({
      where: {
        id: params.id,
        workspaceId: session.workspaceId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Produtor não encontrado' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { name, cpf } = body

    if (name !== undefined && name.trim() === '') {
      return NextResponse.json(
        { error: 'Nome não pode ser vazio' },
        { status: 400 }
      )
    }

    // Formatar CPF
    const cpfClean = cpf !== undefined ? (cpf ? cpf.replace(/\D/g, '') : null) : undefined

    if (cpfClean && cpfClean.length !== 11) {
      return NextResponse.json(
        { error: 'CPF deve ter 11 dígitos' },
        { status: 400 }
      )
    }

    const producer = await prisma.producer.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(cpfClean !== undefined && { cpf: cpfClean }),
      },
    })

    return NextResponse.json({ producer })
  } catch (error) {
    console.error('Erro ao atualizar produtor:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/producers/[id]
 * Remove um produtor
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

    if (!['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(session.role)) {
      return forbiddenResponse()
    }

    // Verificar se produtor existe no workspace
    const existing = await prisma.producer.findFirst({
      where: {
        id: params.id,
        workspaceId: session.workspaceId,
      },
      include: {
        _count: {
          select: { fields: true },
        },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Produtor não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se tem talhões vinculados
    if (existing._count.fields > 0) {
      return NextResponse.json(
        { error: `Não é possível excluir: produtor tem ${existing._count.fields} talhão(ões) vinculado(s). Desvincule-os primeiro.` },
        { status: 400 }
      )
    }

    await prisma.producer.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao excluir produtor:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
