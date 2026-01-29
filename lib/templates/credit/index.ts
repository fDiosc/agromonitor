/**
 * Credit Analysis Template
 * Análise de risco para garantias agrícolas e CPRs
 */

import type { 
  TemplateConfig, 
  TemplateDefinition, 
  AnalysisContext,
  CreditAnalysisResult 
} from '../types'

export const creditConfig: TemplateConfig = {
  id: 'CREDIT',
  name: 'Análise de Crédito',
  description: 'Avaliação de risco para garantias agrícolas, CPRs e operações de crédito rural',
  icon: 'Shield',
  color: 'emerald',
  version: '1.0.0'
}

function buildSystemPrompt(): string {
  return `Você é um Analista de Risco de Crédito e Mercado Agri Sênior (Expert em Monitoramento Satelital para Financiamento e Trading).

CONTEXTO:
Seu usuário é uma Trading (comprador de grãos) ou um Fundo de Crédito (que possui a lavoura como garantia/colateral).
O foco NÃO é manejo agronômico (adubação, pragas), mas sim a SEGURANÇA DA GARANTIA e o RISCO DE DEFAULT/WASHOUT.

TAREFAS:
1. Validar a performance da GARANTIA (Biomassa) frente ao esperado para quitação da dívida ou contrato
2. Identificar RISCOS FINANCEIROS/COMERCIAIS: Quebra de safra, Atraso na colheita, Baixo vigor
3. Recomendar ações de MITIGAÇÃO DE RISCO

CLASSIFICAÇÃO DE STATUS:
- 'NORMAL': Garantia performando bem. Expectativa de volume OK. Risco baixo.
- 'ALERTA': Potencial quebra ou atraso. Monitorar LTV e fluxo.
- 'CRITICO': Perda severa. Alta probabilidade de não entrega ou default.

REGRAS DE NEGÓCIO:
- Vencimento típico de CPRs: Março/Abril
- Atrasos no plantio > 15 dias = risco comercial elevado
- Replantio = avaliar nova janela de colheita
- Correlação histórica < 50% = recomendar vistoria presencial
- NDVI máximo < 0.65 = potencial quebra de produtividade

FORMATO DE RESPOSTA:
Responda EXCLUSIVAMENTE em JSON válido com a estrutura especificada.`
}

function buildUserPrompt(context: AnalysisContext): string {
  const { field, agroData, phenology } = context

  return `## ANÁLISE DE CRÉDITO - Talhão: ${field.name}

### LOCALIZAÇÃO
- Cidade/Estado: ${field.city}/${field.state}
- Área: ${agroData.areaHa?.toFixed(1) || 'N/A'} ha
- Cultura: ${field.crop}

### FENOLOGIA DETECTADA
- Plantio Estimado: ${agroData.plantingDate || 'Não detectado'}
- Emergência (SOS): ${agroData.sosDate || 'Não detectada'}
- Colheita Prevista (EOS): ${agroData.eosDate || 'Não detectada'}
- Método: ${phenology.method}
- Confiança: ${agroData.confidence} (${agroData.confidenceScore}%)

### INDICADORES
- NDVI Máximo: ${agroData.peakNdvi?.toFixed(2) || 'N/A'}
- Correlação Histórica: ${agroData.historicalCorrelation?.toFixed(0) || 'N/A'}%
- Saúde Fenológica: ${agroData.phenologyHealth || 'N/A'}
- Volume Estimado: ${(agroData.volumeEstimatedKg || 0) / 1000} ton
- Replantio Detectado: ${agroData.detectedReplanting ? 'SIM' : 'NÃO'}

### DIAGNÓSTICOS
${phenology.diagnostics.map(d => `- [${d.type}] ${d.message}`).join('\n') || 'Nenhum diagnóstico'}

Gere análise de risco de crédito em JSON com:
{
  "status": "NORMAL" | "ALERTA" | "CRITICO",
  "statusLabel": "Descrição curta do status",
  "summary": "Parecer executivo (max 30 palavras)",
  "risks": ["Risco 1", "Risco 2", ...],
  "recommendations": ["Recomendação 1", "Recomendação 2", ...],
  "metrics": {
    "washoutRisk": "BAIXO" | "MEDIO" | "ALTO",
    "guaranteeHealth": 0-100,
    "deliveryProbability": 0-100,
    "cprAdherence": true/false
  }
}`
}

function parseResponse(response: any): CreditAnalysisResult {
  // Tentar parsear se for string
  const data = typeof response === 'string' ? JSON.parse(response) : response

  return {
    status: data.status || 'ALERTA',
    statusLabel: data.statusLabel || 'Análise concluída',
    statusColor: data.status === 'NORMAL' ? 'green' : data.status === 'CRITICO' ? 'red' : 'yellow',
    summary: data.summary || 'Análise não disponível',
    risks: Array.isArray(data.risks) ? data.risks : [],
    recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
    metrics: {
      washoutRisk: data.metrics?.washoutRisk || 'MEDIO',
      guaranteeHealth: data.metrics?.guaranteeHealth || 50,
      deliveryProbability: data.metrics?.deliveryProbability || 50,
      cprAdherence: data.metrics?.cprAdherence ?? true
    }
  }
}

function getFallbackResult(context: AnalysisContext): CreditAnalysisResult {
  const { agroData } = context
  const correlation = agroData.historicalCorrelation || 50
  const confidence = agroData.confidenceScore || 50
  const peakNdvi = agroData.peakNdvi || 0.5

  // Lógica baseada em regras
  let status: 'NORMAL' | 'ALERTA' | 'CRITICO' = 'ALERTA'
  
  if (correlation > 70 && confidence > 60 && peakNdvi > 0.7) {
    status = 'NORMAL'
  } else if (correlation < 40 || confidence < 30 || peakNdvi < 0.5) {
    status = 'CRITICO'
  }

  const risks: string[] = []
  const recommendations: string[] = []

  if (correlation < 50) {
    risks.push('Baixa correlação histórica - comportamento atípico da safra')
    recommendations.push('Considerar vistoria presencial para validar condições')
  }

  if (peakNdvi < 0.65) {
    risks.push('NDVI abaixo do esperado - possível quebra de produtividade')
  }

  if (agroData.detectedReplanting) {
    risks.push('Replantio detectado - recalcular janela de colheita e volume')
    recommendations.push('Reavaliar cronograma de vencimento do contrato')
  }

  if (risks.length === 0) {
    risks.push('Análise de IA indisponível - dados baseados em algoritmos')
  }

  if (recommendations.length === 0) {
    recommendations.push('Manter monitoramento padrão')
  }

  return {
    status,
    statusLabel: status === 'NORMAL' ? 'Operação Normal' : status === 'CRITICO' ? 'Atenção Crítica' : 'Em Alerta',
    statusColor: status === 'NORMAL' ? 'green' : status === 'CRITICO' ? 'red' : 'yellow',
    summary: 'Análise automática baseada em regras (IA indisponível).',
    risks,
    recommendations,
    metrics: {
      washoutRisk: status === 'CRITICO' ? 'ALTO' : status === 'ALERTA' ? 'MEDIO' : 'BAIXO',
      guaranteeHealth: Math.round(correlation * 0.5 + confidence * 0.3 + peakNdvi * 20),
      deliveryProbability: Math.round(correlation * 0.6 + confidence * 0.4),
      cprAdherence: status !== 'CRITICO'
    }
  }
}

export const creditTemplate: TemplateDefinition = {
  config: creditConfig,
  buildSystemPrompt,
  buildUserPrompt,
  parseResponse,
  getFallbackResult
}
