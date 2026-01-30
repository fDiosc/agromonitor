import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, hashPassword, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'

interface RouteParams {
  params: { id: string }
}

/**
 * POST /api/admin/users/[id]/reset-password
 * Reseta a senha de um usuário
 */
export async function POST(
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
    const { newPassword } = body

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Nova senha deve ter no mínimo 6 caracteres' },
        { status: 400 }
      )
    }

    const passwordHash = await hashPassword(newPassword)

    await prisma.user.update({
      where: {
        id: params.id,
        workspaceId: session.workspaceId,
      },
      data: {
        passwordHash,
        mustChangePassword: true,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao resetar senha:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
