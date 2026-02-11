/**
 * Judge Agent Prompt
 * Role: Senior agronomist performing algorithmic validation using satellite imagery
 * Rewritten for Merx integration with GDD, water balance, ZARC, and fusion metrics
 * Adapted from POC Image Analysis server/agents/judge-prompt.ts
 */

export interface JudgePromptParams {
  // Field info
  fieldArea: number
  cropType: string

  // Algorithmic results from Merx pipeline
  plantingDate: string | null
  plantingSource: string
  sosDate: string | null
  eosDate: string | null
  eosMethod: string
  confidence: number
  peakNdvi: number | null
  peakDate: string | null
  phenologyHealth: string | null

  // Curator output
  curatorContextSummary: string
  imageList: string

  // Time series tables
  multiSensorNdviTable: string
  radarTable: string

  // Enriched Merx data (optional sections)
  gddData?: {
    accumulated: number
    required: number
    progress: number
    daysToMaturity: number | null
    confidence: string
  }
  waterBalanceData?: {
    deficit: number
    stressDays: number
    stressLevel: string
    waterAdjustment: number
  }
  precipData?: {
    recentPrecipMm: number
    qualityRisk: string
  }
  zarcData?: {
    windowStart: string
    windowEnd: string
    plantingRisk: number
    plantingStatus: string
  }
  fusionMetrics?: {
    gapsFilled: number
    radarContribution: number
    continuityScore: number
  }
}

export function buildJudgePrompt(params: JudgePromptParams): string {
  // Build optional sections
  const gddSection = params.gddData
    ? `## SOMA TERMICA (GDD)
- GDD acumulado: ${params.gddData.accumulated} / ${params.gddData.required} (${params.gddData.progress.toFixed(1)}%)
- Dias para maturidade: ${params.gddData.daysToMaturity ?? 'N/A'}
- Confianca GDD: ${params.gddData.confidence}
`
    : `## SOMA TERMICA (GDD)
Nao disponivel
`

  const waterBalanceSection = params.waterBalanceData
    ? `## BALANCO HIDRICO
- Deficit acumulado: ${params.waterBalanceData.deficit}mm em ${params.waterBalanceData.stressDays} dias
- Nivel de estresse: ${params.waterBalanceData.stressLevel}
- Ajuste EOS por estresse: ${params.waterBalanceData.waterAdjustment} dias
`
    : `## BALANCO HIDRICO
Nao disponivel
`

  const precipSection = params.precipData
    ? `## PRECIPITACAO
- Ultimos 7 dias: ${params.precipData.recentPrecipMm}mm
- Risco qualidade: ${params.precipData.qualityRisk}
`
    : `## PRECIPITACAO
Nao disponivel
`

  const zarcSection = params.zarcData
    ? `## ZARC
- Janela plantio: ${params.zarcData.windowStart} a ${params.zarcData.windowEnd}
- Risco no plantio: ${params.zarcData.plantingRisk}
- Status: ${params.zarcData.plantingStatus}
`
    : `## ZARC
Nao disponivel
`

  const fusionSection = params.fusionMetrics
    ? `## FUSAO NDVI (qualidade da serie temporal)
- Gaps preenchidos por radar: ${params.fusionMetrics.gapsFilled}
- Contribuicao radar: ${params.fusionMetrics.radarContribution}%
- Score de continuidade: ${params.fusionMetrics.continuityScore}
`
    : `## FUSAO NDVI
Sem fusao aplicada
`

  return `Voce e um agronomo senior. Sua tarefa e VALIDAR as projecoes algoritmicas usando
as imagens de satelite curadas e TODOS os dados do sistema.

## RESULTADOS ALGORITMICOS DO SISTEMA
- Cultura: ${params.cropType}
- Plantio: ${params.plantingDate ?? 'Nao detectado'} (fonte: ${params.plantingSource})
- SOS: ${params.sosDate ?? 'Nao detectado'}
- EOS projetado: ${params.eosDate ?? 'Nao projetado'} (metodo: ${params.eosMethod}, confianca: ${params.confidence}%)
- Peak NDVI: ${params.peakNdvi?.toFixed(3) ?? 'N/A'} em ${params.peakDate ?? 'N/A'}
- Saude fenologica: ${params.phenologyHealth ?? 'N/A'}

${gddSection}
${waterBalanceSection}
${precipSection}
${zarcSection}
${fusionSection}

## RELATORIO DO CURADOR (qualidade das imagens)
${params.curatorContextSummary}

## IMAGENS CURADAS
${params.imageList}

## SERIE TEMPORAL NDVI + RADAR

### Multi-Sensor NDVI (sorted chronologically):
${params.multiSensorNdviTable}

### Radar Backscatter Time Series (Sentinel-1 GRD - 100% cloud-independent):
${params.radarTable}

## SUA TAREFA
1. A projecao algoritmica de EOS (${params.eosDate ?? 'N/A'}) e consistente com as imagens?
2. O estagio fenologico detectado confere com o visual?
3. Existem riscos visuais que os algoritmos nao detectaram?
4. Recomendacoes operacionais.

## CRITERIOS DE DECISAO OBRIGATORIOS:
- **CONFIRMED**: Evidencia visual concorda com o EOS projetado com divergencia <= 7 dias E o estagio fenologico visual confere.
- **QUESTIONED**: Divergencia entre 7-14 dias OU estagio fenologico parcialmente divergente OU riscos visuais moderados que podem impactar a projecao.
- **REJECTED**: Divergencia > 14 dias OU contradicao visual clara (ex: cultura verde quando projecao indica maturacao, ou cultura seca quando projecao indica vegetativo).

IMPORTANTE: Use a data EOS SOMENTE como referencia. Se a cultura claramente ja maturou (coloracao marrom/palha visivel), o eosAdjustedDate deve ser a data da IMAGEM que mostra essa maturacao, NAO uma data anterior.

## FORMATO DE RESPOSTA (JSON only, no markdown):
{
  "algorithmicValidation": {
    "eosAgreement": "CONFIRMED | QUESTIONED | REJECTED",
    "eosAdjustedDate": "YYYY-MM-DD ou null",
    "eosAdjustmentReason": "razao do ajuste ou null",
    "stageAgreement": true/false,
    "stageComment": "comentario sobre o estagio fenologico"
  },
  "visualFindings": [{
    "type": "tipo da anomalia",
    "severity": "LOW|MEDIUM|HIGH",
    "description": "descricao detalhada",
    "affectedArea": "porcentagem estimada"
  }],
  "harvestReadiness": {
    "ready": false,
    "estimatedDate": "YYYY-MM-DD ou null",
    "delayRisk": "NONE|RAIN|MOISTURE|MATURITY",
    "delayDays": 0,
    "notes": "observacoes sobre prontidao para colheita"
  },
  "riskAssessment": {
    "overallRisk": "LOW|MEDIUM|HIGH|CRITICAL",
    "factors": [
      {
        "category": "CLIMATIC|PHYTOSANITARY|OPERATIONAL",
        "severity": "LOW|MEDIUM|HIGH",
        "description": "descricao do fator de risco"
      }
    ]
  },
  "recommendations": ["recomendacao 1", "recomendacao 2"],
  "confidence": 0-100
}`
}
