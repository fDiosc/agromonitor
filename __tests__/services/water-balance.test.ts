/**
 * Tests for water-balance.service.ts
 * EOS adjustment by water stress, serialization, stress levels
 */

import {
  calculateEosAdjustment,
  serializeWaterBalance,
  deserializeWaterBalance,
} from '@/lib/services/water-balance.service'
import type { WaterBalanceData, EosAdjustment } from '@/lib/services/water-balance.service'
import {
  WB_NO_STRESS,
  WB_MODERATE_STRESS,
  WB_SEVERE_STRESS,
  WB_CRITICAL_STRESS,
} from '../fixtures/precipitation-data'

const EOS_DATE = new Date('2026-01-30')

describe('water-balance.service', () => {
  // ─── Stress Level Classification ──────────────────────────

  describe('stress level classification', () => {
    it('should classify as BAIXO when no deficit', () => {
      const result = calculateEosAdjustment(EOS_DATE, WB_NO_STRESS)

      expect(result.stressLevel).toBe('BAIXO')
      expect(result.adjustmentDays).toBe(0)
      expect(result.yieldImpact).toBe(1.0) // No impact
    })

    it('should classify as MODERADO for light deficit', () => {
      // Create light deficit: effectiveDeficit just above 25 (DEFICIT_LIGHT)
      const lightStress: WaterBalanceData = {
        ...WB_NO_STRESS,
        totalDeficit: 30,
        stressDays: 5,
      }
      const result = calculateEosAdjustment(EOS_DATE, lightStress, 'reproductive')

      // effectiveDeficit = 30 * 1.5 = 45 (between 25 and 50)
      expect(result.stressLevel).toBe('MODERADO')
      expect(result.adjustmentDays).toBe(-3)
      expect(result.yieldImpact).toBe(0.95)
    })

    it('should classify as SEVERO for moderate deficit', () => {
      // Create moderate deficit: effectiveDeficit > 50
      const moderateStress: WaterBalanceData = {
        ...WB_NO_STRESS,
        totalDeficit: 60,
        stressDays: 10,
      }
      const result = calculateEosAdjustment(EOS_DATE, moderateStress, 'reproductive')

      // effectiveDeficit = 60 * 1.5 = 90 (between 50 and 100)
      expect(result.stressLevel).toBe('SEVERO')
      expect(result.adjustmentDays).toBe(-7)
      expect(result.yieldImpact).toBe(0.85)
    })

    it('should classify as CRITICO for severe deficit', () => {
      // Create severe deficit: effectiveDeficit > 100
      const severeStress: WaterBalanceData = {
        ...WB_NO_STRESS,
        totalDeficit: 120,
        stressDays: 25,
      }
      const result = calculateEosAdjustment(EOS_DATE, severeStress, 'reproductive')

      // effectiveDeficit = 120 * 1.5 = 180 (> 100)
      expect(result.stressLevel).toBe('CRITICO')
      expect(result.adjustmentDays).toBe(-12)
      expect(result.yieldImpact).toBe(0.70)
    })
  })

  // ─── EOS Adjustment ───────────────────────────────────────

  describe('EOS adjustment calculation', () => {
    it('should not adjust EOS when no stress', () => {
      const result = calculateEosAdjustment(EOS_DATE, WB_NO_STRESS)

      expect(result.adjustedEos.getTime()).toBe(result.originalEos.getTime())
    })

    it('should shorten cycle (earlier EOS) for stress', () => {
      const highStress: WaterBalanceData = {
        ...WB_NO_STRESS,
        totalDeficit: 120,
        stressDays: 25,
      }
      const result = calculateEosAdjustment(EOS_DATE, highStress, 'reproductive')

      expect(result.adjustedEos.getTime()).toBeLessThan(result.originalEos.getTime())
    })

    it('should apply 1.5x multiplier for reproductive phase', () => {
      const stress: WaterBalanceData = {
        ...WB_NO_STRESS,
        totalDeficit: 40, // effectiveDeficit = 40 * 1.5 = 60
        stressDays: 10,
      }

      const reproductive = calculateEosAdjustment(EOS_DATE, stress, 'reproductive')
      const vegetative = calculateEosAdjustment(EOS_DATE, stress, 'vegetative')

      // Reproductive should have more severe classification
      // 40 * 1.5 = 60 > 50 (DEFICIT_MODERATE) -> SEVERO
      // 40 * 1.0 = 40 > 25 (DEFICIT_LIGHT) -> MODERADO
      expect(reproductive.adjustmentDays).toBeLessThanOrEqual(vegetative.adjustmentDays)
    })

    it('should preserve original EOS date', () => {
      const result = calculateEosAdjustment(EOS_DATE, WB_SEVERE_STRESS, 'reproductive')

      expect(result.originalEos.getTime()).toBe(EOS_DATE.getTime())
    })

    it('should include reason for non-BAIXO stress', () => {
      const stress: WaterBalanceData = {
        ...WB_NO_STRESS,
        totalDeficit: 200,
        stressDays: 30,
      }
      const result = calculateEosAdjustment(EOS_DATE, stress, 'reproductive')

      expect(result.reason).not.toBeNull()
      expect(result.reason).toContain('déficit')
    })

    it('should return null reason for BAIXO stress', () => {
      const result = calculateEosAdjustment(EOS_DATE, WB_NO_STRESS)

      expect(result.reason).toBeNull()
    })
  })

  // ─── Stress Days Trigger ───────────────────────────────────

  describe('stress days trigger', () => {
    it('should trigger CRITICO on stress days > 21', () => {
      const stress: WaterBalanceData = {
        ...WB_NO_STRESS,
        totalDeficit: 10, // Low deficit but many stress days
        stressDays: 22,
      }
      const result = calculateEosAdjustment(EOS_DATE, stress, 'reproductive')

      // effectiveStressDays = 22 * 1.5 = 33 > 21 (STRESS_DAYS_SEVERE)
      expect(result.stressLevel).toBe('CRITICO')
    })

    it('should trigger SEVERO on stress days > 14 in reproductive', () => {
      const stress: WaterBalanceData = {
        ...WB_NO_STRESS,
        totalDeficit: 10,
        stressDays: 10, // 10 * 1.5 = 15 > 14 (STRESS_DAYS_MODERATE)
      }
      const result = calculateEosAdjustment(EOS_DATE, stress, 'reproductive')

      expect(result.stressLevel).toBe('SEVERO')
    })
  })

  // ─── Serialization ─────────────────────────────────────────

  describe('serialization', () => {
    it('should serialize and deserialize WaterBalanceData', () => {
      const json = serializeWaterBalance(WB_MODERATE_STRESS)
      const restored = deserializeWaterBalance(json)

      expect(restored).not.toBeNull()
      expect(restored!.totalDeficit).toBe(WB_MODERATE_STRESS.totalDeficit)
      expect(restored!.stressDays).toBe(WB_MODERATE_STRESS.stressDays)
      expect(restored!.points.length).toBe(WB_MODERATE_STRESS.points.length)
    })

    it('should preserve fetchedAt as Date', () => {
      const json = serializeWaterBalance(WB_NO_STRESS)
      const restored = deserializeWaterBalance(json)

      expect(restored!.fetchedAt).toBeInstanceOf(Date)
    })

    it('should return null for null input', () => {
      expect(deserializeWaterBalance(null)).toBeNull()
    })

    it('should return null for invalid JSON', () => {
      expect(deserializeWaterBalance('not json')).toBeNull()
    })
  })

  // ─── PT-EN Mapping ─────────────────────────────────────────

  describe('stress level labels (PT)', () => {
    it('should use Portuguese stress level names', () => {
      const levels = ['BAIXO', 'MODERADO', 'SEVERO', 'CRITICO']

      const noStress = calculateEosAdjustment(EOS_DATE, WB_NO_STRESS)
      expect(levels).toContain(noStress.stressLevel)

      const highStress: WaterBalanceData = {
        ...WB_NO_STRESS,
        totalDeficit: 200,
        stressDays: 30,
      }
      const critical = calculateEosAdjustment(EOS_DATE, highStress, 'reproductive')
      expect(levels).toContain(critical.stressLevel)
    })
  })
})
