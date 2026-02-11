# Plano: Validação Visual por IA (Agentes Curador + Juiz)

**Data:** Fevereiro 2026  
**Versão do Sistema:** 0.0.28  
**Origem:** POC Image Analysis (`C:\Users\felip\Documents\Image Analysis`)  
**Complexidade:** Alta  
**Estimativa:** 3-4 semanas

---

## 1. Objetivo

Integrar capacidades de **análise visual de imagens de satélite por IA** ao motor agronômico do Merx, usando um pipeline de 2 agentes (Curador + Juiz) para **validar, questionar ou rejeitar** as projeções algorítmicas existentes (EOS, fenologia, riscos).

---

## 2. Revisão da Codebase Atual (Mapa de Dependências)

### 2.1 Fluxo de Processamento Atual (`POST /api/fields/[id]/process`)

```
route.ts (593 linhas) - ORQUESTRADOR PRINCIPAL
│
├── merx.service.ts → getFullReport() → API Merx (NDVI, precipitação, solo, histórico)
│   └── getComplementaryData() → API Merx (idade lavoura, ZARC)
│
├── phenology.service.ts → calculatePhenology() → SOS, EOS, Peak, confiança
│   └── Usa: movingAverage, detectReplanting, detectSenescenceTrend, calculateDynamicEos
│
├── correlation.service.ts → calculateHistoricalCorrelation()
│
├── zarc.service.ts → analyzeZarc() → Janela de plantio ZARC
│
├── precipitation.service.ts → getPrecipitationForField() [feature flag: enablePrecipitation]
│
├── water-balance.service.ts → getWaterBalanceForField() [feature flag: enableWaterBalance]
│
├── thermal.service.ts → getThermalDataForField() [feature flag: enableThermalSum]
│
├── climate-envelope.service.ts → getClimateEnvelopeForField() [feature flag: enableClimateEnvelope]
│
├── sentinel1.service.ts → getS1DataForField() [feature flag: enableRadarNdvi]
│   └── Usa: Copernicus OAuth2, Statistical API, DpRVI
│
├── rvi-calibration.service.ts → findCoincidentPairs, collectRviNdviPairs, trainLocalModel
│   └── [feature flag: useLocalCalibration]
│
├── ndvi-fusion.service.ts → getFusedNdviForField() [feature flag: useRadarForGaps]
│   └── fuseOpticalAndRadarCalibrated() ou fuseOpticalAndRadar()
│
├── sar-ndvi-adaptive.service.ts → fuseSarNdvi() [feature flag BETA]
│   └── calculateHarvestConfidence()
│
├── AgroData → Persiste no banco (Prisma)
│
└── analysis-queue.service.ts → enqueueAnalysis() → Reprocessa análises existentes
```

### 2.2 Fluxo de Análise (`POST /api/fields/[id]/analyze/[templateId]`)

```
route.ts (174 linhas)
│
├── Monta AnalysisContext (field + agroData + phenology)
│
├── ai.service.ts → runAnalysis(templateId, context)
│   ├── template.buildSystemPrompt()
│   ├── template.buildUserPrompt(context)
│   ├── GoogleGenAI → gemini-3-flash-preview
│   ├── template.parseResponse(text, context)
│   └── Fallback: template.getFallbackResult(context)
│
└── Persiste Analysis no banco
```

### 2.3 Templates Existentes

| Template | Versão | Entrada IA | Saída IA |
|----------|--------|-----------|----------|
| **LOGISTICS** | 2.0 (híbrido) | Métricas algorítmicas pré-calculadas | weatherRisk, grainQualityRisk, risks[], recommendations[] |
| **CREDIT** | 1.0 | Fenologia + indicadores | washoutRisk, guaranteeHealth, deliveryProbability |
| **RISK_MATRIX** | 1.0 | Fenologia + diagnósticos | overallScore, 4 categorias de risco, trend |

### 2.4 Feature Flags Existentes (feature-flags.service.ts)

| Flag | Default | Relevância |
|------|---------|-----------|
| `enableRadarNdvi` | false | **Reutilizar** — Auth CDSE já funciona |
| `useRadarForGaps` | false | **Reutilizar** — Pipeline de imagens usa mesmo auth |
| `useLocalCalibration` | false | Não afetada |
| `enablePrecipitation` | true | Dados úteis para prompt do Juiz |
| `enableWaterBalance` | false | Dados úteis para prompt do Juiz |
| `enableThermalSum` | false | GDD é dado crucial para o Juiz |
| ~~Nova~~ `enableAIValidation` | false | **CRIAR** — Liga/desliga validação visual |
| ~~Nova~~ `aiValidationTrigger` | 'MANUAL' | **CRIAR** — 'MANUAL' / 'ON_PROCESS' / 'ON_LOW_CONFIDENCE' |
| ~~Nova~~ `aiCuratorModel` | 'gemini-2.5-flash-lite' | **CRIAR** — Modelo do Curador |

### 2.5 Credenciais CDSE

O `sentinel1.service.ts` já gerencia credenciais Copernicus por workspace:
- `WorkspaceSettings.copernicusClientId`
- `WorkspaceSettings.copernicusClientSecret`
- Token cache em memória com refresh automático
- **A mesma auth funciona para Process API (imagens)** — apenas precisamos adicionar `processImage()` ao serviço existente.

---

## 3. Arquivos a Criar

| Arquivo | Baseado em (POC) | Adaptações |
|---------|-------------------|------------|
| `lib/services/cdse-images.service.ts` | `lib/cdse.ts` (processImage) | Usa auth do sentinel1.service.ts, sem duplicar token management |
| `lib/evalscripts.ts` | `lib/evalscripts.ts` | Copiar apenas evalscripts de imagem (não stats, Merx já tem) |
| `lib/agents/curator-prompt.ts` | `server/agents/curator-prompt.ts` | Adaptar para incluir dados Merx no prompt |
| `lib/agents/curator.ts` | `server/agents/curator.ts` | Adaptar para usar `@google/genai` (SDK do Merx) em vez de `@google/generative-ai` |
| `lib/agents/judge-prompt.ts` | `server/agents/judge-prompt.ts` | **Reescrever** para receber dados algorítmicos + Merx |
| `lib/agents/judge.ts` | `server/agents/judge.ts` | Adaptar para SDK do Merx, novo formato de resposta |
| `lib/services/ai-validation.service.ts` | `app/api/agentic-analyze/route.ts` | Serviço orquestrador (não API route) |
| `lib/services/ai-pricing.service.ts` | `lib/pricing.ts` | Copiar com ajustes mínimos |

## 4. Arquivos a Modificar

| Arquivo | Modificação | Risco |
|---------|-------------|-------|
| `lib/services/sentinel1.service.ts` | Adicionar `processImage()` exportado (usa auth existente) | **BAIXO** — Apenas adiciona função, não altera existentes |
| `lib/services/feature-flags.service.ts` | Adicionar 3 novas flags (enableAIValidation, aiValidationTrigger, aiCuratorModel) | **BAIXO** — Apenas adiciona campos, defaults preservam comportamento |
| `prisma/schema.prisma` | Adicionar campos em WorkspaceSettings + AgroData + Analysis | **MÉDIO** — Requer migração. Campos opcionais, sem breaking change |
| `app/api/fields/[id]/process/route.ts` | Adicionar bloco de validação IA (condicional por feature flag) | **MÉDIO** — Inserir novo bloco após fusão NDVI, antes do upsert |
| `lib/templates/types.ts` | Adicionar `AIValidationResult` interface | **BAIXO** — Apenas adiciona type |
| `lib/templates/logistics/index.ts` | Enriquecer prompt com dados de validação visual (se disponível) | **BAIXO** — Condicional, não quebra sem dados |
| `lib/templates/risk-matrix/index.ts` | Adicionar anomalias visuais ao prompt | **BAIXO** — Condicional |
| `lib/templates/credit/index.ts` | Adicionar evidência visual ao prompt | **BAIXO** — Condicional |
| `components/templates/analysis-panel.tsx` | Adicionar seção "Validação Visual IA" | **BAIXO** — Nova seção colapsível |

## 5. Arquivos NÃO Modificados (preservados)

| Arquivo | Razão |
|---------|-------|
| `lib/services/phenology.service.ts` | Motor algorítmico intocado — IA valida, não substitui |
| `lib/services/eos-fusion.service.ts` | Fusão EOS continua funcionando como antes |
| `lib/services/ndvi-fusion.service.ts` | Fusão óptico+radar preservada |
| `lib/services/rvi-calibration.service.ts` | Calibração local preservada |
| `lib/services/merx.service.ts` | API Merx preservada |
| `lib/services/ai.service.ts` | Serviço de IA para templates preservado (validação usa serviço separado) |
| `lib/services/analysis-queue.service.ts` | Fila de reprocessamento preservada |
| `lib/services/precipitation.service.ts` | Dados passados para o Juiz, serviço inalterado |
| `lib/services/water-balance.service.ts` | Dados passados para o Juiz, serviço inalterado |
| `lib/services/thermal.service.ts` | GDD passado para o Juiz, serviço inalterado |

---

## 6. Alterações no Schema Prisma

```prisma
// WorkspaceSettings — ADICIONAR campos
model WorkspaceSettings {
  // ... campos existentes preservados ...
  
  // Validação Visual IA (NOVOS)
  enableAIValidation     Boolean  @default(false)
  aiValidationTrigger    String   @default("MANUAL")  // MANUAL | ON_PROCESS | ON_LOW_CONFIDENCE
  aiCuratorModel         String   @default("gemini-2.5-flash-lite")
}

// AgroData — ADICIONAR campos
model AgroData {
  // ... campos existentes preservados ...
  
  // Validação Visual IA (NOVOS — todos opcionais)
  aiValidationResult     String?  // JSON com resultado completo da validação
  aiValidationDate       DateTime?
  aiValidationConfidence Int?     // 0-100
  aiValidationAgreement  String?  // CONFIRMED | QUESTIONED | REJECTED
  aiEosAdjustedDate      DateTime?
  aiVisualAlerts         String?  // JSON array de anomalias visuais
  aiCurationReport       String?  // JSON com relatório do Curador
  aiCostReport           String?  // JSON com custos (tokens, $)
}

// Analysis — ADICIONAR campos opcionais
model Analysis {
  // ... campos existentes preservados ...
  
  // Contexto de validação visual (NOVOS — opcionais)
  aiValidationUsed       Boolean  @default(false)
  aiValidationAgreement  String?  // CONFIRMED | QUESTIONED | REJECTED
}
```

**Migração:** Todos os campos novos são opcionais (`?`) ou têm defaults. Zero breaking change. Comando: `prisma db push`.

---

## 7. Dependências npm

### Já existentes no Merx (NÃO adicionar):
- `@google/genai` ^1.0.0 — SDK Gemini (o Merx usa `@google/genai`, POC usa `@google/generative-ai`)

### Potencialmente necessário:
- **Nenhuma nova dependência.** O POC usa `@google/generative-ai` mas o Merx já tem `@google/genai`. Os agentes precisam ser adaptados para usar o SDK existente do Merx.

**ATENÇÃO: Diferença de SDK**
- Merx: `import { GoogleGenAI } from '@google/genai'` → `ai.models.generateContent({ model, contents, config })`
- POC: `import { GoogleGenerativeAI } from '@google/generative-ai'` → `model.generateContent(parts)`

Os agents devem ser reescritos para o SDK `@google/genai` do Merx. A API é similar mas a assinatura difere.

---

## 8. Implementação Detalhada

### Fase 1: Fundação (Sem impacto no sistema existente)

#### 1.1 Adicionar `processImage()` ao sentinel1.service.ts

```typescript
// ADICIONAR ao final de sentinel1.service.ts (NÃO modifica funções existentes)

const PROCESS_URL = 'https://sh.dataspace.copernicus.eu/api/v1/process'

/**
 * Busca imagem renderizada do CDSE Process API
 * Reutiliza auth existente do sentinel1.service
 */
export async function processImage(
  workspaceId: string,
  params: {
    bbox: [number, number, number, number];
    dateFrom: string;
    dateTo: string;
    evalscript: string;
    dataCollection: string;
    width?: number;
    height?: number;
  }
): Promise<Buffer | null> {
  const accessToken = await getAccessToken(workspaceId)
  if (!accessToken) return null

  const body = {
    input: {
      bounds: {
        bbox: params.bbox,
        properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" }
      },
      data: [{
        dataFilter: {
          timeRange: { from: params.dateFrom, to: params.dateTo },
          ...(params.dataCollection.includes("sentinel-2") || 
              params.dataCollection.includes("landsat")
              ? { maxCloudCoverage: 100 } : {})
        },
        type: params.dataCollection
      }]
    },
    output: {
      width: params.width ?? 512,
      height: params.height ?? 512,
      responses: [{ identifier: "default", format: { type: "image/png" } }]
    },
    evalscript: params.evalscript
  }

  try {
    const response = await fetch(PROCESS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'image/png'
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000)
    })

    if (!response.ok) return null
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error) {
    console.error('[SENTINEL1] Process image error:', error)
    return null
  }
}
```

**Risco:** ZERO — Apenas adiciona nova função exportada. Nenhuma função existente é alterada.

#### 1.2 Criar `lib/evalscripts.ts`

Copiar do POC apenas os evalscripts de **imagem** (True Color S2, NDVI S2, Radar S1, Landsat NDVI, S3 NDVI). **NÃO copiar** evalscripts de stats — o Merx já tem os seus no `sentinel1.service.ts`.

#### 1.3 Criar `lib/services/ai-pricing.service.ts`

Copiar `lib/pricing.ts` do POC com ajustes mínimos.

#### 1.4 Criar `lib/agents/` (4 arquivos)

- `curator-prompt.ts` — Adaptar do POC
- `curator.ts` — Reescrever para SDK `@google/genai`, manter batching
- `judge-prompt.ts` — **Reescrever** com dados Merx (GDD, balanço hídrico, ZARC, etc.)
- `judge.ts` — Reescrever para SDK `@google/genai`

#### 1.5 Feature flags e schema

- Adicionar novos campos ao schema Prisma
- Adicionar novas flags no `feature-flags.service.ts`
- Executar `prisma db push`

**Checkpoint:** Neste ponto, ZERO funcionalidade existente foi alterada. Tudo é aditivo.

---

### Fase 2: Serviço de Validação

#### 2.1 Criar `lib/services/ai-validation.service.ts`

```typescript
/**
 * AI Validation Service
 * Orquestra Curador + Juiz para validar projeções algorítmicas
 */

export interface AIValidationInput {
  // Dados do talhão
  fieldId: string
  workspaceId: string
  geometry: string   // GeoJSON
  cropType: string
  areaHa: number
  
  // Projeções algorítmicas (Camada 1)
  phenology: PhenologyResult
  eosDate: string | null
  confidenceScore: number
  
  // Dados enriquecidos do Merx
  gddData?: ThermalResult        // Soma térmica
  waterBalanceData?: WaterBalanceResult  // Balanço hídrico
  precipitationData?: PrecipResult      // Precipitação
  zarcAnalysis?: ZarcAnalysis           // ZARC
  fusionMetrics?: FusionMetrics         // Métricas de fusão NDVI
  
  // Config
  curatorModel: string
}

export interface AIValidationResult {
  // Validação
  agreement: 'CONFIRMED' | 'QUESTIONED' | 'REJECTED'
  eosAdjustedDate: string | null
  eosAdjustmentReason: string | null
  stageAgreement: boolean
  
  // Anomalias visuais
  visualAlerts: VisualAlert[]
  
  // Colheita
  harvestReadiness: HarvestReadiness
  
  // Riscos
  riskAssessment: RiskAssessment
  
  // Meta
  recommendations: string[]
  confidence: number
  curationReport: CurationReport
  costReport: CostReport
  
  // Imagens de evidência (thumbnails base64 para UI)
  evidenceImages: { date: string, type: string, base64: string }[]
}

export async function runAIValidation(input: AIValidationInput): Promise<AIValidationResult> {
  // 1. Fetch images from CDSE (usa processImage do sentinel1.service.ts)
  // 2. Run Curator (batching)
  // 3. Run Judge (com dados Merx enriquecidos)
  // 4. Calculate costs
  // 5. Return result
}
```

---

### Fase 3: Integração no Processamento

#### 3.1 Modificar `process/route.ts`

Adicionar **novo bloco condicional** no final, ANTES do `prisma.agroData.upsert`, DEPOIS de toda a lógica existente:

```typescript
// =======================================================
// VALIDAÇÃO VISUAL POR IA (se feature habilitada)
// =======================================================
let aiValidationResult: AIValidationResult | null = null

if (field.workspaceId) {
  try {
    const aiValidationEnabled = await isFeatureEnabled(field.workspaceId, 'enableAIValidation')
    const trigger = /* ler aiValidationTrigger do workspace */
    
    const shouldRun = 
      aiValidationEnabled && (
        trigger === 'ON_PROCESS' ||
        (trigger === 'ON_LOW_CONFIDENCE' && finalConfidenceScore < 50)
      )
    
    if (shouldRun) {
      const flags = await getFeatureFlags(field.workspaceId)
      
      aiValidationResult = await runAIValidation({
        fieldId: params.id,
        workspaceId: field.workspaceId,
        geometry: field.geometryJson,
        cropType: field.cropType,
        areaHa,
        phenology,
        eosDate: phenology.eosDate,
        confidenceScore: finalConfidenceScore,
        gddData: thermalData ? JSON.parse(thermalData) : undefined,
        waterBalanceData: waterBalanceData ? JSON.parse(waterBalanceData) : undefined,
        curatorModel: flags.aiCuratorModel || 'gemini-2.5-flash-lite',
      })
      
      // Ajustar confiança baseado na validação
      if (aiValidationResult.agreement === 'CONFIRMED') {
        adjustedConfidence = Math.min(95, adjustedConfidence + 15)
      } else if (aiValidationResult.agreement === 'REJECTED') {
        adjustedConfidence = Math.max(15, adjustedConfidence * 0.4)
      }
      
      console.log('[PROCESS] AI Validation:', {
        agreement: aiValidationResult.agreement,
        adjustedConfidence,
        alerts: aiValidationResult.visualAlerts.length,
        cost: aiValidationResult.costReport.totalCost
      })
    }
  } catch (aiError) {
    console.warn('[PROCESS] AI Validation failed (continuando):', aiError)
    // GRACEFUL DEGRADATION: Sistema continua normalmente sem validação
  }
}
```

**Risco:** BAIXO — Bloco try/catch com graceful degradation. Se falhar, comportamento idêntico ao atual.

#### 3.2 Modificar `prisma.agroData.upsert`

Adicionar campos novos ao upsert (condicional):

```typescript
...(aiValidationResult ? {
  aiValidationResult: JSON.stringify(aiValidationResult),
  aiValidationDate: new Date(),
  aiValidationConfidence: aiValidationResult.confidence,
  aiValidationAgreement: aiValidationResult.agreement,
  aiEosAdjustedDate: aiValidationResult.eosAdjustedDate 
    ? new Date(aiValidationResult.eosAdjustedDate) : null,
  aiVisualAlerts: JSON.stringify(aiValidationResult.visualAlerts),
  aiCurationReport: JSON.stringify(aiValidationResult.curationReport),
  aiCostReport: JSON.stringify(aiValidationResult.costReport),
} : {})
```

---

### Fase 4: Enriquecimento dos Templates

Passar dados de validação visual para os prompts dos templates existentes (quando disponíveis):

#### 4.1 Modificar `lib/templates/types.ts`

```typescript
// ADICIONAR à interface AnalysisContext
export interface AnalysisContext {
  // ... campos existentes preservados ...
  
  // Validação Visual IA (opcional)
  aiValidation?: {
    agreement: 'CONFIRMED' | 'QUESTIONED' | 'REJECTED'
    confidence: number
    visualAlerts: { type: string, severity: string, description: string }[]
    eosAdjustedDate: string | null
    recommendations: string[]
  }
}
```

#### 4.2 Enriquecer prompts dos templates

No `buildUserPrompt()` de cada template, adicionar condicional:

```typescript
${context.aiValidation ? `
### VALIDAÇÃO VISUAL POR IA
- Status: ${context.aiValidation.agreement}
- Confiança visual: ${context.aiValidation.confidence}%
- EOS ajustado: ${context.aiValidation.eosAdjustedDate || 'Sem ajuste'}
- Alertas visuais: ${context.aiValidation.visualAlerts.length}
${context.aiValidation.visualAlerts.map(a => `  - [${a.severity}] ${a.description}`).join('\n')}
` : ''}
```

---

### Fase 5: UI

#### 5.1 Modificar `components/templates/analysis-panel.tsx`

Adicionar seção colapsível "Validação Visual IA":

- Badge: "Confirmado / Questionado / Rejeitado" 
- Thumbnails de imagens de evidência (3-4 melhores)
- Lista de anomalias visuais
- Custo da validação
- Botão "Validar com IA" (se trigger = MANUAL)

---

## 9. Prompt Integrado do Juiz (Nova Versão Merx)

```
Você é um agrônomo sênior. Sua tarefa é VALIDAR as projeções algorítmicas usando
as imagens de satélite curadas e TODOS os dados do sistema.

## RESULTADOS ALGORÍTMICOS DO SISTEMA
- Cultura: ${cropType}
- Plantio: ${plantingDate} (fonte: ${plantingSource})
- SOS: ${sosDate}
- EOS projetado: ${eosDate} (método: ${eosMethod}, confiança: ${confidence}%)
- Peak NDVI: ${peakNdvi} em ${peakDate}
- Saúde fenológica: ${phenologyHealth}

## SOMA TÉRMICA (GDD)
${gddData ? `
- GDD acumulado: ${gddAccumulated} / ${gddRequired} (${gddProgress}%)
- Dias para maturidade: ${daysToMaturity}
- Confiança GDD: ${gddConfidence}
` : 'Não disponível'}

## BALANÇO HÍDRICO
${waterBalanceData ? `
- Déficit acumulado: ${deficit}mm em ${stressDays} dias
- Nível de estresse: ${stressLevel}
- Ajuste EOS por estresse: ${waterAdjustment} dias
` : 'Não disponível'}

## PRECIPITAÇÃO
${precipData ? `
- Últimos 7 dias: ${recentPrecip}mm
- Risco qualidade: ${qualityRisk}
` : 'Não disponível'}

## ZARC
${zarcData ? `
- Janela plantio: ${windowStart} a ${windowEnd}
- Risco no plantio: ${plantingRisk}
- Status: ${plantingStatus}
` : 'Não disponível'}

## FUSÃO NDVI (qualidade da série temporal)
${fusionMetrics ? `
- Gaps preenchidos por radar: ${gapsFilled}
- Contribuição radar: ${radarContribution}%
- Score de continuidade: ${continuityScore}
` : 'Sem fusão aplicada'}

## RELATÓRIO DO CURADOR (qualidade das imagens)
${curatorContextSummary}

## IMAGENS CURADAS
${imageList}

## SÉRIE TEMPORAL NDVI + RADAR
${tables}

## SUA TAREFA
1. A projeção algorítmica de EOS (${eosDate}) é consistente com as imagens?
2. O estágio fenológico detectado confere com o visual?
3. Existem riscos visuais que os algoritmos não detectaram?
4. Recomendações operacionais.

## FORMATO DE RESPOSTA (JSON)
{
  "algorithmicValidation": {
    "eosAgreement": "CONFIRMED" | "QUESTIONED" | "REJECTED",
    "eosAdjustedDate": "YYYY-MM-DD ou null",
    "eosAdjustmentReason": "...",
    "stageAgreement": true/false,
    "stageComment": "..."
  },
  "visualFindings": [{
    "type": "...", "severity": "LOW|MEDIUM|HIGH",
    "description": "...", "affectedArea": "%"
  }],
  "harvestReadiness": {
    "isReady": false, "estimatedDate": "...",
    "delayRisk": "NONE|RAIN|MOISTURE|MATURITY", "delayDays": 0
  },
  "riskAssessment": {
    "overall": "BAIXO|MODERADO|ALTO|CRITICO",
    "climatic": "...", "phytosanitary": "...", "operational": "..."
  },
  "recommendations": ["..."],
  "confidence": 0-100
}
```

---

## 10. Testes e Validação

| Cenário | Resultado Esperado | Como Testar |
|---------|-------------------|-------------|
| Feature flag OFF | Sistema funciona 100% como hoje | Processar talhão com `enableAIValidation: false` |
| Feature flag ON, sem credenciais CDSE | Graceful degradation, sem validação | Workspace sem Copernicus config |
| Feature flag ON, CDSE OK | Pipeline Curador + Juiz executa | Processar talhão real |
| Curador falha (API timeout) | Sistema continua sem validação, log de warning | Simular timeout |
| Juiz discorda do EOS | Badge "QUESTIONADO", ambas datas exibidas | Talhão com dados ambíguos |
| Templates sem validação | Funcionam exatamente como antes | Verificar templates pré-existentes |
| Reprocessamento | Análises reprocessadas incluem validação visual | Testar fila de reprocessamento |

---

## 11. Estimativa de Custo por Talhão

| Componente | Tokens (est.) | Custo (Flash-Lite/Flash 3) |
|-----------|---------------|---------------------------|
| Fetch imagens (CDSE) | — | $0.00 (gratuito) |
| Curador (20-60 imagens, batched) | ~100-150K input | $0.010-0.016 |
| Juiz (20-40 curadas) | ~80-120K input | $0.040-0.069 |
| **Total por talhão** | | **$0.05-0.085** |

---

## 12. Checklist de Implementação

### Fase 1: Fundação (sem impacto) ☐
- [ ] Adicionar `processImage()` ao `sentinel1.service.ts`
- [ ] Criar `lib/evalscripts.ts`
- [ ] Criar `lib/services/ai-pricing.service.ts`
- [ ] Criar `lib/agents/curator-prompt.ts`
- [ ] Criar `lib/agents/curator.ts` (SDK @google/genai)
- [ ] Criar `lib/agents/judge-prompt.ts` (prompt integrado Merx)
- [ ] Criar `lib/agents/judge.ts` (SDK @google/genai)
- [ ] Adicionar feature flags no `feature-flags.service.ts`
- [ ] Atualizar `prisma/schema.prisma` com novos campos
- [ ] Executar `prisma db push`
- [ ] Verificar build: `npm run build`

### Fase 2: Orquestrador ☐
- [ ] Criar `lib/services/ai-validation.service.ts`
- [ ] Implementar fetch de imagens via `processImage()`
- [ ] Implementar pipeline Curador → Juiz
- [ ] Implementar cálculo de custos
- [ ] Verificar build: `npm run build`

### Fase 3: Integração ☐
- [ ] Modificar `process/route.ts` (bloco condicional)
- [ ] Persistir resultado no AgroData
- [ ] Ajustar confiança combinada
- [ ] Testar com feature flag OFF (sem mudança)
- [ ] Testar com feature flag ON

### Fase 4: Templates ☐
- [ ] Atualizar `types.ts` com `aiValidation`
- [ ] Enriquecer prompt Logistics
- [ ] Enriquecer prompt Credit
- [ ] Enriquecer prompt Risk Matrix
- [ ] Testar templates com e sem validação

### Fase 5: UI ☐
- [ ] Seção "Validação Visual IA" no analysis-panel
- [ ] Badge de agreement (Confirmado/Questionado/Rejeitado)
- [ ] Thumbnails de evidência
- [ ] Botão "Validar com IA" (trigger manual)
- [ ] Feature flag na tela de Settings

### Fase 6: Documentação ☐
- [ ] Atualizar METHODOLOGY-V2.md
- [ ] Atualizar CHANGELOG.md
- [ ] Incrementar versão em lib/version.ts

---

## 13. Riscos e Mitigações

| Risco | Prob. | Impacto | Mitigação |
|-------|-------|---------|-----------|
| Breaking change no schema | Baixa | Alto | Todos os campos novos são opcionais |
| Timeout no fetch de imagens | Média | Baixo | try/catch + graceful degradation |
| Custo inesperado de IA | Baixa | Médio | Feature flag + controle por workspace |
| SDK @google/genai diferente | Média | Médio | Testar batching com novo SDK antes de tudo |
| process/route.ts muito grande | Média | Baixo | Toda lógica encapsulada no service |
| Rate limit CDSE com imagens | Média | Baixo | Batching com stagger já implementado no POC |

---

*Documento criado em: Fevereiro 2026*
*Baseado na revisão completa do codebase v0.0.28*
