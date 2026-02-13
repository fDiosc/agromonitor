/**
 * Chart helper functions for report pages.
 * Extracted from report page for reuse and maintainability.
 */

export function formatEnvelopeForChart(envelopeResult: any): any[] {
  if (!envelopeResult?.envelope?.points) return []

  const currentYear = new Date().getFullYear()
  const points = envelopeResult.envelope.points || []
  const currentSeason = envelopeResult.currentSeason || []

  const currentMap = new Map<number, number>()
  for (const pt of currentSeason) {
    const doy = pt.dayOfYear || getDayOfYear(pt.date)
    currentMap.set(doy, pt.value)
  }

  const daysWithData = new Set(currentSeason.map((pt: any) => pt.dayOfYear || getDayOfYear(pt.date)))

  return points
    .filter((p: any) => daysWithData.has(p.dayOfYear))
    .map((p: any) => ({
      date: getDateFromDayOfYear(p.dayOfYear, currentYear),
      mean: p.mean,
      upper: p.upper,
      lower: p.lower,
      current: currentMap.get(p.dayOfYear),
      isAnomaly: currentMap.has(p.dayOfYear) &&
        (currentMap.get(p.dayOfYear)! > p.upper || currentMap.get(p.dayOfYear)! < p.lower)
    }))
}

export function getDayOfYear(date: string | Date): number {
  const d = typeof date === 'string' ? new Date(date) : date
  const start = new Date(d.getFullYear(), 0, 0)
  const diff = d.getTime() - start.getTime()
  const oneDay = 1000 * 60 * 60 * 24
  return Math.floor(diff / oneDay)
}

export function getDateFromDayOfYear(dayOfYear: number, year: number): string {
  const date = new Date(year, 0, dayOfYear)
  return date.toISOString().split('T')[0]
}

export function getRiskLevel(summary: any): 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO' {
  if (!summary) return 'BAIXO'
  if (summary.extremeEvents >= 5) return 'CRITICO'
  if (summary.extremeEvents >= 2 || Math.abs(summary.avgDeviation) > 2) return 'ALTO'
  if (summary.daysAboveNormal + summary.daysBelowNormal > 10) return 'MEDIO'
  return 'BAIXO'
}

export function prepareChartData(ndviData: any[], historicalNdvi: any[][], agroData: any) {
  if (!ndviData || ndviData.length === 0) return []

  const chartData: any[] = []

  // Current season data
  ndviData.forEach((pt, idx) => {
    const entry: any = {
      date: pt.date,
      current: pt.ndviSmooth || pt.ndviInterp || pt.ndviRaw
    }

    // Add historical data
    historicalNdvi.forEach((season, i) => {
      if (season[idx]) {
        entry[`h${i + 1}`] = season[idx].ndviSmooth || season[idx].ndviInterp || season[idx].ndviRaw
      }
    })

    chartData.push(entry)
  })

  // Extend with historical projection (60 days)
  if (historicalNdvi.length > 0) {
    const lastDate = new Date(ndviData[ndviData.length - 1]?.date || new Date())
    const extensionLen = 12 // ~60 days at 5-day intervals

    for (let j = 0; j < extensionLen; j++) {
      const idx = ndviData.length + j
      const futureDate = new Date(lastDate)
      futureDate.setDate(futureDate.getDate() + (j + 1) * 5)

      const entry: any = {
        date: futureDate.toISOString().split('T')[0],
        isProjected: true
      }

      let hasData = false
      historicalNdvi.forEach((season, i) => {
        if (season[idx]) {
          entry[`h${i + 1}`] = season[idx].ndviSmooth || season[idx].ndviInterp || season[idx].ndviRaw
          hasData = true
        }
      })

      if (hasData) chartData.push(entry)
    }
  }

  return chartData
}

export function formatChartDate(dateStr: string): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length < 3) return dateStr
  return `${parts[2]}/${parts[1]}`
}

export function formatDateForChart(date: string | Date | null | undefined): string {
  if (!date) return ''
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return dateObj.toISOString().split('T')[0]
  } catch {
    return ''
  }
}

export function computeHarvestWindow(
  eosFusion: { eos: Date } | null,
  harvestWindowData: any,
  agroData: any
): { startDate: string; endDate: string; [key: string]: any } | null {
  if (eosFusion?.eos) {
    const areaHa = agroData?.areaHa || 100
    const harvestCapacityHaPerDay = 50
    const harvestDays = Math.ceil(areaHa / harvestCapacityHaPerDay)

    const harvestStartDate = new Date(eosFusion.eos)
    const harvestEndDate = new Date(eosFusion.eos)
    harvestEndDate.setDate(harvestEndDate.getDate() + harvestDays)

    return {
      startDate: harvestStartDate.toISOString().split('T')[0],
      endDate: harvestEndDate.toISOString().split('T')[0],
      source: 'fusion'
    }
  }

  if (harvestWindowData) {
    return harvestWindowData
  }

  if (agroData?.eosDate) {
    const areaHa = agroData.areaHa || 100
    const harvestCapacityHaPerDay = 50
    const harvestDays = Math.ceil(areaHa / harvestCapacityHaPerDay)

    const harvestStartDate = new Date(agroData.eosDate)
    const harvestEndDate = new Date(agroData.eosDate)
    harvestEndDate.setDate(harvestEndDate.getDate() + harvestDays)

    return {
      startDate: harvestStartDate.toISOString().split('T')[0],
      endDate: harvestEndDate.toISOString().split('T')[0],
      daysToHarvest: harvestDays,
      areaHa,
      source: 'agroData'
    }
  }

  return null
}

const RVI_PARAMS: Record<string, { a: number, b: number }> = {
  'SOJA': { a: 1.15, b: -0.15 },
  'MILHO': { a: 1.10, b: -0.12 },
  'ALGODAO': { a: 1.20, b: -0.18 }
}

export function enrichChartDataWithRadar(
  baseChartData: any[],
  radarRviTimeSeries: { date: string; rvi: number }[] | undefined,
  cropType: string
): any[] {
  if (!radarRviTimeSeries?.length) return baseChartData
  const { a, b } = RVI_PARAMS[cropType] || { a: 1.12, b: -0.14 }
  const radarMap = new Map<string, number>()
  for (const pt of radarRviTimeSeries) {
    radarMap.set(pt.date, Math.max(0, Math.min(1, a * pt.rvi + b)))
  }
  return baseChartData.map((pt: any) => {
    const radarNdvi = radarMap.get(pt.date)
    return radarNdvi !== undefined ? { ...pt, radarNdvi } : pt
  })
}
