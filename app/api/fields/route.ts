import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { validateGeometry } from '@/lib/services/geometry.service'
import { reverseGeocode } from '@/lib/services/geocoding.service'
import { getSession, unauthorizedResponse } from '@/lib/auth'
import { processFieldDistances } from '@/lib/services/logistics-distance.service'
import { z } from 'zod'

// Schema de validação
const createFieldSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  cropType: z.enum(['SOJA', 'MILHO']).default('SOJA'),
  seasonStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  geometryJson: z.string().min(1, 'Geometria é obrigatória'),
  producerId: z.string().nullable().optional(),
  plantingDateInput: z.string().nullable().optional(), // Data de plantio informada pelo produtor
  logisticsUnitId: z.string().nullable().optional(), // Caixa logística atribuída
})

/**
 * GET /api/fields
 * Lista todos os talhões do workspace
 * Query params:
 * - producerId: filtrar por produtor
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    const producerId = searchParams.get('producerId')

    const fields = await prisma.field.findMany({
      where: { 
        workspaceId: session.workspaceId,
        ...(producerId && { producerId })
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        status: true,
        errorMessage: true,
        city: true,
        state: true,
        areaHa: true,
        cropType: true,
        plantingDateInput: true,
        producer: {
          select: {
            id: true,
            name: true,
            defaultLogisticsUnit: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        logisticsUnit: {
          select: {
            id: true,
            name: true
          }
        },
        logisticsDistances: {
          where: {
            isWithinCoverage: true
          },
          select: {
            logisticsUnitId: true,
            distanceKm: true,
            isWithinCoverage: true,
            logisticsUnit: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: {
            distanceKm: 'asc'
          }
        },
        createdAt: true,
        updatedAt: true,
        processedAt: true,
        agroData: {
          select: {
            areaHa: true,
            volumeEstimatedKg: true,
            confidence: true,
            confidenceScore: true,
            eosDate: true,
            sosDate: true,
            rawAreaData: true,       // processed server-side → fusedEosDate
            // Crop pattern (algorithmic)
            cropPatternStatus: true,
            // Crop verification (AI Verifier)
            aiCropVerificationStatus: true,
            // AI Validation fields
            aiValidationAgreement: true,
            aiValidationConfidence: true,
            aiEosAdjustedDate: true,
            aiValidationResult: true, // processed server-side → harvestReady
            aiValidationDate: true,
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

    // Process heavy fields server-side to avoid sending large JSON blobs to client
    // NOTE on DB field names (historical naming):
    //   aiValidationResult  → stores the agreement string ("CONFIRMED" | "QUESTIONED" | "REJECTED")
    //   aiValidationAgreement → stores JSON with detailed agreement data (harvestReadiness, etc.)
    const processedFields = fields.map(field => {
      if (!field.agroData) return field

      // Extract fusedEosDate from rawAreaData
      let fusedEosDate: string | null = null
      if (field.agroData.rawAreaData) {
        try {
          const raw = JSON.parse(field.agroData.rawAreaData)
          fusedEosDate = raw.fusedEos?.date || null
        } catch { /* ignore parse errors */ }
      }

      // Agreement string comes from aiValidationResult (not aiValidationAgreement!)
      const agreementStr = field.agroData.aiValidationResult ?? null // "CONFIRMED" | "QUESTIONED" | "REJECTED"

      // Extract harvestReady from aiValidationAgreement JSON (the detailed data field)
      let harvestReady: boolean | null = null
      if (field.agroData.aiValidationAgreement) {
        try {
          const details = JSON.parse(field.agroData.aiValidationAgreement)
          harvestReady = details.harvestReadiness?.ready ?? null
        } catch { /* ignore parse errors */ }
      }

      return {
        ...field,
        agroData: {
          areaHa: field.agroData.areaHa,
          volumeEstimatedKg: field.agroData.volumeEstimatedKg,
          confidence: field.agroData.confidence,
          confidenceScore: field.agroData.confidenceScore,
          eosDate: field.agroData.eosDate,
          sosDate: field.agroData.sosDate,
          fusedEosDate,
          // Crop pattern (algorithmic)
          cropPatternStatus: field.agroData.cropPatternStatus,
          // Crop verification (AI Verifier)
          aiCropVerificationStatus: field.agroData.aiCropVerificationStatus,
          // AI fields (lightweight, pre-processed)
          aiValidationAgreement: agreementStr, // Now correctly the agreement string
          aiValidationConfidence: field.agroData.aiValidationConfidence,
          aiEosAdjustedDate: field.agroData.aiEosAdjustedDate,
          aiValidationDate: field.agroData.aiValidationDate,
          harvestReady,
        }
      }
    })

    return NextResponse.json({ fields: processedFields })
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
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    // Verificar permissão (VIEWER não pode criar)
    if (session.role === 'VIEWER') {
      return NextResponse.json(
        { error: 'Sem permissão para criar talhões' },
        { status: 403 }
      )
    }

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
    let body: unknown
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

    const bodyData = body as Record<string, unknown>
    console.log('Received field data:', { 
      name: bodyData.name, 
      cropType: bodyData.cropType,
      date: bodyData.seasonStartDate,
      producerId: bodyData.producerId,
      plantingDateInput: bodyData.plantingDateInput,
      hasGeometry: !!bodyData.geometryJson,
      geometryLength: typeof bodyData.geometryJson === 'string' ? bodyData.geometryJson.length : 0
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

    const { name, cropType, seasonStartDate, geometryJson, producerId, plantingDateInput, logisticsUnitId } = parsed.data

    // Validar geometria
    const validation = validateGeometry(geometryJson, 'geometry.geojson')
    if (!validation.isValid) {
      return NextResponse.json(
        { error: 'Geometria inválida', details: validation.errors },
        { status: 400 }
      )
    }

    // Verificar se produtor existe e pertence ao workspace (se informado)
    if (producerId) {
      const producer = await prisma.producer.findFirst({
        where: {
          id: producerId,
          workspaceId: session.workspaceId,
        },
      })
      if (!producer) {
        return NextResponse.json(
          { error: 'Produtor não encontrado' },
          { status: 400 }
        )
      }
    }

    // Verificar se caixa logística existe e pertence ao workspace (se informada)
    if (logisticsUnitId) {
      const unit = await prisma.logisticsUnit.findFirst({
        where: {
          id: logisticsUnitId,
          workspaceId: session.workspaceId,
        },
      })
      if (!unit) {
        return NextResponse.json(
          { error: 'Caixa logística não encontrada' },
          { status: 400 }
        )
      }
    }

    // Geocodificar localização
    const location = await reverseGeocode(
      validation.centroid.lat,
      validation.centroid.lng
    )

    // Criar talhão com workspaceId
    const field = await prisma.field.create({
      data: {
        name,
        cropType,
        seasonStartDate: new Date(seasonStartDate),
        geometryJson: JSON.stringify(validation.geojson),
        status: 'PENDING',
        city: location.city,
        state: location.state,
        latitude: location.lat,
        longitude: location.lng,
        areaHa: validation.areaHa,
        workspaceId: session.workspaceId,
        createdById: session.userId,
        producerId: producerId || null,
        plantingDateInput: plantingDateInput ? new Date(plantingDateInput) : null,
        logisticsUnitId: logisticsUnitId || null,
      }
    })

    // Processar distâncias para caixas logísticas
    if (field.latitude && field.longitude) {
      processFieldDistances(field.id).catch(err => {
        console.error('Erro ao processar distâncias do talhão:', err)
      })
    }

    return NextResponse.json({ field }, { status: 201 })
  } catch (error) {
    console.error('Error creating field:', error)
    return NextResponse.json(
      { error: 'Failed to create field' },
      { status: 500 }
    )
  }
}
