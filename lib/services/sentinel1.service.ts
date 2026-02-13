/**
 * Sentinel-1 Radar Service
 *
 * Barrel re-export - all exports available from this file for backward compatibility.
 */

export type { S1Scene, S1DataPoint, S1ProcessingResult, CopernicusAuth } from './sentinel1/types'
export {
  getS1DataForField,
  hasCopernicusCredentials,
  serializeS1Data,
  deserializeS1Data
} from './sentinel1/api'
export {
  processImage,
  searchCatalogCloudCover
} from './sentinel1/process'
