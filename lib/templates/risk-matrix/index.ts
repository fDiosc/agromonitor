/**
 * Risk Matrix Analysis Template
 * Visão consolidada de todos os riscos do talhão
 */

import type { 
  TemplateConfig, 
  TemplateDefinition, 
  AnalysisContext,
  RiskMatrixAnalysisResult 
} from '../types'

export const riskMatrixConfig: TemplateConfig = {
  id: 'RISK_MATRIX',
  name: 'Matriz de Risco',
  description: 'Visão consolidada de todos os riscos do talhão em categorias',
  icon: 'AlertTriangle',
  color: 'amber',
  version: '1.0.0'
}

function buildSystemPrompt(): string {
  return `Você é um Analista de Risco Agrícola Consolidado.

CONTEXTO:
Seu objetivo é fornecer uma VISÃO 360° de todos os riscos do talhão, categorizados e priorizados.
O usuário precisa de uma análise rápida e visual para tomada de decisão.

CATEGORIAS DE RISCO:

1. CLIMÁTICO
   - Seca prolongada
   - Excesso de chuva
   - Granizo
   - Geada
   - Veranicos

2. FENOLÓGICO
   - Atraso no plantio
   - Replantio
   - Baixo vigor (NDVI)
   - Ciclo irregular
   - Maturação desuniforme

3. OPERACIONAL
   - Dificuldade de colheita
   - Janela apertada
   - Risco de perdas
   - Logística comprometida

4. COMERCIAL
   - Risco de washout
   - Atraso vs contrato
   - Preço desfavorável
   - Inadimplência

SCORE GERAL (0-100):
- 80-100: EXCELENTE - Baixo risco geral
- 60-79: BOM - Alguns riscos menores
- 40-59: ATENCAO - Riscos moderados, requer monitoramento
- 0-39: CRITICO - Alto risco, ação imediata

TENDÊNCIA:
- IMPROVING: Indicadores melhorando
- STABLE: Sem mudanças significativas
- WORSENING: Indicadores piorando

FORMATO DE RESPOSTA:
Responda EXCLUSIVAMENTE em JSON válido com a estrutura especificada.`
}

function buildUserPrompt(context: AnalysisContext): string {
  const { field, agroData, phenology } = context

  return `## MATRIZ DE RISCO - Talhão: ${field.name}

### LOCALIZAÇÃO
- Cidade/Estado: ${field.city}/${field.state}
- Área: ${agroData.areaHa?.toFixed(1) || 'N/A'} ha
- Cultura: ${field.cropType}

### FENOLOGIA
- Plantio: ${agroData.plantingDate || 'Não detectado'}
- Emergência (SOS): ${agroData.sosDate || 'Não detectada'}
- Colheita (EOS): ${agroData.eosDate || 'Não detectada'}
- Método: ${phenology.method}
- Ciclo: ${agroData.cycleDays || 120} dias

### INDICADORES DE SAÚDE
- NDVI Máximo: ${agroData.peakNdvi?.toFixed(2) || 'N/A'}
- Saúde Fenológica: ${agroData.phenologyHealth || 'N/A'}
- Correlação Histórica: ${agroData.historicalCorrelation?.toFixed(0) || 'N/A'}%
- Confiança: ${agroData.confidence} (${agroData.confidenceScore}%)

### ALERTAS
- Replantio Detectado: ${agroData.detectedReplanting ? 'SIM ⚠️' : 'NÃO'}

### DIAGNÓSTICOS
${phenology.diagnostics.map(d => `- [${d.type}] ${d.message}`).join('\n') || 'Nenhum diagnóstico'}

Gere matriz de risco em JSON com:
{
  "status": "EXCELENTE" | "BOM" | "ATENCAO" | "CRITICO",
  "statusLabel": "Descrição curta",
  "summary": "Visão geral consolidada (max 30 palavras)",
  "risks": ["Risco prioritário 1", "Risco 2", ...],
  "recommendations": ["Ação prioritária 1", ...],
  "metrics": {
    "overallScore": 0-100,
    "climaticRisk": "BAIXO" | "MEDIO" | "ALTO" | "CRITICO",
    "phenologicalRisk": "BAIXO" | "MEDIO" | "ALTO" | "CRITICO",
    "operationalRisk": "BAIXO" | "MEDIO" | "ALTO" | "CRITICO",
    "commercialRisk": "BAIXO" | "MEDIO" | "ALTO" | "CRITICO",
    "trend": "IMPROVING" | "STABLE" | "WORSENING"
  }
}`
}

function parseResponse(response: any): RiskMatrixAnalysisResult {
  const data = typeof response === 'string' ? JSON.parse(response) : response

  return {
    status: data.status || 'ATENCAO',
    statusLabel: data.statusLabel || 'Análise concluída',
    statusColor: data.status === 'EXCELENTE' || data.status === 'BOM' ? 'green' 
               : data.status === 'CRITICO' ? 'red' : 'yellow',
    summary: data.summary || 'Análise não disponível',
    risks: Array.isArray(data.risks) ? data.risks : [],
    recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
    metrics: {
      overallScore: data.metrics?.overallScore || 50,
      climaticRisk: data.metrics?.climaticRisk || 'MEDIO',
      phenologicalRisk: data.metrics?.phenologicalRisk || 'MEDIO',
      operationalRisk: data.metrics?.operationalRisk || 'MEDIO',
      commercialRisk: data.metrics?.commercialRisk || 'MEDIO',
      trend: data.metrics?.trend || 'STABLE'
    }
  }
}

function getFallbackResult(context: AnalysisContext): RiskMatrixAnalysisResult {
  const { agroData, phenology } = context
  
  const correlation = agroData.historicalCorrelation || 50
  const confidence = agroData.confidenceScore || 50
  const peakNdvi = agroData.peakNdvi || 0.5
  const hasReplanting = agroData.detectedReplanting
  const eosDate = agroData.eosDate

  // Calcular riscos individuais
  const calculateRisk = (value: number, thresholds: number[]): 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO' => {
    if (value >= thresholds[0]) return 'BAIXO'
    if (value >= thresholds[1]) return 'MEDIO'
    if (value >= thresholds[2]) return 'ALTO'
    return 'CRITICO'
  }

  // Risco fenológico baseado no NDVI e confiança
  const phenoScore = (peakNdvi * 50) + (confidence * 0.5)
  const phenologicalRisk = calculateRisk(phenoScore, [70, 50, 30])

  // Risco climático baseado na época de colheita
  let climaticRisk: 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO' = 'BAIXO'
  if (eosDate) {
    const month = new Date(eosDate).getMonth() + 1
    if (month >= 1 && month <= 2) climaticRisk = 'ALTO'
    else if (month === 3 || month === 12) climaticRisk = 'MEDIO'
  }

  // Risco operacional baseado na saúde fenológica
  const operationalRisk = phenology.phenologyHealth === 'POOR' ? 'ALTO' 
                        : phenology.phenologyHealth === 'FAIR' ? 'MEDIO' : 'BAIXO'

  // Risco comercial baseado na correlação
  const commercialRisk = calculateRisk(correlation, [70, 50, 30])

  // Score geral
  const riskScores = {
    'BAIXO': 90,
    'MEDIO': 60,
    'ALTO': 35,
    'CRITICO': 15
  }
  
  const overallScore = Math.round(
    (riskScores[climaticRisk] + riskScores[phenologicalRisk] + 
     riskScores[operationalRisk] + riskScores[commercialRisk]) / 4
  )

  // Determinar status
  let status: 'EXCELENTE' | 'BOM' | 'ATENCAO' | 'CRITICO'
  if (overallScore >= 80) status = 'EXCELENTE'
  else if (overallScore >= 60) status = 'BOM'
  else if (overallScore >= 40) status = 'ATENCAO'
  else status = 'CRITICO'

  // Determinar tendência
  let trend: 'IMPROVING' | 'STABLE' | 'WORSENING' = 'STABLE'
  if (phenology.method === 'ALGORITHM' && peakNdvi > 0.7) trend = 'IMPROVING'
  if (hasReplanting || peakNdvi < 0.5) trend = 'WORSENING'

  // Construir riscos e recomendações
  const risks: string[] = []
  const recommendations: string[] = []

  if (climaticRisk === 'ALTO' || climaticRisk === 'CRITICO' as string) {
    risks.push('Risco climático elevado - colheita em período chuvoso')
    recommendations.push('Preparar contingência para secagem e armazenagem')
  }

  if (phenologicalRisk === 'ALTO' || phenologicalRisk === 'CRITICO' as string) {
    risks.push('Desenvolvimento fenológico abaixo do esperado')
    recommendations.push('Intensificar monitoramento semanal')
  }

  if (hasReplanting) {
    risks.push('Replantio detectado - ciclo pode estar comprometido')
    recommendations.push('Recalcular janelas e volumes contratuais')
  }

  if (commercialRisk === 'ALTO' || commercialRisk === 'CRITICO') {
    risks.push('Comportamento atípico vs histórico - risco comercial elevado')
    recommendations.push('Considerar vistoria presencial')
  }

  if (risks.length === 0) {
    risks.push('Sem riscos críticos identificados')
    recommendations.push('Manter monitoramento padrão')
  }

  return {
    status,
    statusLabel: status === 'EXCELENTE' ? 'Excelente' : status === 'BOM' ? 'Bom' 
               : status === 'ATENCAO' ? 'Atenção' : 'Crítico',
    statusColor: status === 'EXCELENTE' || status === 'BOM' ? 'green' 
               : status === 'CRITICO' ? 'red' : 'yellow',
    summary: 'Análise automática baseada em regras (IA indisponível).',
    risks,
    recommendations,
    metrics: {
      overallScore,
      climaticRisk,
      phenologicalRisk,
      operationalRisk,
      commercialRisk,
      trend
    }
  }
}

export const riskMatrixTemplate: TemplateDefinition = {
  config: riskMatrixConfig,
  buildSystemPrompt,
  buildUserPrompt,
  parseResponse,
  getFallbackResult
}
