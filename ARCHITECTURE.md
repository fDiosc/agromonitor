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
│  │  │ Dashboard │  │  Reports  │  │ Logistics │  │  Fields   │        │   │
│  │  │   Page    │  │   Page    │  │   Page    │  │  New Page │        │   │
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────┘        │   │
│  │         │              │              │              │               │   │
│  │         └──────────────┴──────────────┴──────────────┘               │   │
│  │                                 │                                     │   │
│  │                    React Query / fetch()                              │   │
│  └─────────────────────────────────┼─────────────────────────────────────┘   │
└────────────────────────────────────┼─────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SERVIDOR (Next.js API Routes)                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                            Route Handlers                            │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐   │   │
│  │  │ /api/fields │  │/api/fields/ │  │/api/logistics│  │/api/admin│   │   │
│  │  │   GET/POST  │  │ [id]/process│  │ /diagnostic  │  │/fix-status│  │   │
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
│  │  │   cycle     │  │  geometry   │  │  geocoding  │              │   │
│  │  │  analysis   │  │   service   │  │   service   │              │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘              │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                │                    │                    │
                ▼                    ▼                    ▼
┌──────────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│     PostgreSQL       │  │    Merx API      │  │   Gemini AI      │
│   (Neon Cloud)       │  │   (Satellite)    │  │   (Analysis)     │
│                      │  │                  │  │                  │
│  ┌────────────────┐  │  │  - NDVI          │  │  - Template      │
│  │     Field      │  │  │  - Precipitação  │  │    prompts       │
│  ├────────────────┤  │  │  - Solo          │  │  - Risk          │
│  │    AgroData    │  │  │  - Histórico     │  │    analysis      │
│  ├────────────────┤  │  │  - Área lavoura  │  │                  │
│  │    Analysis    │  │  │                  │  │                  │
│  ├────────────────┤  │  └──────────────────┘  └──────────────────┘
│  │ NdviDataPoint  │  │
│  └────────────────┘  │
└──────────────────────┘
```

---

## Camadas do Sistema

### 1. Frontend (Presentation Layer)

**Tecnologias:** React 18, Next.js 14 App Router, TailwindCSS, Shadcn/ui

**Responsabilidades:**
- Renderização de páginas
- Gerenciamento de estado local
- Interação com usuário
- Validação de formulários

**Componentes Principais:**
```
components/
├── fields/
│   └── field-table.tsx      # Tabela de talhões
├── layout/
│   └── header.tsx           # Header com navegação
├── map/
│   └── MapDrawer.tsx        # Desenho de polígonos
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
- Autenticação (futuro)
- Orquestração de serviços
- Formatação de responses

**Padrão de Rotas:**
```
app/api/
├── fields/
│   ├── route.ts                    # GET (list), POST (create)
│   └── [id]/
│       ├── route.ts                # GET, DELETE
│       ├── process/route.ts        # POST (process)
│       └── analyze/[templateId]/route.ts
├── logistics/
│   └── diagnostic/route.ts         # GET (aggregated data)
└── admin/
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
| Phenology | `phenology.service.ts` | Detecção de fenologia |
| Cycle Analysis | `cycle-analysis.service.ts` | Análise de ciclo e histórico |
| Correlation | `correlation.service.ts` | Correlação histórica robusta |
| Geometry | `geometry.service.ts` | Validação e cálculo de geometrias |
| Geocoding | `geocoding.service.ts` | Geocodificação reversa |
| AI | `ai.service.ts` | Integração com Gemini |

### 4. Data Layer (Persistence)

**Tecnologias:** Prisma ORM, PostgreSQL (Neon)

**Modelos:**

```prisma
model Field {
  id              String    @id
  name            String
  status          String    // PENDING | PROCESSING | SUCCESS | PARTIAL | ERROR
  errorMessage    String?
  geometryJson    String
  areaHa          Float?
  // ... location fields
  agroData        AgroData?
  analyses        Analysis[]
  ndviData        NdviDataPoint[]
}

model AgroData {
  id                    String
  plantingDate          DateTime?
  sosDate               DateTime?
  eosDate               DateTime?
  peakDate              DateTime?
  volumeEstimatedKg     Float?
  confidenceScore       Int?
  // ... raw data fields
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

### Fluxo de Diagnóstico Logístico

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
                    │  - fields (schedule)                │
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

Modelo: `gemini-pro`

Uso: Geração de análises textuais baseadas em templates.

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

### Atual (MVP)
- Chaves de API em variáveis de ambiente
- Validação de input com Zod
- Sanitização de geometrias

### Futuro
- Autenticação com NextAuth.js
- RBAC (Role-Based Access Control)
- Rate limiting
- Audit logs

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
