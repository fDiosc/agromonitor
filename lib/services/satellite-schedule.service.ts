/**
 * Satellite Schedule Service
 * Calcula e prevê próximas passagens de satélites
 * Sentinel-2: Revisita ~5 dias (2A + 2B)
 * Sentinel-1: Revisita ~6-12 dias
 */

import prisma from '@/lib/prisma'

// ==================== Types ====================

export interface SatellitePass {
  satellite: 'SENTINEL-2A' | 'SENTINEL-2B' | 'SENTINEL-1A' | 'SENTINEL-1B'
  expectedDate: Date
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  orbitNumber?: number
}

export interface FieldSatelliteSchedule {
  fieldId: string
  latitude: number
  longitude: number
  lastS2Acquisition: Date | null
  nextS2Expected: Date | null
  lastS1Acquisition: Date | null
  nextS1Expected: Date | null
  upcomingPasses: SatellitePass[]
  daysUntilNextData: number | null
}

// ==================== Constants ====================

// Período de revisita em dias
const SENTINEL_2_REVISIT = 5  // Combinado 2A + 2B
const SENTINEL_1_REVISIT = 12 // Combinado 1A + 1B

// ==================== Helper Functions ====================

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function diffDays(date1: Date, date2: Date): number {
  const diffTime = date2.getTime() - date1.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

// ==================== Core Functions ====================

/**
 * Estima próxima passagem baseado na última aquisição conhecida
 */
export function estimateNextPass(
  lastAcquisition: Date | null,
  satellite: 'S2' | 'S1'
): Date {
  const revisitDays = satellite === 'S2' ? SENTINEL_2_REVISIT : SENTINEL_1_REVISIT
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  if (!lastAcquisition) {
    // Sem dados anteriores, estimar próxima passagem em 2-3 dias
    return addDays(today, 2)
  }
  
  // Calcular próxima passagem baseado no período de revisita
  let nextPass = addDays(lastAcquisition, revisitDays)
  
  // Se a próxima passagem já passou, calcular a seguinte
  while (nextPass < today) {
    nextPass = addDays(nextPass, revisitDays)
  }
  
  return nextPass
}

/**
 * Gera cronograma de próximas passagens
 */
export function generateUpcomingPasses(
  lastS2: Date | null,
  lastS1: Date | null,
  daysAhead: number = 30
): SatellitePass[] {
  const passes: SatellitePass[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endDate = addDays(today, daysAhead)
  
  // Sentinel-2 passes
  let nextS2 = estimateNextPass(lastS2, 'S2')
  let isS2A = true // Alternar entre 2A e 2B
  
  while (nextS2 <= endDate) {
    passes.push({
      satellite: isS2A ? 'SENTINEL-2A' : 'SENTINEL-2B',
      expectedDate: nextS2,
      confidence: diffDays(today, nextS2) <= 5 ? 'HIGH' : 
                  diffDays(today, nextS2) <= 15 ? 'MEDIUM' : 'LOW'
    })
    nextS2 = addDays(nextS2, SENTINEL_2_REVISIT)
    isS2A = !isS2A
  }
  
  // Sentinel-1 passes
  let nextS1 = estimateNextPass(lastS1, 'S1')
  let isS1A = true
  
  while (nextS1 <= endDate) {
    passes.push({
      satellite: isS1A ? 'SENTINEL-1A' : 'SENTINEL-1B',
      expectedDate: nextS1,
      confidence: diffDays(today, nextS1) <= 7 ? 'HIGH' : 
                  diffDays(today, nextS1) <= 14 ? 'MEDIUM' : 'LOW'
    })
    nextS1 = addDays(nextS1, SENTINEL_1_REVISIT)
    isS1A = !isS1A
  }
  
  // Ordenar por data
  passes.sort((a, b) => a.expectedDate.getTime() - b.expectedDate.getTime())
  
  return passes
}

/**
 * Obtém cronograma de satélite para um talhão
 */
export async function getFieldSatelliteSchedule(
  fieldId: string
): Promise<FieldSatelliteSchedule | null> {
  // Buscar campo e dados de status
  const field = await prisma.field.findUnique({
    where: { id: fieldId },
    include: {
      dataStatus: true,
      ndviData: {
        where: { isHistorical: false },
        orderBy: { date: 'desc' },
        take: 1
      }
    }
  })
  
  if (!field) return null
  
  // Obter última data NDVI (Sentinel-2)
  let lastS2Acquisition: Date | null = null
  if (field.ndviData.length > 0) {
    lastS2Acquisition = field.ndviData[0].date
  } else if (field.dataStatus?.lastS2Acquisition) {
    lastS2Acquisition = field.dataStatus.lastS2Acquisition
  }
  
  // Obter última data Radar (Sentinel-1)
  const lastS1Acquisition = field.dataStatus?.lastS1Acquisition || null
  
  // Calcular próximas passagens
  const nextS2Expected = estimateNextPass(lastS2Acquisition, 'S2')
  const nextS1Expected = estimateNextPass(lastS1Acquisition, 'S1')
  const upcomingPasses = generateUpcomingPasses(lastS2Acquisition, lastS1Acquisition, 30)
  
  // Calcular dias até próximo dado
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const daysUntilNextData = Math.min(
    diffDays(today, nextS2Expected),
    diffDays(today, nextS1Expected)
  )
  
  return {
    fieldId,
    latitude: field.latitude || 0,
    longitude: field.longitude || 0,
    lastS2Acquisition,
    nextS2Expected,
    lastS1Acquisition,
    nextS1Expected,
    upcomingPasses,
    daysUntilNextData: Math.max(0, daysUntilNextData)
  }
}

/**
 * Atualiza o status de dados do talhão
 */
export async function updateFieldDataStatus(
  fieldId: string,
  lastS2: Date | null,
  lastS1: Date | null
): Promise<void> {
  const nextS2 = estimateNextPass(lastS2, 'S2')
  const nextS1 = estimateNextPass(lastS1, 'S1')
  
  await prisma.fieldDataStatus.upsert({
    where: { fieldId },
    create: {
      fieldId,
      lastS2Acquisition: lastS2,
      nextS2Expected: nextS2,
      s2DataAvailable: !!lastS2,
      lastS1Acquisition: lastS1,
      nextS1Expected: nextS1,
      s1DataAvailable: !!lastS1,
      lastProcessedAt: new Date()
    },
    update: {
      lastS2Acquisition: lastS2,
      nextS2Expected: nextS2,
      s2DataAvailable: !!lastS2,
      lastS1Acquisition: lastS1,
      nextS1Expected: nextS1,
      s1DataAvailable: !!lastS1,
      lastProcessedAt: new Date()
    }
  })
}

/**
 * Busca talhões que precisam de reprocessamento
 * (novos dados de satélite disponíveis)
 */
export async function getFieldsNeedingReprocess(): Promise<string[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  // Buscar talhões onde a próxima passagem esperada já passou
  const fields = await prisma.fieldDataStatus.findMany({
    where: {
      OR: [
        { nextS2Expected: { lte: today } },
        { nextS1Expected: { lte: today } }
      ],
      autoReprocessEnabled: true
    },
    select: { fieldId: true }
  })
  
  return fields.map(f => f.fieldId)
}

/**
 * Formata o cronograma para exibição
 */
export function formatScheduleForDisplay(schedule: FieldSatelliteSchedule): {
  s2Status: string
  s1Status: string
  nextDataIn: string
  upcomingList: Array<{ date: string; satellite: string; daysAway: number }>
} {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const formatDate = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  
  let s2Status = 'Sem dados'
  if (schedule.lastS2Acquisition) {
    const daysAgo = diffDays(schedule.lastS2Acquisition, today)
    s2Status = `Último: ${formatDate(schedule.lastS2Acquisition)} (${daysAgo}d atrás)`
  }
  
  let s1Status = 'Sem dados'
  if (schedule.lastS1Acquisition) {
    const daysAgo = diffDays(schedule.lastS1Acquisition, today)
    s1Status = `Último: ${formatDate(schedule.lastS1Acquisition)} (${daysAgo}d atrás)`
  }
  
  const nextDataIn = schedule.daysUntilNextData !== null
    ? schedule.daysUntilNextData === 0 
      ? 'Hoje' 
      : `${schedule.daysUntilNextData} dia${schedule.daysUntilNextData > 1 ? 's' : ''}`
    : 'Desconhecido'
  
  const upcomingList = schedule.upcomingPasses.slice(0, 5).map(pass => ({
    date: formatDate(pass.expectedDate),
    satellite: pass.satellite.replace('SENTINEL-', 'S'),
    daysAway: diffDays(today, pass.expectedDate)
  }))
  
  return { s2Status, s1Status, nextDataIn, upcomingList }
}
