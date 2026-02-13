import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession, unauthorizedResponse } from '@/lib/auth'
import { isFeatureEnabled } from '@/lib/services/feature-flags.service'
import {
  getFieldImages,
  getStoredImages,
  getImageUrls,
  getUniqueDates,
  getBboxFromGeometry,
} from '@/lib/services/field-images.service'

interface RouteParams {
  params: { id: string }
}

/**
 * GET /api/fields/[id]/images
 * Fetch satellite images for visual analysis
 * Query params:
 *   - from: start date (optional, defaults to seasonStartDate or 6 months ago)
 *   - to: end date (optional, defaults to now)
 *   - refresh: 'true' to fetch new images incrementally from CDSE
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

    // Check if visual analysis is enabled
    const enabled = await isFeatureEnabled(session.workspaceId, 'enableVisualAnalysis')
    if (!enabled) {
      return NextResponse.json(
        { error: 'Módulo de Análise Visual não habilitado. Ative nas Configurações.' },
        { status: 403 }
      )
    }

    // Fetch field
    const field = await prisma.field.findFirst({
      where: {
        id: params.id,
        workspaceId: session.workspaceId
      },
      select: {
        id: true,
        name: true,
        geometryJson: true,
        seasonStartDate: true,
        cropType: true,
        workspaceId: true,
        areaHa: true,
      }
    })

    if (!field) {
      return NextResponse.json(
        { error: 'Talhão não encontrado' },
        { status: 404 }
      )
    }

    if (!field.workspaceId) {
      return NextResponse.json(
        { error: 'Workspace não configurado' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const refresh = searchParams.get('refresh') === 'true'

    // Null-safe season start date (fallback to 6 months ago)
    const defaultFrom = field.seasonStartDate
      ? field.seasonStartDate.toISOString().split('T')[0]
      : new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0]

    const from = searchParams.get('from') || defaultFrom
    const to = searchParams.get('to') || undefined

    let storedImages
    let newCount = 0

    const areaHa = field.areaHa || 0

    if (refresh) {
      // Fetch new images incrementally from CDSE, persist to S3 + DB
      // Aligned with AI Validation: always include radar, area-based landsat/s3-ndvi
      const result = await getFieldImages(field.id, field.workspaceId, field.geometryJson, {
        source: 'visual-analysis',
        includeRadar: true,
        includeLandsat: areaHa > 200,
        includeS3Ndvi: areaHa > 500,
        seasonStart: from,
        endDate: to,
      })
      storedImages = result.images
      newCount = result.newCount
    } else {
      // Just return already-stored images
      storedImages = await getStoredImages(field.id)
    }

    // Generate signed URLs for frontend display
    const imagesWithUrls = await getImageUrls(storedImages)
    const dates = getUniqueDates(storedImages)
    const bbox = getBboxFromGeometry(field.geometryJson)

    return NextResponse.json({
      images: imagesWithUrls,
      dates,
      field: {
        id: field.id,
        name: field.name,
        cropType: field.cropType,
      },
      geometryJson: field.geometryJson,
      bbox,
      totalCount: storedImages.length,
      newCount,
    })
  } catch (error) {
    console.error('Error fetching field images:', error)
    return NextResponse.json(
      { error: 'Failed to fetch images', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
