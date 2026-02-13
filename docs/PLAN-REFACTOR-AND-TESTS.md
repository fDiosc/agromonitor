# Plano de Implementação: Testes, Refatoração e Compliance Científica

**Versão:** 1.0  
**Data:** 2026-02-13  
**Baseline:** v0.0.35  
**Objetivo:** Tornar a codebase sustentável para vibe coding de longo prazo, com rede de segurança (testes), arquivos atômicos (~300 linhas), e conformidade científica auditada.

---

## Visão Geral das Fases

| Fase | Nome | Objetivo | Risco sem fazer |
|------|------|----------|-----------------|
| **1** | Setup de Testes | Infraestrutura Jest + helpers | Nenhuma rede de segurança para refatorações |
| **2** | Testes dos Serviços Core | Cobrir os 5 serviços que mais quebram | Bugs em cascata a cada mudança |
| **3** | Refatorar Pipeline de Processamento | Quebrar `process/route.ts` (1.248→~12 arquivos) | AI não consegue editar com precisão |
| **4** | Refatorar Relatório e Componentes | Quebrar god files de UI (1.730→~8 arquivos cada) | Mudanças de UI com efeitos colaterais |
| **5** | Refatorar Demais + Revisão Científica | Completar atomização + auditoria completa | Documentação defasada, algoritmos não verificados |

### Regras Gerais

1. **Cada fase é um conjunto de PRs independentes** — nunca misturar refatoração com features novas
2. **Regra dos 300** — nenhum arquivo deve ultrapassar ~300 linhas; se passar, tem mais de uma responsabilidade
3. **Zero mudança de comportamento** — refatoração não altera lógica, apenas reorganiza
4. **Testes antes de refatorar** — sempre que possível, ter teste do serviço ANTES de quebrá-lo
5. **Código é a fonte da verdade** — documentação segue o código, nunca o contrário

---

## FASE 1: Setup de Testes

**Duração estimada:** 1 sessão  
**Resultado:** Infraestrutura pronta para escrever testes de qualquer serviço  
**Dependências:** Nenhuma

### 1.1 Instalar dependências de teste

```bash
npm install -D jest ts-jest @types/jest
```

Não instalar Testing Library, Playwright ou qualquer ferramenta de teste de UI — o foco são serviços de backend.

### 1.2 Configurar Jest

Criar `jest.config.ts` na raiz:

```typescript
import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  // Não testar componentes React — foco em serviços
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  // Timeout maior para testes que fazem cálculos pesados
  testTimeout: 10000,
}

export default config
```

### 1.3 Adicionar script ao package.json

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

### 1.4 Criar estrutura de diretórios de teste

```
__tests__/
├── fixtures/                    # Dados de teste reutilizáveis
│   ├── ndvi-series.ts          # Séries NDVI realistas (soja, milho, no_crop)
│   ├── precipitation-data.ts   # Dados de precipitação
│   ├── temperature-data.ts     # Dados de temperatura
│   ├── geometry.ts             # GeoJSON válidos para teste
│   └── field-factory.ts        # Factory para criar Fields com defaults
├── helpers/
│   └── test-utils.ts           # Helpers compartilhados
└── services/                   # Testes de serviços (Fase 2)
```

### 1.5 Criar fixtures realistas

As fixtures são o ativo mais valioso dos testes. Devem representar cenários reais:

**`ndvi-series.ts`** — Séries NDVI baseadas em padrões reais de satélite:

| Fixture | Descrição | Uso |
|---------|-----------|-----|
| `SOJA_NORMAL` | Ciclo completo soja (SOS→Peak→EOS), 120 dias, peak 0.82 | Teste base de phenology |
| `SOJA_REPLANTIO` | Queda >0.2 seguida de recuperação | Teste de detecção de replantio |
| `MILHO_NORMAL` | Ciclo completo milho, 140 dias, peak 0.78 | Teste com cultura diferente |
| `NO_CROP` | NDVI estável <0.45 durante todo período | Teste de NO_CROP detection |
| `ANOMALOUS` | Peak 0.52, abaixo do esperado para soja | Teste de classificação ANOMALOUS |
| `ATYPICAL` | Amplitude baixa, SOS/EOS indefinidos | Teste de ATYPICAL (v0.0.33) |
| `CLOUD_GAPS` | Série com lacunas de 15+ dias | Teste de gap filling |
| `SENESCENCE_ACTIVE` | NDVI em queda ativa (slope < -0.005/dia) | Teste de projeção senescência |

**`temperature-data.ts`** — Dados de temperatura para GDD:

| Fixture | Descrição | GDD esperado |
|---------|-----------|-------------|
| `TEMP_NORMAL_PR` | Temperatura média ~25°C, 120 dias (Paraná) | ~1800 GDD |
| `TEMP_COLD_RS` | Temperatura média ~18°C, 120 dias (RS) | ~960 GDD |
| `TEMP_HOT_MT` | Temperatura média ~30°C, 120 dias (MT) | ~2400 GDD |

### 1.6 Verificação

Criar um teste trivial para confirmar que a infraestrutura funciona:

```typescript
// __tests__/services/setup.test.ts
describe('Test infrastructure', () => {
  it('should run tests', () => {
    expect(1 + 1).toBe(2)
  })

  it('should resolve @/ paths', () => {
    const { cn } = require('@/lib/utils')
    expect(typeof cn).toBe('function')
  })
})
```

Rodar `npm test` e confirmar que passa.

### Entregáveis Fase 1

- [ ] `jest.config.ts` criado e funcionando
- [ ] Scripts `test`, `test:watch`, `test:coverage` no `package.json`
- [ ] Diretório `__tests__/` com estrutura completa
- [ ] Fixtures de NDVI (8 séries), temperatura (3 séries), precipitação, geometria
- [ ] Factory de Field
- [ ] Teste trivial passando (`npm test`)

---

## FASE 2: Testes dos Serviços Core

**Duração estimada:** 2-3 sessões  
**Resultado:** Rede de segurança cobrindo os 5 serviços que mais quebraram historicamente  
**Dependências:** Fase 1

### Priorização por risco

Baseada no histórico de bugs do CHANGELOG (v0.0.20 a v0.0.35):

| Prioridade | Serviço | Linhas | Bugs históricos | Impacto de falha |
|------------|---------|--------|-----------------|------------------|
| **P0** | `phenology.service.ts` | 573 | SOS/EOS incorreto invalida toda a cadeia | Catastrófico |
| **P0** | `eos-fusion.service.ts` | 512 | 4+ bugs de contradição (v0.0.30, v0.0.33) | Catastrófico |
| **P1** | `crop-pattern.service.ts` | 577 | Short-circuit indevido, ATYPICAL errado | Alto |
| **P1** | `thermal.service.ts` | 420 | GDD sem maturação, backtracking (v0.0.30) | Alto |
| **P2** | `water-balance.service.ts` | 356 | Mapeamento PT→EN, stressDays (v0.0.30) | Médio |

### 2.1 Testes de `phenology.service.ts`

**Arquivo:** `__tests__/services/phenology.test.ts`

```
Cenários a cobrir:

DETECÇÃO SOS/EOS:
- [ ] Soja normal → SOS detectado no threshold 0.35, EOS no 0.38
- [ ] Milho normal → SOS detectado no threshold 0.30, EOS no 0.35
- [ ] SOS/EOS com datas corretas (não invertidas)
- [ ] Peak detectado como valor máximo da série suavizada
- [ ] cycleDays = EOS - SOS em dias

FALLBACKS:
- [ ] EOS não detectado → projeção exponencial usada
- [ ] EOS não detectado + sem exponencial → plantio + cycleDays default
- [ ] Dados insuficientes (<5 pontos) → retorna null gracefully

REPLANTIO:
- [ ] Série com queda >0.2 + recuperação >0.15 → replantio detectado
- [ ] Série normal sem queda → replantio NÃO detectado
- [ ] Série com variação natural (~0.1) → falso positivo evitado

EDGE CASES:
- [ ] Série toda com NDVI < sosNdvi → SOS null
- [ ] Série monotonicamente crescente (sem EOS) → EOS projetado
- [ ] Série com dados duplicados (mesma data) → tratado
- [ ] plantingDateInput informado → usado como base

CONFIANÇA:
- [ ] SOS + EOS + historicalCorrelation alta → confiança HIGH
- [ ] Apenas SOS detectado → confiança LOW
- [ ] plantingDateInput presente → +25 pontos
```

### 2.2 Testes de `eos-fusion.service.ts`

**Arquivo:** `__tests__/services/eos-fusion.test.ts`

```
Cenários a cobrir:

FUSÃO BÁSICA:
- [ ] Apenas NDVI disponível → usa EOS NDVI direto
- [ ] NDVI + GDD disponíveis → média ponderada
- [ ] NDVI + GDD + water stress → ajuste aplicado
- [ ] Pesos corretos: NDVI peso 0.6, GDD peso 0.4 (default)

SANITY CHECKS (bugs v0.0.30, v0.0.33):
- [ ] GDD 100% atingido + NDVI > 0.55 (planta verde) → NÃO declara maturação
- [ ] GDD no passado + NDVI ativo → projeção futura com confiança reduzida 50%
- [ ] EOS no passado → campo `passed: true`
- [ ] EOS no passado → data preservada (não substituída por "hoje")

ESTÁGIO FENOLÓGICO:
- [ ] NDVI > 0.7 → VEGETATIVE (independente do GDD)
- [ ] NDVI > 0.55 → REPRODUCTIVE (mesmo com GDD > 90%)
- [ ] GDD ≥ 100% + NDVI < 0.55 → MATURATION
- [ ] NDVI < 0.4 + slope negativo → SENESCENCE

ESTRESSE HÍDRICO:
- [ ] NONE → 0 dias ajuste
- [ ] MEDIUM → -2 dias
- [ ] HIGH → -4 dias
- [ ] CRITICAL → -7 dias

EDGE CASES:
- [ ] Sem dados de GDD → usa NDVI puro
- [ ] Sem dados de NDVI → usa GDD puro
- [ ] Ambos null → retorna null
```

### 2.3 Testes de `crop-pattern.service.ts`

**Arquivo:** `__tests__/services/crop-pattern.test.ts`

```
Cenários a cobrir:

CLASSIFICAÇÃO ANNUAL (soja, milho):
- [ ] Peak 0.82, amplitude 0.5, ciclo 120 dias → TYPICAL
- [ ] Peak 0.52, amplitude baixa → ANOMALOUS
- [ ] Peak 0.40 → NO_CROP
- [ ] Peak ok, ciclo indefinido (SOS/EOS null) → ATYPICAL (v0.0.33)
- [ ] Peak ok, amplitude < 85% do esperado → ATYPICAL (v0.0.33)

CLASSIFICAÇÃO SEMI_PERENNIAL (cana):
- [ ] NDVI estável alto com queda abrupta → TYPICAL (corte esperado)
- [ ] NDVI baixo estável → NO_CROP

CLASSIFICAÇÃO PERENNIAL (café):
- [ ] NDVI estável 0.50-0.75 → TYPICAL
- [ ] NDVI < 0.30 → NO_CROP
- [ ] Drop > 0.25 → ANOMALOUS

SHORT-CIRCUIT:
- [ ] NO_CROP → retorno imediato, sem cálculos adicionais
- [ ] MISMATCH → retorno imediato
```

### 2.4 Testes de `thermal.service.ts`

**Arquivo:** `__tests__/services/thermal.test.ts`

```
Cenários a cobrir:

GDD DIÁRIO:
- [ ] Tmean 25°C, Tbase 10°C → GDD = 15
- [ ] Tmean 8°C, Tbase 10°C → GDD = 0 (não negativo)
- [ ] Tmean = Tbase → GDD = 0

GDD ACUMULADO:
- [ ] Série de 120 dias com Tmean 25°C → GDD ≈ 1800
- [ ] Progresso deve ser monotonicamente crescente

MATURAÇÃO:
- [ ] GDD atinge 100% → projectedEos não é null (bug v0.0.30)
- [ ] GDD atinge 100% → backtracking encontra data exata
- [ ] GDD < 100% → projectedEos extrapolado

CULTURAS:
- [ ] Soja: Tbase 10°C, total 1300 GDD
- [ ] Milho: Tbase 10°C, total 1500 GDD
- [ ] Algodão: Tbase 12°C, total 1800 GDD
```

### 2.5 Testes de `water-balance.service.ts`

**Arquivo:** `__tests__/services/water-balance.test.ts`

```
Cenários a cobrir:

NÍVEL DE ESTRESSE:
- [ ] Deficit baixo → stressLevel NONE ou LOW
- [ ] Deficit moderado → stressLevel MEDIUM
- [ ] Deficit alto → stressLevel HIGH ou CRITICAL

AJUSTE EOS:
- [ ] CRITICAL → -12 dias
- [ ] SEVERE → -7 dias
- [ ] MODERATE → -3 dias
- [ ] NONE → 0 dias

MAPEAMENTO PT→EN (bug v0.0.30):
- [ ] 'CRITICO' → 'CRITICAL'
- [ ] 'SEVERO' → 'HIGH'
- [ ] 'MODERADO' → 'MEDIUM'
- [ ] 'BAIXO' → 'LOW'

YIELD IMPACT:
- [ ] CRITICAL → yieldImpact < 0.80
- [ ] NONE → yieldImpact ≈ 1.0
```

### Padrão de teste

Todos os testes seguem o padrão:

```typescript
import { calculatePhenology } from '@/lib/services/phenology.service'
import { SOJA_NORMAL, NO_CROP } from '../fixtures/ndvi-series'

describe('phenology.service', () => {
  describe('calculatePhenology', () => {
    it('should detect SOS at threshold 0.35 for soja', () => {
      const result = calculatePhenology(SOJA_NORMAL, 'SOJA', {
        seasonStartDate: new Date('2025-10-01'),
      })

      expect(result.sosDate).toBeDefined()
      // SOS deve estar dentro da janela esperada
      expect(result.sosDate!.getTime()).toBeGreaterThan(
        new Date('2025-10-15').getTime()
      )
    })
  })
})
```

### Entregáveis Fase 2

- [ ] `__tests__/services/phenology.test.ts` — ~15 cenários
- [ ] `__tests__/services/eos-fusion.test.ts` — ~15 cenários
- [ ] `__tests__/services/crop-pattern.test.ts` — ~10 cenários
- [ ] `__tests__/services/thermal.test.ts` — ~10 cenários
- [ ] `__tests__/services/water-balance.test.ts` — ~10 cenários
- [ ] Todos os testes passando com `npm test`
- [ ] Coverage dos 5 serviços > 80%

---

## FASE 3: Refatorar Pipeline de Processamento

**Duração estimada:** 2-3 sessões  
**Resultado:** `process/route.ts` de 1.248 linhas → orquestrador de ~50 linhas + 8 steps  
**Dependências:** Fase 2 (testes servem como validação)

### Problema atual

O arquivo `app/api/fields/[id]/process/route.ts` (1.248 linhas) é uma função monolítica que:
1. Faz fetch de NDVI da Merx API
2. Calcula fenologia (2x: detecção + efetivo)
3. Analisa padrão de cultura
4. Faz short-circuit em NO_CROP/MISMATCH
5. Busca precipitação
6. Busca balanço hídrico (condicional)
7. Busca temperatura/GDD (condicional)
8. Busca radar Sentinel-1 (condicional)
9. Faz fusão SAR-NDVI (condicional)
10. Calcula fusão EOS
11. Executa validação visual IA (condicional)
12. Persiste tudo no banco

### Arquitetura alvo

```
lib/services/processing/
├── index.ts                    # Export público
├── pipeline.ts                 # Orquestrador (~100 linhas)
├── types.ts                    # PipelineContext + StepResult (~50 linhas)
├── steps/
│   ├── 01-fetch-ndvi.ts       # Merx NDVI + séries históricas (~80 linhas)
│   ├── 02-detect-phenology.ts # Fenologia dual (detecção + efetivo) (~100 linhas)
│   ├── 03-crop-pattern.ts     # Classificação + short-circuit (~60 linhas)
│   ├── 04-fetch-climate.ts    # Precipitação + água + temperatura (~120 linhas)
│   ├── 05-fetch-radar.ts      # Sentinel-1 + fusão SAR-NDVI (~80 linhas)
│   ├── 06-fuse-eos.ts         # Fusão EOS final (~60 linhas)
│   ├── 07-ai-validation.ts    # Validação visual IA (~80 linhas)
│   └── 08-persist.ts          # Salvar AgroData + NdviDataPoints + status (~150 linhas)
└── helpers/
    └── status.ts              # Determinação de status final (SUCCESS/PARTIAL/ERROR)
```

### 3.1 Criar `PipelineContext` (shared state)

```typescript
// lib/services/processing/types.ts

export interface PipelineContext {
  // Input
  fieldId: string
  workspaceId: string
  field: Field & { agroData?: AgroData | null }
  settings: WorkspaceSettingsResolved

  // Dados acumulados por cada step
  ndviData?: NdviDataPoint[]
  rawNdviData?: any
  rawHistoricalData?: any
  rawAreaData?: any
  rawSoilData?: any
  rawZarcData?: any

  phenologyResult?: PhenologyResult
  detectedPhenology?: PhenologyResult  // Preservado para campos detected*
  effectivePhenology?: PhenologyResult // Valores efetivos (com input do usuário)

  cropPattern?: CropPatternResult
  shouldShortCircuit?: boolean  // NO_CROP ou MISMATCH

  precipitationResult?: PrecipitationResult
  waterBalanceResult?: WaterBalanceResult
  thermalResult?: ThermalResult
  radarResult?: RadarResult
  sarFusionResult?: SarFusionResult

  eosFusion?: EosFusionResult
  aiValidation?: AIValidationResult

  // Diagnósticos acumulados
  diagnostics: string[]
  dataStatus: Partial<FieldDataStatus>

  // Controle de fluxo
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'PARTIAL' | 'ERROR'
  errorMessage?: string
}

export interface StepResult {
  success: boolean
  skipped?: boolean
  skipReason?: string
  error?: string
}
```

### 3.2 Criar Orquestrador

```typescript
// lib/services/processing/pipeline.ts

import { PipelineContext, StepResult } from './types'
import { fetchNdvi } from './steps/01-fetch-ndvi'
import { detectPhenology } from './steps/02-detect-phenology'
import { analyzeCropPattern } from './steps/03-crop-pattern'
import { fetchClimateData } from './steps/04-fetch-climate'
import { fetchRadarData } from './steps/05-fetch-radar'
import { fuseEos } from './steps/06-fuse-eos'
import { runAIValidation } from './steps/07-ai-validation'
import { persistResults } from './steps/08-persist'
import { determineStatus } from './helpers/status'

const STEPS = [
  { name: 'Dados NDVI', fn: fetchNdvi },
  { name: 'Fenologia', fn: detectPhenology },
  { name: 'Padrão de Cultura', fn: analyzeCropPattern },
  { name: 'Dados Climáticos', fn: fetchClimateData },
  { name: 'Dados Radar', fn: fetchRadarData },
  { name: 'Fusão EOS', fn: fuseEos },
  { name: 'Validação Visual IA', fn: runAIValidation },
  { name: 'Persistência', fn: persistResults },
]

export async function runPipeline(ctx: PipelineContext): Promise<PipelineContext> {
  for (const step of STEPS) {
    // Short-circuit: NO_CROP ou MISMATCH pula para persistência
    if (ctx.shouldShortCircuit && step.fn !== persistResults) {
      continue
    }

    try {
      const result = await step.fn(ctx)
      if (result.skipped) {
        ctx.diagnostics.push(`${step.name}: Pulado — ${result.skipReason}`)
      }
    } catch (error) {
      ctx.diagnostics.push(`${step.name}: Erro — ${error}`)
      // Erros não-fatais: continua pipeline
      // Erros fatais (fetchNdvi): marcados no step
    }
  }

  ctx.status = determineStatus(ctx)
  return ctx
}
```

### 3.3 Migrar cada step

**Processo para cada step:**

1. Extrair bloco de código do `process/route.ts` atual
2. Envolver em função que recebe e modifica `PipelineContext`
3. Manter **exatamente** a mesma lógica — copiar/colar, depois limpar
4. Rodar `npm test` — testes de serviços devem continuar passando
5. Verificar que o route.ts compilou sem erros

### 3.4 Simplificar route.ts

O `process/route.ts` final:

```typescript
// app/api/fields/[id]/process/route.ts (~50 linhas)

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runPipeline } from '@/lib/services/processing'
import { buildPipelineContext } from '@/lib/services/processing/pipeline'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // 1. Auth + validação (existente)
  const userId = req.headers.get('x-user-id')
  const workspaceId = req.headers.get('x-workspace-id')
  if (!userId || !workspaceId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Buscar field e settings
  const field = await prisma.field.findUnique({ ... })
  if (!field) { return NextResponse.json({ error: 'Not found' }, { status: 404 }) }

  // 3. Construir contexto e executar pipeline
  const ctx = buildPipelineContext(field, workspaceId)

  // Fire and forget — processamento em background
  runPipeline(ctx).catch(console.error)

  return NextResponse.json({ status: 'PROCESSING' })
}
```

### 3.5 Adicionar testes de integração do pipeline

```typescript
// __tests__/services/processing/pipeline.test.ts
describe('Processing Pipeline', () => {
  it('should complete full pipeline for normal soja field', async () => { ... })
  it('should short-circuit on NO_CROP', async () => { ... })
  it('should handle missing GDD data gracefully', async () => { ... })
  it('should skip radar when feature flag disabled', async () => { ... })
  it('should set PARTIAL when some data unavailable', async () => { ... })
})
```

### Entregáveis Fase 3

- [ ] `lib/services/processing/` com 8 steps + orquestrador + types
- [ ] `process/route.ts` reduzido a ~50 linhas
- [ ] Testes de pipeline (5+ cenários)
- [ ] Todos os testes existentes continuam passando
- [ ] Aplicação funciona identicamente (testar manualmente: criar talhão + processar)

---

## FASE 4: Refatorar Relatório e Componentes

**Duração estimada:** 3-4 sessões  
**Resultado:** God files de UI quebrados em componentes atômicos  
**Dependências:** Fase 3 (para garantir que dados chegam corretos)

### 4.1 Refatorar `reports/[id]/page.tsx` (1.730 → ~8 arquivos)

**Maior arquivo do projeto.** Contém: fetch de dados, transformação, 6 seções de UI, gráficos, tabs, modais, e lógica de feature flags.

**Estrutura alvo:**

```
app/(authenticated)/reports/[id]/
├── page.tsx                         # Fetch + composição (~150 linhas)
├── components/
│   ├── ReportHeader.tsx             # Header + nome + badges + mapa modal (~120)
│   ├── MetricsSection.tsx           # 4 cards de métricas (~100)
│   ├── PhenologySection.tsx         # Timeline + ZARC + data sources (~120)
│   ├── NdviChartSection.tsx         # Gráfico NDVI + overlay radar (~150)
│   ├── AnalysisTabs.tsx             # Tabs: Precipitação, GDD, Água, Envelope (~150)
│   ├── AIValidationSection.tsx      # Painel IA + crop alerts (~100)
│   └── VisualAnalysisSection.tsx    # Tab de análise visual (~80)
└── hooks/
    ├── useReportData.ts             # Fetch + transformação de dados (~200)
    └── useReportFeatureFlags.ts     # Resolução de feature flags (~50)
```

**Processo:**

1. Criar `hooks/useReportData.ts` — extrair toda lógica de fetch e transformação
2. Criar cada componente de seção — extrair JSX + props necessárias
3. `page.tsx` fica como compositor: usa o hook, passa dados para seções
4. Verificar visualmente que o relatório renderiza identicamente

### 4.2 Refatorar `(authenticated)/page.tsx` + `fields/page.tsx` (605 + 671 → unificado)

**Problema adicional:** Essas duas páginas renderizam o mesmo conteúdo (dashboard de talhões). A refatoração resolve ambos.

**Estrutura alvo:**

```
app/(authenticated)/
├── page.tsx                         # Importa DashboardView (~20 linhas)
├── components/
│   ├── DashboardView.tsx            # Composição principal (~150)
│   ├── DashboardFilters.tsx         # Barra de filtros (~150)
│   ├── DashboardStats.tsx           # Cards de estatísticas (~80)
│   └── DashboardActions.tsx         # Ações: novo, processar em lote (~80)
└── hooks/
    ├── useFields.ts                 # Fetch + polling (~100)
    └── useFieldFilters.ts           # Estado de filtros + lógica (~120)

app/(authenticated)/fields/
└── page.tsx                         # Importa DashboardView (~20 linhas)
```

### 4.3 Refatorar `settings/page.tsx` (894 → componentes por seção)

```
app/(authenticated)/settings/
├── page.tsx                         # Fetch + tabs container (~100)
├── components/
│   ├── DataModulesSection.tsx       # Toggles de módulos (~120)
│   ├── VisualizationsSection.tsx    # Toggles de gráficos (~100)
│   ├── CalculationsSection.tsx      # Toggles de cálculos (~120)
│   ├── AISettingsSection.tsx        # Config de IA (~100)
│   ├── DistanceSection.tsx          # Método de distância (~80)
│   └── CopernicusSection.tsx        # Credenciais (~80)
└── hooks/
    └── useWorkspaceSettings.ts      # Fetch + save (~100)
```

### 4.4 Refatorar `field-table.tsx` (705 → composição)

```
components/fields/
├── FieldTable.tsx                   # Container + sort state (~120)
├── FieldTableHeader.tsx             # Cabeçalhos ordenáveis (~80)
├── FieldRow.tsx                     # Linha de talhão pai (~120)
├── SubFieldRow.tsx                  # Linha de subtalhão (~80)
├── FieldRowActions.tsx              # Dropdown de ações (~80)
└── field-table.types.ts            # Types + helpers de sorting (~60)
```

### 4.5 Refatorar demais páginas >500 linhas

| Arquivo | Linhas | Ação |
|---------|--------|------|
| `producers/page.tsx` | 593 | Extrair `ProducerTable`, `ProducerFieldsList`, `useProducers` hook |
| `EditFieldModal.tsx` | 522 | Extrair `GeneralTab`, `AgronomicTab` como componentes |
| `VisualAnalysisTab.tsx` | 511 | Extrair `ImageViewer`, `DateTimeline`, `ComparisonView` |
| `fields/new/page.tsx` | 514 | Extrair `GeometryUpload`, `FieldForm`, `useFieldCreation` |
| `admin/users/page.tsx` | 477 | Extrair `UsersTable`, `CreateUserModal`, `useUsers` hook |
| `map-drawer.tsx` | 475 | Extrair `MapSearch`, `MapControls`, `useMapDrawing` hook |
| `AIValidationPanel.tsx` | 471 | Extrair `CropAlertCard`, `JudgePanel`, `AIMetrics` |

### 4.6 Refatorar serviços >500 linhas

| Serviço | Linhas | Ação |
|---------|--------|------|
| `cycle-analysis.service.ts` | 975 | Dividir em `detection.ts`, `alignment.ts`, `envelope.ts`, `chart-data.ts` |
| `sar-ndvi-adaptive.service.ts` | 771 | Dividir em `feature-selection.ts`, `models/gpr.ts`, `models/knn.ts`, `fusion.ts` |
| `sentinel1.service.ts` | 669 | Dividir em `auth.ts`, `catalog.ts`, `statistics.ts`, `process-api.ts` |
| `climate-envelope.service.ts` | 625 | Dividir em `bands.ts`, `anomalies.ts`, `comparison.ts` |
| `crop-pattern.service.ts` | 577 | Dividir em `annual.ts`, `semi-perennial.ts`, `perennial.ts`, `classify.ts` |
| `phenology.service.ts` | 573 | Dividir em `detection.ts`, `confidence.ts`, `yield.ts`, `replanting.ts` |
| `rvi-calibration.service.ts` | 501 | Dividir em `pairs.ts`, `training.ts`, `cascade.ts` |

### Entregáveis Fase 4

- [ ] `reports/[id]/` com ~8 componentes + 2 hooks
- [ ] Dashboard unificado com componentes reutilizados
- [ ] `settings/` com ~6 componentes + 1 hook
- [ ] `field-table` com ~5 componentes
- [ ] Demais páginas >500 linhas refatoradas
- [ ] Serviços >500 linhas divididos
- [ ] Nenhum arquivo > 300 linhas (exceto fixtures de teste)
- [ ] Todos os testes passando
- [ ] Aplicação funciona identicamente

---

## FASE 5: Refatoração Final + Revisão Científica Completa

**Duração estimada:** 2-3 sessões  
**Resultado:** Codebase auditada, documentação atualizada, compliance científica verificada  
**Dependências:** Fases 1-4

### 5.1 Auditoria de arquivos restantes

Verificar que nenhum arquivo ficou esquecido acima de 300 linhas. Candidatos:

| Arquivo | Linhas | Ação necessária |
|---------|--------|-----------------|
| `analysis-panel.tsx` | 548 | Avaliar se foi coberto na Fase 4 |
| `LogisticsUnitModal.tsx` | 309 | No limite — avaliar |
| `PhenologyTimeline.tsx` | 351 | Avaliar extração |
| `processing-context.tsx` | 376 | Avaliar extração do modal |
| Todos os route.ts em `app/api/` | Vários | Verificar se algum passou de 300 |

### 5.2 Revisão de código — Execução completa

Executar o protocolo de revisão definido em `docs/revisao.md` com as 6 fases:

**FASE R1: Inventário** — Confirmar que a estrutura de diretórios pós-refatoração está mapeada.

**FASE R2: Documentação vs Código** — Verificar cada documento:

| Documento | Verificação |
|-----------|-------------|
| `ARCHITECTURE.md` | Atualizar com nova estrutura `lib/services/processing/`, novos diretórios de componentes, hooks extraídos. Diagramas de fluxo devem refletir pipeline modular. |
| `METHODOLOGY.md` | Verificar que todos os thresholds nos serviços refatorados ainda estão documentados. Após a divisão de `phenology.service.ts` em 4 arquivos, atualizar referências de arquivo. |
| `Apisproject.md` | Verificar que todas as rotas API estão documentadas com shapes corretos. |
| `DEPLOY.md` | Verificar variáveis de ambiente atualizadas. |
| `DIAGNOSTICOLOG.md` | Verificar que o fluxo de logística está correto. |
| `SCIENTIFIC-COMPLIANCE.md` | **Revisão completa** — ver seção 5.3 abaixo. |

**FASE R3: Detecção de problemas** — Duplicações, inconsistências, docs faltantes, links quebrados.

**FASE R4: Correções** — Aplicar todas as correções encontradas.

### 5.3 Revisão de Compliance Científica (completa)

Esta é a auditoria mais crítica. Deve ser executada **após** a refatoração, pois os arquivos terão mudado de localização.

**Para cada um dos 12 algoritmos do `SCIENTIFIC-COMPLIANCE.md`:**

#### 5.3.1 Verificar código vs documentação

| # | Algoritmo | Arquivo(s) pós-refatoração | Verificar |
|---|-----------|---------------------------|-----------|
| 1 | Detecção Fenológica | `lib/services/phenology/detection.ts` | Thresholds SOS/EOS coincidem com doc |
| 2 | GDD (Soma Térmica) | `lib/services/thermal.service.ts` | Fórmula, Tbase, GDD total por cultura |
| 3 | Fusão EOS | `lib/services/eos-fusion.service.ts` ou `processing/steps/06-fuse-eos.ts` | Pesos, sanity checks, ajustes |
| 4 | Correlação Histórica | `lib/services/correlation.service.ts` | Score composto 40/30/30 |
| 5 | Projeção Adaptativa | `lib/services/cycle/detection.ts` | Slopes, modelos por fase |
| 6 | Fusão SAR-NDVI | `lib/services/sar-ndvi-adaptive/` | Coeficientes por cultura |
| 7 | Envelope Climático | `lib/services/climate-envelope/bands.ts` | σ-bands, thresholds |
| 8 | Produtividade | `lib/services/phenology/yield.ts` | Fórmula ndviFactor |
| 9 | Criticidade Cultura | `lib/services/crop-pattern/classify.ts` | Thresholds por cultura |
| 10 | Impacto Hídrico | `lib/services/water-balance.service.ts` | Dias de ajuste |
| 11 | Ajuste Precipitação | `lib/services/precipitation.service.ts` | Thresholds mm/dias |
| 12 | Replantio | `lib/services/phenology/replanting.ts` | Queda 0.2 + recuperação 0.15 |

#### 5.3.2 Verificar referências bibliográficas

Para cada referência citada no código e na documentação:

- [ ] A referência existe (DOI válido)?
- [ ] O ano, autores e journal estão corretos?
- [ ] O claim feito no código é suportado pelo paper?
- [ ] A citação "Sakamoto et al., 2020" foi corrigida para "Diao et al., 2020"?
- [ ] A citação "Desclaux et al., 2003" foi corrigida para "Brevedan & Egli, 2003"?

#### 5.3.3 Verificar novos algoritmos desde v0.0.33

Desde a última auditoria (v0.0.33), verificar se novos algoritmos foram adicionados:

- v0.0.34: Edição agronômica (dual phenology) — verificar lógica de detecção vs efetivo
- v0.0.34: Subtalhões — verificar validação de geometria contida (`@turf/boolean-contains`)
- v0.0.35: Visão folder + filtros — sem algoritmo novo

#### 5.3.4 Verificar oportunidades de melhoria pendentes

Conforme o `SCIENTIFIC-COMPLIANCE.md` atual, 4 algoritmos têm status "Melhorável":

| # | Algoritmo | Melhoria sugerida | Ação |
|---|-----------|-------------------|------|
| 1 | Fenologia | Threshold adaptativo por amplitude | Documentar como issue futura |
| 6 | SAR-NDVI | Random Forest em vez de linear | Documentar como issue futura |
| 8 | Produtividade | iNDVI (integrado) em vez de peak | Documentar como issue futura |
| 12 | Replantio | Calibração formal de thresholds | Documentar como issue futura |

**Decisão:** Essas melhorias NÃO entram neste plano. São documentadas como issues para o roadmap futuro.

#### 5.3.5 Atualizar `SCIENTIFIC-COMPLIANCE.md`

- Atualizar versão para versão pós-refatoração
- Atualizar data da auditoria
- Atualizar paths de arquivos (pós-refatoração)
- Corrigir erratas de referências no código
- Adicionar novos algoritmos (dual phenology, geometria subtalhões)
- Manter status "Melhorável" com nota de roadmap

### 5.4 Atualizar documentação de revisão

Atualizar `docs/revisao.md`:
- Nova entrada no histórico de revisões
- Atualizar versão da última revisão

### 5.5 Cleanup final

- [ ] Remover `app/(authenticated)/fields/page.tsx` se dashboard foi unificado
- [ ] Verificar que não há imports quebrados
- [ ] Verificar que não há arquivos órfãos
- [ ] Rodar `npm run lint` e corrigir erros
- [ ] Rodar `npm test` e confirmar 100% passando
- [ ] Rodar `npm run build` e confirmar build sem erros

### Entregáveis Fase 5

- [ ] Nenhum arquivo > 300 linhas no projeto
- [ ] `ARCHITECTURE.md` atualizado com nova estrutura
- [ ] `METHODOLOGY.md` com referências de arquivo corretas
- [ ] `SCIENTIFIC-COMPLIANCE.md` atualizado (v0.0.35+, 14 algoritmos, paths corretos)
- [ ] Erratas de referências corrigidas no código (`eos-fusion.service.ts`)
- [ ] `docs/revisao.md` com nova entrada no histórico
- [ ] `npm test` — todos passando
- [ ] `npm run build` — sem erros
- [ ] `npm run lint` — sem erros novos

---

## Métricas de Sucesso

### Antes vs Depois

| Métrica | Antes (v0.0.35) | Depois | Meta |
|---------|-----------------|--------|------|
| Arquivos > 700 linhas | 6 | 0 | 0 |
| Arquivos > 500 linhas | 12 | 0 | 0 |
| Arquivos > 300 linhas | ~25 | ≤5 | ≤5 |
| Maior arquivo | 1.730 linhas | ~200 linhas | ≤300 |
| Testes unitários | 0 | ~60 | ≥50 |
| Cobertura serviços core | 0% | >80% | >80% |
| Algoritmos auditados | 12 (v0.0.33) | 14 (v0.0.35+) | Todos |
| Erratas de referência | 2 | 0 | 0 |

### Impacto no Vibe Coding

| Cenário | Antes | Depois |
|---------|-------|--------|
| "Altere o cálculo de EOS" | AI edita 1 arquivo de 512 linhas, sem verificação | AI edita 1 arquivo de ~60 linhas, roda `npm test` |
| "Adicione campo no relatório" | AI edita 1 arquivo de 1.730 linhas | AI edita 1 arquivo de ~120 linhas |
| "Mude um step do processamento" | AI edita 1 arquivo de 1.248 linhas | AI edita 1 arquivo de ~80 linhas |
| "Bug no dashboard" | AI busca em 605 linhas de state + UI | AI busca em hook de ~100 linhas |

---

## Cronograma Sugerido

| Sessão | Fase | Entregas |
|--------|------|----------|
| 1 | Fase 1 | Setup completo de testes |
| 2 | Fase 2 (parte 1) | Testes phenology + eos-fusion |
| 3 | Fase 2 (parte 2) | Testes crop-pattern + thermal + water-balance |
| 4 | Fase 3 (parte 1) | Pipeline types + orquestrador + steps 1-4 |
| 5 | Fase 3 (parte 2) | Steps 5-8 + route simplificado + testes pipeline |
| 6 | Fase 4 (parte 1) | Refatorar reports + dashboard + settings |
| 7 | Fase 4 (parte 2) | Refatorar field-table + modais + demais UI |
| 8 | Fase 4 (parte 3) | Refatorar serviços >500 linhas |
| 9 | Fase 5 (parte 1) | Revisão de código + documentação |
| 10 | Fase 5 (parte 2) | Compliance científica + cleanup final |

**Total estimado:** 10 sessões de trabalho

---

*Documento criado em 2026-02-13. Baseline: v0.0.35.*
