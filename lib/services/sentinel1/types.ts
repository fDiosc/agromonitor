/**
 * Sentinel-1 Radar Service - Type definitions
 */

export interface S1Scene {
  id: string
  date: string
  orbitState: 'ascending' | 'descending'
  polarization: string
}

export interface S1DataPoint {
  date: string
  vv: number           // Backscatter VV (dB)
  vh: number           // Backscatter VH (dB)
  rvi?: number         // Radar Vegetation Index
  vhVvRatio?: number   // VH/VV ratio
}

export interface S1ProcessingResult {
  scenes: S1Scene[]
  data: S1DataPoint[]
  rviTimeSeries: { date: string, rvi: number }[]
  source: 'API' | 'UNAVAILABLE'
  fetchedAt: Date
}

export interface CopernicusAuth {
  accessToken: string
  expiresAt: Date
}
