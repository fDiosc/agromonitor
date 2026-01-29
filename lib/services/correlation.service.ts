/**
 * Correlation Service
 * Cálculo robusto de correlação histórica para séries NDVI
 * 
 * OBJETIVO: Determinar quão similar a safra atual está em relação às safras passadas
 * 
 * MÉTRICAS:
 * 1. Correlação de Pearson: Mede similaridade de FORMA da curva (-1 a 1)
 * 2. RMSE: Mede diferença absoluta média (menor = melhor)
 * 3. Aderência: % de pontos dentro do envelope histórico
 */

import type { NdviPoint } from './merx.service'

// ==================== Types ====================

export interface CorrelationResult {
  // Correlação de Pearson (0-100, onde 100 = perfeitamente correlacionado)
  pearsonScore: number
  
  // RMSE normalizado (0-100, onde 100 = erro zero)
  rmseScore: number
  
  // Aderência ao envelope (0-100, % de pontos dentro do histórico)
  adherenceScore: number
  
  // Score composto (média ponderada)
  compositeScore: number
  
  // Metadados
  numPointsCompared: number
  numHistoricalYears: number
  alignmentMethod: 'SOS' | 'DATE' | 'INDEX'
  
  // Diagnóstico
  warnings: string[]
}

export interface AlignedPoint {
  dayOfCycle: number  // Dias desde SOS (ou desde início se SOS não detectável)
  date: string
  current: number
  historical: number[]  // Valor de cada ano histórico
  historicalAvg: number
  historicalMin: number
  historicalMax: number
}

// ==================== Correlation Functions ====================

/**
 * Correlação de Pearson entre duas séries
 */
function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length)
  if (n < 3) return 0
  
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0
  
  for (let i = 0; i < n; i++) {
    sumX += x[i]
    sumY += y[i]
    sumXY += x[i] * y[i]
    sumX2 += x[i] * x[i]
    sumY2 += y[i] * y[i]
  }
  
  const numerator = n * sumXY - sumX * sumY
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  )
  
  if (denominator === 0) return 0
  
  return numerator / denominator
}

/**
 * RMSE (Root Mean Square Error) normalizado
 */
function normalizedRMSE(actual: number[], predicted: number[]): number {
  const n = Math.min(actual.length, predicted.length)
  if (n === 0) return 1
  
  let sumSquaredError = 0
  for (let i = 0; i < n; i++) {
    sumSquaredError += Math.pow(actual[i] - predicted[i], 2)
  }
  
  const rmse = Math.sqrt(sumSquaredError / n)
  
  // Normalizar: NDVI varia de 0 a 1, então RMSE máximo teórico é 1
  return Math.min(1, rmse)
}

/**
 * Detecta ponto de emergência (SOS) em série NDVI
 */
function detectSOS(data: NdviPoint[], threshold: number = 0.35): { date: string; index: number } | null {
  const sorted = [...data]
    .filter(d => d.ndvi_smooth !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  
  if (sorted.length < 5) return null
  
  // Encontrar pico primeiro
  let maxNdvi = 0
  let peakIdx = 0
  sorted.forEach((d, i) => {
    const val = d.ndvi_smooth || 0
    if (val > maxNdvi) {
      maxNdvi = val
      peakIdx = i
    }
  })
  
  // Se pico muito baixo, não há safra
  if (maxNdvi < 0.5) return null
  
  // Procurar SOS (último ponto abaixo do threshold antes do pico)
  for (let i = peakIdx; i >= 0; i--) {
    const val = sorted[i].ndvi_smooth || 0
    if (val < threshold) {
      return { date: sorted[i].date, index: i }
    }
  }
  
  // Fallback: usar primeiro ponto
  return { date: sorted[0].date, index: 0 }
}

/**
 * Alinha série NDVI por dia do ciclo (dias desde SOS)
 */
function alignByDayOfCycle(
  data: NdviPoint[], 
  sosDate: string
): { dayOfCycle: number; ndvi: number; date: string }[] {
  const sosTime = new Date(sosDate).getTime()
  const dayMs = 24 * 60 * 60 * 1000
  
  return data
    .filter(d => d.ndvi_smooth !== null)
    .map(d => ({
      dayOfCycle: Math.round((new Date(d.date).getTime() - sosTime) / dayMs),
      ndvi: d.ndvi_smooth || d.ndvi_interp || 0,
      date: d.date
    }))
    .sort((a, b) => a.dayOfCycle - b.dayOfCycle)
}

// ==================== Main Function ====================

/**
 * Calcula correlação histórica robusta
 */
export function calculateHistoricalCorrelation(
  currentData: NdviPoint[],
  historicalData: NdviPoint[][],
  options: {
    sosThreshold?: number
    minPointsForCorrelation?: number
  } = {}
): CorrelationResult {
  const { sosThreshold = 0.35, minPointsForCorrelation = 5 } = options
  const warnings: string[] = []
  
  // Resultado padrão
  const defaultResult: CorrelationResult = {
    pearsonScore: 50,
    rmseScore: 50,
    adherenceScore: 50,
    compositeScore: 50,
    numPointsCompared: 0,
    numHistoricalYears: 0,
    alignmentMethod: 'INDEX',
    warnings: ['Dados insuficientes para correlação']
  }
  
  // Validar dados atuais
  const validCurrent = currentData.filter(d => d.ndvi_smooth !== null)
  if (validCurrent.length < minPointsForCorrelation) {
    return defaultResult
  }
  
  // Validar histórico
  const validHistorical = historicalData.filter(h => 
    h.filter(d => d.ndvi_smooth !== null).length >= minPointsForCorrelation
  )
  if (validHistorical.length === 0) {
    warnings.push('Nenhum ano histórico com dados suficientes')
    return { ...defaultResult, warnings }
  }
  
  // Detectar SOS da safra atual
  const currentSos = detectSOS(validCurrent, sosThreshold)
  
  // Preparar dados alinhados
  let alignedPoints: AlignedPoint[] = []
  let alignmentMethod: 'SOS' | 'DATE' | 'INDEX' = 'INDEX'
  
  if (currentSos) {
    // MÉTODO 1: Alinhar por SOS (preferido)
    alignmentMethod = 'SOS'
    
    const currentAligned = alignByDayOfCycle(validCurrent, currentSos.date)
    
    // Para cada ano histórico, detectar SOS e alinhar
    const historicalAligned: { dayOfCycle: number; ndvi: number }[][] = []
    
    validHistorical.forEach((hData, hIdx) => {
      const hSos = detectSOS(hData, sosThreshold)
      
      if (hSos) {
        historicalAligned.push(alignByDayOfCycle(hData, hSos.date))
      } else {
        warnings.push(`Ano -${hIdx + 1}: SOS não detectado, usando alinhamento por data`)
        // Fallback: alinhar pelo início dos dados
        const firstDate = [...hData]
          .filter(d => d.ndvi_smooth !== null)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]?.date
        
        if (firstDate) {
          historicalAligned.push(alignByDayOfCycle(hData, firstDate))
        }
      }
    })
    
    // Criar pontos alinhados
    const allDays = new Set<number>()
    currentAligned.forEach(p => allDays.add(p.dayOfCycle))
    
    Array.from(allDays).sort((a, b) => a - b).forEach(day => {
      const currentPoint = currentAligned.find(p => Math.abs(p.dayOfCycle - day) <= 2)
      if (!currentPoint) return
      
      const historicalValues: number[] = []
      historicalAligned.forEach(hAligned => {
        const hPoint = hAligned.find(p => Math.abs(p.dayOfCycle - day) <= 3)
        if (hPoint) {
          historicalValues.push(hPoint.ndvi)
        }
      })
      
      if (historicalValues.length > 0) {
        alignedPoints.push({
          dayOfCycle: day,
          date: currentPoint.date,
          current: currentPoint.ndvi,
          historical: historicalValues,
          historicalAvg: historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length,
          historicalMin: Math.min(...historicalValues),
          historicalMax: Math.max(...historicalValues)
        })
      }
    })
  }
  
  // FALLBACK: Se alinhamento por SOS falhou ou deu poucos pontos
  if (alignedPoints.length < minPointsForCorrelation) {
    warnings.push('Alinhamento por SOS insuficiente, usando alinhamento por índice')
    alignmentMethod = 'INDEX'
    alignedPoints = []
    
    const sortedCurrent = [...validCurrent]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    
    sortedCurrent.forEach((pt, idx) => {
      const historicalValues: number[] = []
      
      validHistorical.forEach(hData => {
        const sortedH = [...hData]
          .filter(d => d.ndvi_smooth !== null)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        
        if (sortedH[idx]) {
          historicalValues.push(sortedH[idx].ndvi_smooth || sortedH[idx].ndvi_interp || 0)
        }
      })
      
      if (historicalValues.length > 0) {
        alignedPoints.push({
          dayOfCycle: idx,
          date: pt.date,
          current: pt.ndvi_smooth || pt.ndvi_interp || 0,
          historical: historicalValues,
          historicalAvg: historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length,
          historicalMin: Math.min(...historicalValues),
          historicalMax: Math.max(...historicalValues)
        })
      }
    })
  }
  
  // Verificar se temos pontos suficientes
  if (alignedPoints.length < minPointsForCorrelation) {
    warnings.push(`Apenas ${alignedPoints.length} pontos alinhados`)
    return {
      ...defaultResult,
      numPointsCompared: alignedPoints.length,
      numHistoricalYears: validHistorical.length,
      alignmentMethod,
      warnings
    }
  }
  
  // ==================== CÁLCULO DAS MÉTRICAS ====================
  
  const currentValues = alignedPoints.map(p => p.current)
  const historicalAvgValues = alignedPoints.map(p => p.historicalAvg)
  
  // 1. Correlação de Pearson
  const pearson = pearsonCorrelation(currentValues, historicalAvgValues)
  const pearsonScore = Math.round(Math.max(0, pearson) * 100)
  
  // 2. RMSE Score
  const rmse = normalizedRMSE(currentValues, historicalAvgValues)
  const rmseScore = Math.round((1 - rmse) * 100)
  
  // 3. Aderência ao envelope
  let pointsInEnvelope = 0
  alignedPoints.forEach(p => {
    // Considera "dentro" se estiver entre min-10% e max+10%
    const margin = 0.05
    if (p.current >= p.historicalMin - margin && p.current <= p.historicalMax + margin) {
      pointsInEnvelope++
    }
  })
  const adherenceScore = Math.round((pointsInEnvelope / alignedPoints.length) * 100)
  
  // 4. Score composto (média ponderada)
  // Pearson: 40% (forma da curva)
  // RMSE: 30% (magnitude absoluta)
  // Aderência: 30% (dentro do envelope)
  const compositeScore = Math.round(
    pearsonScore * 0.4 +
    rmseScore * 0.3 +
    adherenceScore * 0.3
  )
  
  return {
    pearsonScore,
    rmseScore,
    adherenceScore,
    compositeScore,
    numPointsCompared: alignedPoints.length,
    numHistoricalYears: validHistorical.length,
    alignmentMethod,
    warnings
  }
}

/**
 * Retorna diagnóstico textual da correlação
 */
export function getCorrelationDiagnosis(result: CorrelationResult): {
  level: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'
  description: string
} {
  const { compositeScore, alignmentMethod, numHistoricalYears } = result
  
  if (compositeScore >= 80) {
    return {
      level: 'EXCELLENT',
      description: `Safra muito aderente ao padrão histórico (${numHistoricalYears} anos)`
    }
  }
  
  if (compositeScore >= 60) {
    return {
      level: 'GOOD',
      description: `Safra dentro do esperado com base no histórico`
    }
  }
  
  if (compositeScore >= 40) {
    return {
      level: 'FAIR',
      description: `Safra com desvios moderados do padrão histórico`
    }
  }
  
  if (alignmentMethod === 'INDEX') {
    return {
      level: 'POOR',
      description: `Alinhamento fenológico não foi possível - dados podem ser imprecisos`
    }
  }
  
  return {
    level: 'POOR',
    description: `Safra com comportamento atípico em relação ao histórico`
  }
}
