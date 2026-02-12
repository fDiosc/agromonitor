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
│  │  ┌─────────────────────────────────────────────────┐              │   │
│  │  │            AI VALIDATION LAYER (v0.0.29)         │              │   │
│  │  │  ┌───────────┐  ┌───────────┐  ┌────────────┐  │              │   │
│  │  │  │  Curator  │  │   Judge   │  │Orchestrator│  │              │   │
│  │  │  │  Agent    │  │   Agent   │  │  Service   │  │              │   │
│  │  │  └───────────┘  └───────────┘  └────────────┘  │              │   │
│  │  └─────────────────────────────────────────────────┘              │   │
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

**Dashboard (v0.0.31):**
- Tabela com 13 colunas individuais ordenáveis (clique no cabeçalho)
- Ordenação padrão: colheita prevista mais próxima primeiro
- 7 filtros combinatórios em 2 linhas (logística + fenologia/IA)
- Processamento server-side de JSON pesados (rawAreaData → fusedEosDate, aiValidationAgreement → harvestReady)

**Componentes Principais:**
```
components/
├── fields/
│   └── field-table.tsx      # Tabela ordenável de talhões (colunas Cultura+Status, sorting, Field type export)
├── ai-validation/
│   └── AIValidationPanel.tsx # Painel de resultados IA no relatório
├── modals/
│   ├── DisclaimerModal.tsx  # Modal de termos de uso
│   ├── EditFieldModal.tsx   # Modal de edição de talhão
│   └── FieldMapModal.tsx    # Modal de mapa do polígono (Leaflet, satélite/OSM)
├── layout/
│   ├── app-layout.tsx       # Layout principal com sidebar
│   ├── sidebar.tsx          # Navegação lateral
│   ├── sidebar-footer.tsx   # Versão e changelog
│   └── changelog-modal.tsx  # Modal de changelog
├── maps/
│   └── map-drawer.tsx       # Desenho de polígonos (Leaflet Draw)
└── ui/
    ├── button.tsx
    ├── card.tsx
    ├── badge.tsx
    └── ...
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
│       ├── route.ts                # GET, DELETE
│       ├── status/route.ts         # GET (lightweight status check)
│       ├── process/route.ts        # POST (process)
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

### 3. Services Layer (Business Logic)

**Responsabilidades:**
- Lógica de negócio
- Integração com APIs externas
- Cálculos complexos
- Transformação de dados

**Serviços:**

| Serviço | Arquivo | Função |
|---------|---------|--------|
| Merx | `merx.service.ts` | Integração com API de satélite |
| Phenology | `phenology.service.ts` | Detecção de fenologia + EOS dinâmico |
| EOS Fusion | `eos-fusion.service.ts` | Fusão NDVI + GDD + Balanço Hídrico (single source of truth, sanity check v0.0.33) |
| Crop Pattern | `crop-pattern.service.ts` | Análise algorítmica de padrão de cultura (8 culturas, 3 categorias) |
| Thermal | `thermal.service.ts` | Soma térmica (GDD) com backtracking de maturação |
| Water Balance | `water-balance.service.ts` | Balanço hídrico + ajuste EOS por estresse |
| Climate Envelope | `climate-envelope.service.ts` | Bandas históricas (Bollinger-like) |
| Precipitation | `precipitation.service.ts` | Dados de precipitação + ajuste colheita |
| Cycle Analysis | `cycle-analysis.service.ts` | Projeção adaptativa por fase fenológica |
| Correlation | `correlation.service.ts` | Correlação histórica robusta |
| Geometry | `geometry.service.ts` | Validação e cálculo de geometrias |
| Geocoding | `geocoding.service.ts` | Geocodificação reversa |
| AI Templates | `ai.service.ts` | Integração com Gemini para análises textuais |
| AI Validation | `ai-validation.service.ts` | Orquestrador do pipeline de validação visual |
| Feature Flags | `feature-flags.service.ts` | Configuração de módulos por workspace |
| Pricing | `pricing.service.ts` | Custos de API (Gemini, Sentinel Hub) |
| Sentinel-1 | `sentinel1.service.ts` | Integração Radar Copernicus |
| NDVI Fusion | `ndvi-fusion.service.ts` | Fusão óptico + radar |

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

### 4. Data Layer (Persistence)

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
  status            String    // PENDING | PROCESSING | SUCCESS | PARTIAL | ERROR
  errorMessage      String?
  geometryJson      String
  areaHa            Float?
  producerId        String?   // Produtor vinculado (opcional)
  producer          Producer?
  workspaceId       String?   // Multi-tenancy
  workspace         Workspace?
  createdById       String?
  createdBy         User?
  agroData          AgroData?
  analyses          Analysis[]
  ndviData          NdviDataPoint[]
}

model AgroData {
  id                    String
  plantingDate          DateTime?
  sosDate               DateTime?
  eosDate               DateTime?
  peakDate              DateTime?
  volumeEstimatedKg     Float?
  confidenceScore       Int?
  field                 Field
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

---

## Fluxos Principais

### Fluxo de Processamento de Talhão

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Create  │────▶│  Fetch   │────▶│ Calculate│────▶│  Save    │
│  Field   │     │ Merx API │     │ Phenology│     │ AgroData │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                                                   │
     │           PENDING ──▶ PROCESSING ──▶ SUCCESS      │
     │                              │                    │
     │                              ▼                    │
     │                         PARTIAL (se incompleto)   │
     │                         ERROR (se falhar)         │
     └───────────────────────────────────────────────────┘
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
│  process/route.ts                                                │
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

### Fluxo de Validação Visual IA (v0.0.29)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Trigger    │────▶│  Fetch Sat   │────▶│   Curator    │
│ MANUAL/AUTO/ │     │  Images via  │     │   Agent      │
│ LOW_CONF     │     │ Sentinel Hub │     │ (select+rank)│
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                                  ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Persist    │◀────│  Normalize   │◀────│    Judge     │
│   AgroData   │     │  Response    │     │    Agent     │
│  + Analysis  │     │ (PT→EN, old  │     │(multimodal)  │
└──────────────┘     │  →new schema)│     └──────────────┘
                     └──────────────┘
```

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

**Uso em Validação Visual (v0.0.29, atualizado v0.0.32/v0.0.33)**: Pipeline de 3 agentes (Curator → Verifier → Judge) que analisam imagens de satélite para confirmar cultura declarada e validar projeções de fenologia. Verifier opera como gate para o Judge, com short-circuit em NO_CROP/MISMATCH. Resultados do Judge são suprimidos no dashboard e relatório quando crop issues são detectados. Dashboard reestruturado (v0.0.33): colunas Cultura (tipo declarado) + Status (badge algorítmico) separadas. Relatório inclui modal de mapa com polígono do talhão via Leaflet (satélite/OSM).

### Sentinel Hub (Copernicus Data Space)

API para busca e processamento de imagens de satélite.

| Sensor | Uso | Evalscript | Condição |
|--------|-----|------------|----------|
| Sentinel-2 L2A | True Color (RGB) + NDVI Colorizado | `EVALSCRIPT_TRUE_COLOR`, `EVALSCRIPT_NDVI` | Sempre |
| Sentinel-1 GRD | Radar Composto SAR (VV/VH) | `EVALSCRIPT_RADAR` | Sempre |
| Landsat 8/9 | NDVI complementar | `EVALSCRIPT_LANDSAT_NDVI` | Talhões >200ha |
| Sentinel-3 OLCI | NDVI de larga escala | `EVALSCRIPT_S3_NDVI` | Talhões >500ha |

**Autenticação**: OAuth2 Client Credentials (armazenado em WorkspaceSettings ou `.env`).

---

## Considerações de Performance

### Caching
- Dados NDVI são armazenados no banco após processamento
- Evita chamadas repetidas à API Merx

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
