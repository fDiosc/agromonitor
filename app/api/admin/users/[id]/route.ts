import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'

interface RouteParams {
  params: { id: string }
}

/**
 * GET /api/admin/users/[id]
 * Retorna um usuário específico
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

    if (!['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
      return forbiddenResponse()
    }

    const user = await prisma.user.findUnique({
      where: {
        id: params.id,
        workspaceId: session.workspaceId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        lastLoginAt: true,
        createdAt: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Erro ao buscar usuário:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/users/[id]
 * Atualiza um usuário
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

    if (!['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
      return forbiddenResponse()
    }

    const body = await request.json()
    const { name, role, isActive } = body

    // Não pode editar próprio status
    if (params.id === session.userId && isActive === false) {
      return NextResponse.json(
        { error: 'Você não pode desativar sua própria conta' },
        { status: 400 }
      )
    }

    const user = await prisma.user.update({
      where: {
        id: params.id,
        workspaceId: session.workspaceId,
      },
      data: {
        ...(name && { name }),
        ...(role && { role }),
        ...(isActive !== undefined && { isActive }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    })

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Remove um usuário
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

    if (!['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
      return forbiddenResponse()
    }

    // Não pode deletar a si mesmo
    if (params.id === session.userId) {
      return NextResponse.json(
        { error: 'Você não pode deletar sua própria conta' },
        { status: 400 }
      )
    }

    await prisma.user.delete({
      where: {
        id: params.id,
        workspaceId: session.workspaceId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao deletar usuário:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
