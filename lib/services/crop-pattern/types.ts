/**
 * Crop Pattern Service - Types and Thresholds
 */

export type CropPatternStatus = 'TYPICAL' | 'ATYPICAL' | 'ANOMALOUS' | 'NO_CROP'
export type CropCategory = 'ANNUAL' | 'SEMI_PERENNIAL' | 'PERENNIAL'

export interface CropPatternMetrics {
  peakNdvi: number
  basalNdvi: number
  amplitude: number
  meanNdvi: number
  stdNdvi: number
  growthRate: number         // max derivative in ascending phase
  cycleDurationDays: number | null
  dataPoints: number
}

export interface CropPatternResult {
  status: CropPatternStatus
  cropType: string
  cropCategory: CropCategory
  metrics: CropPatternMetrics
  hypotheses: string[]
  reason: string
  shouldShortCircuit: boolean  // true = do NOT run EOS/GDD/IA
  shouldCallVerifier: boolean  // true = call Verifier agent for visual confirmation
}

// ==================== Thresholds ====================

export interface AnnualThresholds {
  category: 'ANNUAL'
  peakMinNdvi: number
  noCropPeak: number
  noCropAmplitude: number
  anomalousPeak: number
  minCycleDays: number
  maxCycleDays: number
  expectedAmplitude: number
  label: string
}

export interface SemiPerennialThresholds {
  category: 'SEMI_PERENNIAL'
  peakMinNdvi: number
  noCropPeak: number
  noCropAmplitude: number
  anomalousPeak: number
  minCycleDays: number
  maxCycleDays: number
  expectedAmplitude: number
  label: string
}

export interface PerennialThresholds {
  category: 'PERENNIAL'
  baselineMinNdvi: number
  baselineMaxNdvi: number
  noCropBaseline: number
  seasonalAmplitude: number
  anomalousDrop: number
  label: string
}

export type CropThresholds = AnnualThresholds | SemiPerennialThresholds | PerennialThresholds

export const CROP_PATTERN_THRESHOLDS: Record<string, CropThresholds> = {
  // ─── ANUAIS ──────────────────────────────────────────────────
  SOJA: {
    category: 'ANNUAL',
    peakMinNdvi: 0.70,
    noCropPeak: 0.45,
    noCropAmplitude: 0.15,
    anomalousPeak: 0.55,
    minCycleDays: 80,
    maxCycleDays: 160,
    expectedAmplitude: 0.35,
    label: 'Soja',
  },
  MILHO: {
    category: 'ANNUAL',
    peakMinNdvi: 0.65,
    noCropPeak: 0.40,
    noCropAmplitude: 0.15,
    anomalousPeak: 0.50,
    minCycleDays: 100,
    maxCycleDays: 180,
    expectedAmplitude: 0.30,
    label: 'Milho',
  },
  GERGELIM: {
    category: 'ANNUAL',
    peakMinNdvi: 0.55,
    noCropPeak: 0.35,
    noCropAmplitude: 0.12,
    anomalousPeak: 0.42,
    minCycleDays: 80,
    maxCycleDays: 130,
    expectedAmplitude: 0.22,
    label: 'Gergelim',
  },
  CEVADA: {
    category: 'ANNUAL',
    peakMinNdvi: 0.65,
    noCropPeak: 0.40,
    noCropAmplitude: 0.15,
    anomalousPeak: 0.50,
    minCycleDays: 80,
    maxCycleDays: 150,
    expectedAmplitude: 0.30,
    label: 'Cevada',
  },
  ALGODAO: {
    category: 'ANNUAL',
    peakMinNdvi: 0.60,
    noCropPeak: 0.38,
    noCropAmplitude: 0.12,
    anomalousPeak: 0.48,
    minCycleDays: 140,
    maxCycleDays: 220,
    expectedAmplitude: 0.25,
    label: 'Algodão',
  },
  ARROZ: {
    category: 'ANNUAL',
    peakMinNdvi: 0.65,
    noCropPeak: 0.35,
    noCropAmplitude: 0.15,
    anomalousPeak: 0.48,
    minCycleDays: 90,
    maxCycleDays: 150,
    expectedAmplitude: 0.30,
    label: 'Arroz',
  },

  // ─── SEMI-PERENE ──────────────────────────────────────────────
  CANA: {
    category: 'SEMI_PERENNIAL',
    peakMinNdvi: 0.70,
    noCropPeak: 0.35,
    noCropAmplitude: 0.10,
    anomalousPeak: 0.50,
    minCycleDays: 300,
    maxCycleDays: 540,
    expectedAmplitude: 0.35,
    label: 'Cana-de-açúcar',
  },

  // ─── PERENE ──────────────────────────────────────────────────
  CAFE: {
    category: 'PERENNIAL',
    baselineMinNdvi: 0.50,
    baselineMaxNdvi: 0.75,
    noCropBaseline: 0.30,
    seasonalAmplitude: 0.15,
    anomalousDrop: 0.25,
    label: 'Café',
  },
}
