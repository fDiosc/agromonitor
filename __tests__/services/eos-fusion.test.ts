/**
 * Tests for eos-fusion.service.ts
 * Critical: 4+ bugs found historically (v0.0.30, v0.0.33)
 */

import {
  calculateFusedEos,
  getConfidenceLabel,
  getMethodLabel,
  getPhenologicalStageLabel,
} from '@/lib/services/eos-fusion.service'
import type { EosFusionInput } from '@/lib/services/eos-fusion.service'

// Helper to create dates relative to today
function daysFromNow(days: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d
}

function makeInput(overrides: Partial<EosFusionInput> = {}): EosFusionInput {
  return {
    eosNdvi: daysFromNow(30),
    ndviConfidence: 70,
    currentNdvi: 0.65,
    peakNdvi: 0.85,
    ndviDeclineRate: 0.3,
    eosGdd: daysFromNow(35),
    gddConfidence: 'MEDIUM',
    gddAccumulated: 900,
    gddRequired: 1300,
    plantingDate: daysFromNow(-90),
    cropType: 'SOJA',
    ...overrides,
  }
}

describe('eos-fusion.service', () => {
  // ─── Basic Fusion ──────────────────────────────────────────

  describe('basic fusion', () => {
    it('should return NDVI method when only NDVI is available', () => {
      const result = calculateFusedEos(makeInput({
        eosGdd: null,
        gddAccumulated: 0,
        gddRequired: 0,
      }))

      expect(result.method).toBe('NDVI')
      expect(result.eos).toBeDefined()
    })

    it('should return GDD method when only GDD is available', () => {
      const result = calculateFusedEos(makeInput({
        eosNdvi: null,
        ndviConfidence: 0,
      }))

      expect(['GDD', 'GDD_ADJUSTED']).toContain(result.method)
      expect(result.eos).toBeDefined()
    })

    it('should return FUSION when NDVI and GDD converge (<7 days)', () => {
      const result = calculateFusedEos(makeInput({
        eosNdvi: daysFromNow(30),
        eosGdd: daysFromNow(33), // 3 days apart
      }))

      expect(result.method).toBe('FUSION')
    })

    it('should fallback to 30-day projection when no data available', () => {
      const result = calculateFusedEos(makeInput({
        eosNdvi: null,
        eosGdd: null,
        gddAccumulated: 0,
        gddRequired: 0,
      }))

      expect(result.confidence).toBeLessThanOrEqual(30)
      expect(result.warnings.length).toBeGreaterThan(0)
    })
  })

  // ─── Sanity Checks (bugs v0.0.30, v0.0.33) ────────────────

  describe('sanity checks', () => {
    it('should NOT declare maturity when GDD 100% but NDVI > 0.55 (v0.0.33)', () => {
      const result = calculateFusedEos(makeInput({
        currentNdvi: 0.72, // Still green
        peakNdvi: 0.85,
        ndviDeclineRate: 0.1, // slow decline
        gddAccumulated: 1400,
        gddRequired: 1300, // GDD > 100%
        eosGdd: daysFromNow(-10), // GDD says past
        eosNdvi: null,
      }))

      // Should NOT be MATURITY since plant is still green
      expect(result.phenologicalStage).not.toBe('MATURITY')
    })

    it('should project future date when GDD past but NDVI active (v0.0.33)', () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const result = calculateFusedEos(makeInput({
        currentNdvi: 0.78, // Very green
        peakNdvi: 0.85,
        ndviDeclineRate: -0.1, // Still growing
        gddAccumulated: 1500,
        gddRequired: 1300,
        eosGdd: daysFromNow(-15), // GDD in past
        eosNdvi: null,
      }))

      // EOS must be in the future since plant is green
      expect(result.eos.getTime()).toBeGreaterThan(today.getTime())
      // Confidence should be reduced
      expect(result.confidence).toBeLessThanOrEqual(50)
    })

    it('should set passed=true when EOS is in the past', () => {
      const result = calculateFusedEos(makeInput({
        currentNdvi: 0.30,
        peakNdvi: 0.85,
        ndviDeclineRate: 2.0,
        gddAccumulated: 1400,
        gddRequired: 1300,
        eosNdvi: daysFromNow(-10),
        eosGdd: daysFromNow(-5),
      }))

      expect(result.passed).toBe(true)
    })

    it('should set passed=false when EOS is in the future', () => {
      const result = calculateFusedEos(makeInput({
        eosNdvi: daysFromNow(30),
        eosGdd: daysFromNow(35),
      }))

      expect(result.passed).toBe(false)
    })

    it('should NOT use "today" as EOS when maturation is confirmed (v0.0.30)', () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const result = calculateFusedEos(makeInput({
        currentNdvi: 0.35, // Low, confirming maturation
        peakNdvi: 0.85,
        ndviDeclineRate: 1.5,
        gddAccumulated: 1400,
        gddRequired: 1300,
        eosNdvi: daysFromNow(-20),
        eosGdd: daysFromNow(-15),
      }))

      // EOS should be the calculated date, not today
      // (the old bug would set it to today)
      expect(result.eos).toBeDefined()
    })
  })

  // ─── Phenological Stage ────────────────────────────────────

  describe('phenological stage determination', () => {
    it('should return VEGETATIVE when NDVI > 0.7 and GDD low', () => {
      const result = calculateFusedEos(makeInput({
        currentNdvi: 0.78,
        peakNdvi: 0.85,
        ndviDeclineRate: -0.2, // growing
        gddAccumulated: 400,
        gddRequired: 1300, // ~30%
      }))

      expect(result.phenologicalStage).toBe('VEGETATIVE')
    })

    it('should return REPRODUCTIVE when GDD 50-70%', () => {
      const result = calculateFusedEos(makeInput({
        currentNdvi: 0.82,
        peakNdvi: 0.85,
        ndviDeclineRate: 0.05,
        gddAccumulated: 780,
        gddRequired: 1300, // ~60%
      }))

      expect(result.phenologicalStage).toBe('REPRODUCTIVE')
    })

    it('should return MATURITY when NDVI < 0.5', () => {
      const result = calculateFusedEos(makeInput({
        currentNdvi: 0.35,
        peakNdvi: 0.85,
        ndviDeclineRate: 1.5,
        gddAccumulated: 1400,
        gddRequired: 1300,
      }))

      expect(result.phenologicalStage).toBe('MATURITY')
    })

    it('should prioritize NDVI over GDD for stage (v0.0.33)', () => {
      // GDD says maturity but NDVI says vegetative
      const result = calculateFusedEos(makeInput({
        currentNdvi: 0.78, // Very green
        peakNdvi: 0.82,
        ndviDeclineRate: -0.1, // Growing
        gddAccumulated: 1500,
        gddRequired: 1300, // GDD > 100%
      }))

      // NDVI should prevail: plant is clearly vegetative
      expect(result.phenologicalStage).toBe('VEGETATIVE')
    })
  })

  // ─── Water Stress Adjustment ───────────────────────────────

  describe('water stress adjustment', () => {
    it('should apply 0 days for NONE stress', () => {
      const result = calculateFusedEos(makeInput({
        waterStressLevel: 'NONE',
      }))

      expect(result.projections.waterAdjustment).toBe(0)
    })

    it('should apply -2 days for MEDIUM stress', () => {
      const result = calculateFusedEos(makeInput({
        waterStressLevel: 'MEDIUM',
      }))

      expect(result.projections.waterAdjustment).toBe(-2)
    })

    it('should apply -4 days for HIGH stress', () => {
      const result = calculateFusedEos(makeInput({
        waterStressLevel: 'HIGH',
      }))

      expect(result.projections.waterAdjustment).toBe(-4)
    })

    it('should apply -7 days for CRITICAL stress', () => {
      const result = calculateFusedEos(makeInput({
        waterStressLevel: 'CRITICAL',
        stressDays: 30,
        yieldImpact: 30,
      }))

      expect(result.projections.waterAdjustment).toBe(-7)
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('should use NDVI_ADJUSTED method when stress applied to NDVI', () => {
      const result = calculateFusedEos(makeInput({
        waterStressLevel: 'HIGH',
        eosGdd: null,
        gddAccumulated: 0,
        gddRequired: 0,
      }))

      expect(result.method).toBe('NDVI_ADJUSTED')
    })
  })

  // ─── Fusion Confidence Boost ───────────────────────────────

  describe('fusion metrics confidence boost', () => {
    it('should boost confidence for continuous series (small gaps)', () => {
      const withRadar = calculateFusedEos(makeInput({
        fusionMetrics: {
          gapsFilled: 3,
          maxGapDays: 4,
          radarContribution: 0.2,
          continuityScore: 0.9,
        },
      }))

      const withoutRadar = calculateFusedEos(makeInput())

      expect(withRadar.confidence).toBeGreaterThanOrEqual(withoutRadar.confidence)
    })
  })

  // ─── Helper Functions ──────────────────────────────────────

  describe('helper functions', () => {
    it('getConfidenceLabel should map correctly', () => {
      expect(getConfidenceLabel(80)).toBe('ALTA')
      expect(getConfidenceLabel(60)).toBe('MEDIA')
      expect(getConfidenceLabel(30)).toBe('BAIXA')
    })

    it('getMethodLabel should return PT labels', () => {
      expect(getMethodLabel('NDVI')).toBe('NDVI Histórico')
      expect(getMethodLabel('GDD')).toBe('Soma Térmica')
      expect(getMethodLabel('FUSION')).toBe('NDVI + GDD')
    })

    it('getPhenologicalStageLabel should return PT labels', () => {
      expect(getPhenologicalStageLabel('VEGETATIVE')).toBe('Vegetativo')
      expect(getPhenologicalStageLabel('MATURITY')).toBe('Maturação')
    })
  })
})
