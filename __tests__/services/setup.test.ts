/**
 * Teste trivial para validar que a infraestrutura de testes funciona.
 */

describe('Test infrastructure', () => {
  it('should run basic assertions', () => {
    expect(1 + 1).toBe(2)
    expect('hello').toContain('hell')
    expect([1, 2, 3]).toHaveLength(3)
  })

  it('should resolve @/ path aliases', () => {
    const { cn } = require('@/lib/utils')
    expect(typeof cn).toBe('function')
  })

  it('should load NDVI fixtures', () => {
    const { SOJA_NORMAL, NO_CROP } = require('../fixtures/ndvi-series')
    expect(SOJA_NORMAL.length).toBeGreaterThan(10)
    expect(NO_CROP.length).toBeGreaterThan(10)
    // Soja normal peak must be > 0.7
    const peak = Math.max(...SOJA_NORMAL.map((p: any) => p.ndvi_smooth))
    expect(peak).toBeGreaterThan(0.7)
    // NO_CROP peak must be < 0.45
    const noPeak = Math.max(...NO_CROP.map((p: any) => p.ndvi_smooth))
    expect(noPeak).toBeLessThan(0.45)
  })

  it('should load temperature fixtures', () => {
    const { TEMP_NORMAL_PR } = require('../fixtures/temperature-data')
    expect(TEMP_NORMAL_PR.points.length).toBe(120)
    expect(TEMP_NORMAL_PR.avgTemp).toBe(25)
  })

  it('should load water balance fixtures', () => {
    const { WB_NO_STRESS, WB_CRITICAL_STRESS } = require('../fixtures/precipitation-data')
    expect(WB_NO_STRESS.stressDays).toBe(0)
    expect(WB_CRITICAL_STRESS.stressDays).toBeGreaterThan(50)
  })
})
