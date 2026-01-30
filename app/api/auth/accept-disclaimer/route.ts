import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorizedResponse } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    const body = await request.json()
    const { version } = body

    if (!version) {
      return NextResponse.json(
        { error: 'Versão não informada' },
        { status: 400 }
      )
    }

    // Atualizar usuário com aceitação do disclaimer
    await prisma.user.update({
      where: { id: session.userId },
      data: {
        hasAcceptedDisclaimer: true,
        disclaimerAcceptedAt: new Date(),
        disclaimerVersionAccepted: version,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Disclaimer aceito com sucesso',
    })
  } catch (error) {
    console.error('Erro ao aceitar disclaimer:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
