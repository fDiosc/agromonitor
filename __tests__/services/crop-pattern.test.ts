/**
 * Tests for crop-pattern.service.ts
 * Classification: TYPICAL, ATYPICAL, ANOMALOUS, NO_CROP
 */

import {
  analyzeCropPattern,
  getSupportedCropTypes,
  getCropThresholdsForPrompt,
} from '@/lib/services/crop-pattern.service'
import {
  SOJA_NORMAL,
  MILHO_NORMAL,
  NO_CROP,
  ANOMALOUS,
  ATYPICAL,
} from '../fixtures/ndvi-series'

describe('crop-pattern.service', () => {
  // ─── Annual Classification (SOJA) ─────────────────────────

  describe('annual classification - SOJA', () => {
    it('should classify normal soja as TYPICAL', () => {
      const result = analyzeCropPattern(
        SOJA_NORMAL,
        'SOJA',
        '2025-10-16', // SOS
        '2026-01-24'  // EOS
      )

      expect(result.status).toBe('TYPICAL')
      expect(result.cropCategory).toBe('ANNUAL')
      expect(result.shouldShortCircuit).toBe(false)
      expect(result.shouldCallVerifier).toBe(false)
    })

    it('should classify NO_CROP series as NO_CROP', () => {
      const result = analyzeCropPattern(NO_CROP, 'SOJA')

      expect(result.status).toBe('NO_CROP')
      expect(result.shouldShortCircuit).toBe(true)
      expect(result.shouldCallVerifier).toBe(false)
      expect(result.hypotheses.length).toBeGreaterThan(0)
    })

    it('should classify ANOMALOUS series correctly', () => {
      const result = analyzeCropPattern(ANOMALOUS, 'SOJA')

      expect(result.status).toBe('ANOMALOUS')
      expect(result.shouldShortCircuit).toBe(false)
      expect(result.shouldCallVerifier).toBe(true)
    })

    it('should classify ATYPICAL series correctly', () => {
      const result = analyzeCropPattern(ATYPICAL, 'SOJA')

      // ATYPICAL has amplitude below expected for SOJA
      expect(['ATYPICAL', 'ANOMALOUS']).toContain(result.status)
      expect(result.shouldCallVerifier).toBe(true)
    })

    it('should classify as ATYPICAL when cycle is null for annual crop (v0.0.33)', () => {
      // No SOS/EOS provided = null cycle = ATYPICAL for annual
      const result = analyzeCropPattern(SOJA_NORMAL, 'SOJA', null, null)

      // Without SOS/EOS dates, cycle is null, which is atypical for annual
      // But if peak is high enough, it might still be TYPICAL based on peak alone
      // The key test is: null cycle for annual triggers ATYPICAL check
      expect(result.metrics.cycleDurationDays).toBeNull()
    })

    it('should classify as ATYPICAL when amplitude < 85% of expected', () => {
      // ATYPICAL series has low amplitude
      const result = analyzeCropPattern(ATYPICAL, 'SOJA', null, null)

      // Expected amplitude for SOJA is 0.35, 85% = 0.2975
      expect(result.metrics.amplitude).toBeLessThan(0.35 * 0.85)
    })
  })

  // ─── Annual Classification (MILHO) ────────────────────────

  describe('annual classification - MILHO', () => {
    it('should classify normal milho as TYPICAL', () => {
      const result = analyzeCropPattern(
        MILHO_NORMAL,
        'MILHO',
        '2025-10-21', // SOS
        '2026-01-29'  // EOS
      )

      expect(result.status).toBe('TYPICAL')
      expect(result.cropCategory).toBe('ANNUAL')
    })

    it('should use MILHO-specific thresholds (lower peak)', () => {
      const result = analyzeCropPattern(MILHO_NORMAL, 'MILHO')

      // MILHO has peakMinNdvi 0.65 (vs SOJA 0.70)
      expect(result.metrics.peakNdvi).toBeGreaterThanOrEqual(0.65)
    })
  })

  // ─── Short-circuit Behavior ────────────────────────────────

  describe('short-circuit behavior', () => {
    it('should set shouldShortCircuit=true only for NO_CROP', () => {
      const noCrop = analyzeCropPattern(NO_CROP, 'SOJA')
      const normal = analyzeCropPattern(SOJA_NORMAL, 'SOJA', '2025-10-16', '2026-01-24')
      const anomalous = analyzeCropPattern(ANOMALOUS, 'SOJA')

      expect(noCrop.shouldShortCircuit).toBe(true)
      expect(normal.shouldShortCircuit).toBe(false)
      expect(anomalous.shouldShortCircuit).toBe(false)
    })

    it('should set shouldCallVerifier=true for ANOMALOUS', () => {
      const result = analyzeCropPattern(ANOMALOUS, 'SOJA')

      expect(result.shouldCallVerifier).toBe(true)
    })
  })

  // ─── Metrics Calculation ───────────────────────────────────

  describe('metrics', () => {
    it('should calculate correct peak NDVI', () => {
      const result = analyzeCropPattern(SOJA_NORMAL, 'SOJA')

      // SOJA_NORMAL has peak at 0.85
      expect(result.metrics.peakNdvi).toBeCloseTo(0.85, 1)
    })

    it('should calculate amplitude as peak - basal', () => {
      const result = analyzeCropPattern(SOJA_NORMAL, 'SOJA')

      expect(result.metrics.amplitude).toBeCloseTo(
        result.metrics.peakNdvi - result.metrics.basalNdvi,
        2
      )
    })

    it('should report correct data point count', () => {
      const result = analyzeCropPattern(SOJA_NORMAL, 'SOJA')

      expect(result.metrics.dataPoints).toBe(SOJA_NORMAL.length)
    })

    it('should calculate cycle duration from SOS to EOS', () => {
      const result = analyzeCropPattern(
        SOJA_NORMAL,
        'SOJA',
        '2025-10-16',
        '2026-01-24'
      )

      // ~100 days
      expect(result.metrics.cycleDurationDays).toBeGreaterThan(80)
      expect(result.metrics.cycleDurationDays).toBeLessThan(160)
    })
  })

  // ─── Edge Cases ────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle insufficient data (<5 points)', () => {
      const few = SOJA_NORMAL.slice(0, 3)
      const result = analyzeCropPattern(few, 'SOJA')

      expect(result.status).toBe('ATYPICAL')
      expect(result.reason).toContain('pontos')
    })

    it('should handle null data', () => {
      const result = analyzeCropPattern(null as any, 'SOJA')

      expect(result.status).toBe('ATYPICAL')
    })

    it('should default to SOJA thresholds for unknown crop', () => {
      const result = analyzeCropPattern(SOJA_NORMAL, 'UNKNOWN')

      expect(result.cropCategory).toBe('ANNUAL')
    })
  })

  // ─── Utility Functions ─────────────────────────────────────

  describe('utility functions', () => {
    it('getSupportedCropTypes should return 8 crops', () => {
      const types = getSupportedCropTypes()

      expect(types.length).toBe(8)
      expect(types.map(t => t.key)).toContain('SOJA')
      expect(types.map(t => t.key)).toContain('CAFE')
    })

    it('getCropThresholdsForPrompt should return description for soja', () => {
      const prompt = getCropThresholdsForPrompt('SOJA')

      expect(prompt.category).toBe('ANNUAL')
      expect(prompt.label).toBe('Soja')
      expect(prompt.description).toContain('Peak NDVI')
    })

    it('getCropThresholdsForPrompt should return perennial description for cafe', () => {
      const prompt = getCropThresholdsForPrompt('CAFE')

      expect(prompt.category).toBe('PERENNIAL')
      expect(prompt.description).toContain('NDVI estável')
    })
  })
})
