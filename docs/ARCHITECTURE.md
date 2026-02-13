# Arquitetura do Sistema

## Visão Geral

O MERX AGRO Monitor segue uma arquitetura Full-Stack com Next.js, onde o frontend e backend coexistem no mesmo projeto, utilizando API Routes para a camada de servidor.

---

## Diagrama de Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTE (Browser)                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Next.js Frontend                              │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐        │   │
│  │  │   Login   │  │ Dashboard │  │ Logistics │  │   Admin   │        │   │
│  │  │   Page    │  │   Page    │  │   Page    │  │   Pages   │        │   │
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────┘        │   │
│  │         │              │              │              │               │   │
│  │         └──────────────┴──────────────┴──────────────┘               │   │
│  │                                 │                                     │   │
│  │                    ┌─────── Sidebar Layout ───────┐                  │   │
│  │                    │  React Query / fetch()       │                  │   │
│  └────────────────────┼──────────────────────────────┼──────────────────┘   │
└───────────────────────┼──────────────────────────────┼──────────────────────┘
                        │                              │
                        ▼                              │
┌───────────────────────────────────────────────────────────────────────────────┐
│                            MIDDLEWARE (middleware.ts)                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │  - Verifica token JWT (cookie)                                           │  │
│  │  - Redireciona para /login se não autenticado                           │  │
│  │  - Injeta headers: x-user-id, x-workspace-id, x-user-role               │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────┬───────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SERVIDOR (Next.js API Routes)                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                            Route Handlers                            │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐   │   │
│  │  │  /api/auth  │  │ /api/fields │  │/api/logistics│  │/api/admin│   │   │
│  │  │ login/logout│  │ (+ tenant)  │  │ (+ tenant)   │  │users/ws  │   │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────────┘   │   │
│  │         │                │                │                        │   │
│  └─────────┼────────────────┼────────────────┼────────────────────────┘   │
│            │                │                │                            │
│  ┌─────────▼────────────────▼────────────────▼──────────────────────┐   │
│  │                         SERVICES LAYER                            │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │   │
│  │  │   merx      │  │  phenology  │  │ correlation │              │   │
│  │  │  service    │  │   service   │  │   service   │              │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘              │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │   │
│  │  │   cycle     │  │  geometry   │  │    auth     │              │   │
│  │  │  analysis   │  │   service   │  │   (JWT)     │              │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘              │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │   │
│  │  │ eos-fusion  │  │  thermal    │  │water-balance│              │   │
│  │  │  service    │  │   (GDD)     │  │   service   │              │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘              │   │
│  │  ┌───────────────────────────────────────────────────────────────┐   │
│  │  │            AI VALIDATION LAYER (v0.0.32)                       │   │
│  │  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌────────────┐ │   │
│  │  │  │  Curator  │  │ Verifier  │  │   Judge   │  │Orchestrator│ │   │
│  │  │  │  Agent    │  │  Agent    │  │   Agent   │  │  Service   │ │   │
│  │  │  └───────────┘  └───────────┘  └───────────┘  └────────────┘ │   │
│  │  └───────────────────────────────────────────────────────────────┘   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                │                    │                    │
       ┌────────┼────────┬───────────┼───────────┐       │
       ▼        │        ▼           ▼           ▼       ▼
┌────────────┐  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐
│ PostgreSQL │  │  │ Merx API │  │Gemini AI │  │  Sentinel Hub    │
│(Neon Cloud)│  │  │(Satellite│  │(Templates│  │  Process API     │
│            │  │  │ + Clima) │  │+ Visual) │  │  (Sat. Images)   │
│┌──────────┐│  │  │          │  │          │  │                  │
││Workspace  ││  │  │ - NDVI   │  │- Template│  │ - True Color     │
│├──────────┤│  │  │ - Precip │  │  prompts │  │ - NDVI Colorized │
││  User    ││  │  │ - Solo   │  │- Curator │  │ - Radar SAR      │
│├──────────┤│  │  │ - Hist.  │  │  prompt  │  │ - Multi-sensor   │
││  Field   ││  │  │ - Área   │  │- Judge   │  │   (S2/S1/L8/S3)  │
│├──────────┤│  │  │ - Temp.  │  │  prompt  │  │                  │
││ AgroData ││  │  │ - Bal.H. │  │          │  │                  │
│├──────────┤│  │  └──────────┘  └──────────┘  └──────────────────┘
││ Analysis ││  │
│└──────────┘│  │
└────────────┘  │
```

---

## Fluxo de Autenticação

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Usuário   │────▶│   POST /login   │────▶│  Valida email/  │
│   acessa    │     │   (email/pwd)   │     │  senha no banco │
└─────────────┘     └─────────────────┘     └────────┬────────┘
                                                      │
                                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    mustChangePassword = true ?                   │
│  ┌────────────┐                         ┌────────────────────┐  │
│  │    SIM     │────────────────────────▶│ Redirect /change-  │  │
│  │            │                         │     password       │  │
│  └────────────┘                         └─────────┬──────────┘  │
│  ┌────────────┐                                   │             │
│  │    NÃO     │◀───── (após trocar) ──────────────┘             │
│  │            │                                                 │
│  └─────┬──────┘                                                 │
└────────┼────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Cria JWT com   │────▶│ Set Cookie      │────▶│ Redirect para   │
│ userId, wsId,   │     │ 'auth-token'    │     │ Dashboard       │
│ role, exp       │     │ (HTTP-only)     │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Fluxo de Disclaimer (Alpha/Beta)

No primeiro acesso após login, usuários que não aceitaram o disclaimer são apresentados com um modal obrigatório:

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Login     │────▶│ hasAccepted     │────▶│     false ?     │
│   success   │     │ Disclaimer?     │     │                 │
└─────────────┘     └─────────────────┘     └────────┬────────┘
                                                      │
                           ┌──────────────────────────┤
                           │                          │
                           ▼                          ▼
                    ┌──────────────┐          ┌──────────────┐
                    │     SIM      │          │     NÃO      │
                    │ (já aceitou) │          │ Modal Termos │
                    └──────┬───────┘          └──────┬───────┘
                           │                          │
                           │                   POST /api/auth/
                           │                   accept-disclaimer
                           │                          │
                           ▼                          ▼
                    ┌─────────────────────────────────────────┐
                    │              Dashboard                   │
                    └─────────────────────────────────────────┘
```

**Termos do Disclaimer (7 itens):**
1. Produto em ALPHA - funcionalidades podem mudar
2. Bugs e indisponibilidades podem ocorrer
3. Dados devem ser verificados/crosscheck
4. Bugs e melhorias devem ser reportados
5. Pode haver indisponibilidade a qualquer tempo
6. Dados podem ser perdidos
7. Serviço pode ser descontinuado (10 dias para extração)

---

## Camadas do Sistema

### 1. Frontend (Presentation Layer)

**Tecnologias:** React 18, Next.js 14 App Router, TailwindCSS, Shadcn/ui

**Responsabilidades:**
- Renderização de páginas
- Gerenciamento de estado local
- Interação com usuário
- Validação de formulários

**Dashboard (v0.0.35):**
- Tabela com 15 colunas individuais ordenáveis (clique no cabeçalho)
- Ordenação padrão: colheita prevista mais próxima primeiro
- 10 filtros combinatórios em 3 linhas: pesquisa textual (nome, produtor, cidade), subtalhões (sim/não), status, tipo atribuição, caixa logística, colheita, confiança, cultura, IA, resultado IA
- Processamento server-side de JSON pesados (rawAreaData → fusedEosDate, aiValidationAgreement → harvestReady)
- **Visão folder de subtalhões**: Talhões pai com subtalhões exibem ícone de pasta com expand/collapse. Subtalhões aparecem como linhas indentadas sob o pai com background azulado, nome do pai como referência, e ações próprias (editar, reprocessar, relatório, excluir)
- API `/api/fields` retorna subtalhões inline com agroData processado (mesma lógica de transformação do pai)
- **Edição de subtalhões (v0.0.36)**: Botão editar nas linhas filhas abre `EditFieldModal` com `isSubField=true` (produtor/logística herdados e travados)

**Componentes Principais:**
```
components/
├── fields/
│   ├── field-table.tsx        # Tabela ordenável com visão folder (pai + filhos expandíveis), sorting
│   ├── field-table-types.ts   # Field, FieldTableProps, SortKey, SortDir, getSortValue, compare
│   ├── field-table-config.tsx # Configuração de colunas, statusConfig, templateColors, bestEos
│   └── FieldRowCells.tsx      # Células da tabela (renderização por coluna, botão editar p/ filhos)
├── ai-validation/
│   └── AIValidationPanel.tsx  # Painel de resultados IA no relatório
├── modals/
│   ├── DisclaimerModal.tsx   # Modal de termos de uso
│   ├── EditFieldModal.tsx    # Modal de edição de talhão/subtalhão (tabs: general, agronomic; isSubField)
│   ├── EditFieldGeneralTab.tsx  # Aba geral (produtor/logística travados quando isSubField)
│   ├── EditFieldAgronomicTab.tsx
│   └── FieldMapModal.tsx     # Modal de mapa do polígono (Leaflet, satélite/OSM, siblings overlay)
├── layout/
│   ├── app-layout.tsx        # Layout principal com sidebar
│   ├── sidebar.tsx           # Navegação lateral (Dashboard, Mapa, Logística, Produtores, Caixas)
│   ├── sidebar-footer.tsx    # Versão e changelog
│   └── changelog-modal.tsx   # Modal de changelog
├── maps/
│   └── map-drawer.tsx        # Desenho de polígonos (Leaflet Draw)
├── reports/
│   ├── AnalysisTabs.tsx     # Abas do relatório (Relatório, Visual, Comparação Subtalhões)
│   ├── SubfieldsComparisonTab.tsx  # Aba comparativa pai vs filhos (tabela + NDVI overlay)
│   ├── NdviChartCard.tsx     # Card do gráfico NDVI
│   └── AIValidationSection.tsx
├── dashboard/
│   └── DashboardFilters.tsx  # Filtros do dashboard
├── settings/
│   ├── FeatureToggle.tsx     # Toggle de feature flags
│   ├── GeneralSettingsTab.tsx
│   ├── ModulesSettingsTab.tsx
│   ├── CalculationsSettingsTab.tsx
│   ├── AutomationSettingsTab.tsx
│   └── ...
└── ui/
    ├── button.tsx
    ├── card.tsx
    ├── badge.tsx
    └── ...
```

**Hooks customizados (hooks/):**
```
hooks/
├── useReportData.ts          # Dados do relatório
├── useProcessingModal.ts     # Modal de processamento
├── useDashboardFields.ts     # Campos do dashboard
├── useWorkspaceSettings.ts   # Configurações do workspace
├── useVisualAnalysisImages.ts# Imagens de análise visual
└── useLocationSearch.ts      # Busca por localização
```

### 2. API Layer (Route Handlers)

**Tecnologias:** Next.js API Routes

**Responsabilidades:**
- Validação de requests
- Autenticação e autorização
- Orquestração de serviços
- Formatação de responses
- Isolamento de dados por workspace

**Padrão de Rotas:**
```
app/api/
├── auth/
│   ├── login/route.ts              # POST (autenticação)
│   ├── logout/route.ts             # POST (encerrar sessão)
│   ├── change-password/route.ts    # POST (trocar senha)
│   └── me/route.ts                 # GET (dados do usuário)
├── fields/
│   ├── route.ts                    # GET (list), POST (create)
│   └── [id]/
│       ├── route.ts                # GET (incl. subFields geom + parentField), PATCH, DELETE
│       ├── status/route.ts         # GET (lightweight status check)
│       ├── process/route.ts        # POST (process via pipeline, ~99 linhas)
│       ├── subfields/
│       │   ├── route.ts            # GET, POST (subtalhões, incl. detected fields)
│       │   └── comparison/route.ts # GET (dados comparativos pai vs filhos)
│       ├── images/route.ts         # GET (imagens satélite, URLs S3)
│       └── analyze/[templateId]/route.ts
├── logistics/
│   └── diagnostic/route.ts         # GET (aggregated data)
└── admin/
    ├── users/
    │   ├── route.ts                # GET, POST (CRUD usuários)
    │   └── [id]/
    │       ├── route.ts            # GET, PUT, DELETE
    │       └── reset-password/route.ts
    ├── workspaces/
    │   ├── route.ts                # GET, POST (SUPER_ADMIN)
    │   └── [id]/route.ts           # GET, PUT, DELETE
    └── fix-status/route.ts         # GET, POST
```

### 3. Pipeline de Processamento (lib/services/processing/)

O processamento de talhões (`POST /api/fields/[id]/process`) foi refatorado de ~1248 linhas para um padrão de pipeline orquestrado (~99 linhas na route, lógica em steps):

```
lib/services/processing/
├── index.ts           # Barrel exports
├── types.ts           # PipelineContext, StepResult, PipelineStep
├── pipeline.ts        # Orchestrator (~60 linhas)
├── steps/
│   ├── 01-fetch-ndvi.ts
│   ├── 02-detect-phenology.ts
│   ├── 03-crop-pattern.ts
│   ├── 04-fetch-climate.ts
│   ├── 05-fetch-radar.ts
│   ├── 06-fuse-eos.ts
│   ├── 07-ai-validation.ts
│   └── 08-persist.ts
└── helpers/
    └── status.ts      # Determinação de status final
```

Cada step recebe `PipelineContext` e retorna `StepResult`. O pipeline executa sequencialmente; falhas em steps críticos interrompem o fluxo.

### 4. Services Layer (Business Logic)

**Responsabilidades:**
- Lógica de negócio
- Integração com APIs externas
- Cálculos complexos
- Transformação de dados

**Serviços:**

| Serviço | Arquivo / Diretório | Função |
|---------|---------------------|--------|
| Merx | `merx.service.ts` | Integração com API de satélite |
| Phenology | `phenology.service.ts` | Detecção de fenologia + EOS dinâmico |
| EOS Fusion | `eos-fusion.service.ts` | Fusão NDVI + GDD + Balanço Hídrico (single source of truth, sanity check v0.0.33) |
| Crop Pattern | `crop-pattern.service.ts` | Análise algorítmica de padrão de cultura (8 culturas, 3 categorias) |
| Thermal | `thermal.service.ts` | Soma térmica (GDD) com backtracking de maturação |
| Water Balance | `water-balance.service.ts` | Balanço hídrico + ajuste EOS por estresse |
| Climate Envelope | `climate-envelope/` | Bandas históricas (Bollinger-like): types, api, analysis |
| Precipitation | `precipitation.service.ts` | Dados de precipitação + ajuste colheita |
| Cycle Analysis | `cycle-analysis/` | Projeção adaptativa por fase fenológica: types, helpers, detection, chart-data |
| Correlation | `correlation.service.ts` | Correlação histórica robusta |
| Geometry | `geometry.service.ts` | Validação e cálculo de geometrias |
| Geocoding | `geocoding.service.ts` | Geocodificação reversa |
| AI Templates | `ai.service.ts` | Integração com Gemini para análises textuais |
| AI Validation | `ai-validation.service.ts` | Orquestrador do pipeline de validação visual (Curator→Verifier→Judge) |
| Field Images | `field-images.service.ts` | Serviço compartilhado de imagens (fetch, S3, incremental) — IA + Visual Analysis |
| Feature Flags | `feature-flags.service.ts` | Configuração de módulos por workspace (incl. `enableVisualAnalysis`, `enableSubFields`, `enableSubFieldComparison`) |
| Pricing | `pricing.service.ts` | Custos de API (Gemini, Sentinel Hub) |
| Sentinel-1 | `sentinel1/` | Integração Radar Copernicus: types, auth, helpers, statistics, api, process |
| SAR-NDVI Adaptive | `sar-ndvi-adaptive.service.ts` + `sar-ndvi/` | Fusão óptico + radar adaptativa (types, statistics, models, calibration, fusion) |
| NDVI Fusion | `ndvi-fusion.service.ts` | Fusão óptico + radar (usa sar-ndvi internamente) |
| RVI Calibration | `rvi-calibration/` | Calibração RVI: types, math, data, calibration |
| S3 Client | `s3.ts` (lib/) | Upload, download, presigned URLs para armazenamento de imagens em AWS S3 |

**Nota:** Serviços grandes foram divididos em subdiretórios com barrel re-exports (index.ts).

**Agentes IA (lib/agents/):**

| Agente | Arquivo | Função |
|--------|---------|--------|
| Curator | `curator.ts` | Seleção e pontuação de imagens de satélite |
| Verifier | `verifier.ts` | Confirmação visual da cultura declarada (flash-lite) |
| Judge | `judge.ts` | Validação fenológica por visão computacional |
| Curator Prompt | `curator-prompt.ts` | Template de prompt do Curador |
| Verifier Prompt | `verifier-prompt.ts` | Template de prompt do Verificador com padrões visuais por cultura |
| Judge Prompt | `judge-prompt.ts` | Template de prompt do Juiz com critérios de decisão |
| Types | `types.ts` | Interfaces compartilhadas (incl. CropVerification, VerifierAnalysis) |
| Evalscripts | `evalscripts.ts` | Scripts Sentinel Hub (S2 True Color, S2 NDVI, S1 Radar, Landsat NDVI, S3 NDVI) |

### 5. Data Layer (Persistence)

**Tecnologias:** Prisma ORM, PostgreSQL (Neon)

**Modelos:**

```prisma
// Multi-tenancy
model Workspace {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  logo        String?
  isActive    Boolean  @default(true)
  settings    String?
  maxFields   Int      @default(100)
  maxUsers    Int      @default(10)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  users       User[]
  fields      Field[]
}

model User {
  id                 String    @id @default(cuid())
  email              String    @unique
  name               String
  passwordHash       String
  isActive           Boolean   @default(true)
  role               UserRole  @default(VIEWER)
  mustChangePassword Boolean   @default(true)
  workspaceId        String
  workspace          Workspace @relation(...)
  lastLoginAt        DateTime?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
}

enum UserRole {
  SUPER_ADMIN  // Gestão global da plataforma
  ADMIN        // Gestão do workspace
  OPERATOR     // Criar/editar talhões
  VIEWER       // Apenas visualização
}

model Producer {
  id          String    @id @default(cuid())
  name        String    // Obrigatório
  cpf         String?   // Opcional
  workspaceId String
  workspace   Workspace @relation(...)
  fields      Field[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

enum CropType {
  SOJA   // Ciclo 120 dias
  MILHO  // Ciclo 140 dias
}

// Dados de negócio
model Field {
  id                String    @id
  name              String
  cropType          CropType  @default(SOJA)  // Tipo de cultura
  plantingDateInput DateTime? // Data de plantio informada pelo produtor
  seasonStartDate   DateTime? // Data de início da safra (editável)
  status            String    // PENDING | PROCESSING | SUCCESS | PARTIAL | ERROR
  errorMessage      String?
  geometryJson      String
  areaHa            Float?
  editHistory       String?   // JSON: [{timestamp, field, oldValue, newValue}]
  parentFieldId     String?   // Hierarquia pai/filho (subtalhões)
  parentField       Field?    @relation("SubFields", ...)
  subFields         Field[]   @relation("SubFields")
  producerId        String?   // Produtor vinculado (opcional)
  producer          Producer?
  workspaceId       String?   // Multi-tenancy
  workspace         Workspace?
  createdById       String?
  createdBy         User?
  agroData          AgroData?
  analyses          Analysis[]
  ndviData          NdviDataPoint[]
  fieldImages       FieldImage[]
}

model AgroData {
  id                      String
  plantingDate            DateTime?
  sosDate                 DateTime?
  eosDate                 DateTime?
  peakDate                DateTime?
  volumeEstimatedKg       Float?
  confidenceScore         Int?
  // Detecções algorítmicas preservadas (v0.0.34)
  detectedPlantingDate    DateTime?
  detectedSosDate         DateTime?
  detectedEosDate         DateTime?
  detectedPeakDate        DateTime?
  detectedCycleDays       Int?
  detectedCropType        String?
  detectedConfidence      String?
  detectedConfidenceScore Int?
  field                   Field
}

// Persistência de imagens de satélite (v0.0.34)
model FieldImage {
  id          String   @id @default(cuid())
  fieldId     String
  field       Field    @relation(...)
  date        String   // YYYY-MM-DD
  type        String   // 'truecolor' | 'ndvi' | 'radar' | 'landsat-ndvi' | 's3-ndvi'
  collection  String   // 'sentinel-2-l2a' | 'sentinel-1-grd' | etc.
  s3Key       String   // Full S3 object key
  width       Int      @default(512)
  height      Int      @default(512)
  sizeBytes   Int?
  source      String   // 'ai-validation' | 'visual-analysis' | 'process'

  @@unique([fieldId, date, type, collection])
}

model Analysis {
  id              String
  templateId      String    // CREDIT | LOGISTICS | RISK_MATRIX
  status          String
  aiSummary       String?
  aiMetrics       String?   // JSON
  field           Field
}
```

### 6. Infraestrutura de Testes (__tests__/)

Testes unitários com Jest + ts-jest. ~110 testes cobrindo serviços de fenologia, fusão EOS, padrão de cultura, térmico e balanço hídrico.

```
__tests__/
├── fixtures/              # Dados de teste
│   ├── ndvi-series.ts     # 8 cenários NDVI (SOJA_NORMAL, NO_CROP, etc.)
│   ├── temperature-data.ts
│   ├── precipitation-data.ts
│   └── geometry.ts
├── helpers/
│   └── test-utils.ts
└── services/
    ├── setup.test.ts      # Infraestrutura, path aliases, fixtures
    ├── phenology.test.ts  # ~28 cenários
    ├── eos-fusion.test.ts # ~22 cenários
    ├── crop-pattern.test.ts # ~20 cenários
    ├── thermal.test.ts    # ~18 cenários
    └── water-balance.test.ts # ~17 cenários
```

### 7. Utilitários e Tipos (lib/utils/, lib/types/)

**lib/utils/** — Utilitários compartilhados:
- `report-chart-utils.ts` — Helpers para gráficos de relatório
- `date-utils.ts` — Formatação e parsing de datas (formatDateForInput, parseDateBRToISO, isValidDateBR)

**lib/types/** — Tipos compartilhados:
- `settings.ts` — Tipos de configuração do workspace

---

## Fluxos Principais

### Fluxo de Processamento de Talhão

O processamento é orquestrado pelo pipeline (`lib/services/processing/`). A route `process/route.ts` delega para `runPipeline()`.

```
┌──────────┐     ┌──────────────────────────────────────┐     ┌──────────┐
│  Create  │────▶│  Pipeline (8 steps)                  │────▶│  Save    │
│  Field   │     │  01-NDVI → 02-Phenology → 03-Pattern │     │ AgroData │
└──────────┘     │  → 04-Climate → 05-Radar → 06-Fuse   │     └──────────┘
     │           │  → 07-AI Validation → 08-Persist     │           │
     │           └──────────────────────────────────────┘           │
     │           PENDING ──▶ PROCESSING ──▶ SUCCESS                 │
     │                              │                               │
     │                              ▼                               │
     │                         PARTIAL (se incompleto)              │
     │                         ERROR (se falhar)                    │
     └─────────────────────────────────────────────────────────────┘
```

### Fluxo de Dados EOS (Single Source of Truth - v0.0.30, sanity check v0.0.33)

```
┌──────────────────────────────────────────────────────────────────┐
│                    CÁLCULO NO SERVIDOR                            │
│                                                                  │
│  phenology.service ──→ EOS_NDVI (data bruta por curva)          │
│  thermal.service   ──→ EOS_GDD (data por soma térmica)          │
│  water-balance     ──→ stress_level (PT→EN mapping)             │
│                                                                  │
│  eos-fusion.service ──→ FUSED EOS (canônico)                    │
│    ↕ campos: date, method, confidence, passed                    │
│    ↕ v0.0.33: NDVI prevalece sobre GDD em contradições          │
│    ↕ v0.0.33: GDD passado + NDVI ativo → projeção futura       │
│                                                                  │
│  crop-pattern.service ──→ classifica cultura (v0.0.32/33)       │
│    ↕ NO_CROP/MISMATCH → short-circuit (EOS não calculado)       │
│    ↕ ATYPICAL → ciclo indefinido ou baixa amplitude             │
│                                                                  │
│  process/route.ts (pipeline: steps 01–08)                        │
│    ├── persiste em agroData.eosDate (NDVI bruto)                │
│    ├── persiste em rawAreaData.fusedEos (objeto completo)       │
│    └── salva fusedEosPassed (boolean)                           │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                ┌───────────┼───────────┐
                ▼           ▼           ▼
        ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
        │ fields/[id] │ │reports/[id] │ │  logistics  │
        │  route.ts   │ │  page.tsx   │ │ diagnostic  │
        │             │ │             │ │             │
        │ bestEosDate │ │ prioriza    │ │ usa fusedEos│
        │ = fusedEos  │ │ server EOS  │ │ p/ curva    │
        │   > bruto   │ │ > client    │ │ recebimento │
        └─────────────┘ └─────────────┘ └─────────────┘
```

### Fluxo de Validação Visual IA (v0.0.29, refatorado v0.0.34)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Trigger    │────▶│ field-images │────▶│   Curator    │────▶│  Verifier    │
│ MANUAL/AUTO/ │     │  .service    │     │   Agent      │     │ (condicional)│
│ LOW_CONF     │     │ (S3 + CDSE)  │     │ (select+rank)│     │              │
└──────────────┘     └──────┬───────┘     └──────────────┘     └──────┬───────┘
                            │                                         │
                    ┌───────▼───────┐                                 ▼
                    │  S3 Storage   │     ┌──────────────┐     ┌──────────────┐
                    │ (persist new) │     │   Persist    │◀────│    Judge     │
                    │ + FieldImage  │     │   AgroData   │     │    Agent     │
                    │   metadata    │     │  + Analysis  │     │(multimodal)  │
                    └───────────────┘     └──────────────┘     └──────────────┘
```

**Nota (v0.0.34)**: O fetch de imagens agora passa pelo `field-images.service.ts` compartilhado. Imagens são persistidas em S3 (`agro-monitor/{workspaceId}/fields/{fieldId}/`), com metadados no modelo `FieldImage`. O fetch é incremental — apenas datas novas são buscadas no Sentinel Hub.

### Fluxo de Análise Visual (v0.0.34)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Tab Visual  │────▶│ GET /api/    │────▶│ field-images │────▶│  S3 Presign  │
│  no Relatório│     │ fields/[id]/ │     │  .service    │     │  URLs        │
│  (condicional│     │ images       │     │ (stored +    │     │              │
│  feat. flag) │     │ ?refresh=... │     │  incremental)│     └──────┬───────┘
└──────────────┘     └──────────────┘     └──────────────┘            │
                                                                      ▼
                     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
                     │ Comparison   │◀────│   Timeline   │◀────│   Image      │
                     │ Slider       │     │   Navegação  │     │   List       │
                     │ (before/     │     │   por datas  │     │  (URLs S3)   │
                     │  after)      │     └──────────────┘     └──────────────┘
                     └──────────────┘
```

### Relatório do Talhão (v0.0.36)

A página de relatório (`reports/[id]/page.tsx`) suporta tanto talhões pai quanto subtalhões:

**Funcionalidades v0.0.36:**
- **Breadcrumb de navegação**: Subtalhões exibem breadcrumb `[PaiName] / [FilhoName]` no header, com link clicável para o relatório do pai. `router.back()` preserva histórico de navegação
- **Mapa com polígonos filhos**: `FieldMapModal` recebe prop `siblings` com geometrias dos subtalhões, renderizados como polígonos coloridos com tooltips
- **Aba de comparação**: Quando habilitado (`enableSubFieldComparison`), talhões pai com subtalhões exibem aba extra com tabela comparativa (área, volume, confiança, NDVI peak, SOS, EOS, cultura) e gráfico NDVI overlay
- **API**: `GET /api/fields/[id]` agora inclui `subFields` (id, name, geometryJson) e `parentField` (id, name) no response

### Fluxo de Diagnóstico Logístico

O módulo de diagnóstico logístico é organizado em **3 abas**:

```
┌─────────────────────────────────────────────────────────────┐
│                    Diagnóstico Logístico                     │
├─────────────────┬─────────────────┬─────────────────────────┤
│    Overview     │    Produtor     │  Unidade de Recebimento │
│    (default)    │   (filtro)      │      (em breve)         │
└────────┬────────┴────────┬────────┴─────────────────────────┘
         │                 │
         ▼                 ▼
  ┌──────────────┐  ┌──────────────────────────────────────┐
  │ Visão geral  │  │ Selecionar produtores (multi-select) │
  │ consolidada  │  │ Recalcular métricas, timeline, curva │
  │ (todos)      │  │ Filtrar mapa e tabela                │
  └──────────────┘  └──────────────────────────────────────┘
```

**Fluxo de Dados:**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Fetch Fields│────▶│   Filter    │────▶│  Calculate  │
│ SUCCESS only│     │ with eosDate│     │  Aggregates │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                              ▼
                    ┌─────────────────────────────────────┐
                    │         Response                     │
                    │  - summary (totals, dates)          │
                    │  - dailyForecast (bell curve)       │
                    │  - fields (+ producerId/Name)       │
                    │  - alerts (critical indicators)     │
                    └─────────────────────────────────────┘
```

---

## Integrações Externas

### Merx API

Base URL: `https://api.merx.app.br`

| Endpoint | Uso |
|----------|-----|
| `/consulta-ndvi` | Dados NDVI atual e histórico |
| `/consulta-precipitacao` | Dados de precipitação |
| `/consulta-solo` | Tipo de solo |
| `/consulta-area-lavoura` | Área plantada |
| `/consulta-zarc-anual` | Zoneamento agrícola |

### Google Gemini AI

| Uso | Modelo | SDK |
|-----|--------|-----|
| Templates de Análise | `gemini-3-flash-preview` | `@google/genai` |
| Agente Curador (Visual) | `gemini-2.5-flash-lite` ou `gemini-3-flash-preview` | `@google/genai` |
| Agente Verificador (Cultura) | `gemini-2.5-flash-lite` | `@google/genai` |
| Agente Juiz (Visual) | `gemini-3-flash-preview` | `@google/genai` |

**Uso em Templates**: Geração de análises textuais (Crédito, Logística, Risco).

**Uso em Validação Visual (v0.0.29, atualizado v0.0.32/v0.0.33)**: Pipeline de 3 agentes (Curator → Verifier → Judge) que analisam imagens de satélite para confirmar cultura declarada e validar projeções de fenologia. O Verifier usa `gemini-2.5-flash-lite` e opera como gate condicional para o Judge, com short-circuit em NO_CROP/MISMATCH. Resultados do Judge são suprimidos no dashboard e relatório quando crop issues são detectados. Dashboard reestruturado (v0.0.33): colunas Cultura (tipo declarado) + Status (badge algorítmico) separadas. Relatório inclui modal de mapa com polígono do talhão via Leaflet (satélite/OSM).

### Sentinel Hub (Copernicus Data Space)

API para busca e processamento de imagens de satélite.

| Sensor | Uso | Evalscript | Condição |
|--------|-----|------------|----------|
| Sentinel-2 L2A | True Color (RGB) + NDVI Colorizado | `EVALSCRIPT_TRUE_COLOR`, `EVALSCRIPT_NDVI` | Sempre |
| Sentinel-1 GRD | Radar Composto SAR (VV/VH) | `EVALSCRIPT_RADAR` | Sempre |
| Landsat 8/9 | NDVI complementar | `EVALSCRIPT_LANDSAT_NDVI` | Talhões >200ha |
| Sentinel-3 OLCI | NDVI de larga escala | `EVALSCRIPT_S3_NDVI` | Talhões >500ha |

**Autenticação**: OAuth2 Client Credentials (armazenado em WorkspaceSettings ou `.env`).

### AWS S3 (Armazenamento de Imagens — v0.0.34)

Armazenamento de imagens de satélite para Análise Visual e Validação IA.

| Configuração | Valor |
|-------------|-------|
| **SDK** | `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` |
| **Bucket** | Configurável via `S3_BUCKET` (default: `pocs-merxlabs`) |
| **Região** | Configurável via `S3_REGION` (default: `us-east-1`) |
| **Path** | `agro-monitor/{workspaceId}/fields/{fieldId}/{date}_{type}_{collection}.png` |
| **Alternativa** | Suporta R2/MinIO via `S3_ENDPOINT` opcional |
| **Arquivo** | `lib/s3.ts` |

**Operações:**
- `uploadImage` — Envio de imagem PNG para S3
- `downloadImage` — Download de imagem para processamento (base64 para IA)
- `getPresignedUrl` — URL assinada (1h) para visualização no frontend
- `buildImageKey` — Geração de chave S3 com segregação por workspace

**Metadados:** Modelo `FieldImage` (Prisma) registra cada imagem com `fieldId`, `date`, `type`, `collection`, `s3Key`, `source`.

---

## Considerações de Performance

### Caching
- Dados NDVI são armazenados no banco após processamento
- Evita chamadas repetidas à API Merx
- Imagens de satélite persistidas em S3 com fetch incremental (apenas datas novas são buscadas no Sentinel Hub)

### Lazy Loading
- Componentes de mapa carregados dinamicamente (next/dynamic)
- Evita problemas de SSR com Leaflet

### Otimizações de Query
- Seleção de campos específicos no Prisma (select)
- Filtragem em JavaScript quando Prisma não suporta

---

## Segurança

### Autenticação
- JWT com `jose` para tokens de sessão
- Cookies HTTP-only para armazenamento de tokens
- Hash de senhas com `bcryptjs` (cost 12)
- Middleware de proteção em todas as rotas
- Fluxo de primeiro acesso com troca de senha obrigatória

### Multi-tenancy
- Isolamento completo de dados por `workspaceId`
- Todas as queries filtram por workspace do usuário
- Middleware injeta `x-workspace-id` nos headers
- Validação redundante em cada endpoint

### RBAC (Role-Based Access Control)
```
SUPER_ADMIN → Pode tudo (criar workspaces, ver todos os dados)
    │
    ▼
  ADMIN → Gestão de usuários do próprio workspace
    │
    ▼
 OPERATOR → Criar/editar/processar talhões
    │
    ▼
  VIEWER → Apenas leitura
```

### Validação e Sanitização
- Chaves de API em variáveis de ambiente
- Validação de input com Zod
- Sanitização de geometrias
- Emails normalizados (lowercase)

---

## Escalabilidade

### Horizontal
- Stateless API routes
- Database connection pooling (Neon)
- CDN para assets estáticos

### Vertical
- Otimização de queries
- Índices no banco de dados
- Cache em memória (futuro: Redis)
