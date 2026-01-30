/**
 * Logistics Analysis Template
 * Previsão de colheita e planejamento de transporte
 * 
 * ARQUITETURA HÍBRIDA:
 * - Métricas operacionais: calculadas ALGORITMICAMENTE (determinístico)
 * - Análise de riscos: gerada por IA (contextual)
 */

import type { 
  TemplateConfig, 
  TemplateDefinition, 
  AnalysisContext,
  LogisticsAnalysisResult,
  LogisticsAlgorithmicMetrics
} from '../types'

export const logisticsConfig: TemplateConfig = {
  id: 'LOGISTICS',
  name: 'Análise Logística',
  description: 'Previsão de colheita e planejamento de transporte para originação',
  icon: 'Truck',
  color: 'blue',
  version: '2.0.0' // Versão híbrida
}

// ==================== CÁLCULO ALGORÍTMICO ====================
// Estas métricas são calculadas de forma determinística, sem IA

export function calculateLogisticsMetrics(context: AnalysisContext): LogisticsAlgorithmicMetrics | null {
  const { agroData } = context
  const areaHa = agroData.areaHa || 100
  const volumeKg = agroData.volumeEstimatedKg || 0
  const volumeTon = volumeKg / 1000
  const eosDate = agroData.eosDate

  // Sem EOS, não há como calcular métricas de colheita
  if (!eosDate) {
    return null
  }

  const eos = new Date(eosDate)
  
  // Início da colheita = EOS - 5 dias (preparação)
  const harvestStart = new Date(eos)
  harvestStart.setDate(eos.getDate() - 5)

  // Duração baseada na área: 2 dias a cada 80 ha, mínimo 5 dias
  const daysToHarvest = Math.max(5, Math.ceil(areaHa / 80) * 2)
  
  // Fim da colheita
  const harvestEnd = new Date(harvestStart)
  harvestEnd.setDate(harvestStart.getDate() + daysToHarvest)

  // Pico: começa 2 dias após início, termina 2 dias antes do fim
  const peakStart = new Date(harvestStart)
  peakStart.setDate(harvestStart.getDate() + 2)
  
  const peakEnd = new Date(harvestEnd)
  peakEnd.setDate(harvestEnd.getDate() - 2)

  // Volume diário (80 ha/dia de colheita típico)
  const dailyVolume = areaHa > 0 ? Math.round((volumeTon / areaHa) * 80) : 0

  // Carretas necessárias (35 ton por viagem)
  const trucksNeeded = volumeTon > 0 ? Math.ceil(volumeTon / 35) : 0

  return {
    harvestStart: harvestStart.toISOString().split('T')[0],
    harvestEnd: harvestEnd.toISOString().split('T')[0],
    peakStart: peakStart.toISOString().split('T')[0],
    peakEnd: peakEnd.toISOString().split('T')[0],
    dailyVolume,
    trucksNeeded,
    daysToHarvest,
    source: 'ALGORITHM'
  }
}

// ==================== PROMPT PARA IA ====================
// A IA recebe as métricas pré-calculadas e foca na análise qualitativa

function buildSystemPrompt(): string {
  return `Você é um Especialista em Logística Agrícola e Originação de Grãos.

CONTEXTO:
Você receberá métricas de colheita JÁ CALCULADAS pelo sistema. Seu papel é analisar os RISCOS e gerar RECOMENDAÇÕES contextuais.

NÃO RECALCULE as métricas de datas, volume ou carretas - elas já foram calculadas algoritmicamente.

SEU FOCO:
1. Avaliar risco climático baseado no período de colheita
2. Avaliar risco de qualidade do grão (umidade, chuva)
3. Identificar riscos operacionais específicos
4. Gerar recomendações práticas e acionáveis

CRITÉRIOS DE RISCO CLIMÁTICO:
- ALTO: Colheita entre Janeiro e Março (período chuvoso intenso)
- MEDIO: Colheita em Dezembro ou Abril (transição)
- BAIXO: Colheita entre Maio e Novembro (período seco)

CRITÉRIOS DE RISCO QUALIDADE:
- ALTO: Colheita em período chuvoso + área grande (demora)
- MEDIO: Período chuvoso OU área grande
- BAIXO: Período seco + área pequena/média

FORMATO DE RESPOSTA:
Responda EXCLUSIVAMENTE em JSON válido:`
}

function buildUserPrompt(context: AnalysisContext): string {
  const { field, agroData, phenology } = context
  const volumeTon = (agroData.volumeEstimatedKg || 0) / 1000
  
  // Calcular métricas algoritmicamente
  const metrics = calculateLogisticsMetrics(context)

  return `## ANÁLISE DE RISCOS LOGÍSTICOS - Talhão: ${field.name}

### LOCALIZAÇÃO
- Cidade/Estado: ${field.city}/${field.state}
- Cultura: ${field.cropType}

### MÉTRICAS PRÉ-CALCULADAS (NÃO MODIFIQUE)
- Área: ${agroData.areaHa?.toFixed(1) || 'N/A'} ha
- Volume Total: ${volumeTon.toFixed(0)} ton
- Início Colheita: ${metrics?.harvestStart || 'N/A'}
- Fim Colheita: ${metrics?.harvestEnd || 'N/A'}
- Dias de Colheita: ${metrics?.daysToHarvest || 'N/A'}
- Volume Diário: ${metrics?.dailyVolume || 0} ton/dia
- Carretas Necessárias: ${metrics?.trucksNeeded || 0}

### FENOLOGIA
- EOS (Fim Ciclo): ${agroData.eosDate || 'Não detectado'}
- Método: ${phenology.method}
- Confiança: ${agroData.confidence} (${agroData.confidenceScore}%)

### CONTEXTO REGIONAL
- Período típico de chuvas: Outubro a Março
- Mês da colheita: ${agroData.eosDate ? new Date(agroData.eosDate).toLocaleString('pt-BR', { month: 'long' }) : 'indefinido'}

Analise os riscos e gere recomendações em JSON:
{
  "weatherRisk": "BAIXO" | "MEDIO" | "ALTO",
  "grainQualityRisk": "BAIXO" | "MEDIO" | "ALTO",
  "risks": ["Risco 1", "Risco 2", ...],
  "recommendations": ["Recomendação 1", ...],
  "summary": "Resumo contextual em 1-2 frases"
}`
}

// ==================== PARSER COM MERGE ====================

function parseResponse(response: any, context?: AnalysisContext): LogisticsAnalysisResult {
  const data = typeof response === 'string' ? JSON.parse(response) : response
  
  // Obter métricas algorítmicas
  const algorithmicMetrics = context ? calculateLogisticsMetrics(context) : null
  
  // Determinar status baseado nos riscos da IA
  const weatherRisk = data.weatherRisk || 'MEDIO'
  const status = weatherRisk === 'ALTO' ? 'CRITICO' : weatherRisk === 'MEDIO' ? 'ATENCAO' : 'OTIMO'
  const statusLabel = weatherRisk === 'ALTO' ? 'Janela de colheita em período chuvoso' : 
                      weatherRisk === 'MEDIO' ? 'Atenção ao clima' : 'Condições favoráveis'

  return {
    status,
    statusLabel,
    statusColor: status === 'OTIMO' ? 'green' : status === 'CRITICO' ? 'red' : 'yellow',
    summary: data.summary || 'Análise qualitativa gerada.',
    risks: Array.isArray(data.risks) ? data.risks : [],
    recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
    metrics: {
      // Métricas algorítmicas (fonte: sistema)
      harvestStart: algorithmicMetrics?.harvestStart || '',
      harvestEnd: algorithmicMetrics?.harvestEnd || '',
      peakStart: algorithmicMetrics?.peakStart || '',
      peakEnd: algorithmicMetrics?.peakEnd || '',
      dailyVolume: algorithmicMetrics?.dailyVolume || 0,
      trucksNeeded: algorithmicMetrics?.trucksNeeded || 0,
      daysToHarvest: algorithmicMetrics?.daysToHarvest,
      metricsSource: 'ALGORITHM',
      // Análise qualitativa (fonte: IA)
      weatherRisk: data.weatherRisk || 'MEDIO',
      grainQualityRisk: data.grainQualityRisk || 'MEDIO',
      analysisSource: 'AI'
    }
  }
}

// ==================== FALLBACK (quando IA falha) ====================
// Usa métricas algorítmicas + análise de riscos baseada em regras simples

function getFallbackResult(context: AnalysisContext): LogisticsAnalysisResult {
  const { agroData } = context
  const eosDate = agroData.eosDate
  
  // Obter métricas algorítmicas
  const metrics = calculateLogisticsMetrics(context)

  // Análise de riscos por regras simples
  let weatherRisk: 'BAIXO' | 'MEDIO' | 'ALTO' = 'BAIXO'
  let grainQualityRisk: 'BAIXO' | 'MEDIO' | 'ALTO' = 'BAIXO'

  if (eosDate) {
    const month = new Date(eosDate).getMonth() + 1
    if (month >= 1 && month <= 3) {
      weatherRisk = 'ALTO'
      grainQualityRisk = 'MEDIO'
    } else if (month === 12 || month === 4) {
      weatherRisk = 'MEDIO'
    }
  }

  const risks: string[] = []
  const recommendations: string[] = []

  if (weatherRisk === 'ALTO') {
    risks.push('Colheita prevista para período chuvoso (Jan-Mar)')
    risks.push('Atraso na colheita devido às chuvas')
    risks.push('Perda de qualidade do grão (umidade elevada)')
    recommendations.push('Monitorar a previsão do tempo com frequência')
    recommendations.push('Ajustar o cronograma de colheita conforme as condições climáticas')
    recommendations.push('Preparar estrutura de secagem para o grão')
    recommendations.push('Negociar contratos de transporte flexíveis')
  } else if (weatherRisk === 'MEDIO') {
    risks.push('Período de transição climática - possíveis chuvas esporádicas')
    recommendations.push('Manter flexibilidade no cronograma de colheita')
    recommendations.push('Monitorar previsão do tempo')
  }

  if (!eosDate) {
    risks.push('Data de colheita não determinada com precisão')
    recommendations.push('Monitorar evolução do NDVI semanalmente')
  }

  if (risks.length === 0) {
    recommendations.push('Janela de colheita dentro do esperado - manter planejamento')
  }

  const status = weatherRisk === 'ALTO' ? 'CRITICO' : weatherRisk === 'MEDIO' ? 'ATENCAO' : 'OTIMO'

  return {
    status,
    statusLabel: weatherRisk === 'ALTO' ? 'Janela de colheita em período chuvoso' : 
                 weatherRisk === 'MEDIO' ? 'Atenção ao clima' : 'Condições favoráveis',
    statusColor: status === 'OTIMO' ? 'green' : status === 'CRITICO' ? 'red' : 'yellow',
    summary: weatherRisk === 'ALTO' 
      ? `Colheita prevista para período de chuvas em ${agroData.eosDate ? new Date(agroData.eosDate).toLocaleString('pt-BR', { month: 'long' }) : 'data indefinida'}. Monitorar umidade do grão e ajustar logística para evitar perdas na qualidade.`
      : 'Análise baseada em regras (IA indisponível).',
    risks,
    recommendations,
    metrics: {
      harvestStart: metrics?.harvestStart || '',
      harvestEnd: metrics?.harvestEnd || '',
      peakStart: metrics?.peakStart || '',
      peakEnd: metrics?.peakEnd || '',
      dailyVolume: metrics?.dailyVolume || 0,
      trucksNeeded: metrics?.trucksNeeded || 0,
      daysToHarvest: metrics?.daysToHarvest,
      metricsSource: 'ALGORITHM',
      weatherRisk,
      grainQualityRisk,
      analysisSource: 'FALLBACK'
    }
  }
}

export const logisticsTemplate: TemplateDefinition = {
  config: logisticsConfig,
  buildSystemPrompt,
  buildUserPrompt,
  parseResponse: (response: any, context?: AnalysisContext) => parseResponse(response, context),
  getFallbackResult
}
