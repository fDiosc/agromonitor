/**
 * Chart Data Preparation Functions
 */

import type { NdviPoint } from '../merx.service'
import type { CycleAnalysisResult } from './types'
import { applyAdaptiveProjection, applyRangeFilter } from './historical-overlay-projection'

/**
 * Prepara dados para o gráfico com curvas alinhadas
 */
export function prepareAlignedChartData(analysis: CycleAnalysisResult): any[] {
  const { currentCycle, historicalCycles, envelope } = analysis

  if (!currentCycle && historicalCycles.length === 0) return []

  // Determinar range de dias
  let minDay = 0
  let maxDay = 0

  if (currentCycle) {
    currentCycle.points.forEach(p => {
      if (p.dayOfCycle > maxDay) maxDay = p.dayOfCycle
    })
  }

  // Estender maxDay para incluir projeção histórica
  historicalCycles.forEach(cycle => {
    cycle.points.forEach(p => {
      if (p.dayOfCycle > maxDay) maxDay = p.dayOfCycle
    })
  })

  // Adicionar margem para projeção
  maxDay = Math.max(maxDay, 150)

  const chartData: any[] = []

  // Criar pontos a cada 5 dias
  for (let day = minDay; day <= maxDay; day += 5) {
    const entry: any = {
      dayOfCycle: day,
      dayLabel: day === 0 ? 'SOS' : day > 0 ? `D+${day}` : `D${day}`
    }

    // Dados atuais
    if (currentCycle) {
      const closest = currentCycle.points.find(p => Math.abs(p.dayOfCycle - day) <= 3)
      if (closest) {
        entry.current = closest.ndvi
        entry.currentDate = closest.date
      }
    }

    // Dados históricos individuais
    historicalCycles.forEach((cycle, idx) => {
      const closest = cycle.points.find(p => Math.abs(p.dayOfCycle - day) <= 3)
      if (closest) {
        entry[`h${idx + 1}`] = closest.ndvi
        entry[`h${idx + 1}Year`] = cycle.year
      }
    })

    // Envelope
    const envPoint = envelope.find(e => Math.abs(e.dayOfCycle - day) <= 3)
    if (envPoint) {
      entry.envMin = envPoint.min
      entry.envMax = envPoint.max
      entry.envAvg = envPoint.avg
    }

    chartData.push(entry)
  }

  return chartData
}

/**
 * Prepara dados para gráfico com eixo de data (não alinhado por ciclo)
 * Inclui histórico estimado baseado no ciclo atual
 *
 * Alinhamento histórico usa calendário agrícola simples:
 * - Mesma data do ano anterior mapeada para o ano atual
 * - Exemplo: 15/10/2024 → 15/10/2025
 */
export function prepareHistoricalOverlayData(
  currentData: NdviPoint[],
  historicalData: NdviPoint[][],
  sosDate: string | null,
  crop: string = 'SOJA',
  eosDate: string | null = null,
  plantingDate: string | null = null,
  harvestEndDate: string | null = null
): any[] {
  if (!currentData || currentData.length === 0) return []

  // Helper para obter NDVI com fallback robusto
  const getNdvi = (d: NdviPoint): number | null => {
    return d.ndvi_smooth ?? d.ndvi_interp ?? d.ndvi_raw ?? null
  }

  // Ordenar dados atuais - usar fallback para filtro
  const sorted = [...currentData]
    .filter(d => getNdvi(d) !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Criar mapa de datas para facilitar lookup
  const dateMap: Map<string, any> = new Map()

  // Adicionar dados atuais
  sorted.forEach(d => {
    dateMap.set(d.date, {
      date: d.date,
      current: getNdvi(d)
    })
  })

  // IMPORTANTE: Adicionar datas de referência (plantio, SOS, EOS) ao mapa
  // para que ReferenceLine funcione (precisa de correspondência exata)
  // NÃO adicionar current para não confundir a projeção
  const lastDataTime = sorted.length > 0 ? new Date(sorted[sorted.length - 1].date).getTime() : 0
  const firstDataTime = sorted.length > 0 ? new Date(sorted[0].date).getTime() : 0

  const referenceDates = [
    { date: plantingDate, name: 'planting' },
    { date: sosDate, name: 'sos' },
    { date: eosDate, name: 'eos' },
    { date: harvestEndDate, name: 'harvestEnd' }
  ].filter(r => r.date) as { date: string, name: string }[]

  referenceDates.forEach(ref => {
    const refTime = new Date(ref.date).getTime()

    // Só adicionar current se a data estiver DENTRO do range de dados reais
    const isWithinData = refTime >= firstDataTime && refTime <= lastDataTime

    if (!dateMap.has(ref.date)) {
      const entry: any = { date: ref.date, isReference: true }

      // Só interpolar current se estiver dentro do range de dados
      if (isWithinData) {
        let beforePoint: any = null
        let afterPoint: any = null

        for (const d of sorted) {
          const dTime = new Date(d.date).getTime()
          if (dTime <= refTime) {
            beforePoint = d
          } else if (!afterPoint && dTime > refTime) {
            afterPoint = d
            break
          }
        }

        if (beforePoint && afterPoint) {
          const t1 = new Date(beforePoint.date).getTime()
          const t2 = new Date(afterPoint.date).getTime()
          const ratio = (refTime - t1) / (t2 - t1)
          const v1 = getNdvi(beforePoint)
          const v2 = getNdvi(afterPoint)
          if (v1 !== null && v2 !== null) {
            entry.current = v1 + (v2 - v1) * ratio
          }
        } else if (beforePoint) {
          entry.current = getNdvi(beforePoint)
        }
      }

      dateMap.set(ref.date, entry)
    } else if (isWithinData) {
      // Se já existe, apenas marcar como referência
      dateMap.get(ref.date).isReference = true
    }
  })

  // ==================== ALINHAMENTO HISTÓRICO POR CALENDÁRIO ====================
  // Método simples e robusto: mesma data do ano anterior → data equivalente no ano atual
  // Exemplo: 15/10/2024 → 15/10/2025 (diferença de 1 ano exato)
  if (historicalData.length > 0) {
    // Determinar o ano base da safra atual
    // Para safra de verão: começa em set/out e vai até fev/mar do ano seguinte
    const firstCurrentDate = new Date(sorted[0].date)
    const currentSeasonYear = firstCurrentDate.getMonth() >= 7
      ? firstCurrentDate.getFullYear()
      : firstCurrentDate.getFullYear() - 1

    historicalData.forEach((hData, hIdx) => {
      if (hData.length === 0) return

      // Filtrar dados válidos
      const validHData = hData.filter(d => getNdvi(d) !== null)
      if (validHData.length < 5) return

      // Determinar o ano da safra histórica
      const firstHDate = new Date(validHData[0].date)
      const hSeasonYear = firstHDate.getMonth() >= 7
        ? firstHDate.getFullYear()
        : firstHDate.getFullYear() - 1

      // Calcular diferença em anos entre safras
      const yearDiff = currentSeasonYear - hSeasonYear

      // Mapear cada ponto histórico para o ano atual
      // Simplesmente adiciona yearDiff anos à data original
      validHData.forEach(hPoint => {
        const hPointDate = new Date(hPoint.date)

        // Adicionar yearDiff anos à data histórica
        const mappedDate = new Date(hPointDate)
        mappedDate.setFullYear(mappedDate.getFullYear() + yearDiff)
        const mappedDateStr = mappedDate.toISOString().split('T')[0]

        let entry = dateMap.get(mappedDateStr)
        if (!entry) {
          entry = { date: mappedDateStr }
          dateMap.set(mappedDateStr, entry)
        }
        entry[`h${hIdx + 1}`] = getNdvi(hPoint)
      })
    })
  }

  // Converter mapa para array e ordenar
  const chartData = Array.from(dateMap.values())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Interpolar gaps nos dados históricos para linhas contínuas
  const keys = ['h1', 'h2', 'h3']
  keys.forEach(key => {
    let lastValue: number | null = null
    let lastIdx: number = -1

    chartData.forEach((entry, idx) => {
      if (entry[key] !== undefined) {
        // Se há um gap, interpolar
        if (lastIdx >= 0 && idx - lastIdx > 1 && idx - lastIdx < 10) {
          const steps = idx - lastIdx
          for (let i = 1; i < steps; i++) {
            const ratio = i / steps
            chartData[lastIdx + i][key] = lastValue! + (entry[key] - lastValue!) * ratio
          }
        }
        lastValue = entry[key]
        lastIdx = idx
      }
    })
  })

  // Estender dados até a colheita prevista (se disponível)
  if (eosDate && chartData.length > 0) {
    const eosTime = new Date(eosDate).getTime()
    const lastDataDate = new Date(chartData[chartData.length - 1].date).getTime()
    const dayMs = 24 * 60 * 60 * 1000

    // Se EOS é após última data, estender
    if (eosTime > lastDataDate) {
      const daysToAdd = Math.ceil((eosTime - lastDataDate) / dayMs)

      for (let d = 1; d <= daysToAdd; d += 5) { // A cada 5 dias
        const newDate = new Date(lastDataDate + d * dayMs)
        const newDateStr = newDate.toISOString().split('T')[0]

        if (!dateMap.has(newDateStr)) {
          dateMap.set(newDateStr, { date: newDateStr })
        }
      }

      // Reordenar o chartData
      chartData.length = 0
      Array.from(dateMap.values())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .forEach(entry => chartData.push(entry))
    }
  }

  // Filtrar por range e preparar para projeção
  const firstCurrentDate = sorted[0]?.date
  const lastCurrentDate = sorted[sorted.length - 1]?.date

  let lastCurrentIdx = -1
  let lastCurrentValue = 0
  if (firstCurrentDate && lastCurrentDate) {
    const result = applyRangeFilter(dateMap, chartData, firstCurrentDate, lastCurrentDate, eosDate)
    chartData.length = 0
    result.chartData.forEach(d => chartData.push(d))
    lastCurrentIdx = result.lastCurrentIdx
    lastCurrentValue = result.lastCurrentValue
  } else {
    chartData.forEach((entry, idx) => {
      if (entry.current !== undefined) {
        lastCurrentIdx = idx
        lastCurrentValue = entry.current
      }
    })
  }

  // ==================== MODELO ADAPTATIVO DE PROJEÇÃO ====================
  applyAdaptiveProjection(chartData, currentData, lastCurrentIdx, lastCurrentValue)

  return chartData
}
