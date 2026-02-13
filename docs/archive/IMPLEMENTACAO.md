# MERX AGRO Monitor - Plano de Implementação MVP

## Escopo do MVP

### Objetivo
Replicar as funcionalidades atuais com arquitetura mais robusta, sem autenticação, para execução local. **Arquitetura preparada para múltiplos templates de análise.**

### O que ENTRA no MVP
- Dashboard com carteira de talhões
- Cadastro de talhões (upload KML/GeoJSON + desenho no mapa)
- Integração com API Merx (NDVI, precipitação, solo, histórico)
- Cálculo de fenologia aprimorado
- **Sistema de Templates de Análise** (extensível)
  - Template: Análise de Crédito/Garantia
  - Template: Análise Logística (previsão de colheita e transporte)
  - Template: Matriz de Risco Geral
- Análise com IA (Gemini) baseada em templates
- Relatório visual dinâmico por template
- Persistência local (banco de dados SQLite)
- Validação de geometrias
- Tratamento de erros robusto

### O que NÃO ENTRA no MVP
- Autenticação/Autorização
- Multi-tenancy
- Deploy em produção
- Sistema de alertas
- Notificações
- Exportação PDF/Excel
- API pública

---

## Arquitetura de Templates de Análise

### Conceito
Os **dados agronômicos são sempre os mesmos** (NDVI, fenologia, precipitação, área). O que muda é a **interpretação e análise** conforme o caso de uso.

```
┌─────────────────────────────────────────────────────────────────┐
│                     DADOS AGRONÔMICOS (BASE)                     │
│  NDVI • Fenologia • Precipitação • Solo • Área • Histórico      │
└─────────────────────────────────────────────────────────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│    TEMPLATE     │   │    TEMPLATE     │   │    TEMPLATE     │
│    CRÉDITO      │   │   LOGÍSTICA     │   │  MATRIZ RISCO   │
├─────────────────┤   ├─────────────────┤   ├─────────────────┤
│ • Risco default │   │ • Janela colhe. │   │ • Score geral   │
│ • LTV garantia  │   │ • Volume diário │   │ • Riscos categ. │
│ • Washout       │   │ • Rotas ótimas  │   │ • Severidade    │
│ • Venc. CPR     │   │ • Frota necess. │   │ • Tendências    │
└─────────────────┘   └─────────────────┘   └─────────────────┘
          │                     │                     │
          ▼                     ▼                     ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   PROMPT IA     │   │   PROMPT IA     │   │   PROMPT IA     │
│   ESPECÍFICO    │   │   ESPECÍFICO    │   │   ESPECÍFICO    │
└─────────────────┘   └─────────────────┘   └─────────────────┘
          │                     │                     │
          ▼                     ▼                     ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   VISUALIZAÇÃO  │   │   VISUALIZAÇÃO  │   │   VISUALIZAÇÃO  │
│   ESPECÍFICA    │   │   ESPECÍFICA    │   │   ESPECÍFICA    │
└─────────────────┘   └─────────────────┘   └─────────────────┘
```

### Templates Planejados

#### 1. Crédito/Garantia (Já existe)
**Público:** Fundos, Bancos, Credores
**Foco:** Segurança da garantia, risco de inadimplência

| Métrica | Descrição |
|---------|-----------|
| Status Operação | NORMAL / ALERTA / CRÍTICO |
| Risco Washout | Probabilidade de venda antecipada |
| Aderência CPR | Colheita vs vencimento do título |
| Volume Garantido | Toneladas disponíveis como colateral |

#### 2. Logística (NOVO)
**Público:** Tradings, Transportadoras, Originadores
**Foco:** Planejamento de colheita e transporte

| Métrica | Descrição |
|---------|-----------|
| Janela de Colheita | Data início e fim estimados |
| Volume Diário | Estimativa de colheita por dia |
| Pico de Demanda | Período de maior volume |
| Risco Climático | Probabilidade de atraso por chuva |
| Qualidade Grão | Risco de colheita em período chuvoso |

#### 3. Matriz de Risco (NOVO)
**Público:** Gestores de Carteira, Analistas
**Foco:** Visão consolidada de todos os riscos

| Métrica | Descrição |
|---------|-----------|
| Score Geral | 0-100 (saúde do talhão) |
| Riscos Categorizados | Climático, Fenológico, Operacional, Comercial |
| Severidade | Baixa, Média, Alta, Crítica |
| Tendência | Melhorando, Estável, Piorando |
| Ações Prioritárias | Top 3 ações recomendadas |

---

## Stack Técnica do MVP

| Camada | Tecnologia | Justificativa |
|--------|------------|---------------|
| Framework | Next.js 14 (App Router) | Full-stack, API Routes |
| Linguagem | TypeScript 5 | Type safety |
| Estilização | TailwindCSS 3 | Produtividade, já usado |
| Componentes | shadcn/ui | Qualidade, acessibilidade |
| ORM | Prisma | SQLite local, migrations |
| Banco | SQLite | Zero config, local |
| Validação | Zod | Schemas tipados |
| Estado | Zustand | Simples, persistente |
| Gráficos | Recharts | Já usado |
| Mapas | Leaflet + React-Leaflet | Já usado |
| IA | Google Gemini | Já usado |
| HTTP | Fetch nativo | Simplicidade |

---

## Estrutura do Projeto

```
merx-agro-mvp/
├── app/
│   ├── page.tsx                    # Dashboard (carteira)
│   ├── layout.tsx                  # Layout global
│   ├── globals.css                 # Estilos globais
│   │
│   ├── fields/
│   │   └── new/
│   │       └── page.tsx            # Cadastro de talhão
│   │
│   ├── reports/
│   │   └── [id]/
│   │       ├── page.tsx            # Relatório do talhão (dados agro + templates)
│   │       └── [templateId]/
│   │           └── page.tsx        # Análise específica de um template
│   │
│   └── api/
│       ├── fields/
│       │   ├── route.ts            # GET (list), POST (create)
│       │   └── [id]/
│       │       ├── route.ts        # GET, DELETE
│       │       ├── process/
│       │       │   └── route.ts    # POST (processar dados agro)
│       │       └── analyze/
│       │           └── [templateId]/
│       │               └── route.ts # POST (análise por template)
│       │
│       ├── templates/
│       │   └── route.ts            # GET (listar templates disponíveis)
│       │
│       └── upload/
│           └── route.ts            # POST (upload geometria)
│
├── components/
│   ├── ui/                         # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── table.tsx
│   │   ├── input.tsx
│   │   ├── tabs.tsx
│   │   └── progress.tsx
│   │
│   ├── fields/
│   │   ├── field-table.tsx         # Tabela do dashboard
│   │   ├── field-form.tsx          # Formulário de cadastro
│   │   ├── field-drawer.tsx        # Desenho no mapa
│   │   └── field-uploader.tsx      # Upload de arquivo
│   │
│   ├── agro/                       # Dados agronômicos (sempre iguais)
│   │   ├── metric-cards.tsx        # Cards de métricas base
│   │   ├── phenology-timeline.tsx  # Timeline fenológica
│   │   ├── ndvi-chart.tsx          # Gráfico NDVI comparativo
│   │   └── agro-summary.tsx        # Resumo dos dados agro
│   │
│   ├── templates/                  # Componentes por template
│   │   ├── template-selector.tsx   # Seletor de template
│   │   ├── template-badge.tsx      # Badge com status do template
│   │   │
│   │   ├── credit/                 # Template: Crédito
│   │   │   ├── credit-panel.tsx    # Painel principal
│   │   │   ├── credit-metrics.tsx  # Métricas específicas
│   │   │   └── credit-risks.tsx    # Riscos e recomendações
│   │   │
│   │   ├── logistics/              # Template: Logística
│   │   │   ├── logistics-panel.tsx
│   │   │   ├── harvest-timeline.tsx
│   │   │   └── volume-chart.tsx
│   │   │
│   │   └── risk-matrix/            # Template: Matriz de Risco
│   │       ├── risk-panel.tsx
│   │       ├── risk-categories.tsx
│   │       └── risk-score.tsx
│   │
│   ├── reports/
│   │   └── full-report.tsx         # Wrapper que monta dados agro + template
│   │
│   └── layout/
│       ├── header.tsx
│       └── page-container.tsx
│
├── lib/
│   ├── prisma.ts                   # Cliente Prisma
│   │
│   ├── services/
│   │   ├── merx.service.ts         # API Merx
│   │   ├── phenology.service.ts    # Cálculo fenologia
│   │   ├── geocoding.service.ts    # Geocodificação
│   │   ├── geometry.service.ts     # Validação geometria
│   │   │
│   │   └── ai/                     # Serviços de IA por template
│   │       ├── base.service.ts     # Classe base para análise
│   │       ├── credit.service.ts   # Análise de crédito
│   │       ├── logistics.service.ts # Análise logística
│   │       └── risk-matrix.service.ts # Matriz de risco
│   │
│   ├── templates/                  # Configuração de templates
│   │   ├── index.ts                # Registry de templates
│   │   ├── types.ts                # Tipos compartilhados
│   │   │
│   │   ├── credit/
│   │   │   ├── config.ts           # Configuração
│   │   │   ├── prompt.ts           # System + User prompts
│   │   │   └── schema.ts           # Response schema (Zod)
│   │   │
│   │   ├── logistics/
│   │   │   ├── config.ts
│   │   │   ├── prompt.ts
│   │   │   └── schema.ts
│   │   │
│   │   └── risk-matrix/
│   │       ├── config.ts
│   │       ├── prompt.ts
│   │       └── schema.ts
│   │
│   ├── validations/
│   │   └── field.schema.ts         # Schemas Zod
│   │
│   └── utils/
│       ├── geo.ts                  # Helpers geométricos
│       ├── dates.ts                # Formatação datas
│       └── formatters.ts           # Formatação números
│
├── hooks/
│   ├── use-fields.ts               # CRUD de talhões
│   ├── use-agro-data.ts            # Dados agronômicos
│   ├── use-analysis.ts             # Análise por template
│   └── use-templates.ts            # Templates disponíveis
│
├── stores/
│   └── ui.store.ts                 # Estado de UI (loading, etc)
│
├── prisma/
│   ├── schema.prisma               # Modelo de dados
│   ├── seed.ts                     # Seed dos templates
│   └── dev.db                      # SQLite (gerado)
│
├── public/
│   └── ...
│
├── .env.local                      # Variáveis de ambiente
├── .env.example
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Modelo de Dados (SQLite)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

// ==================== TALHÕES ====================

model Field {
  id              String      @id @default(cuid())
  name            String
  crop            String      @default("SOJA")
  seasonStartDate DateTime
  status          String      @default("PENDING") // PENDING, ANALYZING, SUCCESS, ERROR
  
  // Localização
  city            String?
  state           String?
  latitude        Float?
  longitude       Float?
  areaHa          Float?
  
  // Geometria (JSON armazenado como string)
  geometryJson    String      // GeoJSON stringified
  
  // Timestamps
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  analyzedAt      DateTime?
  
  // Relações
  agroData        AgroData?           // Dados agro (1:1)
  analyses        Analysis[]          // Análises por template (1:N)
  ndviData        NdviDataPoint[]
}

// ==================== DADOS AGRONÔMICOS (BASE) ====================
// Dados que são sempre os mesmos, independente do template

model AgroData {
  id              String   @id @default(cuid())
  
  // Métricas base
  areaHa          Float?
  volumeEstimatedKg Float?
  
  // Fenologia detectada
  plantingDate    DateTime?
  sosDate         DateTime?
  eosDate         DateTime?
  peakDate        DateTime?
  cycleDays       Int?
  phenologyMethod String?      // ALGORITHM | PROJECTION
  confidenceScore Int?
  confidence      String?      // HIGH | MEDIUM | LOW
  historicalCorrelation Float?
  
  // Detecções avançadas
  detectedReplanting Boolean @default(false)
  replantingDate  DateTime?
  yieldEstimateKgHa Float?   // Produtividade estimada kg/ha
  phenologyHealth String?    // EXCELLENT | GOOD | FAIR | POOR
  
  // Dados brutos da API Merx
  rawNdviData     String?      // JSON stringified
  rawPrecipData   String?      // JSON stringified
  rawSoilData     String?      // JSON stringified
  rawHistoricalData String?    // JSON stringified
  
  // Diagnósticos do processamento
  diagnostics     String?      // JSON array of diagnostics
  
  // Relação 1:1 com Field
  fieldId         String       @unique
  field           Field        @relation(fields: [fieldId], references: [id], onDelete: Cascade)
  
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
}

// ==================== ANÁLISES POR TEMPLATE ====================
// Uma análise para cada template aplicado

model Analysis {
  id              String   @id @default(cuid())
  
  // Template usado
  templateId      String       // CREDIT | LOGISTICS | RISK_MATRIX
  templateVersion String       @default("1.0.0")
  
  // Status da análise
  status          String       // NORMAL | ALERTA | CRITICO (ou equivalente do template)
  statusLabel     String?      // Label customizado do template
  statusColor     String?      // Cor para UI (green, yellow, red)
  
  // Resultado da IA
  aiSummary       String?
  aiMetrics       String?      // JSON - métricas específicas do template
  aiRisks         String?      // JSON array
  aiRecommendations String?    // JSON array
  aiFullResponse  String?      // JSON completo da resposta
  
  // Metadados
  promptVersion   String?
  modelUsed       String?
  processingTimeMs Int?
  fallbackUsed    Boolean      @default(false)
  
  // Relação com Field
  fieldId         String
  field           Field        @relation(fields: [fieldId], references: [id], onDelete: Cascade)
  
  createdAt       DateTime     @default(now())
  
  @@index([fieldId, templateId])
  @@unique([fieldId, templateId]) // Apenas uma análise por template por talhão
}

// ==================== TEMPLATES DE ANÁLISE ====================
// Configuração dos templates disponíveis

model AnalysisTemplate {
  id              String   @id // CREDIT, LOGISTICS, RISK_MATRIX
  name            String       // "Análise de Crédito"
  description     String?
  icon            String?      // Nome do ícone (lucide)
  color           String?      // Cor tema
  
  // Configuração
  isActive        Boolean      @default(true)
  sortOrder       Int          @default(0)
  
  // Schema de métricas (JSON)
  metricsSchema   String?      // Define quais métricas esse template gera
  
  // Prompt da IA (versionado)
  currentPromptVersion String  @default("1.0.0")
  systemPrompt    String       // System instruction para Gemini
  userPromptTemplate String    // Template do user prompt
  responseSchema  String?      // JSON Schema para resposta estruturada
  
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
}

// ==================== SÉRIES TEMPORAIS ====================

model NdviDataPoint {
  id          String   @id @default(cuid())
  date        DateTime
  ndviRaw     Float?
  ndviSmooth  Float?
  ndviInterp  Float?
  cloudCover  Float?
  isHistorical Boolean  @default(false)
  seasonYear  Int?
  
  fieldId     String
  field       Field    @relation(fields: [fieldId], references: [id], onDelete: Cascade)
  
  @@unique([fieldId, date, seasonYear])
  @@index([fieldId, date])
}
```

### Seed de Templates Iniciais

```typescript
// prisma/seed.ts

const templates = [
  {
    id: 'CREDIT',
    name: 'Análise de Crédito',
    description: 'Avaliação de risco para garantias agrícolas e CPRs',
    icon: 'Shield',
    color: 'emerald',
    sortOrder: 1,
    metricsSchema: JSON.stringify({
      status: { type: 'status', options: ['NORMAL', 'ALERTA', 'CRITICO'] },
      washoutRisk: { type: 'percentage', label: 'Risco Washout' },
      guaranteeHealth: { type: 'score', label: 'Saúde Garantia' },
      deliveryProbability: { type: 'percentage', label: 'Prob. Entrega' }
    }),
    systemPrompt: `Você é um Analista de Risco de Crédito Agrícola Sênior...`,
    userPromptTemplate: `Análise para talhão em {{city}}/{{state}}...`
  },
  {
    id: 'LOGISTICS',
    name: 'Análise Logística',
    description: 'Previsão de colheita e planejamento de transporte',
    icon: 'Truck',
    color: 'blue',
    sortOrder: 2,
    metricsSchema: JSON.stringify({
      harvestWindow: { type: 'dateRange', label: 'Janela Colheita' },
      dailyVolume: { type: 'number', unit: 'ton/dia', label: 'Volume Diário' },
      peakPeriod: { type: 'dateRange', label: 'Pico Demanda' },
      weatherRisk: { type: 'level', options: ['BAIXO', 'MEDIO', 'ALTO'] },
      grainQualityRisk: { type: 'level', options: ['BAIXO', 'MEDIO', 'ALTO'] }
    }),
    systemPrompt: `Você é um Especialista em Logística Agrícola...`,
    userPromptTemplate: `Planejamento logístico para talhão em {{city}}/{{state}}...`
  },
  {
    id: 'RISK_MATRIX',
    name: 'Matriz de Risco',
    description: 'Visão consolidada de todos os riscos do talhão',
    icon: 'AlertTriangle',
    color: 'amber',
    sortOrder: 3,
    metricsSchema: JSON.stringify({
      overallScore: { type: 'score', label: 'Score Geral', max: 100 },
      climaticRisk: { type: 'level', label: 'Risco Climático' },
      phenologicalRisk: { type: 'level', label: 'Risco Fenológico' },
      operationalRisk: { type: 'level', label: 'Risco Operacional' },
      trend: { type: 'trend', options: ['IMPROVING', 'STABLE', 'WORSENING'] }
    }),
    systemPrompt: `Você é um Analista de Risco Agrícola...`,
    userPromptTemplate: `Matriz de risco para talhão em {{city}}/{{state}}...`
  }
]
```

---

## Tarefas de Implementação

### Fase 1: Setup do Projeto (Dia 1)

#### 1.1 Inicialização
```bash
# Criar projeto Next.js
npx create-next-app@latest merx-agro-mvp --typescript --tailwind --eslint --app --src-dir=false

# Entrar no diretório
cd merx-agro-mvp

# Instalar dependências
npm install prisma @prisma/client zod zustand recharts leaflet react-leaflet lucide-react @google/genai

# Dependências de dev
npm install -D @types/leaflet prisma

# Inicializar Prisma com SQLite
npx prisma init --datasource-provider sqlite

# Instalar shadcn/ui
npx shadcn@latest init
npx shadcn@latest add button card badge table input tabs progress alert select
```

#### 1.2 Configurar ambiente
```env
# .env.local
DATABASE_URL="file:./prisma/dev.db"
GEMINI_API_KEY="sua-chave-aqui"
```

#### 1.3 Criar schema Prisma e rodar migrations
```bash
npx prisma db push
npx prisma generate
npx prisma db seed  # Seed dos templates
```

#### 1.4 Configurar seed script
```json
// package.json
{
  "prisma": {
    "seed": "npx tsx prisma/seed.ts"
  }
}
```

**Entregável:** Projeto rodando com `npm run dev`, banco criado, 3 templates seedados.

---

### Fase 2: Services do Backend (Dias 2-3)

#### 2.1 Geometry Service
**Arquivo:** `lib/services/geometry.service.ts`

**Funcionalidades:**
- Parsear KML e GeoJSON
- Validar geometria (mínimo 3 vértices, polígono fechado)
- Calcular área em hectares
- Calcular centroid
- Retornar erros e warnings

**Interface:**
```typescript
interface GeometryValidation {
  isValid: boolean
  type: 'Polygon' | 'MultiPolygon' | 'Unknown'
  vertexCount: number
  areaHa: number
  centroid: { lat: number; lng: number }
  geojson: object // GeoJSON normalizado
  errors: string[]
  warnings: string[]
}

function validateGeometry(fileContent: string, fileName: string): GeometryValidation
```

#### 2.2 Geocoding Service
**Arquivo:** `lib/services/geocoding.service.ts`

**Funcionalidades:**
- Geocodificação reversa via Nominatim
- Cache em memória (evitar rate limit)
- Fallback para coordenadas do MT

**Interface:**
```typescript
interface Location {
  city: string
  state: string
  lat: number
  lng: number
}

async function reverseGeocode(lat: number, lng: number): Promise<Location>
```

#### 2.3 Merx Service
**Arquivo:** `lib/services/merx.service.ts`

**Funcionalidades:**
- Consultas à API Merx (NDVI, precipitação, área, solo, histórico)
- Tratamento de erros tipado
- Retry com exponential backoff
- Timeout configurável
- Fallback via CORS proxy

**Interface:**
```typescript
interface MerxReport {
  ndvi: NdviPoint[]
  precipitacao: any[]
  area_ha: number
  solo: any
  historical_ndvi: NdviPoint[][]
}

async function getFullReport(geometry: object, startDate: string): Promise<MerxReport>
```

#### 2.4 Phenology Service
**Arquivo:** `lib/services/phenology.service.ts`

**Funcionalidades:**
- Detecção de SOS/EOS/Peak com limiares adaptativos por cultura
- Cálculo de correlação histórica
- Detecção de replantio
- Estimativa de produtividade baseada em NDVI máximo
- Sistema de diagnósticos (INFO/WARNING/ERROR)
- Score de confiança

**Interface:**
```typescript
interface PhenologyResult {
  plantingDate: string | null
  sosDate: string | null
  eosDate: string | null
  peakDate: string | null
  cycleDays: number
  
  detectedReplanting: boolean
  replantingDate: string | null
  yieldEstimateKg: number
  phenologyHealth: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'
  
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  confidenceScore: number
  method: 'ALGORITHM' | 'PROJECTION'
  
  diagnostics: Diagnostic[]
}

function calculate(
  ndviData: NdviPoint[],
  historicalData: NdviPoint[][],
  areaHa: number,
  config: { crop: string }
): PhenologyResult
```

#### 2.5 Sistema de Templates de IA
**Pasta:** `lib/templates/`

**Estrutura de cada template:**

```typescript
// lib/templates/types.ts
interface TemplateConfig {
  id: string
  name: string
  description: string
  icon: string
  color: string
  version: string
}

interface TemplatePrompt {
  systemInstruction: string
  buildUserPrompt: (context: AnalysisContext) => string
  responseSchema: z.ZodSchema
}

interface AnalysisContext {
  field: { name: string; city: string; state: string; crop: string }
  agroData: AgroData
  phenology: PhenologyResult
}
```

```typescript
// lib/templates/credit/config.ts
export const creditConfig: TemplateConfig = {
  id: 'CREDIT',
  name: 'Análise de Crédito',
  description: 'Risco para garantias agrícolas e CPRs',
  icon: 'Shield',
  color: 'emerald',
  version: '1.0.0'
}
```

```typescript
// lib/templates/credit/prompt.ts
export const creditPrompt: TemplatePrompt = {
  systemInstruction: `
    Você é um Analista de Risco de Crédito Agrícola Sênior.
    Seu foco é avaliar a SEGURANÇA DA GARANTIA e RISCO DE DEFAULT.
    ...
  `,
  buildUserPrompt: (ctx) => `
    Análise para talhão ${ctx.field.name} em ${ctx.field.city}/${ctx.field.state}.
    Área: ${ctx.agroData.areaHa} ha
    Fenologia: ${JSON.stringify(ctx.phenology)}
    ...
  `,
  responseSchema: creditResponseSchema
}
```

```typescript
// lib/templates/logistics/prompt.ts
export const logisticsPrompt: TemplatePrompt = {
  systemInstruction: `
    Você é um Especialista em Logística Agrícola e Originação.
    Seu foco é PLANEJAMENTO DE COLHEITA e OTIMIZAÇÃO DE TRANSPORTE.
    
    TAREFAS:
    1. Estimar janela de colheita com precisão de +/- 5 dias
    2. Calcular volume diário esperado baseado na área e ciclo
    3. Identificar período de pico de demanda logística
    4. Avaliar riscos climáticos que afetam a operação
    5. Prever impacto na qualidade do grão (colheita na chuva)
    
    MÉTRICAS LOGÍSTICAS:
    - Considerar capacidade média de colheitadeira: 50-80 ha/dia
    - Rendimento de transporte: 30-40 ton por carreta
    - Janela ideal de colheita: umidade grão 13-14%
    ...
  `,
  buildUserPrompt: (ctx) => `
    Planejamento logístico para talhão ${ctx.field.name}.
    Localização: ${ctx.field.city}/${ctx.field.state}
    Área: ${ctx.agroData.areaHa} ha
    Volume estimado: ${ctx.agroData.volumeEstimatedKg / 1000} ton
    Colheita prevista: ${ctx.phenology.eosDate}
    ...
  `,
  responseSchema: logisticsResponseSchema
}
```

```typescript
// lib/templates/risk-matrix/prompt.ts
export const riskMatrixPrompt: TemplatePrompt = {
  systemInstruction: `
    Você é um Analista de Risco Agrícola Consolidado.
    Seu objetivo é fornecer uma VISÃO 360° de todos os riscos do talhão.
    
    CATEGORIAS DE RISCO:
    1. CLIMÁTICO: Seca, excesso de chuva, granizo, geada
    2. FENOLÓGICO: Atraso, replantio, baixo vigor, doença
    3. OPERACIONAL: Logística, colheita, armazenagem
    4. COMERCIAL: Preço, washout, inadimplência
    
    SCORE GERAL: 0-100
    - 80-100: Excelente
    - 60-79: Bom
    - 40-59: Atenção
    - 20-39: Alerta
    - 0-19: Crítico
    ...
  `,
  responseSchema: riskMatrixResponseSchema
}
```

#### 2.6 AI Analysis Service (Base)
**Arquivo:** `lib/services/ai/base.service.ts`

**Funcionalidades:**
- Classe base para análise com IA
- Carrega template dinamicamente
- Retry com backoff
- Fallback para regras
- Salva resultado no banco

```typescript
class AIAnalysisService {
  constructor(private templateId: string) {}
  
  async analyze(
    fieldId: string,
    agroData: AgroData,
    phenology: PhenologyResult
  ): Promise<Analysis> {
    const template = await this.loadTemplate()
    const prompt = template.buildUserPrompt(context)
    
    try {
      const result = await this.callGemini(template.systemInstruction, prompt)
      return this.saveAnalysis(fieldId, template, result)
    } catch (error) {
      return this.fallbackAnalysis(fieldId, template, agroData)
    }
  }
}
```

**Entregável:** 
- 4 services base (Geometry, Geocoding, Merx, Phenology)
- Sistema de templates configurável
- 3 templates implementados (Credit, Logistics, RiskMatrix)

---

### Fase 3: API Routes (Dia 4)

#### 3.1 POST /api/upload
**Arquivo:** `app/api/upload/route.ts`

**Funcionalidade:**
- Recebe arquivo (multipart/form-data)
- Valida geometria
- Retorna validação e GeoJSON normalizado

#### 3.2 GET/POST /api/fields
**Arquivo:** `app/api/fields/route.ts`

**GET:** Lista todos os talhões com status de análises
**POST:** Cria novo talhão com geometria validada

#### 3.3 GET/DELETE /api/fields/[id]
**Arquivo:** `app/api/fields/[id]/route.ts`

**GET:** Retorna talhão com agroData e todas as análises
**DELETE:** Remove talhão e dados relacionados

#### 3.4 POST /api/fields/[id]/process
**Arquivo:** `app/api/fields/[id]/process/route.ts`

**Funcionalidade (Processamento de Dados Agro):**
- Busca dados do Merx (NDVI, precipitação, solo, histórico)
- Calcula fenologia
- Detecta replantio, estima produtividade
- Salva AgroData e pontos NDVI
- Atualiza status do talhão para SUCCESS

**Retorno:**
```typescript
{
  agroData: AgroData
  diagnostics: Diagnostic[]
}
```

#### 3.5 POST /api/fields/[id]/analyze/[templateId]
**Arquivo:** `app/api/fields/[id]/analyze/[templateId]/route.ts`

**Funcionalidade (Análise por Template):**
- Carrega template pelo ID (CREDIT, LOGISTICS, RISK_MATRIX)
- Busca agroData existente
- Executa prompt específico do template
- Salva Analysis vinculada ao template
- Retorna resultado formatado

**Retorno:**
```typescript
{
  analysis: Analysis
  template: { id, name, color, icon }
}
```

#### 3.6 GET /api/templates
**Arquivo:** `app/api/templates/route.ts`

**Funcionalidade:**
- Lista todos os templates disponíveis
- Inclui config e schema de métricas

**Retorno:**
```typescript
{
  templates: [
    { id: 'CREDIT', name: 'Análise de Crédito', icon: 'Shield', color: 'emerald' },
    { id: 'LOGISTICS', name: 'Análise Logística', icon: 'Truck', color: 'blue' },
    { id: 'RISK_MATRIX', name: 'Matriz de Risco', icon: 'AlertTriangle', color: 'amber' }
  ]
}
```

#### 3.7 Fluxo Completo de Processamento

```
1. Usuário cadastra talhão (POST /api/fields)
   └─> Field criado com status PENDING

2. Frontend chama processamento (POST /api/fields/:id/process)
   └─> Busca Merx, calcula fenologia
   └─> Salva AgroData
   └─> Status vira SUCCESS

3. Usuário seleciona template (POST /api/fields/:id/analyze/:templateId)
   └─> Executa IA com prompt do template
   └─> Salva Analysis
   └─> Pode repetir para outros templates

4. Usuário visualiza relatório (GET /api/fields/:id)
   └─> Retorna Field + AgroData + todas as Analysis
```

**Entregável:** APIs funcionais com suporte a múltiplos templates.

---

### Fase 4: Componentes UI (Dias 5-6)

#### 4.1 Layout
- `components/layout/header.tsx` - Header com logo e navegação
- `components/layout/page-container.tsx` - Container com padding

#### 4.2 Dashboard (Carteira)
- `components/fields/field-table.tsx` - Tabela de talhões
  - Colunas: Status, Nome, Localização, Área, Templates Analisados, Ações
  - Status com badge colorido
  - Badges de templates já executados
  - Ações: Ver relatório, Excluir
  - Loading state

#### 4.3 Cadastro de Talhão
- `components/fields/field-form.tsx` - Formulário completo
  - Input nome
  - Input data início safra
  - Tabs: Upload / Desenhar
  - Validação com Zod
  - Submit com loading

- `components/fields/field-uploader.tsx` - Upload de arquivo
  - Drag and drop
  - Preview do nome
  - Erros de validação

- `components/fields/field-drawer.tsx` - Desenho no mapa
  - Mapa Leaflet com tiles satélite
  - Click para adicionar pontos
  - Polygon preview
  - Undo/Clear/Confirm

#### 4.4 Dados Agronômicos (Base - sempre igual)
- `components/agro/metric-cards.tsx` - 4 cards de métricas base
  - Área, Volume, Correlação Histórica, Confiança do Modelo
  
- `components/agro/phenology-timeline.tsx` - 3 cards de datas
  - Plantio, Emergência, Colheita
  - Cores diferenciadas (azul, verde, âmbar)

- `components/agro/ndvi-chart.tsx` - Gráfico Recharts
  - Área da safra atual
  - Linhas do histórico (3 safras)
  - Linhas de referência (plantio, SOS, EOS)
  - Projeção de 60 dias

- `components/agro/agro-summary.tsx` - Wrapper dos dados agro
  - Todos os componentes acima organizados

#### 4.5 Sistema de Templates

- `components/templates/template-selector.tsx` - Seletor de template
  - Cards clicáveis para cada template disponível
  - Mostra ícone, nome, descrição
  - Badge se já foi executado
  - Loading state ao analisar

- `components/templates/template-badge.tsx` - Badge de status do template
  - Ícone do template
  - Cor baseada no status (NORMAL=verde, ALERTA=amarelo, CRÍTICO=vermelho)
  - Tooltip com resumo

#### 4.6 Template: Crédito

- `components/templates/credit/credit-panel.tsx` - Painel principal
  - Status badge grande (OPERAÇÃO: NORMAL/ALERTA/CRÍTICO)
  - Summary da IA em citação
  - Grid com métricas e riscos

- `components/templates/credit/credit-metrics.tsx` - Métricas específicas
  - Risco Washout
  - Saúde da Garantia
  - Probabilidade de Entrega
  - Aderência ao CPR

- `components/templates/credit/credit-risks.tsx` - Riscos e Recomendações
  - Lista de Riscos (vermelho)
  - Lista de Estratégias de Mitigação (verde)

#### 4.7 Template: Logística

- `components/templates/logistics/logistics-panel.tsx` - Painel principal
  - Janela de colheita destacada
  - Métricas de volume e pico

- `components/templates/logistics/harvest-timeline.tsx` - Timeline de colheita
  - Barra visual com período de colheita
  - Marcadores de início, pico, fim
  - Riscos climáticos no período

- `components/templates/logistics/volume-chart.tsx` - Gráfico de volume
  - Volume diário estimado
  - Pico de demanda
  - Capacidade necessária de transporte

#### 4.8 Template: Matriz de Risco

- `components/templates/risk-matrix/risk-panel.tsx` - Painel principal
  - Score geral grande (0-100)
  - Tendência (melhorando/estável/piorando)

- `components/templates/risk-matrix/risk-categories.tsx` - Categorias
  - Grid 2x2 com 4 categorias
  - Cada uma com nível (Baixo/Médio/Alto/Crítico)
  - Ícones e cores diferenciados

- `components/templates/risk-matrix/risk-score.tsx` - Score visual
  - Gauge ou progress circular
  - Cor baseada no score

#### 4.9 Relatório Completo

- `components/reports/full-report.tsx` - Wrapper
  - Header com botão voltar
  - Seção 1: Dados Agronômicos (agro-summary)
  - Seção 2: Seletor de Templates
  - Seção 3: Análise do Template Selecionado
  - Navegação entre templates já analisados

**Entregável:** Componentes visuais para dados agro + 3 templates.

---

### Fase 5: Páginas e Integração (Dia 7)

#### 5.1 Dashboard Page
**Arquivo:** `app/page.tsx`

- Fetch lista de talhões
- Renderiza FieldTable
- Botão "Novo Talhão"
- Estado vazio

#### 5.2 Cadastro Page
**Arquivo:** `app/fields/new/page.tsx`

- FieldForm com FieldUploader e FieldDrawer
- Submit chama POST /api/fields
- Redirect para dashboard após sucesso
- Opção de já iniciar análise

#### 5.3 Relatório Page
**Arquivo:** `app/reports/[id]/page.tsx`

- Fetch talhão e relatório
- Se sem relatório, mostra botão "Analisar"
- Se analisando, mostra progress
- Se pronto, renderiza FullReport

#### 5.4 Hooks de Integração
**Arquivo:** `hooks/use-fields.ts`
```typescript
function useFields() // Lista com SWR ou fetch
function useField(id: string) // Talhão específico
function useCreateField() // Mutation de criação
function useDeleteField() // Mutation de exclusão
```

**Arquivo:** `hooks/use-analysis.ts`
```typescript
function useAnalysis(fieldId: string) // Trigger e polling de status
```

**Entregável:** Aplicação funcionando end-to-end.

---

### Fase 6: Polish e Testes (Dia 8)

#### 6.1 Loading States
- Skeleton no dashboard
- Progress na análise com etapas
- Disabled states nos botões

#### 6.2 Error Handling
- Toast para erros
- Retry em falhas
- Mensagens amigáveis

#### 6.3 Responsividade
- Mobile-friendly
- Gráfico responsivo

#### 6.4 Testes Manuais
- [ ] Upload de KML válido
- [ ] Upload de GeoJSON válido
- [ ] Upload de arquivo inválido (erro esperado)
- [ ] Desenho de polígono no mapa
- [ ] Polígono com menos de 3 pontos (erro esperado)
- [ ] Análise completa de talhão
- [ ] Visualização de relatório
- [ ] Exclusão de talhão
- [ ] Persistência após reload

**Entregável:** MVP completo e testado.

---

## Cronograma Resumido

| Dia | Fase | Entregável |
|-----|------|------------|
| 1 | Setup | Projeto configurado, banco criado, templates seedados |
| 2-3 | Services | 4 services base + sistema de templates + 3 templates IA |
| 4 | APIs | 6 endpoints com suporte a múltiplos templates |
| 5-6 | UI | Componentes agro + componentes de 3 templates |
| 7 | Integração | App funcionando E2E com fluxo de templates |
| 8 | Polish | MVP testado, todos templates funcionais |

**Total: 8 dias de desenvolvimento**

---

## Comandos Úteis

```bash
# Desenvolvimento
npm run dev

# Prisma Studio (visualizar banco)
npx prisma studio

# Resetar banco
npx prisma db push --force-reset

# Gerar cliente após mudança no schema
npx prisma generate

# Build de produção (local)
npm run build && npm start
```

---

## Checklist de Validação do MVP

### Funcionalidades Core
- [ ] Listar talhões no dashboard
- [ ] Cadastrar talhão via upload
- [ ] Cadastrar talhão via desenho
- [ ] Validar geometria com feedback
- [ ] Processar dados agronômicos (Merx + Fenologia)
- [ ] Mostrar progresso do processamento
- [ ] Exibir dados agro (métricas, timeline, gráfico NDVI)
- [ ] Selecionar template de análise
- [ ] Executar análise por template
- [ ] Exibir resultado do template selecionado
- [ ] Navegar entre templates analisados
- [ ] Excluir talhão
- [ ] Dados persistem após reload

### Templates
- [ ] Template Crédito funcionando
- [ ] Template Logística funcionando
- [ ] Template Matriz de Risco funcionando
- [ ] Cada template com visualização específica
- [ ] Fallback para regras em cada template

### Qualidade
- [ ] Tratamento de erros em todos os endpoints
- [ ] Loading states em todas as ações
- [ ] Mensagens de erro amigáveis
- [ ] Validação de formulários
- [ ] Responsivo em telas menores

### Robustez (vs versão atual)
- [ ] Geometria validada antes de salvar
- [ ] Área calculada localmente como fallback
- [ ] Fenologia com limiares adaptativos
- [ ] Detecção de replantio
- [ ] Estimativa de produtividade por NDVI
- [ ] IA com fallback para regras
- [ ] Retry automático em falhas de rede
- [ ] Dados históricos persistidos
- [ ] Separação clara: dados agro vs análises

### Extensibilidade
- [ ] Adicionar novo template é simples (criar pasta + config + prompt)
- [ ] Templates versionados
- [ ] Schema de resposta validado com Zod

---

## Como Adicionar Novos Templates (Futuro)

Para adicionar um novo template (ex: "Análise ESG" ou "Precificação"):

```
1. Criar pasta: lib/templates/esg/
   ├── config.ts    # id, name, icon, color
   ├── prompt.ts    # systemInstruction, buildUserPrompt
   └── schema.ts    # Zod schema da resposta

2. Registrar no index: lib/templates/index.ts
   export { esgConfig, esgPrompt } from './esg'

3. Adicionar seed: prisma/seed.ts
   templates.push({ id: 'ESG', name: 'Análise ESG', ... })

4. Criar componentes: components/templates/esg/
   ├── esg-panel.tsx
   ├── esg-metrics.tsx
   └── esg-score.tsx

5. Rodar seed e reiniciar:
   npx prisma db seed
```

O sistema carrega templates dinamicamente, então novos templates ficam disponíveis automaticamente na UI.

---

## Próximo Passo

Quando estiver pronto para começar, podemos:

1. **Criar o projeto** - Inicializar Next.js e configurar toda a estrutura
2. **Implementar por fase** - Seguir o cronograma dia a dia
3. **Focar no core primeiro** - Dados agro + 1 template (Crédito) como POC, depois expandir

Recomendo a **opção 3**: fazer o core + template de Crédito funcionar completamente, validar a arquitetura, e então adicionar Logística e Matriz de Risco.

Quer que eu inicie a implementação?
