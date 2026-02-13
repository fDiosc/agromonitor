/**
 * Phenology Service - Main Calculation
 */

import type { NdviPoint } from '../merx.service'
import type { PhenologyConfig, PhenologyResult } from './types'
import {
  getThresholds,
  movingAverage,
  detectReplanting,
  calculateCorrelation,
  detectSenescenceTrend,
  calculateDynamicEos,
  estimateYield,
  assessPhenologyHealth,
  calculateConfidenceScore,
} from './helpers'

export function calculatePhenology(
  ndviData: NdviPoint[],
  historicalData: NdviPoint[][],
  config: PhenologyConfig
): PhenologyResult {
  const diagnostics: PhenologyResult['diagnostics'] = []
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
