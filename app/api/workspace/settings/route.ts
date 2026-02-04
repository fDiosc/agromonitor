import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession, unauthorizedResponse } from '@/lib/auth'
import { getFeatureFlags, updateFeatureFlags, type FeatureFlagsUpdate } from '@/lib/services/feature-flags.service'

// Interface legacy (para compatibilidade)
interface LegacySettings {
  distanceCalculationMethod?: 'straight_line' | 'road_distance'
  googleMapsApiKey?: string
}

// GET - Obter configurações do workspace (legacy + feature flags)
export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    // Buscar configurações legacy do campo JSON
    const workspace = await prisma.workspace.findUnique({
      where: { id: session.workspaceId },
      select: { settings: true }
    })

    let legacySettings: LegacySettings = {}
    if (workspace?.settings) {
      try {
        legacySettings = JSON.parse(workspace.settings) as LegacySettings
      } catch {
        legacySettings = {}
      }
    }

    // Buscar feature flags do novo modelo
    const featureFlags = await getFeatureFlags(session.workspaceId)

    // Mesclar legacy com feature flags (feature flags tem precedência)
    const settings = {
      // Campos legacy (para compatibilidade com UI existente)
      distanceCalculationMethod: featureFlags.distanceCalculationMethod || legacySettings.distanceCalculationMethod || 'straight_line',
      googleMapsApiKey: featureFlags.googleMapsApiKey || legacySettings.googleMapsApiKey || '',
    }

    return NextResponse.json({ 
      settings,
      featureFlags
    })
  } catch (error) {
    console.error('Error fetching workspace settings:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar configurações' },
      { status: 500 }
    )
  }
}

// PUT - Atualizar configurações do workspace (suporta legacy e feature flags)
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
    const { settings, featureFlags } = body as { 
      settings?: LegacySettings
      featureFlags?: FeatureFlagsUpdate
    }

    // Validar método de distância (se fornecido em qualquer lugar)
    const distanceMethod = featureFlags?.distanceCalculationMethod || settings?.distanceCalculationMethod
    if (distanceMethod && !['straight_line', 'road_distance'].includes(distanceMethod)) {
      return NextResponse.json(
        { error: 'Método de cálculo de distância inválido' },
        { status: 400 }
      )
    }

    // Se recebeu settings legacy, converter para featureFlags
    if (settings && !featureFlags) {
      const updates: FeatureFlagsUpdate = {}
      if (settings.distanceCalculationMethod) {
        updates.distanceCalculationMethod = settings.distanceCalculationMethod
      }
      if (settings.googleMapsApiKey !== undefined) {
        updates.googleMapsApiKey = settings.googleMapsApiKey || null
      }
      
      const updatedFlags = await updateFeatureFlags(session.workspaceId, updates)
      
      // Também atualizar o campo legacy para compatibilidade
      await prisma.workspace.update({
        where: { id: session.workspaceId },
        data: {
          settings: JSON.stringify(settings)
        }
      })
      
      return NextResponse.json({ 
        settings, 
        featureFlags: updatedFlags 
      })
    }

    // Se recebeu featureFlags diretamente
    if (featureFlags) {
      const updatedFlags = await updateFeatureFlags(session.workspaceId, featureFlags)
      
      // Sincronizar campos de distância com legacy
      if (featureFlags.distanceCalculationMethod || featureFlags.googleMapsApiKey !== undefined) {
        const workspace = await prisma.workspace.findUnique({
          where: { id: session.workspaceId },
          select: { settings: true }
        })
        
        let legacySettings: LegacySettings = {}
        if (workspace?.settings) {
          try {
            legacySettings = JSON.parse(workspace.settings)
          } catch {
            legacySettings = {}
          }
        }
        
        if (featureFlags.distanceCalculationMethod) {
          legacySettings.distanceCalculationMethod = featureFlags.distanceCalculationMethod
        }
        if (featureFlags.googleMapsApiKey !== undefined) {
          legacySettings.googleMapsApiKey = featureFlags.googleMapsApiKey || undefined
        }
        
        await prisma.workspace.update({
          where: { id: session.workspaceId },
          data: {
            settings: JSON.stringify(legacySettings)
          }
        })
      }
      
      return NextResponse.json({ 
        settings: {
          distanceCalculationMethod: updatedFlags.distanceCalculationMethod,
          googleMapsApiKey: updatedFlags.googleMapsApiKey || ''
        },
        featureFlags: updatedFlags 
      })
    }

    return NextResponse.json(
      { error: 'Nenhuma configuração fornecida' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error updating workspace settings:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar configurações' },
      { status: 500 }
    )
  }
}
