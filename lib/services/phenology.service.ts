/**
 * Phenology Service
 * Cálculo de fenologia com limiares adaptativos por cultura
 */

import type { NdviPoint } from './merx.service'

// ==================== Types ====================

export interface PhenologyConfig {
  crop: string
  areaHa: number
  // Data de plantio informada pelo produtor (opcional)
  // Se fornecida, será usada como base confiável para os cálculos
  plantingDateInput?: string | null
}

export interface PhenologyDiagnostic {
  type: 'INFO' | 'WARNING' | 'ERROR'
  code: string
  message: string
  date?: string
}

export interface PhenologyResult {
  plantingDate: string | null
  sosDate: string | null
  eosDate: string | null
  peakDate: string | null
  cycleDays: number
  
  detectedReplanting: boolean
  replantingDate: string | null
  yieldEstimateKg: number
  yieldEstimateKgHa: number
  phenologyHealth: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'
  peakNdvi: number
  
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  confidenceScore: number
  method: 'ALGORITHM' | 'PROJECTION'
  historicalCorrelation: number
  
  diagnostics: PhenologyDiagnostic[]
}

interface CropThresholds {
  sosNdvi: number
  eosNdvi: number
  peakMinNdvi: number
  cycleDays: number
  emergenceDays: number
  baseYieldKgHa: number
}

// ==================== Configuration ====================

const CROP_THRESHOLDS: Record<string, CropThresholds> = {
  SOJA: {
    sosNdvi: 0.35,
    eosNdvi: 0.38,
    peakMinNdvi: 0.70,
    cycleDays: 120,
    emergenceDays: 8,
    baseYieldKgHa: 3500
  },
  MILHO: {
    sosNdvi: 0.30,
    eosNdvi: 0.35,
    peakMinNdvi: 0.65,
    cycleDays: 140,
    emergenceDays: 7,
    baseYieldKgHa: 9000
  },
  ALGODAO: {
    sosNdvi: 0.32,
    eosNdvi: 0.40,
    peakMinNdvi: 0.60,
    cycleDays: 180,
    emergenceDays: 10,
    baseYieldKgHa: 4500
  },
  TRIGO: {
    sosNdvi: 0.30,
    eosNdvi: 0.35,
    peakMinNdvi: 0.65,
    cycleDays: 120,
    emergenceDays: 7,
    baseYieldKgHa: 3000
  }
}

// ==================== Helper Functions ====================

function getThresholds(crop: string): CropThresholds {
  return CROP_THRESHOLDS[crop.toUpperCase()] || CROP_THRESHOLDS.SOJA
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

function detectReplanting(
  smoothed: number[],
  thresholds: CropThresholds
): { detected: boolean; index: number } {
  // Procura por queda > 0.2 seguida de subida > 0.15 em janela de 30 dias
  for (let i = 5; i < smoothed.length - 5; i++) {
    const before = smoothed[i - 5]
    const current = smoothed[i]
    const after = smoothed[i + 5]

    if (before > 0.5 && current < 0.35 && after > 0.5) {
      return { detected: true, index: i }
    }
  }
  return { detected: false, index: -1 }
}

function calculateCorrelation(current: number[], historyAvg: number[]): number {
  const n = Math.min(current.length, historyAvg.length)
  if (n < 3) return 50

  let sumDiff = 0
  for (let i = 0; i < n; i++) {
    sumDiff += Math.abs(current[i] - historyAvg[i])
  }

  const avgDiff = sumDiff / n
  return Math.max(0, Math.min(100, Math.round((1 - avgDiff * 1.5) * 100)))
}

/**
 * Detecta tendência de senescência usando regressão linear
 * Retorna dados para cálculo dinâmico de EOS
 */
function detectSenescenceTrend(
  data: NdviPoint[],
  peakIdx: number,
  windowDays: number = 14
): {
  isSenescence: boolean
  slope: number
  rSquared: number
  lastNdvi: number
  lastDate: string
} | null {
  if (data.length < 10 || peakIdx < 0) return null

  // Pegar dados após o pico
  const afterPeak = data.slice(peakIdx)
  if (afterPeak.length < 5) return null

  // Pegar últimos N pontos
  const lastN = afterPeak.slice(-windowDays)
  if (lastN.length < 5) return null

  // Regressão linear
  const baseTime = new Date(lastN[0].date).getTime()
  const dayMs = 24 * 60 * 60 * 1000

  const points = lastN.map(p => ({
    x: (new Date(p.date).getTime() - baseTime) / dayMs,
    y: p.ndvi_smooth || p.ndvi_interp || 0
  }))

  const n = points.length
  const sumX = points.reduce((s, p) => s + p.x, 0)
  const sumY = points.reduce((s, p) => s + p.y, 0)
  const meanX = sumX / n
  const meanY = sumY / n

  let ssXY = 0, ssXX = 0, ssYY = 0
  points.forEach(p => {
    const dx = p.x - meanX
    const dy = p.y - meanY
    ssXY += dx * dy
    ssXX += dx * dx
    ssYY += dy * dy
  })

  if (ssXX === 0) return null

  const slope = ssXY / ssXX
  const rSquared = ssYY > 0 ? Math.pow(ssXY, 2) / (ssXX * ssYY) : 0

  const lastPoint = lastN[lastN.length - 1]
  const lastNdvi = lastPoint.ndvi_smooth || lastPoint.ndvi_interp || 0
  const peakNdvi = data[peakIdx].ndvi_smooth || data[peakIdx].ndvi_interp || 0

  // Critérios para senescência:
  // 1. slope < -0.01 (queda de pelo menos 1%/dia)
  // 2. R² > 0.7 (tendência consistente)
  // 3. NDVI atual < 85% do pico (passou do máximo)
  const isSenescence = 
    slope < -0.01 && 
    rSquared > 0.7 && 
    lastNdvi < peakNdvi * 0.85

  return {
    isSenescence,
    slope,
    rSquared,
    lastNdvi,
    lastDate: lastPoint.date
  }
}

/**
 * Calcula EOS dinâmico baseado em modelo exponencial
 * Retorna a data quando a projeção cruza o threshold de EOS
 */
function calculateDynamicEos(
  lastNdvi: number,
  lastDate: string,
  slope: number,
  eosThreshold: number,
  minNdvi: number = 0.18
): string | null {
  // Modelo exponencial: NDVI(t) = MIN + (NDVI_0 - MIN) * e^(-k*t)
  // Resolver para t quando NDVI(t) = threshold
  
  if (lastNdvi <= eosThreshold) {
    // Já está abaixo do threshold
    return lastDate
  }

  // Taxa de decaimento
  const decayRate = Math.abs(slope) / Math.max(0.3, lastNdvi - minNdvi)
  
  // Resolver: threshold = MIN + (lastNdvi - MIN) * e^(-k*t)
  // (threshold - MIN) / (lastNdvi - MIN) = e^(-k*t)
  // t = -ln((threshold - MIN) / (lastNdvi - MIN)) / k
  
  const ratio = (eosThreshold - minNdvi) / (lastNdvi - minNdvi)
  
  if (ratio <= 0 || ratio >= 1) {
    // Matematicamente impossível
    return null
  }
  
  const daysToEos = -Math.log(ratio) / decayRate
  
  // Limitar a 60 dias no máximo
  if (daysToEos > 60 || daysToEos < 0) {
    return null
  }
  
  const eosDate = new Date(lastDate)
  eosDate.setDate(eosDate.getDate() + Math.round(daysToEos))
  
  return eosDate.toISOString().split('T')[0]
}

function estimateYield(maxNdvi: number, areaHa: number, crop: string): number {
  const thresholds = getThresholds(crop)
  
  // Fator de ajuste baseado no NDVI máximo
  // NDVI 0.8+ = 100% do potencial, 0.6 = ~75%, etc
  const ndviFactor = Math.min(1, Math.max(0.3, (maxNdvi - 0.3) / 0.5))
  
  return Math.round(thresholds.baseYieldKgHa * ndviFactor * areaHa)
}

function assessPhenologyHealth(
  maxNdvi: number,
  correlation: number,
  method: 'ALGORITHM' | 'PROJECTION',
  diagnostics: PhenologyDiagnostic[]
): 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' {
  const errorCount = diagnostics.filter(d => d.type === 'ERROR').length
  const warningCount = diagnostics.filter(d => d.type === 'WARNING').length

  if (errorCount > 0) return 'POOR'
  if (maxNdvi >= 0.75 && correlation >= 70 && method === 'ALGORITHM' && warningCount === 0) {
    return 'EXCELLENT'
  }
  if (maxNdvi >= 0.65 && correlation >= 50) return 'GOOD'
  if (maxNdvi >= 0.50 || warningCount <= 1) return 'FAIR'
  return 'POOR'
}

function calculateConfidenceScore(params: {
  hasSos: boolean
  hasEos: boolean
  hasPeak: boolean
  method: 'ALGORITHM' | 'PROJECTION'
  correlation: number
  dataPoints: number
  peakNdvi: number
  peakMinNdvi: number
  hasInputPlantingDate?: boolean
}): number {
  let score = 10

  // Bônus grande se plantio foi informado pelo produtor
  if (params.hasInputPlantingDate) {
    score += 25 // Data confiável do produtor
  }

  if (params.hasSos) score += 20
  if (params.hasEos) score += 15
  if (params.hasPeak) score += 15
  if (params.method === 'ALGORITHM') score += 10 // Reduzido pois plantio informado também conta
  if (params.correlation > 70) score += 10
  if (params.dataPoints >= 20) score += 5
  if (params.peakNdvi >= params.peakMinNdvi) score += 5

  return Math.min(100, score)
}

// ==================== Main Function ====================

export function calculatePhenology(
  ndviData: NdviPoint[],
  historicalData: NdviPoint[][],
  config: PhenologyConfig
): PhenologyResult {
  const diagnostics: PhenologyDiagnostic[] = []
  const thresholds = getThresholds(config.crop)

  // Resultado padrão
  const defaultResult: PhenologyResult = {
    plantingDate: null,
    sosDate: null,
    eosDate: null,
    peakDate: null,
    cycleDays: thresholds.cycleDays,
    detectedReplanting: false,
    replantingDate: null,
    yieldEstimateKg: config.areaHa * thresholds.baseYieldKgHa,
    yieldEstimateKgHa: thresholds.baseYieldKgHa,
    phenologyHealth: 'POOR',
    peakNdvi: 0,
    confidence: 'LOW',
    confidenceScore: 10,
    method: 'PROJECTION',
    historicalCorrelation: 50,
    diagnostics: [{
      type: 'ERROR',
      code: 'INSUFFICIENT_DATA',
      message: 'Dados insuficientes para análise'
    }]
  }

  if (!ndviData || ndviData.length < 5) {
    return defaultResult
  }

  // Ordenar e filtrar dados válidos
  const sorted = [...ndviData]
    .filter(d => d.ndvi_smooth !== null && d.ndvi_smooth !== undefined)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  if (sorted.length < 5) {
    diagnostics.push({
      type: 'WARNING',
      code: 'FEW_POINTS',
      message: `Apenas ${sorted.length} pontos válidos de NDVI`
    })
    return { ...defaultResult, diagnostics }
  }

  // Suavização adicional
  const ndviValues = sorted.map(d => d.ndvi_smooth || d.ndvi_interp || 0)
  const smoothed = movingAverage(ndviValues, 3)

  // Detectar pico
  let maxVal = 0
  let peakIdx = -1
  smoothed.forEach((val, i) => {
    if (val > maxVal) {
      maxVal = val
      peakIdx = i
    }
  })

  // Verificar se pico é válido
  if (maxVal < thresholds.peakMinNdvi) {
    diagnostics.push({
      type: 'WARNING',
      code: 'LOW_PEAK',
      message: `NDVI máximo (${maxVal.toFixed(2)}) abaixo do esperado (${thresholds.peakMinNdvi})`
    })
  }

  // Detectar SOS (Start of Season)
  let sosIdx = -1
  for (let i = peakIdx; i >= 0; i--) {
    if (smoothed[i] < thresholds.sosNdvi) {
      sosIdx = i
      break
    }
  }

  // Detectar EOS (End of Season)
  let eosIdx = -1
  for (let i = peakIdx; i < smoothed.length; i++) {
    if (smoothed[i] < thresholds.eosNdvi) {
      eosIdx = i
      break
    }
  }

  // Detectar replantio
  const replanting = detectReplanting(smoothed, thresholds)
  if (replanting.detected) {
    diagnostics.push({
      type: 'WARNING',
      code: 'REPLANTING_DETECTED',
      message: 'Possível replantio detectado',
      date: sorted[replanting.index]?.date
    })
  }

  // Calcular datas
  const sosDateDetected = sosIdx >= 0 ? sorted[sosIdx].date : null
  const eosDateDetected = eosIdx >= 0 ? sorted[eosIdx].date : null
  const peakDate = peakIdx >= 0 ? sorted[peakIdx].date : null

  // Se o produtor informou a data de plantio, usar como base confiável
  let plantingDate: string | null = null
  let sosDate: string | null = null
  let method: 'ALGORITHM' | 'PROJECTION' = 'ALGORITHM'
  let hasInputPlantingDate = false

  if (config.plantingDateInput) {
    // Usar data informada pelo produtor como base
    plantingDate = config.plantingDateInput
    hasInputPlantingDate = true
    
    // Calcular SOS a partir da data de plantio + dias de emergência
    const sosEstimated = new Date(plantingDate)
    sosEstimated.setDate(sosEstimated.getDate() + thresholds.emergenceDays)
    sosDate = sosEstimated.toISOString().split('T')[0]
    
    diagnostics.push({
      type: 'INFO',
      code: 'PLANTING_DATE_PROVIDED',
      message: `Data de plantio informada pelo produtor: ${plantingDate}`,
      date: plantingDate
    })
  } else {
    // Estimar plantio a partir do SOS detectado
    sosDate = sosDateDetected
    if (sosDate) {
      const d = new Date(sosDate)
      d.setDate(d.getDate() - thresholds.emergenceDays)
      plantingDate = d.toISOString().split('T')[0]
    }
  }

  // Usar EOS detectado ou calcular dinamicamente
  let projectedEosDate = eosDateDetected
  let usedDynamicEos = false
  
  if (!eosDateDetected) {
    method = 'PROJECTION'
    
    // Tentar calcular EOS dinâmico baseado em tendência de senescência
    const senescenceTrend = detectSenescenceTrend(sorted, peakIdx)
    
    if (senescenceTrend && senescenceTrend.isSenescence) {
      // Calcular EOS dinâmico usando modelo exponencial
      const dynamicEos = calculateDynamicEos(
        senescenceTrend.lastNdvi,
        senescenceTrend.lastDate,
        senescenceTrend.slope,
        thresholds.eosNdvi
      )
      
      if (dynamicEos) {
        projectedEosDate = dynamicEos
        usedDynamicEos = true
        
        diagnostics.push({
          type: 'INFO',
          code: 'EOS_DYNAMIC_SENESCENCE',
          message: `Colheita calculada por tendência de senescência (R²=${(senescenceTrend.rSquared * 100).toFixed(0)}%, slope=${(senescenceTrend.slope * 100).toFixed(1)}%/dia)`,
          date: dynamicEos
        })
      }
    }
    
    // Fallback: projetar a partir do plantio se EOS dinâmico não foi calculado
    if (!projectedEosDate && plantingDate) {
      const ed = new Date(plantingDate)
      ed.setDate(ed.getDate() + thresholds.cycleDays)
      projectedEosDate = ed.toISOString().split('T')[0]
      
      diagnostics.push({
        type: 'INFO',
        code: 'EOS_PROJECTED_CYCLE',
        message: `Colheita projetada pelo ciclo típico (${thresholds.cycleDays} dias)`
      })
    }
  }

  // Se plantio foi informado e não há EOS detectado/dinâmico, ainda é confiável
  if (hasInputPlantingDate && !eosDateDetected && !usedDynamicEos) {
    method = 'PROJECTION' // Mas com base sólida
    diagnostics.push({
      type: 'INFO',
      code: 'EOS_PROJECTED_FROM_INPUT',
      message: `Colheita projetada a partir da data de plantio informada`
    })
  }

  // Calcular correlação histórica
  let correlation = 50
  if (historicalData.length > 0) {
    const historyAvgs = smoothed.map((_, idx) => {
      let sum = 0
      let count = 0
      historicalData.forEach(h => {
        if (h[idx]) {
          sum += h[idx].ndvi_smooth || h[idx].ndvi_interp || 0
          count++
        }
      })
      return count > 0 ? sum / count : 0.5
    })
    correlation = calculateCorrelation(smoothed, historyAvgs)
  }

  // Estimar produtividade
  const yieldEstimateKg = estimateYield(maxVal, config.areaHa, config.crop)
  const yieldEstimateKgHa = config.areaHa > 0 ? yieldEstimateKg / config.areaHa : 0

  // Calcular score de confiança
  const score = calculateConfidenceScore({
    hasSos: !!sosDate,
    hasEos: !!eosDateDetected,
    hasPeak: peakIdx >= 0,
    method,
    correlation,
    dataPoints: sorted.length,
    peakNdvi: maxVal,
    peakMinNdvi: thresholds.peakMinNdvi,
    hasInputPlantingDate
  })

  // Avaliar saúde fenológica
  const health = assessPhenologyHealth(maxVal, correlation, method, diagnostics)

  return {
    plantingDate,
    sosDate,
    eosDate: projectedEosDate,
    peakDate,
    cycleDays: thresholds.cycleDays,
    detectedReplanting: replanting.detected,
    replantingDate: replanting.detected && replanting.index >= 0 
      ? sorted[replanting.index].date 
      : null,
    yieldEstimateKg,
    yieldEstimateKgHa,
    phenologyHealth: health,
    peakNdvi: maxVal,
    confidence: score > 75 ? 'HIGH' : score > 40 ? 'MEDIUM' : 'LOW',
    confidenceScore: score,
    method,
    historicalCorrelation: correlation,
    diagnostics
  }
}
