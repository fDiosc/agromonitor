/**
 * Cycle Analysis Service
 * Análise e alinhamento de ciclos fenológicos para comparação histórica
 */

import type { NdviPoint } from './merx.service'

// ==================== Types ====================

export interface CycleDetection {
  year: number
  sosDate: string | null
  eosDate: string | null
  peakDate: string | null
  sosDayOfYear: number | null
  eosDayOfYear: number | null
  cycleDays: number
  peakNdvi: number
  data: NdviPoint[]
}

export interface AlignedCyclePoint {
  dayOfCycle: number // 0 = SOS
  date: string
  ndvi: number
}

export interface AlignedCycle {
  year: number
  sosDate: string
  eosDate: string | null
  cycleDays: number
  peakNdvi: number
  points: AlignedCyclePoint[]
}

export interface HistoricalEnvelope {
  dayOfCycle: number
  min: number
  max: number
  avg: number
  median: number
  count: number
}

export interface CycleAnalysisResult {
  currentCycle: AlignedCycle | null
  historicalCycles: AlignedCycle[]
  envelope: HistoricalEnvelope[]
  avgCycleDays: number
  projectedEosDate: string | null
  correlationScore: number
  adherenceScore: number
}

// ==================== Configuration ====================

const CROP_THRESHOLDS: Record<string, { sosNdvi: number; eosNdvi: number; minCycle: number; maxCycle: number }> = {
  SOJA: { sosNdvi: 0.35, eosNdvi: 0.38, minCycle: 90, maxCycle: 150 },
  MILHO: { sosNdvi: 0.30, eosNdvi: 0.35, minCycle: 100, maxCycle: 160 },
  ALGODAO: { sosNdvi: 0.32, eosNdvi: 0.40, minCycle: 150, maxCycle: 200 },
  TRIGO: { sosNdvi: 0.30, eosNdvi: 0.35, minCycle: 90, maxCycle: 140 }
}

// ==================== Helper Functions ====================

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0)
  const diff = date.getTime() - start.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function movingAverage(data: number[], window: number): number[] {
  const result: number[] = []
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - Math.floor(window / 2))
    const end = Math.min(data.length, i + Math.ceil(window / 2))
    const slice = data.slice(start, end)
    result.push(slice.reduce((a, b) => a + b, 0) / slice.length)
  }
  return result
}

function detectCycleBoundaries(
  data: NdviPoint[],
  crop: string
): { sosIdx: number; eosIdx: number; peakIdx: number; peakNdvi: number } {
  const thresholds = CROP_THRESHOLDS[crop.toUpperCase()] || CROP_THRESHOLDS.SOJA
  
  // Ordenar e suavizar
  const sorted = [...data]
    .filter(d => d.ndvi_smooth !== null && d.ndvi_smooth !== undefined)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  
  if (sorted.length < 5) {
    return { sosIdx: -1, eosIdx: -1, peakIdx: -1, peakNdvi: 0 }
  }
  
  const ndviValues = sorted.map(d => d.ndvi_smooth || d.ndvi_interp || 0)
  const smoothed = movingAverage(ndviValues, 3)
  
  // Encontrar pico
  let peakNdvi = 0
  let peakIdx = -1
  smoothed.forEach((val, i) => {
    if (val > peakNdvi) {
      peakNdvi = val
      peakIdx = i
    }
  })
  
  // Encontrar SOS (antes do pico)
  let sosIdx = -1
  for (let i = peakIdx; i >= 0; i--) {
    if (smoothed[i] < thresholds.sosNdvi) {
      sosIdx = i
      break
    }
  }
  
  // Encontrar EOS (depois do pico)
  let eosIdx = -1
  for (let i = peakIdx; i < smoothed.length; i++) {
    if (smoothed[i] < thresholds.eosNdvi) {
      eosIdx = i
      break
    }
  }
  
  return { sosIdx, eosIdx, peakIdx, peakNdvi }
}

// ==================== Main Functions ====================

/**
 * Detecta ciclo fenológico em uma série de dados NDVI
 */
export function detectCycle(data: NdviPoint[], crop: string, year?: number): CycleDetection {
  const sorted = [...data]
    .filter(d => d.ndvi_smooth !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  
  const { sosIdx, eosIdx, peakIdx, peakNdvi } = detectCycleBoundaries(sorted, crop)
  
  const sosDate = sosIdx >= 0 ? sorted[sosIdx].date : null
  const eosDate = eosIdx >= 0 ? sorted[eosIdx].date : null
  const peakDate = peakIdx >= 0 ? sorted[peakIdx].date : null
  
  const sosDayOfYear = sosDate ? getDayOfYear(new Date(sosDate)) : null
  const eosDayOfYear = eosDate ? getDayOfYear(new Date(eosDate)) : null
  
  let cycleDays = 120 // default
  if (sosDate && eosDate) {
    const sosTime = new Date(sosDate).getTime()
    const eosTime = new Date(eosDate).getTime()
    cycleDays = Math.round((eosTime - sosTime) / (1000 * 60 * 60 * 24))
  }
  
  const detectedYear = year || (sorted.length > 0 ? new Date(sorted[0].date).getFullYear() : new Date().getFullYear())
  
  return {
    year: detectedYear,
    sosDate,
    eosDate,
    peakDate,
    sosDayOfYear,
    eosDayOfYear,
    cycleDays,
    peakNdvi,
    data: sorted
  }
}

/**
 * Alinha dados NDVI pelo dia do ciclo (0 = SOS)
 */
export function alignCycleData(detection: CycleDetection): AlignedCycle | null {
  if (!detection.sosDate) return null
  
  const sosTime = new Date(detection.sosDate).getTime()
  
  const points: AlignedCyclePoint[] = detection.data
    .filter(d => d.ndvi_smooth !== null)
    .map(d => {
      const dayOfCycle = Math.round(
        (new Date(d.date).getTime() - sosTime) / (1000 * 60 * 60 * 24)
      )
      return {
        dayOfCycle,
        date: d.date,
        ndvi: d.ndvi_smooth || d.ndvi_interp || 0
      }
    })
    .filter(p => p.dayOfCycle >= -10) // Incluir até 10 dias antes do SOS
    .sort((a, b) => a.dayOfCycle - b.dayOfCycle)
  
  if (points.length === 0) return null
  
  return {
    year: detection.year,
    sosDate: detection.sosDate,
    eosDate: detection.eosDate,
    cycleDays: detection.cycleDays,
    peakNdvi: detection.peakNdvi,
    points
  }
}

/**
 * Calcula envelope histórico (min, max, avg, median por dia do ciclo)
 */
export function calculateEnvelope(alignedCycles: AlignedCycle[]): HistoricalEnvelope[] {
  if (alignedCycles.length === 0) return []
  
  // Encontrar range de dias
  let minDay = 0
  let maxDay = 0
  alignedCycles.forEach(cycle => {
    cycle.points.forEach(p => {
      if (p.dayOfCycle < minDay) minDay = p.dayOfCycle
      if (p.dayOfCycle > maxDay) maxDay = p.dayOfCycle
    })
  })
  
  const envelope: HistoricalEnvelope[] = []
  
  // Para cada dia do ciclo
  for (let day = minDay; day <= maxDay; day++) {
    const values: number[] = []
    
    alignedCycles.forEach(cycle => {
      // Encontrar ponto mais próximo deste dia
      const closest = cycle.points.reduce((prev, curr) => {
        return Math.abs(curr.dayOfCycle - day) < Math.abs(prev.dayOfCycle - day) ? curr : prev
      })
      
      // Só usar se estiver dentro de 3 dias
      if (Math.abs(closest.dayOfCycle - day) <= 3) {
        values.push(closest.ndvi)
      }
    })
    
    if (values.length > 0) {
      values.sort((a, b) => a - b)
      const mid = Math.floor(values.length / 2)
      
      envelope.push({
        dayOfCycle: day,
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        median: values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2,
        count: values.length
      })
    }
  }
  
  return envelope
}

/**
 * Calcula aderência da safra atual ao envelope histórico
 */
export function calculateAdherence(
  currentCycle: AlignedCycle,
  envelope: HistoricalEnvelope[]
): number {
  if (!currentCycle || envelope.length === 0) return 50
  
  let totalScore = 0
  let count = 0
  
  currentCycle.points.forEach(point => {
    const envPoint = envelope.find(e => Math.abs(e.dayOfCycle - point.dayOfCycle) <= 2)
    if (envPoint) {
      // Score baseado na distância da média
      const range = envPoint.max - envPoint.min
      if (range > 0) {
        const distFromAvg = Math.abs(point.ndvi - envPoint.avg)
        const normalizedDist = distFromAvg / (range / 2)
        totalScore += Math.max(0, 100 - normalizedDist * 50)
        count++
      }
    }
  })
  
  return count > 0 ? Math.round(totalScore / count) : 50
}

/**
 * Projeta EOS baseado no histórico
 */
export function projectEos(
  currentCycle: AlignedCycle,
  historicalCycles: AlignedCycle[]
): { projectedEosDate: string; avgCycleDays: number; confidence: number } | null {
  if (!currentCycle || historicalCycles.length === 0) return null
  
  // Calcular média de dias do ciclo histórico
  const cycleDaysArray = historicalCycles
    .filter(c => c.eosDate)
    .map(c => c.cycleDays)
  
  if (cycleDaysArray.length === 0) return null
  
  const avgCycleDays = Math.round(
    cycleDaysArray.reduce((a, b) => a + b, 0) / cycleDaysArray.length
  )
  
  // Projetar EOS
  const sosDate = new Date(currentCycle.sosDate)
  const projectedEos = new Date(sosDate)
  projectedEos.setDate(projectedEos.getDate() + avgCycleDays)
  
  // Confidence baseada no desvio padrão
  const variance = cycleDaysArray.reduce((sum, days) => {
    return sum + Math.pow(days - avgCycleDays, 2)
  }, 0) / cycleDaysArray.length
  const stdDev = Math.sqrt(variance)
  const confidence = Math.max(30, Math.min(95, 100 - stdDev * 2))
  
  return {
    projectedEosDate: projectedEos.toISOString().split('T')[0],
    avgCycleDays,
    confidence: Math.round(confidence)
  }
}

/**
 * Análise completa de ciclo com histórico
 */
export function analyzeCycles(
  currentData: NdviPoint[],
  historicalData: NdviPoint[][],
  crop: string = 'SOJA'
): CycleAnalysisResult {
  // Detectar ciclo atual
  const currentDetection = detectCycle(currentData, crop, new Date().getFullYear())
  const currentCycle = alignCycleData(currentDetection)
  
  // Processar histórico
  const historicalCycles: AlignedCycle[] = []
  historicalData.forEach((data, idx) => {
    if (data.length > 0) {
      const year = new Date().getFullYear() - (idx + 1)
      const detection = detectCycle(data, crop, year)
      const aligned = alignCycleData(detection)
      if (aligned) {
        historicalCycles.push(aligned)
      }
    }
  })
  
  // Calcular envelope
  const envelope = calculateEnvelope(historicalCycles)
  
  // Calcular aderência
  const adherenceScore = currentCycle 
    ? calculateAdherence(currentCycle, envelope)
    : 50
  
  // Projetar EOS
  const projection = currentCycle 
    ? projectEos(currentCycle, historicalCycles)
    : null
  
  // Correlação = média de (100 - |diff de NDVI| * 100) para cada ponto
  let correlationScore = 50
  if (currentCycle && envelope.length > 0) {
    let sumCorr = 0
    let countCorr = 0
    currentCycle.points.forEach(p => {
      const envPoint = envelope.find(e => Math.abs(e.dayOfCycle - p.dayOfCycle) <= 2)
      if (envPoint) {
        const diff = Math.abs(p.ndvi - envPoint.avg)
        sumCorr += Math.max(0, 100 - diff * 150)
        countCorr++
      }
    })
    correlationScore = countCorr > 0 ? Math.round(sumCorr / countCorr) : 50
  }
  
  return {
    currentCycle,
    historicalCycles,
    envelope,
    avgCycleDays: projection?.avgCycleDays || 120,
    projectedEosDate: projection?.projectedEosDate || null,
    correlationScore,
    adherenceScore
  }
}

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
  
  // Processar histórico
  if (historicalData.length > 0) {
    // Determinar SOS da safra atual
    let currentSosTime: number | null = null
    if (sosDate) {
      currentSosTime = new Date(sosDate).getTime()
    } else {
      // Tentar detectar SOS dos dados atuais
      const currentDetection = detectCycle(currentData, crop)
      if (currentDetection.sosDate) {
        currentSosTime = new Date(currentDetection.sosDate).getTime()
      }
    }
    
    historicalData.forEach((hData, hIdx) => {
      if (hData.length === 0) return
      
      // Filtrar dados válidos - usar fallback robusto
      const validHData = hData.filter(d => getNdvi(d) !== null)
      if (validHData.length < 5) return
      
      // Detectar SOS do histórico
      const hDetection = detectCycle(validHData, crop)
      
      // Se não conseguir detectar SOS, usar o primeiro ponto acima de 0.3
      let hSosTime: number | null = null
      if (hDetection.sosDate) {
        hSosTime = new Date(hDetection.sosDate).getTime()
      } else {
        // Fallback: encontrar primeiro ponto com NDVI > 0.3
        const firstHigh = validHData.find(d => (getNdvi(d) || 0) > 0.3)
        if (firstHigh) {
          hSosTime = new Date(firstHigh.date).getTime()
        }
      }
      
      if (!hSosTime || !currentSosTime) {
        // Sem SOS detectável, alinhar pelo início dos dados
        const currentStart = new Date(sorted[0].date).getTime()
        const hStart = new Date(validHData[0].date).getTime()
        
        validHData.forEach(hPoint => {
          const hPointTime = new Date(hPoint.date).getTime()
          const daysSinceStart = Math.round((hPointTime - hStart) / (1000 * 60 * 60 * 24))
          const mappedTime = currentStart + daysSinceStart * 24 * 60 * 60 * 1000
          const mappedDate = new Date(mappedTime).toISOString().split('T')[0]
          
          let entry = dateMap.get(mappedDate)
          if (!entry) {
            entry = { date: mappedDate }
            dateMap.set(mappedDate, entry)
          }
          entry[`h${hIdx + 1}`] = getNdvi(hPoint)
        })
      } else {
        // Alinhar pelo SOS
        validHData.forEach(hPoint => {
          const hPointTime = new Date(hPoint.date).getTime()
          const daysSinceHSos = Math.round((hPointTime - hSosTime!) / (1000 * 60 * 60 * 24))
          const mappedTime = currentSosTime! + daysSinceHSos * 24 * 60 * 60 * 1000
          const mappedDate = new Date(mappedTime).toISOString().split('T')[0]
          
          let entry = dateMap.get(mappedDate)
          if (!entry) {
            entry = { date: mappedDate }
            dateMap.set(mappedDate, entry)
          }
          entry[`h${hIdx + 1}`] = getNdvi(hPoint)
        })
      }
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
  
  // Calcular linha de PROJEÇÃO baseada na média histórica
  // Encontrar último ponto com dados atuais
  let lastCurrentIdx = -1
  let lastCurrentValue = 0
  chartData.forEach((entry, idx) => {
    if (entry.current !== undefined) {
      lastCurrentIdx = idx
      lastCurrentValue = entry.current
    }
  })
  
  // FILTRAR: Manter apenas pontos dentro do range relevante
  // Começar 15 dias antes do primeiro dado atual
  // Terminar na data de EOS ou 60 dias após último dado atual
  const firstCurrentDate = sorted[0]?.date
  const lastCurrentDate = sorted[sorted.length - 1]?.date
  
  if (firstCurrentDate && lastCurrentDate) {
    const rangeStart = new Date(firstCurrentDate)
    rangeStart.setDate(rangeStart.getDate() - 15)
    const rangeStartStr = rangeStart.toISOString().split('T')[0]
    
    let rangeEnd: Date
    if (eosDate) {
      rangeEnd = new Date(eosDate)
      rangeEnd.setDate(rangeEnd.getDate() + 7) // 7 dias após EOS
    } else {
      rangeEnd = new Date(lastCurrentDate)
      rangeEnd.setDate(rangeEnd.getDate() + 60) // 60 dias após último dado
    }
    const rangeEndStr = rangeEnd.toISOString().split('T')[0]
    
    // Garantir que existam pontos intermediários para projeção
    // Criar pontos a cada 1 dia do último dado até o fim do range
    const lastCurrentTime = new Date(lastCurrentDate).getTime()
    const rangeEndTime = rangeEnd.getTime()
    const dayMs = 24 * 60 * 60 * 1000
    
    for (let t = lastCurrentTime + dayMs; t <= rangeEndTime; t += dayMs) {
      const dateStr = new Date(t).toISOString().split('T')[0]
      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, { date: dateStr })
      }
    }
    
    // Reconstruir chartData com os novos pontos
    chartData.length = 0
    Array.from(dateMap.values())
      .filter(d => d.date >= rangeStartStr && d.date <= rangeEndStr)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .forEach(d => chartData.push(d))
    
    // Recalcular lastCurrentIdx após reconstrução
    lastCurrentIdx = -1
    lastCurrentValue = 0
    chartData.forEach((entry, idx) => {
      if (entry.current !== undefined) {
        lastCurrentIdx = idx
        lastCurrentValue = entry.current
      }
    })
  }
  
  // Gerar projeção a partir do último ponto atual até o fim
  if (lastCurrentIdx >= 0 && lastCurrentIdx < chartData.length - 1) {
    // Primeiro ponto da projeção = último valor atual (para continuidade)
    chartData[lastCurrentIdx].projection = lastCurrentValue
    
    // Calcular curva de projeção típica
    // Baseado no ciclo fenológico: plateau -> senescência -> colheita
    const remainingPoints = chartData.length - lastCurrentIdx - 1
    
    for (let i = lastCurrentIdx + 1; i < chartData.length; i++) {
      const entry = chartData[i]
      const progressIdx = i - lastCurrentIdx
      
      // Calcular média dos históricos disponíveis neste ponto
      const historicalValues: number[] = []
      keys.forEach(key => {
        if (entry[key] !== undefined && entry[key] !== null) {
          historicalValues.push(entry[key])
        }
      })
      
      if (historicalValues.length > 0) {
        // Usar média histórica
        entry.projection = historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length
      } else {
        // Modelo de senescência típico (curva logística inversa)
        // Fase 1 (0-30%): manutenção/platô
        // Fase 2 (30-80%): senescência acelerada
        // Fase 3 (80-100%): estabilização baixa
        const progress = progressIdx / remainingPoints
        
        let decay: number
        if (progress < 0.3) {
          // Platô - pequeno declínio
          decay = progress * 0.1
        } else if (progress < 0.8) {
          // Senescência principal
          const senProgress = (progress - 0.3) / 0.5
          decay = 0.03 + senProgress * 0.6
        } else {
          // Estabilização
          const finalProgress = (progress - 0.8) / 0.2
          decay = 0.63 + finalProgress * 0.15
        }
        
        entry.projection = Math.max(0.2, lastCurrentValue * (1 - decay))
      }
    }
  }
  
  return chartData
}
