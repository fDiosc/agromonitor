import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession, unauthorizedResponse } from '@/lib/auth'

interface WorkspaceSettings {
  distanceCalculationMethod?: 'straight_line' | 'road_distance'
  googleMapsApiKey?: string
}

// GET - Obter configurações do workspace
export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: session.workspaceId },
      select: { settings: true }
    })

    let settings: WorkspaceSettings = {}
    if (workspace?.settings) {
      try {
        settings = JSON.parse(workspace.settings) as WorkspaceSettings
      } catch {
        settings = {}
      }
    }

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Error fetching workspace settings:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar configurações' },
      { status: 500 }
    )
  }
}

// PUT - Atualizar configurações do workspace
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    // Verificar permissão (apenas ADMIN ou superior)
    if (!['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Sem permissão para alterar configurações' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { settings } = body as { settings: WorkspaceSettings }

    // Validar método de distância
    if (settings.distanceCalculationMethod && 
        !['straight_line', 'road_distance'].includes(settings.distanceCalculationMethod)) {
      return NextResponse.json(
        { error: 'Método de cálculo de distância inválido' },
        { status: 400 }
      )
    }

    // Buscar configurações atuais para mesclar
    const workspace = await prisma.workspace.findUnique({
      where: { id: session.workspaceId },
      select: { settings: true }
    })

    let currentSettings: WorkspaceSettings = {}
    if (workspace?.settings) {
      try {
        currentSettings = JSON.parse(workspace.settings) as WorkspaceSettings
      } catch {
        currentSettings = {}
      }
    }

    // Mesclar configurações
    const newSettings: WorkspaceSettings = {
      ...currentSettings,
      ...settings
    }

    // Atualizar workspace
    await prisma.workspace.update({
      where: { id: session.workspaceId },
      data: {
        settings: JSON.stringify(newSettings)
      }
    })

    return NextResponse.json({ settings: newSettings })
  } catch (error) {
    console.error('Error updating workspace settings:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar configurações' },
      { status: 500 }
    )
  }
}
