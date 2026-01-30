import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'

interface RouteParams {
  params: { id: string }
}

/**
 * GET /api/admin/workspaces/[id]
 * Retorna um workspace específico com seus usuários
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

    if (session.role !== 'SUPER_ADMIN') {
      return forbiddenResponse()
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: params.id },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            fields: true,
          },
        },
      },
    })

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({ workspace })
  } catch (error) {
    console.error('Erro ao buscar workspace:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/workspaces/[id]
 * Atualiza um workspace
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

    if (session.role !== 'SUPER_ADMIN') {
      return forbiddenResponse()
    }

    const body = await request.json()
    const { name, isActive, maxFields, maxUsers } = body

    const workspace = await prisma.workspace.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(isActive !== undefined && { isActive }),
        ...(maxFields && { maxFields }),
        ...(maxUsers && { maxUsers }),
      },
    })

    return NextResponse.json({ workspace })
  } catch (error) {
    console.error('Erro ao atualizar workspace:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/workspaces/[id]
 * Remove um workspace (cuidado: remove todos os dados!)
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

    if (session.role !== 'SUPER_ADMIN') {
      return forbiddenResponse()
    }

    // Não permitir deletar o próprio workspace
    if (params.id === session.workspaceId) {
      return NextResponse.json(
        { error: 'Você não pode deletar seu próprio workspace' },
        { status: 400 }
      )
    }

    // Verificar se tem dados
    const workspace = await prisma.workspace.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            users: true,
            fields: true,
          },
        },
      },
    })

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace não encontrado' },
        { status: 404 }
      )
    }

    if (workspace._count.fields > 0) {
      return NextResponse.json(
        { error: `Não é possível deletar: workspace tem ${workspace._count.fields} talhões. Remova os dados primeiro.` },
        { status: 400 }
      )
    }

    // Deletar usuários primeiro
    await prisma.user.deleteMany({
      where: { workspaceId: params.id },
    })

    // Deletar workspace
    await prisma.workspace.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao deletar workspace:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
