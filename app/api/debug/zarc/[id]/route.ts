import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/debug/zarc/[id]
 * Retorna os dados ZARC salvos para um talhão
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const field = await prisma.field.findUnique({
      where: { id: params.id },
      include: { agroData: true }
    })

    if (!field) {
      return NextResponse.json({ error: 'Talhão não encontrado' }, { status: 404 })
    }

    const zarcData = field.agroData?.rawZarcData 
      ? JSON.parse(field.agroData.rawZarcData)
      : null

    return NextResponse.json({
      fieldId: params.id,
      fieldName: field.name,
      cropType: field.cropType,
      city: field.city,
      state: field.state,
      zarc: zarcData,
      hasZarcData: !!zarcData
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
