import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getSession,
  verifyPassword,
  hashPassword,
  createToken,
  setAuthCookie,
  unauthorizedResponse,
  type JWTPayload,
} from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    const body = await request.json()
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Senha atual e nova senha são obrigatórias' },
        { status: 400 }
      )
    }

    // Validar nova senha
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'A nova senha deve ter no mínimo 8 caracteres' },
        { status: 400 }
      )
    }

    if (!/[A-Z]/.test(newPassword)) {
      return NextResponse.json(
        { error: 'A nova senha deve ter pelo menos uma letra maiúscula' },
        { status: 400 }
      )
    }

    if (!/[0-9]/.test(newPassword)) {
      return NextResponse.json(
        { error: 'A nova senha deve ter pelo menos um número' },
        { status: 400 }
      )
    }

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { workspace: true },
    })

    if (!user) {
      return unauthorizedResponse()
    }

    // Verificar senha atual
    const isValidPassword = await verifyPassword(currentPassword, user.passwordHash)
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Senha atual incorreta' },
        { status: 401 }
      )
    }

    // Atualizar senha
    const newHash = await hashPassword(newPassword)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
      },
    })

    // Criar novo token (sem mustChangePassword)
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      workspaceId: user.workspaceId,
      workspaceName: user.workspace.name,
      workspaceSlug: user.workspace.slug,
    }

    const token = await createToken(payload)
    await setAuthCookie(token)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao alterar senha:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
