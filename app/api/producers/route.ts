import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'

/**
 * GET /api/producers
 * Lista todos os produtores do workspace
 */
export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    const producers = await prisma.producer.findMany({
      where: { workspaceId: session.workspaceId },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { fields: true },
        },
      },
    })

    return NextResponse.json({ producers })
  } catch (error) {
    console.error('Erro ao listar produtores:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/producers
 * Cria um novo produtor
 */
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    // Apenas ADMIN e OPERATOR podem criar produtores
    if (!['SUPER_ADMIN', 'ADMIN', 'OPERATOR'].includes(session.role)) {
      return forbiddenResponse('Sem permissão para criar produtores')
    }

    const body = await request.json()
    const { name, cpf } = body

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'Nome é obrigatório' },
        { status: 400 }
      )
    }

    // Formatar CPF (remover caracteres não numéricos)
    const cpfClean = cpf ? cpf.replace(/\D/g, '') : null

    // Validar CPF se fornecido (11 dígitos)
    if (cpfClean && cpfClean.length !== 11) {
      return NextResponse.json(
        { error: 'CPF deve ter 11 dígitos' },
        { status: 400 }
      )
    }

    const producer = await prisma.producer.create({
      data: {
        name: name.trim(),
        cpf: cpfClean,
        workspaceId: session.workspaceId,
      },
    })

    return NextResponse.json({ producer }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar produtor:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
