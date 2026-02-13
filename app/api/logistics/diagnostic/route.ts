import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorizedResponse } from '@/lib/auth'
import { differenceInDays, addDays, format, parseISO } from 'date-fns'

interface FieldWithData {
  id: string
  name: string
  city: string | null
  state: string | null
  areaHa: number | null
  latitude: number | null
  longitude: number | null
  status: string
  producerId: string | null
  logisticsUnitId: string | null
  producer: {
    id: string
    name: string
    defaultLogisticsUnitId: string | null
  } | null
  agroData: {
    volumeEstimatedKg: number | null
    plantingDate: Date | null
    sosDate: Date | null
    eosDate: Date | null
    peakDate: Date | null
    confidenceScore: number | null
    yieldEstimateKgHa: number | null
  } | null
}

type FieldStatus = 'harvesting' | 'upcoming' | 'attention' | 'waiting'
type RiskLevel = 'low' | 'medium' | 'high'

interface ProcessedField {
  id: string
  name: string
  city: string
  state: string
  areaHa: number
  volumeKg: number
  harvestStart: string
  harvestEnd: string
  peakDate: string
  status: FieldStatus
  riskLevel: RiskLevel
  latitude: number
  longitude: number
  daysToHarvest: number
  producerId?: string
  producerName?: string
}

interface DailyForecast {
  date: string
  volumeKg: number
  cumulativeKg: number
  fieldsHarvesting: number
}

// Default harvest capacity: 50 ha/day
const HARVEST_CAPACITY_HA_PER_DAY = 50
const TONS_PER_TRUCK = 35

function getFieldStatus(harvestStart: Date, harvestEnd: Date, today: Date): FieldStatus {
  const daysToStart = differenceInDays(harvestStart, today)
  
  if (today >= harvestStart && today <= harvestEnd) {
    return 'harvesting'
  }
  if (daysToStart > 0 && daysToStart <= 7) {
    return 'upcoming'
  }
  if (daysToStart <= 0 && today > harvestEnd) {
    return 'attention' // Harvest should have ended
  }
  return 'waiting'
}

function getRiskLevel(field: FieldWithData): RiskLevel {
  const confidence = field.agroData?.confidenceScore ?? 50
  if (confidence < 40) return 'high'
  if (confidence < 70) return 'medium'
  return 'low'
}

function calculateHarvestEnd(harvestStart: Date, areaHa: number): Date {
  const harvestDays = Math.ceil(areaHa / HARVEST_CAPACITY_HA_PER_DAY)
  return addDays(harvestStart, harvestDays)
}

function calculateDailyForecast(fields: ProcessedField[], startDate: Date, endDate: Date): DailyForecast[] {
  const forecast: DailyForecast[] = []
  let cumulativeKg = 0
  
  for (let day = new Date(startDate); day <= endDate; day = addDays(day, 1)) {
    let dailyVolumeKg = 0
    let fieldsHarvesting = 0
    
    for (const field of fields) {
      const fieldStart = parseISO(field.harvestStart)
      const fieldEnd = parseISO(field.harvestEnd)
      
      if (day >= fieldStart && day <= fieldEnd) {
        const harvestDays = differenceInDays(fieldEnd, fieldStart) + 1
        const fieldDailyVolume = field.volumeKg / harvestDays
        dailyVolumeKg += fieldDailyVolume
        fieldsHarvesting++
      }
    }
    
    cumulativeKg += dailyVolumeKg
    
    forecast.push({
      date: format(day, 'yyyy-MM-dd'),
      volumeKg: Math.round(dailyVolumeKg),
      cumulativeKg: Math.round(cumulativeKg),
      fieldsHarvesting
    })
  }
  
  return forecast
}

function calculatePeakPeriod(dailyForecast: DailyForecast[]): { start: string; end: string } {
  if (dailyForecast.length === 0) {
    return { start: '', end: '' }
  }
  
  const avgVolume = dailyForecast.reduce((a, b) => a + b.volumeKg, 0) / dailyForecast.length
  const threshold = avgVolume * 1.2 // 20% above average = peak
  
  const peakDays = dailyForecast.filter(d => d.volumeKg >= threshold)
  
  if (peakDays.length === 0) {
    // If no clear peak, use max volume day
    const maxDay = dailyForecast.reduce((max, d) => d.volumeKg > max.volumeKg ? d : max)
    return { start: maxDay.date, end: maxDay.date }
  }
  
  return {
    start: peakDays[0].date,
    end: peakDays[peakDays.length - 1].date
  }
}

function aggregateClimateRisk(fields: ProcessedField[]): RiskLevel {
  if (fields.length === 0) return 'low'
  
  const weightedRisk = fields.reduce((sum, f) => {
    const riskValue = f.riskLevel === 'high' ? 3 : f.riskLevel === 'medium' ? 2 : 1
    return sum + (riskValue * f.volumeKg)
  }, 0)
  
  const totalVolume = fields.reduce((sum, f) => sum + f.volumeKg, 0)
  if (totalVolume === 0) return 'low'
  
  const avgRisk = weightedRisk / totalVolume
  
  if (avgRisk >= 2.5) return 'high'
  if (avgRisk >= 1.5) return 'medium'
  return 'low'
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return unauthorizedResponse()
    }

    const searchParams = request.nextUrl.searchParams
    const seasonYear = searchParams.get('seasonYear')
    const logisticsUnitIds = searchParams.get('logisticsUnitIds')
    
    // Parse logistics unit IDs if provided
    const unitIdFilter = logisticsUnitIds 
      ? logisticsUnitIds.split(',').filter(id => id.trim()) 
      : null
    
    // Fetch all fields with processed data (only SUCCESS, not PARTIAL or ERROR)
    // Filtered by workspace
    const fieldsRaw = await prisma.field.findMany({
      where: {
        workspaceId: session.workspaceId,
        status: 'SUCCESS',
        agroData: {
          isNot: null
        }
      },
      include: {
        producer: {
          select: {
            id: true,
            name: true,
            defaultLogisticsUnitId: true
          }
        },
        agroData: {
          select: {
            volumeEstimatedKg: true,
            plantingDate: true,
            sosDate: true,
            eosDate: true,
            peakDate: true,
            confidenceScore: true,
            yieldEstimateKgHa: true
          }
        },
        logisticsDistances: {
          where: {
            isWithinCoverage: true
          },
          orderBy: {
            distanceKm: 'asc'
          },
          take: 1, // Apenas a mais próxima
          select: {
            logisticsUnitId: true
          }
        },
        _count: {
          select: { subFields: true }
        }
      }
    }) as (FieldWithData & { logisticsDistances: { logisticsUnitId: string }[], _count?: { subFields: number } })[]
    
    // Filtrar apenas talhões com eosDate válido (não pode fazer no where do Prisma)
    // Excluir pais que possuem subtalhões para evitar contagem dupla de área/volume
    let fields = fieldsRaw
      .filter(f => f.agroData?.eosDate !== null)
      .filter(f => (f._count?.subFields ?? 0) === 0)
    
    // Apply logistics unit filter if provided (usando dados persistidos)
    if (unitIdFilter && unitIdFilter.length > 0) {
      fields = fields.filter(field => {
        // 1. Check direct assignment
        if (field.logisticsUnitId && unitIdFilter.includes(field.logisticsUnitId)) {
          return true
        }
        
        // 2. Check inherited from producer
        if (field.producer?.defaultLogisticsUnitId && unitIdFilter.includes(field.producer.defaultLogisticsUnitId)) {
          return true
        }
        
        // 3. Check automatic (using persisted distances)
        const nearestUnit = (field as (FieldWithData & { logisticsDistances: { logisticsUnitId: string }[] })).logisticsDistances?.[0]
        if (nearestUnit && unitIdFilter.includes(nearestUnit.logisticsUnitId)) {
          return true
        }
        
        return false
      })
    }
    
    const today = new Date()
    
    // Process fields
    const processedFields: ProcessedField[] = fields
      .filter(f => f.agroData?.eosDate) // Only fields with harvest date
      .map(f => {
        const harvestStart = f.agroData!.eosDate!
        const areaHa = f.areaHa ?? 100
        const harvestEnd = calculateHarvestEnd(harvestStart, areaHa)
        const volumeKg = f.agroData?.volumeEstimatedKg ?? (areaHa * 3500) // Default 3.5 ton/ha
        
        // Peak logístico = ponto médio da janela de colheita (não o pico fenológico)
        const harvestDays = differenceInDays(harvestEnd, harvestStart)
        const harvestPeak = addDays(harvestStart, Math.floor(harvestDays / 2))
        
        return {
          id: f.id,
          name: f.name,
          city: f.city ?? 'N/A',
          state: f.state ?? 'N/A',
          areaHa,
          volumeKg,
          harvestStart: format(harvestStart, 'yyyy-MM-dd'),
          harvestEnd: format(harvestEnd, 'yyyy-MM-dd'),
          peakDate: format(harvestPeak, 'yyyy-MM-dd'),
          status: getFieldStatus(harvestStart, harvestEnd, today),
          riskLevel: getRiskLevel(f),
          latitude: f.latitude ?? 0,
          longitude: f.longitude ?? 0,
          daysToHarvest: differenceInDays(harvestStart, today),
          producerId: f.producerId ?? undefined,
          producerName: f.producer?.name ?? undefined
        }
      })
      .sort((a, b) => a.daysToHarvest - b.daysToHarvest)
    
    // Calculate aggregates
    const totalFields = processedFields.length
    const totalAreaHa = processedFields.reduce((sum, f) => sum + f.areaHa, 0)
    const totalVolumeKg = processedFields.reduce((sum, f) => sum + f.volumeKg, 0)
    const totalTrucks = Math.ceil(totalVolumeKg / 1000 / TONS_PER_TRUCK)
    
    // Find date range
    const harvestDates = processedFields.flatMap(f => [
      parseISO(f.harvestStart),
      parseISO(f.harvestEnd)
    ])
    
    const firstHarvestDate = harvestDates.length > 0 
      ? format(new Date(Math.min(...harvestDates.map(d => d.getTime()))), 'yyyy-MM-dd')
      : ''
    const lastHarvestDate = harvestDates.length > 0
      ? format(new Date(Math.max(...harvestDates.map(d => d.getTime()))), 'yyyy-MM-dd')
      : ''
    
    // Calculate daily forecast
    const dailyForecast = harvestDates.length > 0
      ? calculateDailyForecast(
          processedFields,
          parseISO(firstHarvestDate),
          parseISO(lastHarvestDate)
        )
      : []
    
    // Calculate peak period
    const peakPeriod = calculatePeakPeriod(dailyForecast)
    
    // Calculate alerts
    const daysToFirstHarvest = processedFields.length > 0 
      ? processedFields[0].daysToHarvest 
      : 0
    const peakDailyVolume = dailyForecast.length > 0
      ? Math.max(...dailyForecast.map(d => d.volumeKg))
      : 0
    const climateRisk = aggregateClimateRisk(processedFields)
    
    // Storage utilization (mock - would come from config)
    const storageCapacityKg = 50000 * 1000 // 50,000 tons
    const storageUtilization = Math.min((totalVolumeKg / storageCapacityKg) * 100, 100)
    
    const response = {
      summary: {
        totalFields,
        totalAreaHa: Math.round(totalAreaHa),
        totalVolumeKg: Math.round(totalVolumeKg),
        totalVolumeTon: Math.round(totalVolumeKg / 1000),
        totalTrucks,
        firstHarvestDate,
        lastHarvestDate,
        peakStartDate: peakPeriod.start,
        peakEndDate: peakPeriod.end
      },
      dailyForecast,
      fields: processedFields,
      alerts: {
        daysToFirstHarvest,
        peakDailyVolume: Math.round(peakDailyVolume),
        peakDailyVolumeTon: Math.round(peakDailyVolume / 1000),
        climateRisk,
        storageUtilization: Math.round(storageUtilization)
      }
    }
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching logistics diagnostic:', error)
    return NextResponse.json(
      { error: 'Failed to fetch logistics diagnostic' },
      { status: 500 }
    )
  }
}
