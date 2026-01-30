import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorizedResponse } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    // Buscar dados atualizados do usuário
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { workspace: true },
    })

    if (!user || !user.isActive) {
      return unauthorizedResponse()
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        hasAcceptedDisclaimer: user.hasAcceptedDisclaimer,
        disclaimerVersionAccepted: user.disclaimerVersionAccepted,
        workspace: {
          id: user.workspace.id,
          name: user.workspace.name,
          slug: user.workspace.slug,
        },
      },
    })
  } catch (error) {
    console.error('Erro ao buscar usuário:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
