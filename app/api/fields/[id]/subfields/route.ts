import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession, unauthorizedResponse } from '@/lib/auth'
import { validateGeometry } from '@/lib/services/geometry.service'
import { reverseGeocode } from '@/lib/services/geocoding.service'
import { isFeatureEnabled } from '@/lib/services/feature-flags.service'
import booleanContains from '@turf/boolean-contains'
import { polygon as turfPolygon } from '@turf/helpers'

interface RouteParams {
  params: { id: string }
}

/**
 * GET /api/fields/[id]/subfields
 * Lista os subtalhões de um talhão pai
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

    // Verificar se o talhão pai existe e pertence ao workspace
    const parentField = await prisma.field.findFirst({
      where: {
        id: params.id,
        workspaceId: session.workspaceId
      }
    })

    if (!parentField) {
      return NextResponse.json(
        { error: 'Talhão não encontrado' },
        { status: 404 }
      )
    }

    // Buscar subtalhões
    const subFields = await prisma.field.findMany({
      where: {
        parentFieldId: params.id
      },
      orderBy: { name: 'asc' },
      include: {
        agroData: {
          select: {
            areaHa: true,
            volumeEstimatedKg: true,
            confidence: true,
            confidenceScore: true,
            eosDate: true,
            sosDate: true,
            cropPatternStatus: true,
            phenologyHealth: true,
            peakNdvi: true,
          }
        }
      }
    })

    return NextResponse.json({
      parentField: {
        id: parentField.id,
        name: parentField.name,
        geometryJson: parentField.geometryJson,
        cropType: parentField.cropType,
        seasonStartDate: parentField.seasonStartDate,
      },
      subFields
    })
  } catch (error) {
    console.error('Error listing subfields:', error)
    return NextResponse.json(
      { error: 'Failed to list subfields' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/fields/[id]/subfields
 * Cria um subtalhão dentro do polígono pai
 * 
 * Body: {
 *   name: string (opcional, auto-gerado se omitido)
 *   geometryJson: string (GeoJSON - DEVE estar dentro do polígono pai)
 *   cropType?: 'SOJA' | 'MILHO' (herda do pai se omitido)
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    // Verificar permissão
    if (session.role === 'VIEWER') {
      return NextResponse.json(
        { error: 'Sem permissão para criar subtalhões' },
        { status: 403 }
      )
    }

    // Verificar se feature está habilitada
    const enabled = await isFeatureEnabled(session.workspaceId, 'enableSubFields')
    if (!enabled) {
      return NextResponse.json(
        { error: 'Subtalhões não habilitados. Ative nas Configurações.' },
        { status: 403 }
      )
    }

    // Buscar talhão pai
    const parentField = await prisma.field.findFirst({
      where: {
        id: params.id,
        workspaceId: session.workspaceId,
        parentFieldId: null // Deve ser um talhão raiz (não subtalhão)
      }
    })

    if (!parentField) {
      return NextResponse.json(
        { error: 'Talhão pai não encontrado ou é um subtalhão' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { geometryJson, cropType } = body

    if (!geometryJson) {
      return NextResponse.json(
        { error: 'geometryJson é obrigatório' },
        { status: 400 }
      )
    }

    // Validar geometria do subtalhão
    const validation = validateGeometry(geometryJson, 'subfield.geojson')
    if (!validation.isValid) {
      return NextResponse.json(
        { error: 'Geometria inválida', details: validation.errors },
        { status: 400 }
      )
    }

    // Validar que o subtalhão está DENTRO do polígono pai
    try {
      const parentGeojson = JSON.parse(parentField.geometryJson)
      const childGeojson = typeof geometryJson === 'string' ? JSON.parse(geometryJson) : geometryJson
      
      // Extrair coordenadas dos polígonos
      const parentCoords = parentGeojson.features?.[0]?.geometry?.coordinates || 
                           parentGeojson.geometry?.coordinates ||
                           parentGeojson.coordinates
      const childCoords = childGeojson.features?.[0]?.geometry?.coordinates ||
                          childGeojson.geometry?.coordinates ||
                          childGeojson.coordinates

      if (!parentCoords || !childCoords) {
        return NextResponse.json(
          { error: 'Não foi possível extrair coordenadas dos polígonos' },
          { status: 400 }
        )
      }

      const parentPoly = turfPolygon(parentCoords)
      const childPoly = turfPolygon(childCoords)

      if (!booleanContains(parentPoly, childPoly)) {
        return NextResponse.json(
          { error: 'O subtalhão deve estar completamente dentro do polígono pai' },
          { status: 400 }
        )
      }
    } catch (geoError) {
      console.error('Geometry containment check error:', geoError)
      return NextResponse.json(
        { error: 'Erro na validação geométrica. Verifique os polígonos.' },
        { status: 400 }
      )
    }

    // Auto-gerar nome se não fornecido
    const existingSubfields = await prisma.field.count({
      where: { parentFieldId: params.id }
    })
    const name = body.name?.trim() || `Talhão ${existingSubfields + 1}`

    // Geocodificar localização
    const location = await reverseGeocode(
      validation.centroid.lat,
      validation.centroid.lng
    )

    // Criar subtalhão herdando propriedades do pai
    const subField = await prisma.field.create({
      data: {
        name,
        cropType: cropType || parentField.cropType,
        seasonStartDate: parentField.seasonStartDate,
        geometryJson: JSON.stringify(validation.geojson),
        status: 'PENDING',
        city: location.city || parentField.city,
        state: location.state || parentField.state,
        latitude: location.lat || parentField.latitude,
        longitude: location.lng || parentField.longitude,
        areaHa: validation.areaHa,
        workspaceId: session.workspaceId,
        createdById: session.userId,
        producerId: parentField.producerId,
        logisticsUnitId: parentField.logisticsUnitId,
        plantingDateInput: parentField.plantingDateInput,
        parentFieldId: params.id,
      }
    })

    return NextResponse.json({ subField }, { status: 201 })
  } catch (error) {
    console.error('Error creating subfield:', error)
    return NextResponse.json(
      { error: 'Failed to create subfield' },
      { status: 500 }
    )
  }
}
