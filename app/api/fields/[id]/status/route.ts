import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession, unauthorizedResponse } from '@/lib/auth'

interface RouteParams {
  params: { id: string }
}

/**
 * GET /api/fields/[id]/status
 * Endpoint leve que retorna apenas status e updatedAt do campo
 * Usado para polling sem recalcular análises
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

    const field = await prisma.field.findUnique({
      where: { 
        id: params.id,
        workspaceId: session.workspaceId
      },
      select: {
        id: true,
        status: true,
        errorMessage: true,
        updatedAt: true
      }
    })

    if (!field) {
      return NextResponse.json(
        { error: 'Talhão não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(field)
  } catch (error) {
    console.error('Error fetching field status:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar status do talhão' },
      { status: 500 }
    )
  }
}
