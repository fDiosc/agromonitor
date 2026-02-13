/**
 * SAR-NDVI Adaptive Fusion - Calibration training and persistence
 */

import prisma from '@/lib/prisma'
import { r2Score, rmse } from './statistics'
import { trainKNN, trainGPR, trainLinear, selectBestFeature } from './models'
import type { SarPoint, CalibrationModel } from './types'

/**
 * Treina modelo de calibração local para o talhão
 */
export async function trainLocalCalibration(
  fieldId: string,
  sarPoints: SarPoint[],
  ndviPoints: { date: string, ndvi: number }[]
): Promise<CalibrationModel | null> {
  console.log(`[SAR_FUSION] Training calibration for field ${fieldId}`)
  console.log(`[SAR_FUSION] SAR points: ${sarPoints.length}, NDVI points: ${ndviPoints.length}`)

  // Selecionar features
  const { featureType, pairs, corrVV, corrVH } = selectBestFeature(sarPoints, ndviPoints)

  if (pairs.length < 8) {
    console.log(`[SAR_FUSION] Not enough pairs (${pairs.length}) for calibration`)
    return null
  }

  console.log(`[SAR_FUSION] Using feature: ${featureType}, pairs: ${pairs.length}`)

  const X = pairs.map(p => p.features)
  const y = pairs.map(p => p.ndvi)

  // Testar GPR e KNN via LOOCV simplificado
  let bestModel: 'GPR' | 'KNN' = 'GPR'
  let bestR2 = -999
  let bestRMSE = 999

  // Testar GPR
  try {
    const gprPreds: number[] = []
    const gprTrue: number[] = []
    for (let i = 0; i < X.length; i++) {
      const XTrain = X.filter((_, j) => j !== i)
      const yTrain = y.filter((_, j) => j !== i)
      const model = trainGPR(XTrain, yTrain)
      gprPreds.push(model.predict(X[i]).mean)
      gprTrue.push(y[i])
    }
    const gprR2 = r2Score(gprTrue, gprPreds)
    const gprRMSE = rmse(gprTrue, gprPreds)
    if (gprR2 > bestR2) {
      bestModel = 'GPR'
      bestR2 = gprR2
      bestRMSE = gprRMSE
    }
  } catch { }

  // Testar KNN
  try {
    const knnPreds: number[] = []
    const knnTrue: number[] = []
    for (let i = 0; i < X.length; i++) {
      const XTrain = X.filter((_, j) => j !== i)
      const yTrain = y.filter((_, j) => j !== i)
      const model = trainKNN(XTrain, yTrain, 5)
      knnPreds.push(model.predict(X[i]))
      knnTrue.push(y[i])
    }
    const knnR2 = r2Score(knnTrue, knnPreds)
    const knnRMSE = rmse(knnTrue, knnPreds)
    if (knnR2 > bestR2) {
      bestModel = 'KNN'
      bestR2 = knnR2
      bestRMSE = knnRMSE
    }
  } catch { }

  console.log(`[SAR_FUSION] Best model: ${bestModel}, R²=${(bestR2 * 100).toFixed(1)}%, RMSE=${bestRMSE.toFixed(3)}`)

  // Treinar modelo final com todos os dados
  let params: CalibrationModel['params'] = {}

  if (bestModel === 'GPR') {
    const model = trainGPR(X, y)
    params = model.params
  } else {
    const model = trainKNN(X, y, 5)
    params = { trainingData: model.trainingData, k: 5 }
  }

  // Também treinar linear como fallback
  const linearModel = trainLinear(X, y)
  params.coeffs = linearModel.coeffs
  params.intercept = linearModel.intercept

  return {
    fieldId,
    featureType,
    modelType: bestModel,
    r2: bestR2,
    rmse: bestRMSE,
    correlationVV: corrVV,
    correlationVH: corrVH,
    trainedAt: new Date().toISOString(),
    nPairs: pairs.length,
    params
  }
}

/**
 * Salva calibração no banco de dados
 */
export async function saveCalibration(calibration: CalibrationModel): Promise<void> {
  try {
    // Salvar no agroData do field
    const field = await prisma.field.findUnique({
      where: { id: calibration.fieldId },
      include: { agroData: true }
    })

    if (!field) return

    let rawAreaData: any = {}
    if (field.agroData?.rawAreaData) {
      try {
        rawAreaData = JSON.parse(field.agroData.rawAreaData)
      } catch { }
    }

    rawAreaData.sarCalibration = calibration

    if (field.agroData) {
      await prisma.agroData.update({
        where: { fieldId: calibration.fieldId },
        data: { rawAreaData: JSON.stringify(rawAreaData) }
      })
    }

    console.log(`[SAR_FUSION] Calibration saved for field ${calibration.fieldId}`)
  } catch (error) {
    console.error('[SAR_FUSION] Error saving calibration:', error)
  }
}

/**
 * Carrega calibração do banco de dados
 */
export async function loadCalibration(fieldId: string): Promise<CalibrationModel | null> {
  try {
    const field = await prisma.field.findUnique({
      where: { id: fieldId },
      include: { agroData: true }
    })

    if (!field?.agroData?.rawAreaData) return null

    const rawAreaData = JSON.parse(field.agroData.rawAreaData)
    return rawAreaData.sarCalibration || null
  } catch {
    return null
  }
}
