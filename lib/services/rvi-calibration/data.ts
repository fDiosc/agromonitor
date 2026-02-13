/**
 * RVI Calibration - DB functions
 */

import { prisma } from '@/lib/prisma'
import type { RviNdviPairInput } from './types'

/**
 * Coleta pares coincidentes de NDVI óptico e RVI radar
 * Usa tolerância de ±1 dia para matching
 */
export async function collectRviNdviPairs(
  fieldId: string,
  pairs: RviNdviPairInput[]
): Promise<number> {
  if (!pairs || pairs.length === 0) return 0

  let insertedCount = 0

  for (const pair of pairs) {
    try {
      await prisma.rviNdviPair.upsert({
        where: {
          fieldId_date: {
            fieldId,
            date: pair.date
          }
        },
        create: {
          fieldId,
          date: pair.date,
          ndviValue: pair.ndviValue,
          rviValue: pair.rviValue,
          cloudCover: pair.cloudCover,
          quality: pair.quality
        },
        update: {
          ndviValue: pair.ndviValue,
          rviValue: pair.rviValue,
          cloudCover: pair.cloudCover,
          quality: pair.quality
        }
      })
      insertedCount++
    } catch (error) {
      console.error('[RVI_CALIBRATION] Error inserting pair:', error)
    }
  }

  console.log(`[RVI_CALIBRATION] Collected ${insertedCount} pairs for field ${fieldId}`)
  return insertedCount
}

/**
 * Busca pares existentes para um talhão
 */
export async function getPairsForField(
  fieldId: string,
  minQuality: number = 0.5
): Promise<{ date: Date, ndvi: number, rvi: number }[]> {
  const pairs = await prisma.rviNdviPair.findMany({
    where: {
      fieldId,
      quality: { gte: minQuality }
    },
    orderBy: { date: 'asc' }
  })

  return pairs.map(p => ({
    date: p.date,
    ndvi: p.ndviValue,
    rvi: p.rviValue
  }))
}

/**
 * Encontra pares coincidentes entre séries temporais de NDVI e RVI
 * Usa tolerância de ±1 dia para matching
 */
export function findCoincidentPairs(
  ndviTimeSeries: { date: string, ndvi: number, cloudCover?: number }[],
  rviTimeSeries: { date: string, rvi: number }[],
  toleranceDays: number = 1
): RviNdviPairInput[] {
  const pairs: RviNdviPairInput[] = []
  const toleranceMs = toleranceDays * 24 * 60 * 60 * 1000

  for (const ndviPoint of ndviTimeSeries) {
    const ndviDate = new Date(ndviPoint.date).getTime()

    // Encontrar RVI mais próximo dentro da tolerância
    let closestRvi: { date: string, rvi: number } | null = null
    let minDiff = Infinity

    for (const rviPoint of rviTimeSeries) {
      const rviDate = new Date(rviPoint.date).getTime()
      const diff = Math.abs(ndviDate - rviDate)

      if (diff <= toleranceMs && diff < minDiff) {
        minDiff = diff
        closestRvi = rviPoint
      }
    }

    if (closestRvi) {
      // Calcular qualidade baseada na proximidade temporal e cloud cover
      const temporalQuality = 1 - (minDiff / toleranceMs)
      const cloudQuality = ndviPoint.cloudCover !== undefined
        ? Math.max(0, 1 - ndviPoint.cloudCover / 100)
        : 1

      pairs.push({
        date: new Date(ndviPoint.date),
        ndviValue: ndviPoint.ndvi,
        rviValue: closestRvi.rvi,
        cloudCover: ndviPoint.cloudCover,
        quality: temporalQuality * cloudQuality
      })
    }
  }

  return pairs
}
