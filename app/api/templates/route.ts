import { NextResponse } from 'next/server'
import { getTemplateConfigs } from '@/lib/templates'

/**
 * GET /api/templates
 * Lista todos os templates de análise disponíveis
 */
export async function GET() {
  try {
    const templates = getTemplateConfigs()

    return NextResponse.json({
      templates: templates.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        icon: t.icon,
        color: t.color,
        version: t.version
      }))
    })
  } catch (error) {
    console.error('Error listing templates:', error)
    return NextResponse.json(
      { error: 'Failed to list templates' },
      { status: 500 }
    )
  }
}
