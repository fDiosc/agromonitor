/**
 * RVI Calibration Service
 * Calibração local de RVI para NDVI usando dados históricos
 *
 * Baseado em: Pelta et al. (2022) "SNAF: Sentinel-1 to NDVI for Agricultural Fields
 * Using Hyperlocal Dynamic Machine Learning Approach" - Remote Sensing, 14(11), 2600
 *
 * Barrel re-export - all exports available from original path
 */

export type {
  RviNdviPairInput,
  CalibrationCoefficients,
  CalibrationResult
} from './rvi-calibration/types'

export {
  collectRviNdviPairs,
  getPairsForField,
  findCoincidentPairs
} from './rvi-calibration/data'

export {
  trainLocalModel,
  getLocalCoefficients,
  getFixedCoefficients,
  applyCalibration,
  calibrateRviTimeSeries,
  hasLocalModel,
  getCalibrationStats
} from './rvi-calibration/calibration'
