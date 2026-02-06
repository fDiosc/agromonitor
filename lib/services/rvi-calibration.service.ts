/**
 * RVI Calibration Service
 * Calibração local de RVI para NDVI usando dados históricos
 * 
 * Baseado em: Pelta et al. (2022) "SNAF: Sentinel-1 to NDVI for Agricultural Fields 
 * Using Hyperlocal Dynamic Machine Learning Approach" - Remote Sensing, 14(11), 2600
 * 
 * Key insights do paper:
 * - Modelos hyperlocal (por talhão) superam modelos globais
 * - Random Forest com 6 índices SAR atinge RMSE 0.06, R² 0.92
 * - Para simplificação, usamos regressão linear RVI->NDVI
 */

import { prisma } from '@/lib/prisma'

// ==================== Types ====================

export interface RviNdviPairInput {
  date: Date
  ndviValue: number
  rviValue: number
  cloudCover?: number
  quality: number
}

export interface CalibrationCoefficients {
  coefficientA: number  // Slope
  coefficientB: number  // Intercept
  rSquared: number      // R²
  rmse: number          // RMSE
  sampleCount: number
  trainPeriodStart: Date
  trainPeriodEnd: Date
  cropType: string
}

export interface CalibrationResult {
  ndvi: number
  method: 'LOCAL' | 'FIXED'
  confidence: number  // 0-1
  modelR2?: number
}

// ==================== Constants ====================

// Coeficientes fixos da literatura (fallback)
// Baseado em: Filgueiras et al. (2019), Veloso et al. (2017)
const FIXED_COEFFICIENTS: Record<string, { a: number, b: number, r2: number }> = {
  SOJA: { a: 1.15, b: -0.15, r2: 0.78 },
  MILHO: { a: 1.10, b: -0.12, r2: 0.75 },
  ALGODAO: { a: 1.20, b: -0.18, r2: 0.72 },
  DEFAULT: { a: 1.12, b: -0.14, r2: 0.70 }
}

// Requisitos mínimos para treinamento
const MIN_PAIRS_FOR_TRAINING = 15
const MIN_R2_THRESHOLD = 0.5  // R² mínimo para usar modelo local

// ==================== Training Functions ====================

/**
 * Treina regressão linear simples (OLS)
 * NDVI = a * RVI + b
 */
function trainLinearRegression(pairs: { ndvi: number, rvi: number }[]): {
  a: number
  b: number
  r2: number
  rmse: number
} {
  const n = pairs.length
  
  if (n < 2) {
    throw new Error('Insufficient pairs for regression')
  }
  
  // Somas para OLS
  const sumX = pairs.reduce((s, p) => s + p.rvi, 0)
  const sumY = pairs.reduce((s, p) => s + p.ndvi, 0)
  const sumXY = pairs.reduce((s, p) => s + p.rvi * p.ndvi, 0)
  const sumX2 = pairs.reduce((s, p) => s + p.rvi * p.rvi, 0)
  
  const denominator = n * sumX2 - sumX * sumX
  
  if (Math.abs(denominator) < 1e-10) {
    // Variância zero em X - usar coeficientes default
    return { a: 1.0, b: 0, r2: 0, rmse: 1 }
  }
  
  const a = (n * sumXY - sumX * sumY) / denominator
  const b = (sumY - a * sumX) / n
  
  // Calcular R² e RMSE
  const meanY = sumY / n
  const ssTotal = pairs.reduce((s, p) => s + Math.pow(p.ndvi - meanY, 2), 0)
  const ssResidual = pairs.reduce((s, p) => s + Math.pow(p.ndvi - (a * p.rvi + b), 2), 0)
  
  const r2 = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0
  const rmse = Math.sqrt(ssResidual / n)
  
  return { a, b, r2, rmse }
}

// ==================== Data Collection ====================

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

// ==================== Model Training ====================

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

// ==================== Coefficient Retrieval ====================

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

// ==================== Calibration Application ====================

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

// ==================== Batch Processing ====================

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

// ==================== Utility Functions ====================

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
