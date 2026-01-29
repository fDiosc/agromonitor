import { NextRequest, NextResponse } from 'next/server'
import { validateGeometry } from '@/lib/services/geometry.service'

/**
 * POST /api/upload
 * Valida um arquivo de geometria (KML ou GeoJSON)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum arquivo enviado' },
        { status: 400 }
      )
    }

    // Ler conteúdo do arquivo
    const content = await file.text()
    
    // Validar geometria
    const validation = validateGeometry(content, file.name)

    if (!validation.isValid) {
      return NextResponse.json(
        {
          isValid: false,
          errors: validation.errors,
          warnings: validation.warnings
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      isValid: true,
      type: validation.type,
      vertexCount: validation.vertexCount,
      areaHa: validation.areaHa,
      centroid: validation.centroid,
      geojson: validation.geojson,
      warnings: validation.warnings
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Erro ao processar arquivo' },
      { status: 500 }
    )
  }
}
