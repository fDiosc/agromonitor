import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/admin/fix-status
 * Corrige o status de talhões que estão como SUCCESS mas têm dados incompletos
 */
export async function POST(request: NextRequest) {
  try {
    // Buscar todos os talhões com status SUCCESS
    const fields = await prisma.field.findMany({
      where: { status: 'SUCCESS' },
      include: {
        agroData: {
          select: {
            eosDate: true,
            sosDate: true,
            confidenceScore: true,
            peakNdvi: true
          }
        }
      }
    })

    const fixes: { id: string; name: string; oldStatus: string; newStatus: string; reason: string }[] = []

    for (const field of fields) {
      const warnings: string[] = []
      let shouldBePartial = false

      // Verificar dados críticos
      if (!field.agroData) {
        warnings.push('Sem dados agronômicos')
        shouldBePartial = true
      } else {
        if (!field.agroData.eosDate) {
          warnings.push('Sem data de colheita (EOS)')
          shouldBePartial = true
        }
        if (!field.agroData.sosDate) {
          warnings.push('Sem data de emergência (SOS)')
          shouldBePartial = true
        }
        if (field.agroData.confidenceScore !== null && field.agroData.confidenceScore < 30) {
          warnings.push(`Confiança muito baixa (${field.agroData.confidenceScore}%)`)
          shouldBePartial = true
        }
      }

      if (shouldBePartial) {
        await prisma.field.update({
          where: { id: field.id },
          data: {
            status: 'PARTIAL',
            errorMessage: warnings.join('; ')
          }
        })

        fixes.push({
          id: field.id,
          name: field.name,
          oldStatus: 'SUCCESS',
          newStatus: 'PARTIAL',
          reason: warnings.join('; ')
        })
      }
    }

    return NextResponse.json({
      message: `Corrigido ${fixes.length} talhão(ões)`,
      fixes
    })
  } catch (error) {
    console.error('Error fixing status:', error)
    return NextResponse.json(
      { error: 'Failed to fix status' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/fix-status
 * Lista talhões com status inconsistente (para preview antes de corrigir)
 */
export async function GET() {
  try {
    const fields = await prisma.field.findMany({
      where: { status: 'SUCCESS' },
      include: {
        agroData: {
          select: {
            eosDate: true,
            sosDate: true,
            confidenceScore: true
          }
        }
      }
    })

    const inconsistent = fields.filter(f => {
      if (!f.agroData) return true
      if (!f.agroData.eosDate) return true
      if (!f.agroData.sosDate) return true
      if (f.agroData.confidenceScore !== null && f.agroData.confidenceScore < 30) return true
      return false
    }).map(f => ({
      id: f.id,
      name: f.name,
      status: f.status,
      hasAgroData: !!f.agroData,
      eosDate: f.agroData?.eosDate,
      sosDate: f.agroData?.sosDate,
      confidence: f.agroData?.confidenceScore
    }))

    return NextResponse.json({
      total: fields.length,
      inconsistent: inconsistent.length,
      fields: inconsistent
    })
  } catch (error) {
    console.error('Error checking status:', error)
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    )
  }
}
