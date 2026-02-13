/**
 * Crop Pattern Service - Barrel Re-export
 * Algorithmic pre-validator for NDVI curve shape analysis
 */

export {
  analyzeCropPattern,
  getSupportedCropTypes,
  getCropThresholdsForPrompt,
} from './crop-pattern/analyze'
export type {
  CropPatternStatus,
  CropCategory,
  CropPatternMetrics,
  CropPatternResult,
} from './crop-pattern/types'
