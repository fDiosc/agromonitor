import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorizedResponse } from '@/lib/auth'
import { reprocessWorkspaceDistances } from '@/lib/services/logistics-distance.service'

// POST - Reprocessar todas as distâncias do workspace
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    // Verificar permissão (apenas ADMIN ou superior)
    if (!['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Sem permissão para reprocessar distâncias' },
        { status: 403 }
      )
    }

    console.log(`[LOGISTICS] Iniciando reprocessamento solicitado por ${session.email}`)

    const result = await reprocessWorkspaceDistances(session.workspaceId)

    return NextResponse.json({
      success: true,
      message: `Reprocessamento concluído`,
      ...result
    })
  } catch (error) {
    console.error('Error reprocessing distances:', error)
    return NextResponse.json(
      { error: 'Erro ao reprocessar distâncias' },
      { status: 500 }
    )
  }
}
