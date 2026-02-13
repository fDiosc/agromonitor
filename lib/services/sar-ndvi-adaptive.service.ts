/**
 * SAR-NDVI Adaptive Fusion Service (BETA)
 *
 * Barrel re-export - all exports available from this file for backward compatibility.
 */

export type { SarPoint, NdviPoint, CalibrationModel, FusionResult } from './sar-ndvi/types'
export {
  fuseSarNdvi,
  isSarFusionEnabled,
  calculateHarvestConfidence
} from './sar-ndvi/fusion'
export {
  trainLocalCalibration,
  saveCalibration,
  loadCalibration
} from './sar-ndvi/calibration'
