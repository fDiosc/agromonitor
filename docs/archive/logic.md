# MERX AGRO Monitor - Melhorias de Lógica e Código

## Objetivo

Este documento detalha as melhorias necessárias no código e na lógica de negócio para tornar o produto mais robusto, confiável e alinhado com o objetivo de **monitoramento de risco de crédito agrícola**.

---

## 1. Melhorias no Serviço Merx (`merxService.ts`)

### 1.1 Tratamento de Erros Robusto

**Problema Atual:**
O código atual usa try/catch genéricos e não diferencia tipos de erro.

**Solução:**

```typescript
// lib/services/merx.service.ts

export class MerxServiceError extends Error {
  constructor(
    message: string,
    public code: MerxErrorCode,
    public httpStatus?: number,
    public retryable: boolean = false
  ) {
    super(message)
    this.name = 'MerxServiceError'
  }
}

export enum MerxErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
  INVALID_GEOMETRY = 'INVALID_GEOMETRY',
  NO_DATA_AVAILABLE = 'NO_DATA_AVAILABLE',
  TIMEOUT = 'TIMEOUT'
}

private static async request(
  endpoint: string, 
  method: 'GET' | 'POST', 
  data?: Record<string, any>, 
  file?: File,
  options: { timeout?: number; retries?: number } = {}
): Promise<any> {
  const { timeout = 30000, retries = 2 } = options
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)
      
      const response = await fetch(targetUrl, {
        ...buildOptions(),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (response.status === 429) {
        throw new MerxServiceError(
          'Rate limit exceeded',
          MerxErrorCode.RATE_LIMIT,
          429,
          true
        )
      }
      
      if (!response.ok) {
        const text = await response.text()
        throw new MerxServiceError(
          `API Error: ${text}`,
          MerxErrorCode.API_ERROR,
          response.status,
          response.status >= 500
        )
      }
      
      return await response.json()
      
    } catch (error) {
      if (error instanceof MerxServiceError) {
        if (error.retryable && attempt < retries) {
          await this.delay(Math.pow(2, attempt) * 1000) // Exponential backoff
          continue
        }
        throw error
      }
      
      if (error.name === 'AbortError') {
        throw new MerxServiceError(
          'Request timeout',
          MerxErrorCode.TIMEOUT,
          undefined,
          true
        )
      }
      
      throw new MerxServiceError(
        'Network error',
        MerxErrorCode.NETWORK_ERROR,
        undefined,
        true
      )
    }
  }
}

private static delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
```

### 1.2 Validação de Geometria

**Problema Atual:**
O código aceita qualquer arquivo sem validar se é uma geometria válida.

**Solução:**

```typescript
// lib/utils/geo-validator.ts

export interface GeometryValidation {
  isValid: boolean
  type: 'Polygon' | 'MultiPolygon' | 'Unknown'
  vertexCount: number
  areaHa: number
  centroid: { lat: number; lng: number }
  errors: string[]
  warnings: string[]
}

export async function validateGeometry(file: File): Promise<GeometryValidation> {
  const errors: string[] = []
  const warnings: string[] = []
  
  try {
    const text = await file.text()
    let coords: [number, number][] = []
    let type: 'Polygon' | 'MultiPolygon' | 'Unknown' = 'Unknown'
    
    // Parse KML ou GeoJSON
    if (text.trim().startsWith('{')) {
      const json = JSON.parse(text)
      const feature = json.features?.[0] || json
      const geometry = feature.geometry || feature
      
      if (!geometry?.type) {
        errors.push('Geometria não encontrada no arquivo')
        return { isValid: false, type: 'Unknown', vertexCount: 0, areaHa: 0, centroid: { lat: 0, lng: 0 }, errors, warnings }
      }
      
      type = geometry.type as 'Polygon' | 'MultiPolygon'
      coords = type === 'Polygon' 
        ? geometry.coordinates[0] 
        : geometry.coordinates[0][0]
        
    } else if (text.includes('<kml')) {
      const match = text.match(/<coordinates>([\s\S]*?)<\/coordinates>/)
      if (!match) {
        errors.push('Coordenadas não encontradas no KML')
        return { isValid: false, type: 'Unknown', vertexCount: 0, areaHa: 0, centroid: { lat: 0, lng: 0 }, errors, warnings }
      }
      
      type = 'Polygon'
      coords = match[1].trim().split(/\s+/).map(r => {
        const p = r.split(',')
        return [parseFloat(p[0]), parseFloat(p[1])]
      })
    } else {
      errors.push('Formato de arquivo não suportado. Use GeoJSON ou KML.')
      return { isValid: false, type: 'Unknown', vertexCount: 0, areaHa: 0, centroid: { lat: 0, lng: 0 }, errors, warnings }
    }
    
    // Validações
    if (coords.length < 4) {
      errors.push(`Polígono precisa de pelo menos 3 vértices (encontrado: ${coords.length - 1})`)
    }
    
    // Verificar se polígono está fechado
    const first = coords[0]
    const last = coords[coords.length - 1]
    if (first[0] !== last[0] || first[1] !== last[1]) {
      warnings.push('Polígono não está fechado. Será fechado automaticamente.')
      coords.push(first)
    }
    
    // Verificar coordenadas dentro do Brasil
    const centroid = calculateCentroid(coords)
    if (centroid.lat < -34 || centroid.lat > 6 || centroid.lng < -74 || centroid.lng > -32) {
      warnings.push('Coordenadas parecem estar fora do Brasil')
    }
    
    // Calcular área
    const areaHa = calculateSphericalArea(coords)
    
    if (areaHa < 1) {
      warnings.push('Área muito pequena (< 1 ha). Verifique as coordenadas.')
    }
    
    if (areaHa > 50000) {
      warnings.push('Área muito grande (> 50.000 ha). Verifique se o polígono está correto.')
    }
    
    return {
      isValid: errors.length === 0,
      type,
      vertexCount: coords.length - 1,
      areaHa,
      centroid,
      errors,
      warnings
    }
    
  } catch (e) {
    errors.push(`Erro ao processar arquivo: ${e.message}`)
    return { isValid: false, type: 'Unknown', vertexCount: 0, areaHa: 0, centroid: { lat: 0, lng: 0 }, errors, warnings }
  }
}

function calculateCentroid(coords: [number, number][]): { lat: number; lng: number } {
  let sumLng = 0, sumLat = 0
  for (const [lng, lat] of coords) {
    sumLng += lng
    sumLat += lat
  }
  return {
    lng: sumLng / coords.length,
    lat: sumLat / coords.length
  }
}

function calculateSphericalArea(coords: [number, number][]): number {
  const R = 6371000 // metros
  const toRad = Math.PI / 180
  
  let area = 0
  for (let i = 0; i < coords.length - 1; i++) {
    const p1 = coords[i]
    const p2 = coords[i + 1]
    area += (p2[0] - p1[0]) * toRad * (2 + Math.sin(p1[1] * toRad) + Math.sin(p2[1] * toRad))
  }
  
  return Math.abs(area * R * R / 2) / 10000 // hectares
}
```

### 1.3 Cálculo de Fenologia Aprimorado

**Problema Atual:**
- Limiares fixos (0.38 e 0.40) não funcionam para todas as regiões
- Não considera sazonalidade
- Não detecta replantio

**Solução:**

```typescript
// lib/services/phenology.service.ts

export interface PhenologyConfig {
  crop: Crop
  region: Region
  sowingWindow: { start: string; end: string } // Janela típica de plantio
}

export interface PhenologyResult {
  plantingDate: string | null
  sosDate: string | null
  eosDate: string | null
  peakDate: string | null
  cycleDays: number
  
  // Novos campos
  detectedReplanting: boolean
  replantingDate: string | null
  actualYieldEstimate: number // kg/ha baseado em NDVI máximo
  phenologyHealth: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'
  
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  confidenceScore: number
  method: 'ALGORITHM' | 'PROJECTION' | 'HYBRID'
  
  diagnostics: PhenologyDiagnostic[]
}

export interface PhenologyDiagnostic {
  type: 'INFO' | 'WARNING' | 'ERROR'
  code: string
  message: string
  date?: string
}

export class PhenologyService {
  // Limiares adaptativos por cultura e região
  private static getThresholds(config: PhenologyConfig) {
    const thresholds: Record<Crop, { sosNdvi: number; eosNdvi: number; peakMinNdvi: number }> = {
      SOJA: { sosNdvi: 0.35, eosNdvi: 0.38, peakMinNdvi: 0.70 },
      MILHO: { sosNdvi: 0.30, eosNdvi: 0.35, peakMinNdvi: 0.65 },
      ALGODAO: { sosNdvi: 0.32, eosNdvi: 0.40, peakMinNdvi: 0.60 },
      CAFE: { sosNdvi: 0.45, eosNdvi: 0.45, peakMinNdvi: 0.55 },
      CANA: { sosNdvi: 0.35, eosNdvi: 0.40, peakMinNdvi: 0.60 },
      TRIGO: { sosNdvi: 0.30, eosNdvi: 0.35, peakMinNdvi: 0.65 }
    }
    
    return thresholds[config.crop] || thresholds.SOJA
  }
  
  // Ciclo típico por cultura (dias)
  private static getCycleDays(crop: Crop): number {
    const cycles: Record<Crop, number> = {
      SOJA: 120,
      MILHO: 140,
      ALGODAO: 180,
      CAFE: 365,
      CANA: 365,
      TRIGO: 120
    }
    return cycles[crop] || 120
  }
  
  static calculate(
    ndviData: { date: string; ndvi_smooth: number; ndvi_interp?: number }[],
    historicalData: any[][],
    areaHa: number,
    config: PhenologyConfig
  ): PhenologyResult {
    const diagnostics: PhenologyDiagnostic[] = []
    const thresholds = this.getThresholds(config)
    const typicalCycle = this.getCycleDays(config.crop)
    
    if (!ndviData || ndviData.length < 5) {
      return this.getDefaultResult(areaHa, typicalCycle, diagnostics)
    }
    
    // Ordenar e limpar dados
    const sorted = [...ndviData]
      .filter(d => d.ndvi_smooth !== null && d.ndvi_smooth !== undefined)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    
    if (sorted.length < 5) {
      diagnostics.push({
        type: 'WARNING',
        code: 'INSUFFICIENT_DATA',
        message: `Apenas ${sorted.length} pontos válidos de NDVI`
      })
      return this.getDefaultResult(areaHa, typicalCycle, diagnostics)
    }
    
    // Suavização adicional para reduzir ruído
    const smoothed = this.movingAverage(sorted.map(d => d.ndvi_smooth), 3)
    
    // Detectar pico
    let maxVal = 0, peakIdx = -1
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
    
    // Detectar possível replantio (queda brusca seguida de nova subida)
    const { replanting, replantingIdx } = this.detectReplanting(smoothed, thresholds)
    
    if (replanting) {
      diagnostics.push({
        type: 'WARNING',
        code: 'REPLANTING_DETECTED',
        message: 'Possível replantio detectado',
        date: sorted[replantingIdx]?.date
      })
    }
    
    // Calcular datas
    const sosDate = sosIdx >= 0 ? sorted[sosIdx].date : null
    const eosDate = eosIdx >= 0 ? sorted[eosIdx].date : null
    const peakDate = peakIdx >= 0 ? sorted[peakIdx].date : null
    
    // Estimar plantio (SOS - dias típicos de emergência)
    const emergenceDays = config.crop === 'SOJA' ? 8 : config.crop === 'MILHO' ? 7 : 10
    let plantingDate: string | null = null
    if (sosDate) {
      const d = new Date(sosDate)
      d.setDate(d.getDate() - emergenceDays)
      plantingDate = d.toISOString().split('T')[0]
    }
    
    // Projetar EOS se não detectado
    let method: 'ALGORITHM' | 'PROJECTION' | 'HYBRID' = 'ALGORITHM'
    if (!eosDate && plantingDate) {
      const ed = new Date(plantingDate)
      ed.setDate(ed.getDate() + typicalCycle)
      // eosDate seria a projeção
      method = 'PROJECTION'
    } else if (!eosDate && !plantingDate) {
      method = 'PROJECTION'
    }
    
    // Calcular correlação histórica
    const correlation = this.calculateHistoricalCorrelation(smoothed, historicalData)
    
    // Estimar produtividade baseada no NDVI máximo
    const yieldEstimate = this.estimateYield(maxVal, areaHa, config.crop)
    
    // Calcular saúde fenológica
    const health = this.assessPhenologyHealth(maxVal, correlation, method, diagnostics)
    
    // Calcular score de confiança
    const score = this.calculateConfidenceScore({
      hasPlanting: !!plantingDate,
      hasSos: !!sosDate,
      hasEos: !!eosDate,
      hasPeak: peakIdx >= 0,
      method,
      correlation,
      dataPoints: sorted.length,
      peakNdvi: maxVal,
      thresholds
    })
    
    return {
      plantingDate,
      sosDate,
      eosDate: eosDate || (plantingDate ? new Date(new Date(plantingDate).getTime() + typicalCycle * 86400000).toISOString().split('T')[0] : null),
      peakDate,
      cycleDays: typicalCycle,
      
      detectedReplanting: replanting,
      replantingDate: replanting && replantingIdx >= 0 ? sorted[replantingIdx].date : null,
      actualYieldEstimate: yieldEstimate,
      phenologyHealth: health,
      
      confidence: score > 75 ? 'HIGH' : score > 40 ? 'MEDIUM' : 'LOW',
      confidenceScore: score,
      method,
      
      diagnostics
    }
  }
  
  private static movingAverage(data: number[], window: number): number[] {
    const result: number[] = []
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - Math.floor(window / 2))
      const end = Math.min(data.length, i + Math.ceil(window / 2))
      const slice = data.slice(start, end)
      result.push(slice.reduce((a, b) => a + b, 0) / slice.length)
    }
    return result
  }
  
  private static detectReplanting(
    smoothed: number[], 
    thresholds: { sosNdvi: number }
  ): { replanting: boolean; replantingIdx: number } {
    // Procura por queda > 0.2 seguida de subida > 0.15 em janela de 30 dias
    for (let i = 5; i < smoothed.length - 5; i++) {
      const before = smoothed[i - 5]
      const current = smoothed[i]
      const after = smoothed[i + 5]
      
      if (before > 0.5 && current < 0.35 && after > 0.5) {
        return { replanting: true, replantingIdx: i }
      }
    }
    return { replanting: false, replantingIdx: -1 }
  }
  
  private static calculateHistoricalCorrelation(
    current: number[], 
    historical: any[][]
  ): number {
    if (historical.length === 0) return 50
    
    // Calcular média histórica
    const historyAvg = current.map((_, idx) => {
      let sum = 0, count = 0
      historical.forEach(h => {
        if (h[idx]?.ndvi_smooth) {
          sum += h[idx].ndvi_smooth
          count++
        }
      })
      return count > 0 ? sum / count : 0.5
    })
    
    // Correlação de Pearson simplificada
    const n = Math.min(current.length, historyAvg.length)
    if (n < 3) return 50
    
    let sumDiff = 0
    for (let i = 0; i < n; i++) {
      sumDiff += Math.abs(current[i] - historyAvg[i])
    }
    
    const avgDiff = sumDiff / n
    return Math.max(0, Math.min(100, Math.round((1 - avgDiff * 1.5) * 100)))
  }
  
  private static estimateYield(
    maxNdvi: number, 
    areaHa: number, 
    crop: Crop
  ): number {
    // Estimativa baseada em relação NDVI x Produtividade
    // Valores são aproximações e devem ser calibrados por região
    const baseYield: Record<Crop, number> = {
      SOJA: 3500,    // kg/ha
      MILHO: 9000,
      ALGODAO: 4500,
      CAFE: 2400,
      CANA: 75000,
      TRIGO: 3000
    }
    
    // Fator de ajuste baseado no NDVI máximo
    // NDVI 0.8+ = 100% do potencial, 0.6 = ~75%, etc
    const ndviFactor = Math.min(1, Math.max(0.3, (maxNdvi - 0.3) / 0.5))
    
    const yieldPerHa = (baseYield[crop] || 3500) * ndviFactor
    return Math.round(yieldPerHa * areaHa)
  }
  
  private static assessPhenologyHealth(
    maxNdvi: number,
    correlation: number,
    method: string,
    diagnostics: PhenologyDiagnostic[]
  ): 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' {
    const errorCount = diagnostics.filter(d => d.type === 'ERROR').length
    const warningCount = diagnostics.filter(d => d.type === 'WARNING').length
    
    if (errorCount > 0) return 'POOR'
    if (maxNdvi >= 0.75 && correlation >= 70 && method === 'ALGORITHM' && warningCount === 0) return 'EXCELLENT'
    if (maxNdvi >= 0.65 && correlation >= 50) return 'GOOD'
    if (maxNdvi >= 0.50 || warningCount <= 1) return 'FAIR'
    return 'POOR'
  }
  
  private static calculateConfidenceScore(params: {
    hasPlanting: boolean
    hasSos: boolean
    hasEos: boolean
    hasPeak: boolean
    method: string
    correlation: number
    dataPoints: number
    peakNdvi: number
    thresholds: { peakMinNdvi: number }
  }): number {
    let score = 10
    
    if (params.hasSos) score += 20
    if (params.hasEos) score += 15
    if (params.hasPeak) score += 15
    if (params.method === 'ALGORITHM') score += 20
    if (params.correlation > 70) score += 10
    if (params.dataPoints >= 20) score += 5
    if (params.peakNdvi >= params.thresholds.peakMinNdvi) score += 5
    
    return Math.min(100, score)
  }
  
  private static getDefaultResult(
    areaHa: number, 
    cycleDays: number,
    diagnostics: PhenologyDiagnostic[]
  ): PhenologyResult {
    return {
      plantingDate: null,
      sosDate: null,
      eosDate: null,
      peakDate: null,
      cycleDays,
      detectedReplanting: false,
      replantingDate: null,
      actualYieldEstimate: areaHa * 3500,
      phenologyHealth: 'POOR',
      confidence: 'LOW',
      confidenceScore: 10,
      method: 'PROJECTION',
      diagnostics: [
        ...diagnostics,
        { type: 'ERROR', code: 'NO_DATA', message: 'Dados insuficientes para análise' }
      ]
    }
  }
}
```

---

## 2. Melhorias no Serviço de IA (`aiService.ts`)

### 2.1 Prompts Estruturados e Versionados

**Problema Atual:**
Prompt inline dificulta manutenção e testes.

**Solução:**

```typescript
// lib/services/prompts/credit-analyst.prompt.ts

export const CREDIT_ANALYST_PROMPT = {
  version: '2.0.0',
  
  systemInstruction: `
Você é um Analista de Risco de Crédito e Mercado Agri Sênior.

## CONTEXTO
- Usuário: Trading (comprador de grãos) ou Fundo de Crédito (lavoura como garantia)
- Foco: Segurança da GARANTIA, não manejo agronômico

## TAREFAS
1. Validar performance da garantia (biomassa) vs expectativa de quitação
2. Identificar riscos financeiros: quebra de safra, atraso na colheita, baixo vigor
3. Recomendar mitigação: vistoria, hedge, garantia adicional

## CLASSIFICAÇÃO DE STATUS

| Status | Critérios |
|--------|-----------|
| NORMAL | Correlação histórica > 70%, NDVI dentro da curva, sem anomalias |
| ALERTA | Correlação 40-70%, atraso detectado, NDVI 10-20% abaixo do esperado |
| CRÍTICO | Correlação < 40%, quebra severa, replantio detectado, NDVI > 30% abaixo |

## REGRAS DE NEGÓCIO
- Considerar vencimento típico de CPRs: Março/Abril
- Atrasos no plantio > 15 dias = risco comercial elevado
- Replantio = avaliar nova janela de colheita
- Correlação histórica < 50% = recomendar vistoria presencial

## FORMATO
- JSON estruturado conforme schema
- Linguagem técnica e objetiva
- Parecer máximo 30 palavras
- Riscos e recomendações acionáveis
`.trim(),

  buildUserPrompt: (fieldInfo: any, rawData: any) => `
## TALHÃO
- Localização: ${fieldInfo.city}/${fieldInfo.state}
- Área: ${rawData.area_ha?.toFixed(1) || 'N/A'} ha
- Cultura: ${fieldInfo.crop || 'SOJA'}

## FENOLOGIA DETECTADA
${JSON.stringify(rawData.detected_phenology, null, 2)}

## DADOS NDVI (Últimos 30 pontos)
${JSON.stringify(rawData.ndvi?.slice(-30).map((d: any) => ({
  date: d.date,
  ndvi: d.ndvi_smooth?.toFixed(3)
})), null, 2)}

## PRECIPITAÇÃO (Últimos 10 registros)
${JSON.stringify(rawData.precipitacao?.slice(-10), null, 2)}

## CORRELAÇÃO HISTÓRICA
${rawData.detected_phenology?.historical_correlation || 'N/A'}%

Gere análise de risco completa.
`.trim()
}
```

### 2.2 Fallback e Retry com Cache

```typescript
// lib/services/gemini.service.ts

import { GoogleGenAI } from '@google/genai'
import { cache } from '../cache'
import { CREDIT_ANALYST_PROMPT } from './prompts/credit-analyst.prompt'

export interface GeminiConfig {
  model: string
  temperature: number
  maxRetries: number
  cacheEnabled: boolean
  cacheTtlSeconds: number
}

const DEFAULT_CONFIG: GeminiConfig = {
  model: 'gemini-2.0-flash',
  temperature: 0.3,
  maxRetries: 2,
  cacheEnabled: true,
  cacheTtlSeconds: 3600 // 1 hora
}

export class GeminiService {
  private ai: GoogleGenAI
  private config: GeminiConfig
  
  constructor(apiKey: string, config: Partial<GeminiConfig> = {}) {
    this.ai = new GoogleGenAI({ apiKey })
    this.config = { ...DEFAULT_CONFIG, ...config }
  }
  
  async analyzeField(rawData: any, fieldInfo: any): Promise<GeminiInsight> {
    // Tentar cache primeiro
    if (this.config.cacheEnabled) {
      const cacheKey = this.buildCacheKey(rawData, fieldInfo)
      const cached = await cache.get<GeminiInsight>(cacheKey)
      if (cached) {
        return { ...cached, fromCache: true }
      }
    }
    
    // Executar análise com retry
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await this.executeAnalysis(rawData, fieldInfo)
        
        // Salvar em cache
        if (this.config.cacheEnabled) {
          const cacheKey = this.buildCacheKey(rawData, fieldInfo)
          await cache.set(cacheKey, result, this.config.cacheTtlSeconds)
        }
        
        return result
        
      } catch (error) {
        if (attempt === this.config.maxRetries) {
          console.error('Gemini analysis failed after retries:', error)
          return this.getFallbackResult(rawData, fieldInfo)
        }
        
        // Exponential backoff
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000))
      }
    }
    
    return this.getFallbackResult(rawData, fieldInfo)
  }
  
  private async executeAnalysis(rawData: any, fieldInfo: any): Promise<GeminiInsight> {
    const response = await this.ai.models.generateContent({
      model: this.config.model,
      contents: CREDIT_ANALYST_PROMPT.buildUserPrompt(fieldInfo, rawData),
      config: {
        systemInstruction: CREDIT_ANALYST_PROMPT.systemInstruction,
        temperature: this.config.temperature,
        responseMimeType: 'application/json',
        responseSchema: this.getResponseSchema()
      }
    })
    
    const parsed = JSON.parse(response.text)
    
    // Validar resposta
    if (!parsed.status || !['NORMAL', 'ALERTA', 'CRITICO'].includes(parsed.status)) {
      throw new Error('Invalid AI response: missing or invalid status')
    }
    
    return {
      ...parsed,
      generatedAt: new Date().toISOString(),
      modelVersion: this.config.model,
      promptVersion: CREDIT_ANALYST_PROMPT.version
    }
  }
  
  private getFallbackResult(rawData: any, fieldInfo: any): GeminiInsight {
    // Análise básica baseada em regras quando IA falha
    const pheno = rawData.detected_phenology
    const correlation = pheno?.historical_correlation || 50
    
    let status: 'NORMAL' | 'ALERTA' | 'CRITICO' = 'ALERTA'
    if (correlation > 70 && pheno?.confidence_score > 60) {
      status = 'NORMAL'
    } else if (correlation < 40 || pheno?.confidence_score < 30) {
      status = 'CRITICO'
    }
    
    return {
      status,
      summary: 'Análise automática baseada em regras (IA indisponível).',
      risks: [
        'Análise de IA indisponível - dados baseados apenas em algoritmos',
        correlation < 50 ? 'Baixa correlação histórica detectada' : null,
        pheno?.method === 'PROJECTION' ? 'Colheita baseada em projeção, não em detecção real' : null
      ].filter(Boolean) as string[],
      recommendations: [
        'Verificar disponibilidade do serviço de IA',
        correlation < 50 ? 'Considerar vistoria presencial' : 'Monitoramento padrão'
      ],
      phenology_validation: {
        is_accurate: pheno?.confidence === 'HIGH',
        confirmed_planting_date: pheno?.planting_date,
        confirmed_sos_date: pheno?.sos_date,
        confirmed_eos_date: pheno?.eos_date,
        ai_confidence: pheno?.confidence_score || 0
      },
      current_stage: 'DESENVOLVIMENTO',
      critical_events: [],
      
      fallback: true,
      generatedAt: new Date().toISOString()
    }
  }
  
  private buildCacheKey(rawData: any, fieldInfo: any): string {
    const dataHash = hashObject({
      lat: fieldInfo.lat,
      lng: fieldInfo.lng,
      lastNdviDate: rawData.ndvi?.[rawData.ndvi.length - 1]?.date,
      ndviCount: rawData.ndvi?.length,
      correlation: rawData.detected_phenology?.historical_correlation
    })
    return `gemini:analysis:${dataHash}`
  }
  
  private getResponseSchema() {
    // Schema Zod ou JSON Schema para validação
    return {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        status: { type: 'string', enum: ['NORMAL', 'ALERTA', 'CRITICO'] },
        // ... resto do schema
      },
      required: ['summary', 'status', 'risks', 'recommendations']
    }
  }
}

function hashObject(obj: any): string {
  const str = JSON.stringify(obj)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}
```

---

## 3. Melhorias no Frontend (`App.tsx`)

### 3.1 Separação de Componentes

**Problema Atual:**
Arquivo único com 470 linhas dificulta manutenção.

**Estrutura Recomendada:**

```
components/
├── fields/
│   ├── FieldDrawer.tsx       # Desenho no mapa
│   ├── FieldUploader.tsx     # Upload de arquivo
│   ├── FieldTable.tsx        # Tabela do dashboard
│   └── FieldForm.tsx         # Formulário de cadastro
│
├── reports/
│   ├── MetricCards.tsx       # Cards de métricas
│   ├── PhenologyTimeline.tsx # Timeline de fenologia
│   ├── NdviChart.tsx         # Gráfico de NDVI
│   ├── RiskPanel.tsx         # Painel de riscos
│   └── FullReport.tsx        # Componente completo
│
├── layout/
│   ├── Header.tsx
│   ├── Sidebar.tsx
│   └── PageContainer.tsx
│
└── ui/
    ├── Button.tsx
    ├── Card.tsx
    ├── Badge.tsx
    └── ...
```

### 3.2 Estado Global com Zustand

```typescript
// stores/fields.store.ts

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface FieldData {
  id: string
  name: string
  status: 'pending' | 'loading' | 'success' | 'error'
  reportData?: any
  aiInsight?: any
  // ...
}

interface FieldsStore {
  fields: FieldData[]
  selectedFieldId: string | null
  
  // Actions
  addField: (field: Omit<FieldData, 'id'>) => string
  updateField: (id: string, data: Partial<FieldData>) => void
  removeField: (id: string) => void
  selectField: (id: string | null) => void
  
  // Selectors
  getSelectedField: () => FieldData | undefined
}

export const useFieldsStore = create<FieldsStore>()(
  persist(
    (set, get) => ({
      fields: [],
      selectedFieldId: null,
      
      addField: (field) => {
        const id = crypto.randomUUID()
        set(state => ({
          fields: [{ ...field, id }, ...state.fields]
        }))
        return id
      },
      
      updateField: (id, data) => {
        set(state => ({
          fields: state.fields.map(f => 
            f.id === id ? { ...f, ...data } : f
          )
        }))
      },
      
      removeField: (id) => {
        set(state => ({
          fields: state.fields.filter(f => f.id !== id),
          selectedFieldId: state.selectedFieldId === id ? null : state.selectedFieldId
        }))
      },
      
      selectField: (id) => {
        set({ selectedFieldId: id })
      },
      
      getSelectedField: () => {
        const { fields, selectedFieldId } = get()
        return fields.find(f => f.id === selectedFieldId)
      }
    }),
    {
      name: 'merx-fields-storage',
      partialize: (state) => ({ 
        fields: state.fields.filter(f => f.status === 'success')
      })
    }
  )
)
```

### 3.3 Hooks Customizados

```typescript
// hooks/useFieldAnalysis.ts

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useFieldsStore } from '../stores/fields.store'
import { analyzeField } from '../lib/api/fields'

export function useFieldAnalysis() {
  const queryClient = useQueryClient()
  const { updateField } = useFieldsStore()
  
  return useMutation({
    mutationFn: async ({ 
      fieldId, 
      file, 
      startDate 
    }: { 
      fieldId: string
      file: File
      startDate: string 
    }) => {
      updateField(fieldId, { status: 'loading' })
      
      try {
        const result = await analyzeField(file, startDate)
        
        updateField(fieldId, {
          status: 'success',
          reportData: result.report,
          aiInsight: result.insight,
          location: result.location
        })
        
        return result
        
      } catch (error) {
        updateField(fieldId, {
          status: 'error',
          errorMessage: error.message
        })
        throw error
      }
    },
    
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fields'] })
    }
  })
}
```

### 3.4 Validação de Formulários

```typescript
// lib/validations/field.validation.ts

import { z } from 'zod'

export const createFieldSchema = z.object({
  name: z
    .string()
    .min(3, 'Nome deve ter pelo menos 3 caracteres')
    .max(100, 'Nome muito longo'),
    
  seasonStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')
    .refine(date => {
      const d = new Date(date)
      const now = new Date()
      const twoYearsAgo = new Date()
      twoYearsAgo.setFullYear(now.getFullYear() - 2)
      
      return d >= twoYearsAgo && d <= now
    }, 'Data deve estar nos últimos 2 anos'),
    
  file: z
    .instanceof(File)
    .refine(file => file.size <= 10 * 1024 * 1024, 'Arquivo muito grande (max 10MB)')
    .refine(file => {
      const ext = file.name.split('.').pop()?.toLowerCase()
      return ['kml', 'kmz', 'geojson', 'json'].includes(ext || '')
    }, 'Formato inválido. Use KML, KMZ ou GeoJSON')
})

export type CreateFieldInput = z.infer<typeof createFieldSchema>
```

---

## 4. Melhorias de UX

### 4.1 Loading States

```typescript
// components/ui/AnalysisProgress.tsx

interface AnalysisProgressProps {
  status: 'pending' | 'loading' | 'success' | 'error'
  currentStep?: string
}

export function AnalysisProgress({ status, currentStep }: AnalysisProgressProps) {
  const steps = [
    { id: 'upload', label: 'Upload do arquivo' },
    { id: 'validate', label: 'Validando geometria' },
    { id: 'location', label: 'Detectando localização' },
    { id: 'ndvi', label: 'Consultando NDVI' },
    { id: 'history', label: 'Buscando histórico' },
    { id: 'phenology', label: 'Calculando fenologia' },
    { id: 'ai', label: 'Análise de IA' }
  ]
  
  return (
    <div className="space-y-4">
      {steps.map((step, idx) => (
        <div key={step.id} className="flex items-center gap-3">
          <StepIndicator 
            status={getStepStatus(step.id, currentStep, status)} 
          />
          <span className="text-sm">{step.label}</span>
        </div>
      ))}
    </div>
  )
}
```

### 4.2 Feedback de Erros

```typescript
// components/ui/ErrorDisplay.tsx

interface ErrorDisplayProps {
  error: Error | string
  onRetry?: () => void
  context?: string
}

export function ErrorDisplay({ error, onRetry, context }: ErrorDisplayProps) {
  const message = typeof error === 'string' ? error : error.message
  
  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="text-red-500 shrink-0" />
        <div className="flex-1">
          <h4 className="font-bold text-red-700">Erro na análise</h4>
          <p className="text-sm text-red-600 mt-1">{message}</p>
          {context && (
            <p className="text-xs text-red-400 mt-2">Contexto: {context}</p>
          )}
        </div>
      </div>
      
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition"
        >
          Tentar novamente
        </button>
      )}
    </div>
  )
}
```

---

## 5. Testes

### 5.1 Testes Unitários

```typescript
// tests/unit/phenology.service.test.ts

import { describe, it, expect } from 'vitest'
import { PhenologyService } from '../../lib/services/phenology.service'

describe('PhenologyService', () => {
  describe('calculate', () => {
    it('should detect SOS when NDVI crosses threshold', () => {
      const ndviData = [
        { date: '2024-09-01', ndvi_smooth: 0.20 },
        { date: '2024-09-10', ndvi_smooth: 0.30 },
        { date: '2024-09-20', ndvi_smooth: 0.40 },
        { date: '2024-10-01', ndvi_smooth: 0.55 },
        { date: '2024-10-10', ndvi_smooth: 0.70 },
        { date: '2024-10-20', ndvi_smooth: 0.80 },
        { date: '2024-11-01', ndvi_smooth: 0.75 },
      ]
      
      const result = PhenologyService.calculate(
        ndviData, 
        [], 
        100,
        { crop: 'SOJA', region: 'MT', sowingWindow: { start: '09-01', end: '11-30' } }
      )
      
      expect(result.sosDate).toBe('2024-09-20')
      expect(result.peakDate).toBe('2024-10-20')
      expect(result.confidence).toBe('MEDIUM')
    })
    
    it('should detect replanting pattern', () => {
      const ndviData = [
        { date: '2024-09-01', ndvi_smooth: 0.25 },
        { date: '2024-09-15', ndvi_smooth: 0.50 },
        { date: '2024-09-25', ndvi_smooth: 0.65 },
        { date: '2024-10-05', ndvi_smooth: 0.25 }, // Queda brusca (replantio)
        { date: '2024-10-15', ndvi_smooth: 0.35 },
        { date: '2024-10-25', ndvi_smooth: 0.55 },
        { date: '2024-11-05', ndvi_smooth: 0.70 },
      ]
      
      const result = PhenologyService.calculate(ndviData, [], 100, { 
        crop: 'SOJA', 
        region: 'MT', 
        sowingWindow: { start: '09-01', end: '11-30' } 
      })
      
      expect(result.detectedReplanting).toBe(true)
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({ code: 'REPLANTING_DETECTED' })
      )
    })
    
    it('should return low confidence for insufficient data', () => {
      const ndviData = [
        { date: '2024-09-01', ndvi_smooth: 0.30 },
        { date: '2024-09-15', ndvi_smooth: 0.45 },
      ]
      
      const result = PhenologyService.calculate(ndviData, [], 100, { 
        crop: 'SOJA', 
        region: 'MT', 
        sowingWindow: { start: '09-01', end: '11-30' } 
      })
      
      expect(result.confidence).toBe('LOW')
      expect(result.method).toBe('PROJECTION')
    })
  })
})
```

### 5.2 Testes de Integração

```typescript
// tests/integration/fields.api.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer } from '../../app/api/test-utils'

describe('Fields API', () => {
  let server: any
  
  beforeAll(async () => {
    server = await createServer()
  })
  
  afterAll(async () => {
    await server.close()
  })
  
  describe('POST /api/fields', () => {
    it('should create a field with valid GeoJSON', async () => {
      const geojson = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [-55.0, -12.0],
              [-55.0, -12.1],
              [-54.9, -12.1],
              [-54.9, -12.0],
              [-55.0, -12.0]
            ]]
          }
        }]
      }
      
      const response = await server.inject({
        method: 'POST',
        url: '/api/fields',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          name: 'Talhão Teste',
          seasonStartDate: '2024-09-01',
          geometry: geojson
        }
      })
      
      expect(response.statusCode).toBe(201)
      expect(response.json()).toMatchObject({
        id: expect.any(String),
        name: 'Talhão Teste',
        status: 'PENDING'
      })
    })
    
    it('should reject invalid geometry', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/fields',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          name: 'Talhão Inválido',
          seasonStartDate: '2024-09-01',
          geometry: { invalid: true }
        }
      })
      
      expect(response.statusCode).toBe(400)
      expect(response.json().error).toContain('geometria')
    })
  })
})
```

---

## 6. Checklist de Implementação

### Prioridade CRÍTICA
- [ ] Separar componentes do App.tsx
- [ ] Implementar validação de geometria
- [ ] Adicionar tratamento de erros robusto no MerxService
- [ ] Mover API keys para backend
- [ ] Implementar persistência (Zustand + localStorage como interim)

### Prioridade ALTA
- [ ] Refatorar PhenologyService com limiares adaptativos
- [ ] Adicionar cache no GeminiService
- [ ] Implementar loading states detalhados
- [ ] Adicionar validação de formulários com Zod
- [ ] Criar hooks customizados para lógica de negócio

### Prioridade MÉDIA
- [ ] Adicionar testes unitários para services
- [ ] Implementar detecção de replantio
- [ ] Adicionar estimativa de produtividade baseada em NDVI
- [ ] Criar sistema de diagnósticos na fenologia
- [ ] Melhorar prompts da IA com versionamento

### Prioridade BAIXA
- [ ] Adicionar suporte a múltiplas culturas
- [ ] Implementar comparação entre safras
- [ ] Adicionar exportação de relatórios
- [ ] Criar modo offline básico
