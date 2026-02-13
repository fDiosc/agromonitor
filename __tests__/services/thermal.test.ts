/**
 * Tests for thermal.service.ts
 * GDD calculation, maturation projection, serialization
 */

import {
  calculateGddAnalysis,
  serializeThermalData,
  deserializeThermalData,
} from '@/lib/services/thermal.service'
import type { TemperatureData, GddAnalysis } from '@/lib/services/thermal.service'
import {
  TEMP_NORMAL_PR,
  TEMP_COLD_RS,
  TEMP_HOT_MT,
  TEMP_BELOW_TBASE,
  TEMP_EMPTY,
} from '../fixtures/temperature-data'

describe('thermal.service', () => {
  // ─── Daily GDD Calculation ─────────────────────────────────

  describe('GDD calculation', () => {
    it('should accumulate GDD for normal temperature (PR, ~25°C)', () => {
      const result = calculateGddAnalysis(
        TEMP_NORMAL_PR,
        new Date('2025-10-01'),
        'SOJA'
      )

      // Soja Tbase=10, Tmean~25, 120 days -> ~1800 GDD
      expect(result.accumulatedGdd).toBeGreaterThan(1000)
      expect(result.requiredGdd).toBe(1300)
    })

    it('should accumulate less GDD in cold region (RS, ~18°C)', () => {
      const result = calculateGddAnalysis(
        TEMP_COLD_RS,
        new Date('2025-10-01'),
        'SOJA'
      )

      // Soja Tbase=10, Tmean~18, 120 days -> ~960 GDD
      expect(result.accumulatedGdd).toBeLessThan(
        calculateGddAnalysis(TEMP_NORMAL_PR, new Date('2025-10-01'), 'SOJA').accumulatedGdd
      )
    })

    it('should accumulate more GDD in hot region (MT, ~30°C)', () => {
      const result = calculateGddAnalysis(
        TEMP_HOT_MT,
        new Date('2025-10-01'),
        'SOJA'
      )

      // Soja Tbase=10, Tmean~30, 120 days -> ~2400 GDD
      expect(result.accumulatedGdd).toBeGreaterThan(1500)
    })

    it('should accumulate 0 GDD when temp < Tbase', () => {
      const result = calculateGddAnalysis(
        TEMP_BELOW_TBASE,
        new Date('2025-07-01'),
        'SOJA'
      )

      // Tmean ~8°C < Tbase 10°C -> most days GDD=0
      // Some days might have sin-wave above 10, so allow small accumulation
      expect(result.accumulatedGdd).toBeLessThan(100)
    })

    it('should use different Tbase for different crops', () => {
      // SOJA: Tbase=10, ALGODAO: Tbase=12, TRIGO: Tbase=5
      const soja = calculateGddAnalysis(TEMP_NORMAL_PR, new Date('2025-10-01'), 'SOJA')
      const algodao = calculateGddAnalysis(TEMP_NORMAL_PR, new Date('2025-10-01'), 'ALGODAO')
      const trigo = calculateGddAnalysis(TEMP_NORMAL_PR, new Date('2025-10-01'), 'TRIGO')

      // Algodão has higher Tbase -> less GDD accumulated
      expect(algodao.accumulatedGdd).toBeLessThan(soja.accumulatedGdd)
      // Trigo has lower Tbase -> more GDD accumulated
      expect(trigo.accumulatedGdd).toBeGreaterThan(soja.accumulatedGdd)
    })
  })

  // ─── Maturation Projection ─────────────────────────────────

  describe('maturation projection', () => {
    it('should report 100% progress when GDD >= required', () => {
      const result = calculateGddAnalysis(
        TEMP_HOT_MT,
        new Date('2025-10-01'),
        'SOJA'
      )

      // Hot region should exceed 1300 GDD in 120 days
      expect(result.progressPercent).toBe(100)
      expect(result.daysToMaturity).toBe(0)
    })

    it('should project EOS date when maturation reached', () => {
      const result = calculateGddAnalysis(
        TEMP_HOT_MT,
        new Date('2025-10-01'),
        'SOJA'
      )

      if (result.accumulatedGdd >= result.requiredGdd) {
        expect(result.projectedEos).not.toBeNull()
        expect(result.confidence).toBe('HIGH')
      }
    })

    it('should project future EOS when GDD < required', () => {
      const result = calculateGddAnalysis(
        TEMP_COLD_RS,
        new Date('2025-10-01'),
        'SOJA'
      )

      if (result.accumulatedGdd < result.requiredGdd) {
        expect(result.progressPercent).toBeLessThan(100)
        // Should project future EOS if enough data
        if (TEMP_COLD_RS.points.length >= 14) {
          expect(result.daysToMaturity).toBeGreaterThan(0)
          expect(result.projectedEos).not.toBeNull()
        }
      }
    })

    it('should return null EOS for empty data', () => {
      const result = calculateGddAnalysis(
        TEMP_EMPTY,
        new Date('2025-10-01'),
        'SOJA'
      )

      expect(result.accumulatedGdd).toBe(0)
      expect(result.projectedEos).toBeNull()
    })

    it('should set HIGH confidence with 60+ data points', () => {
      // TEMP_NORMAL_PR has 120 points
      const result = calculateGddAnalysis(
        TEMP_NORMAL_PR,
        new Date('2025-10-01'),
        'SOJA'
      )

      expect(result.confidence).toBe('HIGH')
    })
  })

  // ─── Backtracking (v0.0.34 feature) ───────────────────────

  describe('backtracking when GDD exceeded', () => {
    it('should find exact date when GDD crossed threshold', () => {
      const result = calculateGddAnalysis(
        TEMP_HOT_MT,
        new Date('2025-10-01'),
        'SOJA'
      )

      if (result.accumulatedGdd >= result.requiredGdd && result.projectedEos) {
        // Projected EOS should be before the last data point
        const lastDate = new Date(TEMP_HOT_MT.points[TEMP_HOT_MT.points.length - 1].date)
        expect(result.projectedEos.getTime()).toBeLessThanOrEqual(lastDate.getTime())
      }
    })
  })

  // ─── Serialization ─────────────────────────────────────────

  describe('serialization', () => {
    it('should serialize and deserialize correctly', () => {
      const gddAnalysis = calculateGddAnalysis(
        TEMP_NORMAL_PR,
        new Date('2025-10-01'),
        'SOJA'
      )

      const original = { temperature: TEMP_NORMAL_PR, gddAnalysis }
      const json = serializeThermalData(original)
      const restored = deserializeThermalData(json)

      expect(restored).not.toBeNull()
      expect(restored!.temperature.avgTemp).toBe(original.temperature.avgTemp)
      expect(restored!.gddAnalysis.accumulatedGdd).toBe(original.gddAnalysis.accumulatedGdd)
      expect(restored!.gddAnalysis.requiredGdd).toBe(original.gddAnalysis.requiredGdd)
    })

    it('should preserve Date objects after deserialization', () => {
      const gddAnalysis = calculateGddAnalysis(
        TEMP_NORMAL_PR,
        new Date('2025-10-01'),
        'SOJA'
      )

      const json = serializeThermalData({ temperature: TEMP_NORMAL_PR, gddAnalysis })
      const restored = deserializeThermalData(json)

      expect(restored!.temperature.fetchedAt).toBeInstanceOf(Date)
      if (restored!.gddAnalysis.projectedEos) {
        expect(restored!.gddAnalysis.projectedEos).toBeInstanceOf(Date)
      }
    })

    it('should return null for null input', () => {
      expect(deserializeThermalData(null)).toBeNull()
    })

    it('should return null for invalid JSON', () => {
      expect(deserializeThermalData('{invalid')).toBeNull()
    })
  })

  // ─── Crop-specific Requirements ────────────────────────────

  describe('crop-specific GDD requirements', () => {
    it('should use SOJA defaults for unknown crop', () => {
      const result = calculateGddAnalysis(
        TEMP_NORMAL_PR,
        new Date('2025-10-01'),
        'UNKNOWN'
      )

      expect(result.requiredGdd).toBe(1300) // SOJA default
    })

    it('should use MILHO requirements (1500 GDD)', () => {
      const result = calculateGddAnalysis(
        TEMP_NORMAL_PR,
        new Date('2025-10-01'),
        'MILHO'
      )

      expect(result.requiredGdd).toBe(1500)
    })

    it('should use ALGODAO requirements (1800 GDD)', () => {
      const result = calculateGddAnalysis(
        TEMP_NORMAL_PR,
        new Date('2025-10-01'),
        'ALGODAO'
      )

      expect(result.requiredGdd).toBe(1800)
    })
  })
})
