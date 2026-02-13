/**
 * RVI Calibration - Main calibration functions
 */

import { prisma } from '@/lib/prisma'
import type { CalibrationCoefficients, CalibrationResult } from './types'
import { FIXED_COEFFICIENTS, MIN_PAIRS_FOR_TRAINING, MIN_R2_THRESHOLD } from './types'
import { trainLinearRegression } from './math'
import { getPairsForField } from './data'

/**
 * Treina modelo local para um talhão
 * Retorna null se não há dados suficientes ou R² muito baixo
 */
export async function trainLocalModel(
  fieldId: string,
  cropType: string
): Promise<CalibrationCoefficients | null> {
  // Buscar pares existentes
  const pairs = await getPairsForField(fieldId)

  if (pairs.length < MIN_PAIRS_FOR_TRAINING) {
    console.log(`[RVI_CALIBRATION] Insufficient pairs for field ${fieldId}: ${pairs.length} < ${MIN_PAIRS_FOR_TRAINING}`)
    return null
  }

  // Treinar regressão
  const { a, b, r2, rmse } = trainLinearRegression(
    pairs.map(p => ({ ndvi: p.ndvi, rvi: p.rvi }))
  )

  // Verificar qualidade mínima
  if (r2 < MIN_R2_THRESHOLD) {
    console.log(`[RVI_CALIBRATION] R² too low for field ${fieldId}: ${r2.toFixed(3)} < ${MIN_R2_THRESHOLD}`)
    return null
  }

  // Período de treinamento
  const dates = pairs.map(p => p.date)
  const trainPeriodStart = new Date(Math.min(...dates.map(d => d.getTime())))
  const trainPeriodEnd = new Date(Math.max(...dates.map(d => d.getTime())))

  // Salvar modelo no banco
  const calibration = await prisma.rviNdviCalibration.upsert({
    where: {
      fieldId_cropType: {
        fieldId,
        cropType
      }
    },
    create: {
      fieldId,
      cropType,
      coefficientA: a,
      coefficientB: b,
      rSquared: r2,
      rmse,
      sampleCount: pairs.length,
      trainPeriodStart,
      trainPeriodEnd,
      isActive: true
    },
    update: {
      coefficientA: a,
      coefficientB: b,
      rSquared: r2,
      rmse,
      sampleCount: pairs.length,
      trainPeriodStart,
      trainPeriodEnd,
      isActive: true
    }
  })

  console.log(`[RVI_CALIBRATION] Model trained for field ${fieldId}:`, {
    a: a.toFixed(4),
    b: b.toFixed(4),
    r2: r2.toFixed(3),
    rmse: rmse.toFixed(4),
    samples: pairs.length
  })

  return {
    coefficientA: calibration.coefficientA,
    coefficientB: calibration.coefficientB,
    rSquared: calibration.rSquared,
    rmse: calibration.rmse,
    sampleCount: calibration.sampleCount,
    trainPeriodStart: calibration.trainPeriodStart,
    trainPeriodEnd: calibration.trainPeriodEnd,
    cropType: calibration.cropType
  }
}

/**
 * Busca coeficientes locais para um talhão
 */
export async function getLocalCoefficients(
  fieldId: string,
  cropType: string
): Promise<CalibrationCoefficients | null> {
  const calibration = await prisma.rviNdviCalibration.findUnique({
    where: {
      fieldId_cropType: {
        fieldId,
        cropType
      }
    }
  })

  if (!calibration || !calibration.isActive) {
    return null
  }

  return {
    coefficientA: calibration.coefficientA,
    coefficientB: calibration.coefficientB,
    rSquared: calibration.rSquared,
    rmse: calibration.rmse,
    sampleCount: calibration.sampleCount,
    trainPeriodStart: calibration.trainPeriodStart,
    trainPeriodEnd: calibration.trainPeriodEnd,
    cropType: calibration.cropType
  }
}

/**
 * Busca coeficientes fixos da literatura
 */
export function getFixedCoefficients(cropType: string): { a: number, b: number, r2: number } {
  return FIXED_COEFFICIENTS[cropType] || FIXED_COEFFICIENTS.DEFAULT
}

/**
 * Aplica calibração para converter RVI em NDVI
 * Usa modelo local se disponível e com R² adequado, senão usa fixo
 */
export async function applyCalibration(
  rvi: number,
  fieldId: string,
  cropType: string,
  useLocalCalibration: boolean
): Promise<CalibrationResult> {
  let ndvi: number
  let method: 'LOCAL' | 'FIXED'
  let confidence: number
  let modelR2: number | undefined

  if (useLocalCalibration) {
    const localCoefs = await getLocalCoefficients(fieldId, cropType)

    if (localCoefs && localCoefs.rSquared >= MIN_R2_THRESHOLD) {
      // Usar modelo local
      ndvi = localCoefs.coefficientA * rvi + localCoefs.coefficientB
      method = 'LOCAL'
      confidence = Math.min(1, localCoefs.rSquared * 1.1)  // R² como proxy de confiança
      modelR2 = localCoefs.rSquared

      console.log(`[RVI_CALIBRATION] Applied LOCAL model for field ${fieldId}:`, {
        rvi: rvi.toFixed(3),
        ndvi: ndvi.toFixed(3),
        r2: localCoefs.rSquared.toFixed(3)
      })
    } else {
      // Fallback para coeficientes fixos
      const fixedCoefs = getFixedCoefficients(cropType)
      ndvi = fixedCoefs.a * rvi + fixedCoefs.b
      method = 'FIXED'
      confidence = fixedCoefs.r2 * 0.9  // Menor confiança para modelo fixo
      modelR2 = fixedCoefs.r2

      console.log(`[RVI_CALIBRATION] No local model, using FIXED for field ${fieldId}`)
    }
  } else {
    // Calibração local desabilitada - usar fixo direto
    const fixedCoefs = getFixedCoefficients(cropType)
    ndvi = fixedCoefs.a * rvi + fixedCoefs.b
    method = 'FIXED'
    confidence = fixedCoefs.r2 * 0.9
    modelR2 = fixedCoefs.r2
  }

  // Clamp NDVI para range válido [-1, 1]
  ndvi = Math.max(-1, Math.min(1, ndvi))

  return { ndvi, method, confidence, modelR2 }
}

/**
 * Processa série temporal de RVI para NDVI
 */
export async function calibrateRviTimeSeries(
  rviTimeSeries: { date: string, rvi: number }[],
  fieldId: string,
  cropType: string,
  useLocalCalibration: boolean
): Promise<{ date: string, ndvi: number, method: 'LOCAL' | 'FIXED', confidence: number }[]> {
  const results: { date: string, ndvi: number, method: 'LOCAL' | 'FIXED', confidence: number }[] = []

  // Buscar coeficientes uma vez (otimização)
  let localCoefs: CalibrationCoefficients | null = null
  if (useLocalCalibration) {
    localCoefs = await getLocalCoefficients(fieldId, cropType)
  }

  const fixedCoefs = getFixedCoefficients(cropType)

  for (const point of rviTimeSeries) {
    let ndvi: number
    let method: 'LOCAL' | 'FIXED'
    let confidence: number

    if (localCoefs && localCoefs.rSquared >= MIN_R2_THRESHOLD) {
      ndvi = localCoefs.coefficientA * point.rvi + localCoefs.coefficientB
      method = 'LOCAL'
      confidence = Math.min(1, localCoefs.rSquared * 1.1)
    } else {
      ndvi = fixedCoefs.a * point.rvi + fixedCoefs.b
      method = 'FIXED'
      confidence = fixedCoefs.r2 * 0.9
    }

    // Clamp
    ndvi = Math.max(-1, Math.min(1, ndvi))

    results.push({
      date: point.date,
      ndvi,
      method,
      confidence
    })
  }

  return results
}

/**
 * Verifica se um talhão tem modelo local treinado e ativo
 */
export async function hasLocalModel(fieldId: string, cropType: string): Promise<boolean> {
  const calibration = await prisma.rviNdviCalibration.findUnique({
    where: {
      fieldId_cropType: {
        fieldId,
        cropType
      }
    },
    select: { isActive: true, rSquared: true }
  })

  return !!calibration && calibration.isActive && calibration.rSquared >= MIN_R2_THRESHOLD
}

/**
 * Retorna estatísticas de calibração para um talhão
 */
export async function getCalibrationStats(fieldId: string): Promise<{
  pairsCount: number
  hasModel: boolean
  modelR2: number | null
  modelRmse: number | null
  lastTrainingDate: Date | null
} | null> {
  const [pairsCount, calibration] = await Promise.all([
    prisma.rviNdviPair.count({ where: { fieldId } }),
    prisma.rviNdviCalibration.findFirst({
      where: { fieldId, isActive: true },
      orderBy: { updatedAt: 'desc' }
    })
  ])

  return {
    pairsCount,
    hasModel: !!calibration && calibration.rSquared >= MIN_R2_THRESHOLD,
    modelR2: calibration?.rSquared ?? null,
    modelRmse: calibration?.rmse ?? null,
    lastTrainingDate: calibration?.updatedAt ?? null
  }
}
