import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { validateGeometry } from '@/lib/services/geometry.service'
import { reverseGeocode } from '@/lib/services/geocoding.service'
import { z } from 'zod'

// Schema de validação
const createFieldSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  crop: z.string().default('SOJA'),
  seasonStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  geometryJson: z.string().min(1, 'Geometria é obrigatória')
})

/**
 * GET /api/fields
 * Lista todos os talhões
 */
export async function GET() {
  try {
    const fields = await prisma.field.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        status: true,
        errorMessage: true,
        city: true,
        state: true,
        areaHa: true,
        crop: true,
        createdAt: true,
        updatedAt: true,
        processedAt: true,
        agroData: {
          select: {
            areaHa: true,
            volumeEstimatedKg: true,
            confidence: true,
            eosDate: true
          }
        },
        analyses: {
          select: {
            templateId: true,
            status: true,
            statusColor: true,
            createdAt: true
          }
        }
      }
    })

    return NextResponse.json({ fields })
  } catch (error) {
    console.error('Error listing fields:', error)
    return NextResponse.json(
      { error: 'Failed to list fields' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/fields
 * Cria um novo talhão
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar se há body
    const contentLength = request.headers.get('content-length')
    if (!contentLength || contentLength === '0') {
      console.error('Empty request body')
      return NextResponse.json(
        { error: 'Request body is empty' },
        { status: 400 }
      )
    }

    // Parse JSON com tratamento de erro
    let body: any
    try {
      const text = await request.text()
      if (!text || text.trim() === '') {
        console.error('Empty request text')
        return NextResponse.json(
          { error: 'Request body is empty' },
          { status: 400 }
        )
      }
      body = JSON.parse(text)
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    console.log('Received field data:', { 
      name: body.name, 
      crop: body.crop,
      date: body.seasonStartDate,
      hasGeometry: !!body.geometryJson,
      geometryLength: body.geometryJson?.length
    })
    
    // Validar input
    const parsed = createFieldSchema.safeParse(body)
    if (!parsed.success) {
      console.error('Validation error:', parsed.error.flatten())
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { name, crop, seasonStartDate, geometryJson } = parsed.data

    // Validar geometria
    const validation = validateGeometry(geometryJson, 'geometry.geojson')
    if (!validation.isValid) {
      return NextResponse.json(
        { error: 'Geometria inválida', details: validation.errors },
        { status: 400 }
      )
    }

    // Geocodificar localização
    const location = await reverseGeocode(
      validation.centroid.lat,
      validation.centroid.lng
    )

    // Criar talhão
    const field = await prisma.field.create({
      data: {
        name,
        crop,
        seasonStartDate: new Date(seasonStartDate),
        geometryJson: JSON.stringify(validation.geojson),
        status: 'PENDING',
        city: location.city,
        state: location.state,
        latitude: location.lat,
        longitude: location.lng,
        areaHa: validation.areaHa
      }
    })

    return NextResponse.json({ field }, { status: 201 })
  } catch (error) {
    console.error('Error creating field:', error)
    return NextResponse.json(
      { error: 'Failed to create field' },
      { status: 500 }
    )
  }
}
