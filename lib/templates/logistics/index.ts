/**
 * Logistics Analysis Template
 * Previsão de colheita e planejamento de transporte
 */

import type { 
  TemplateConfig, 
  TemplateDefinition, 
  AnalysisContext,
  LogisticsAnalysisResult 
} from '../types'

export const logisticsConfig: TemplateConfig = {
  id: 'LOGISTICS',
  name: 'Análise Logística',
  description: 'Previsão de colheita e planejamento de transporte para originação',
  icon: 'Truck',
  color: 'blue',
  version: '1.0.0'
}

function buildSystemPrompt(): string {
  return `Você é um Especialista em Logística Agrícola e Originação de Grãos.

CONTEXTO:
Seu usuário é uma Trading, Cooperativa ou Transportadora que precisa planejar a recepção e transporte de grãos.
O foco é PLANEJAMENTO OPERACIONAL: quando começa a colheita, qual o volume diário, quando é o pico.

TAREFAS:
1. Estimar janela de colheita com precisão de +/- 5 dias
2. Calcular volume diário esperado baseado na área e ciclo
3. Identificar período de pico de demanda logística
4. Avaliar riscos climáticos que afetam a operação
5. Prever impacto na qualidade do grão (colheita na chuva)

MÉTRICAS LOGÍSTICAS:
- Capacidade média de colheitadeira: 50-80 ha/dia (dependendo do tamanho)
- Para áreas < 100 ha: considerar 1-2 colheitadeiras
- Rendimento de transporte: 30-40 ton por carreta
- Janela ideal de colheita: umidade grão 13-14%
- Ciclo de colheita típico: 5-10 dias para cada 100 ha

CLASSIFICAÇÃO DE STATUS:
- 'OTIMO': Janela clara, sem riscos climáticos significativos
- 'ATENCAO': Janela apertada ou risco climático moderado
- 'CRITICO': Alto risco de atraso ou perda de qualidade

FORMATO DE RESPOSTA:
Responda EXCLUSIVAMENTE em JSON válido com a estrutura especificada.`
}

function buildUserPrompt(context: AnalysisContext): string {
  const { field, agroData, phenology } = context
  const volumeTon = (agroData.volumeEstimatedKg || 0) / 1000

  return `## ANÁLISE LOGÍSTICA - Talhão: ${field.name}

### LOCALIZAÇÃO
- Cidade/Estado: ${field.city}/${field.state}
- Área: ${agroData.areaHa?.toFixed(1) || 'N/A'} ha
- Cultura: ${field.crop}

### FENOLOGIA E COLHEITA
- Plantio Estimado: ${agroData.plantingDate || 'Não detectado'}
- Colheita Prevista (EOS): ${agroData.eosDate || 'Não detectada'}
- Método de Detecção: ${phenology.method}
- Ciclo: ${agroData.cycleDays || 120} dias

### VOLUME
- Volume Estimado: ${volumeTon.toFixed(0)} ton
- Produtividade: ${(phenology.yieldEstimateKgHa / 1000).toFixed(1)} ton/ha

### INDICADORES
- NDVI Máximo: ${agroData.peakNdvi?.toFixed(2) || 'N/A'}
- Correlação Histórica: ${agroData.historicalCorrelation?.toFixed(0) || 'N/A'}%
- Confiança: ${agroData.confidence} (${agroData.confidenceScore}%)

### CONTEXTO REGIONAL
- Período típico de chuvas: Outubro a Março
- Risco de colheita chuvosa se EOS entre Janeiro e Março

Gere análise logística em JSON com:
{
  "status": "OTIMO" | "ATENCAO" | "CRITICO",
  "statusLabel": "Descrição curta",
  "summary": "Resumo operacional (max 30 palavras)",
  "risks": ["Risco 1", "Risco 2", ...],
  "recommendations": ["Recomendação 1", ...],
  "metrics": {
    "harvestStart": "YYYY-MM-DD",
    "harvestEnd": "YYYY-MM-DD",
    "dailyVolume": número em ton/dia,
    "peakStart": "YYYY-MM-DD",
    "peakEnd": "YYYY-MM-DD",
    "weatherRisk": "BAIXO" | "MEDIO" | "ALTO",
    "grainQualityRisk": "BAIXO" | "MEDIO" | "ALTO",
    "trucksNeeded": número de carretas
  }
}`
}

function parseResponse(response: any): LogisticsAnalysisResult {
  const data = typeof response === 'string' ? JSON.parse(response) : response

  return {
    status: data.status || 'ATENCAO',
    statusLabel: data.statusLabel || 'Análise concluída',
    statusColor: data.status === 'OTIMO' ? 'green' : data.status === 'CRITICO' ? 'red' : 'yellow',
    summary: data.summary || 'Análise não disponível',
    risks: Array.isArray(data.risks) ? data.risks : [],
    recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
    metrics: {
      harvestStart: data.metrics?.harvestStart || '',
      harvestEnd: data.metrics?.harvestEnd || '',
      dailyVolume: data.metrics?.dailyVolume || 0,
      peakStart: data.metrics?.peakStart || '',
      peakEnd: data.metrics?.peakEnd || '',
      weatherRisk: data.metrics?.weatherRisk || 'MEDIO',
      grainQualityRisk: data.metrics?.grainQualityRisk || 'MEDIO',
      trucksNeeded: data.metrics?.trucksNeeded || 0
    }
  }
}

function getFallbackResult(context: AnalysisContext): LogisticsAnalysisResult {
  const { agroData } = context
  const areaHa = agroData.areaHa || 100
  const volumeTon = (agroData.volumeEstimatedKg || 0) / 1000
  const eosDate = agroData.eosDate

  // Calcular janela de colheita
  let harvestStart = ''
  let harvestEnd = ''
  let peakStart = ''
  let peakEnd = ''

  if (eosDate) {
    const eos = new Date(eosDate)
    
    // Colheita começa ~5 dias antes do EOS estimado
    const start = new Date(eos)
    start.setDate(start.getDate() - 5)
    harvestStart = start.toISOString().split('T')[0]

    // Duração baseada na área (10 dias por 100 ha)
    const daysToHarvest = Math.ceil(areaHa / 80) * 2 // 2 dias a cada 80 ha
    const end = new Date(start)
    end.setDate(end.getDate() + Math.max(daysToHarvest, 5))
    harvestEnd = end.toISOString().split('T')[0]

    // Pico no meio
    const peakS = new Date(start)
    peakS.setDate(peakS.getDate() + 2)
    peakStart = peakS.toISOString().split('T')[0]

    const peakE = new Date(end)
    peakE.setDate(peakE.getDate() - 2)
    peakEnd = peakE.toISOString().split('T')[0]
  }

  // Volume diário (assumindo 80 ha/dia de colheita)
  const dailyVolume = Math.round((volumeTon / areaHa) * 80)

  // Carretas necessárias (35 ton por carreta, 2 viagens por dia)
  const trucksNeeded = Math.ceil(dailyVolume / (35 * 2))

  // Verificar risco climático (colheita entre Jan-Mar)
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
    recommendations.push('Preparar logística de secagem e armazenagem')
  }

  if (!eosDate) {
    risks.push('Data de colheita não determinada com precisão')
    recommendations.push('Monitorar evolução do NDVI semanalmente')
  }

  if (risks.length === 0) {
    recommendations.push('Janela de colheita dentro do esperado - manter planejamento')
  }

  return {
    status: weatherRisk === 'ALTO' ? 'CRITICO' : weatherRisk === 'MEDIO' ? 'ATENCAO' : 'OTIMO',
    statusLabel: weatherRisk === 'ALTO' ? 'Atenção Crítica' : weatherRisk === 'MEDIO' ? 'Requer Atenção' : 'Situação Ótima',
    statusColor: weatherRisk === 'ALTO' ? 'red' : weatherRisk === 'MEDIO' ? 'yellow' : 'green',
    summary: 'Análise automática baseada em regras (IA indisponível).',
    risks,
    recommendations,
    metrics: {
      harvestStart,
      harvestEnd,
      dailyVolume,
      peakStart,
      peakEnd,
      weatherRisk,
      grainQualityRisk,
      trucksNeeded
    }
  }
}

export const logisticsTemplate: TemplateDefinition = {
  config: logisticsConfig,
  buildSystemPrompt,
  buildUserPrompt,
  parseResponse,
  getFallbackResult
}
