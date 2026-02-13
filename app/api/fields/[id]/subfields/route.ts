import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession, unauthorizedResponse } from '@/lib/auth'
import { validateGeometry } from '@/lib/services/geometry.service'
import { reverseGeocode } from '@/lib/services/geocoding.service'
import { isFeatureEnabled } from '@/lib/services/feature-flags.service'
import booleanContains from '@turf/boolean-contains'
import buffer from '@turf/buffer'
import { polygon as turfPolygon, multiPolygon as turfMultiPolygon } from '@turf/helpers'

// Tolerância em metros para compensar imprecisão de desenho no mapa.
// 20m é suficiente para cobrir imprecisão de clique/toque sem permitir
// subtalhões significativamente fora do pai.
const CONTAINMENT_BUFFER_METERS = 20

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
            // Detected fields (para referência no modal de edição)
            detectedPlantingDate: true,
            detectedCropType: true,
            detectedConfidence: true,
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

      const parentFeature = extractTurfFeature(parentGeojson)
      const childFeature = extractTurfFeature(childGeojson)

      if (!parentFeature || !childFeature) {
        // Geometria degenerada no banco — não bloquear criação, mas logar
        console.warn(
          `Geometry containment check skipped for field ${params.id}: ` +
          `parent=${!!parentFeature}, child=${!!childFeature}`
        )
      } else {
        // Aplicar buffer de tolerância ao pai para compensar imprecisão de desenho
        const bufferedParent = buffer(parentFeature, CONTAINMENT_BUFFER_METERS, { units: 'meters' })

        if (bufferedParent && !booleanContains(bufferedParent, childFeature)) {
          return NextResponse.json(
            { error: 'O subtalhão deve estar dentro do polígono pai' },
            { status: 400 }
          )
        }
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

// ---------------------------------------------------------------------------
// Helpers de geometria para containment check
// ---------------------------------------------------------------------------

/**
 * Extrai um Feature turf válido de um GeoJSON arbitrário.
 * Suporta FeatureCollection, Feature, Polygon e MultiPolygon.
 * Fecha anéis não-fechados e valida que cada anel tem >= 4 posições.
 * Retorna null se a geometria for inválida ou degenerada.
 */
function extractTurfFeature(geojson: any) {
  const geometry =
    geojson?.features?.[0]?.geometry ||
    geojson?.geometry ||
    (geojson?.type === 'Polygon' || geojson?.type === 'MultiPolygon'
      ? geojson
      : null)

  if (!geometry?.type || !geometry?.coordinates) return null

  // Deep-clone para não mutar o original ao fechar anéis
  const coords = JSON.parse(JSON.stringify(geometry.coordinates))

  if (geometry.type === 'Polygon') {
    for (const ring of coords) {
      if (!closeAndValidateRing(ring)) return null
    }
    return turfPolygon(coords)
  }

  if (geometry.type === 'MultiPolygon') {
    for (const polygon of coords) {
      for (const ring of polygon) {
        if (!closeAndValidateRing(ring)) return null
      }
    }
    return turfMultiPolygon(coords)
  }

  return null
}

/**
 * Fecha o anel se não estiver fechado e valida >= 4 posições.
 * Modifica o array in-place.
 */
function closeAndValidateRing(ring: number[][]): boolean {
  if (!Array.isArray(ring) || ring.length < 3) return false

  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]])
  }

  return ring.length >= 4
}
