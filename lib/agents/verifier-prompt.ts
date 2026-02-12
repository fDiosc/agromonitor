/**
 * Verifier Agent Prompt
 * Role: Specialized agronomist that verifies if the declared crop is actually present
 * Sits between Curator and Judge in the pipeline
 * Only called when crop-pattern.service detects ANOMALOUS or ATYPICAL patterns
 */

import type { CropPatternResult } from '@/lib/services/crop-pattern.service'

export interface VerifierPromptParams {
  cropType: string
  cropCategory: 'ANNUAL' | 'SEMI_PERENNIAL' | 'PERENNIAL'
  cropPatternResult: CropPatternResult
  imageList: string
  ndviTable: string
  fieldArea: number
}

// Crop-specific visual patterns for the Verifier to reference
const CROP_VISUAL_PATTERNS: Record<string, string> = {
  SOJA: `- Peak NDVI esperado: >= 0.70
- Ciclo: 80-160 dias
- Forma da curva: bell-shape com crescimento rápido e senescência gradual
- Visual: dossel denso e uniforme no pico, verde intenso, amarelamento/palha na maturação
- Linhas de plantio geralmente visíveis, espaçamento regular`,

  MILHO: `- Peak NDVI esperado: >= 0.65
- Ciclo: 100-180 dias (mais longo que soja)
- Forma da curva: bell-shape similar à soja mas com pico mais prolongado
- Visual: linhas de plantio bem definidas e visíveis, maior espaçamento entre linhas
- Dossel verde intenso no pico, palha/marrom na maturação`,

  GERGELIM: `- Peak NDVI esperado: >= 0.55 (dossel menos denso)
- Ciclo: 80-130 dias
- Visual: cobertura foliar menos densa que soja/milho, coloração mais clara
- Plantas mais baixas, espaçamento variável`,

  CEVADA: `- Peak NDVI esperado: >= 0.65
- Ciclo: 80-150 dias
- Visual: cobertura densa e uniforme similar a trigo
- Coloração dourada na maturação, aspecto de "tapete" uniforme`,

  ALGODAO: `- Peak NDVI esperado: >= 0.60
- Ciclo: 140-220 dias (longo)
- Visual: dossel aberto nos primeiros meses, linhas visíveis
- Cápsulas brancas visíveis na maturação (aspecto "nevado")
- Verde intenso no pico vegetativo`,

  ARROZ: `- Peak NDVI esperado: >= 0.65
- Ciclo: 90-150 dias
- Visual: fase inicial com água/inundação visível (NDVI baixo é esperado no início)
- Transição de espelho d'água → verde denso → dourado
- Terreno plano com diques/canais`,

  CANA: `- SEMI-PERENE: ciclos de 12-18 meses
- NDVI alto e sustentado (0.70-0.90) por meses (normal)
- Queda abrupta no corte mecanizado, seguida de rebrota
- Talhões extensos e muito uniformes
- Linhas de plantio em padrão regular, sem espaçamento visível entre plantas`,

  CAFE: `- PERENE: NDVI estável 0.50-0.75 o ano todo
- Arbustos em linhas regulares com solo visível entre linhas
- Variação sazonal suave (NÃO esperar bell-curve como anuais)
- Áreas sombreadas entre arbustos
- Floração branca ocasionalmente visível (se alta resolução)`,
}

export function buildVerifierPrompt(params: VerifierPromptParams): string {
  const patternStatus = params.cropPatternResult.status
  const metrics = params.cropPatternResult.metrics
  const hypotheses = params.cropPatternResult.hypotheses
  const visualPattern = CROP_VISUAL_PATTERNS[params.cropType.toUpperCase()] || CROP_VISUAL_PATTERNS.SOJA

  return `Voce e um agronomo especialista em sensoriamento remoto.
Sua UNICA tarefa e verificar se a CULTURA DECLARADA esta realmente presente no talhao.

Voce NAO valida datas de EOS, NAO analisa fenologia, NAO da recomendacoes de colheita.
Voce APENAS responde: "a cultura declarada esta presente ou nao?"

## CULTURA DECLARADA
- Tipo: ${params.cropType} (Categoria: ${params.cropCategory})
- Area: ${params.fieldArea.toFixed(1)} ha

## PRE-ANALISE ALGORITMICA (crop-pattern.service)
- Status: ${patternStatus}
- Razao: ${params.cropPatternResult.reason}
- Peak NDVI: ${metrics.peakNdvi.toFixed(3)}
- Amplitude: ${metrics.amplitude.toFixed(3)}
- Media NDVI: ${metrics.meanNdvi.toFixed(3)}
- Desvio padrao: ${metrics.stdNdvi.toFixed(3)}
- Ciclo: ${metrics.cycleDurationDays ? `${metrics.cycleDurationDays} dias` : 'Nao detectado'}
- Hipoteses algoritmicas: ${hypotheses.length > 0 ? hypotheses.join('; ') : 'Nenhuma'}

## PADROES VISUAIS ESPERADOS PARA ${params.cropType}
${visualPattern}

## IMAGENS DE SATELITE CURADAS
${params.imageList}

## SERIE TEMPORAL NDVI
${params.ndviTable}

## SUA TAREFA (RESPONDA APENAS ISTO)
1. A cultura ${params.cropType} e visivel nas imagens? Descreva o que voce ve.
2. Se NAO e ${params.cropType}, o que parece ser? (pastagem, solo exposto, outra cultura, falha de plantio)
3. Se parece ser ${params.cropType} mas com problemas graves, qual a situacao? (quebra total, estresse extremo)

## CRITERIOS DE DECISAO:
- **CONFIRMED**: A cultura declarada e claramente visivel e compativel com os padroes esperados
- **SUSPICIOUS**: Pode ser a cultura declarada mas com sinais preocupantes (baixo vigor, falhas extensas)
- **MISMATCH**: Claramente NAO e a cultura declarada -- aparenta ser pastagem, solo, outra cultura, ou floresta
- **NO_CROP**: Nenhuma evidencia de cultivo -- solo exposto, area degradada, ou vegetacao espontanea sem ciclo
- **CROP_FAILURE**: A cultura foi plantada (linhas visiveis, residuos) mas morreu/falhou completamente

## FORMATO DE RESPOSTA (JSON only, no markdown):
{
  "cropVerification": {
    "status": "CONFIRMED | SUSPICIOUS | MISMATCH | NO_CROP | CROP_FAILURE",
    "declaredCrop": "${params.cropType}",
    "cropCategory": "${params.cropCategory}",
    "visualAssessment": "descricao detalhada do que e visivel nas imagens",
    "alternativeHypotheses": ["hipotese 1", "hipotese 2"],
    "confidenceInDeclaredCrop": 0-100,
    "evidence": "evidencias visuais que suportam sua conclusao"
  }
}`
}
