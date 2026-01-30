import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { differenceInDays, addDays, format } from 'date-fns'

// Force dynamic to prevent static generation during build
export const dynamic = 'force-dynamic'

const HARVEST_CAPACITY_HA_PER_DAY = 50

export async function GET() {
  try {
    const fields = await prisma.field.findMany({
      where: {
        status: 'SUCCESS',
        agroData: { isNot: null }
      },
      include: {
        agroData: {
          select: {
            plantingDate: true,
            sosDate: true,
            eosDate: true,
            peakDate: true,
            peakNdvi: true,
            volumeEstimatedKg: true,
            areaHa: true,
            yieldEstimateKgHa: true,
            confidenceScore: true,
            cycleDays: true
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    const today = new Date()
    
    const debugData = fields.map(f => {
      const agro = f.agroData
      
      if (!agro?.eosDate) {
        return {
          name: f.name,
          error: 'Sem eosDate'
        }
      }
      
      const harvestStart = agro.eosDate
      const areaHa = f.areaHa ?? 100
      const harvestDays = Math.ceil(areaHa / HARVEST_CAPACITY_HA_PER_DAY)
      const harvestEnd = addDays(harvestStart, harvestDays)
      const harvestPeak = addDays(harvestStart, Math.floor(harvestDays / 2))
      
      return {
        name: f.name,
        location: `${f.city}, ${f.state}`,
        areaHa,
        
        // Dados fenológicos (do banco)
        fenologico: {
          plantingDate: agro.plantingDate ? format(agro.plantingDate, 'yyyy-MM-dd') : null,
          sosDate: agro.sosDate ? format(agro.sosDate, 'yyyy-MM-dd') : null,
          eosDate: format(agro.eosDate, 'yyyy-MM-dd'),
          peakDateNDVI: agro.peakDate ? format(agro.peakDate, 'yyyy-MM-dd') : null,
          peakNdvi: agro.peakNdvi,
          cycleDays: agro.cycleDays
        },
        
        // Dados logísticos (calculados)
        logistico: {
          harvestStart: format(harvestStart, 'yyyy-MM-dd'),
          harvestEnd: format(harvestEnd, 'yyyy-MM-dd'),
          harvestPeak: format(harvestPeak, 'yyyy-MM-dd'),
          harvestDays,
          daysToHarvest: differenceInDays(harvestStart, today)
        },
        
        // Verificações
        checks: {
          peakNDVI_antes_EOS: agro.peakDate && agro.peakDate < agro.eosDate,
          harvestPeak_dentro_janela: harvestPeak >= harvestStart && harvestPeak <= harvestEnd,
          sos_antes_peak: agro.sosDate && agro.peakDate ? agro.sosDate < agro.peakDate : null,
          peak_antes_eos: agro.peakDate && agro.eosDate ? agro.peakDate < agro.eosDate : null
        }
      }
    })

    return NextResponse.json({
      totalFields: fields.length,
      today: format(today, 'yyyy-MM-dd'),
      explanation: {
        peakDateNDVI: "Data do pico vegetativo (NDVI máximo) - ocorre ANTES da colheita",
        harvestPeak: "Pico logístico = meio da janela de colheita",
        harvestStart: "= eosDate (fim do ciclo = início da colheita)",
        harvestEnd: "= harvestStart + (area / 50 ha/dia)"
      },
      fields: debugData
    })
  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
