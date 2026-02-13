# MERX AGRO Monitor - Análise de Melhorias e Arquitetura

## Sumário Executivo

Este documento apresenta uma análise detalhada das melhorias necessárias para transformar o protótipo atual em um produto robusto e escalável, incluindo decisões arquiteturais, stack tecnológica recomendada e roadmap de implementação.

---

## 1. Análise do Estado Atual

### Pontos Fortes
- Interface moderna e bem projetada
- Integração funcional com API Merx
- Análise de IA com Gemini bem estruturada
- Algoritmos de fenologia funcionais
- UX intuitiva para desenho de talhões

### Limitações Críticas

| Categoria | Problema | Severidade |
|-----------|----------|------------|
| **Persistência** | Dados em memória (useState) | CRÍTICA |
| **Autenticação** | Inexistente | CRÍTICA |
| **Multi-tenancy** | Não suportado | ALTA |
| **API Key** | Exposta no frontend | CRÍTICA |
| **Escalabilidade** | SPA monolítica | MÉDIA |
| **Offline** | Não funciona | MÉDIA |
| **Testes** | Inexistentes | ALTA |

---

## 2. Decisão de Stack: Python Backend vs Next.js Full-Stack

### Opção A: Next.js Full-Stack (RECOMENDADA)

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│                    Next.js 14+ (App Router)                      │
│         React 19 + TypeScript + TailwindCSS + Shadcn/ui         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API ROUTES (Backend)                        │
│                   Next.js Route Handlers                         │
│              /api/auth, /api/fields, /api/reports                │
└─────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
        ┌───────────────────┐   ┌───────────────────────┐
        │    PostgreSQL     │   │   Serviços Externos   │
        │    (via Prisma)   │   │  Merx API, Gemini AI  │
        └───────────────────┘   └───────────────────────┘
```

#### Vantagens:
- **Velocidade de desenvolvimento:** Stack unificada, menos contexto switching
- **Deploy simplificado:** Uma única aplicação na Vercel/Railway
- **Type safety end-to-end:** TypeScript em todo o stack
- **SEO Ready:** SSR/SSG nativos se necessário
- **Menor custo operacional:** Menos infraestrutura para gerenciar
- **Ecosystem React:** Reutiliza componentes existentes
- **Edge Functions:** Processamento próximo ao usuário
- **Comunidade ativa:** Documentação e suporte abundantes

#### Desvantagens:
- Processamento pesado de dados pode travar event loop
- Menos flexibilidade para tarefas assíncronas complexas

---

### Opção B: Python Backend + React Frontend (Separados)

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│               React + Vite + TypeScript                          │
│                  (Deploy: Vercel/Netlify)                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                          BACKEND                                 │
│                   FastAPI (Python 3.11+)                         │
│                   (Deploy: Railway/Render)                       │
└─────────────────────────────────────────────────────────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   PostgreSQL    │   │     Redis       │   │     Celery      │
│                 │   │   (Cache/Queue) │   │  (Background)   │
└─────────────────┘   └─────────────────┘   └─────────────────┘
```

#### Vantagens:
- **Processamento pesado:** Python excelente para dados/ML
- **Bibliotecas geoespaciais:** GeoPandas, Shapely, Rasterio
- **Tarefas assíncronas:** Celery para jobs longos
- **Escalabilidade independente:** Backend e frontend escalam separadamente
- **Time especializado:** Se equipe tem Python skills

#### Desvantagens:
- **Dois deploys:** Maior complexidade operacional
- **CORS:** Configuração adicional
- **Custos maiores:** Mais infraestrutura
- **Latência:** Chamadas entre serviços

---

### Recomendação Final: **Next.js Full-Stack**

**Justificativa:**

1. **Produto atual é simples:** Não há processamento pesado que justifique Python
2. **Dados vêm prontos:** API Merx já processa os dados de satélite
3. **IA via API:** Gemini é chamado via REST, não precisa de Python
4. **Time to market:** Next.js acelera entregas
5. **Custo:** Menor infraestrutura, menor custo
6. **Evolução futura:** Se surgir necessidade de ML pesado, pode-se adicionar microserviço Python específico

---

## 3. Stack Tecnológica Recomendada

### Core

| Camada | Tecnologia | Justificativa |
|--------|------------|---------------|
| **Framework** | Next.js 14+ (App Router) | Full-stack, SSR, API Routes |
| **Linguagem** | TypeScript 5+ | Type safety, DX |
| **Runtime** | Node.js 20 LTS | Estabilidade, performance |
| **Estilização** | TailwindCSS 3+ | Já usado, produtivo |
| **Componentes** | shadcn/ui | Acessibilidade, customização |

### Backend/API

| Camada | Tecnologia | Justificativa |
|--------|------------|---------------|
| **ORM** | Prisma | Type-safe, migrations, studio |
| **Validação** | Zod | Schema validation, type inference |
| **Autenticação** | NextAuth.js v5 | Flexível, providers múltiplos |
| **Rate Limiting** | Upstash Ratelimit | Edge-compatible |

### Banco de Dados

| Tipo | Tecnologia | Uso |
|------|------------|-----|
| **Principal** | PostgreSQL (Neon/Supabase) | Dados estruturados |
| **Cache** | Upstash Redis | Sessões, rate limit, cache |
| **Files** | S3/R2 (Cloudflare) | Arquivos KML/GeoJSON |

### Infraestrutura

| Camada | Tecnologia | Justificativa |
|--------|------------|---------------|
| **Deploy** | Vercel | Zero-config, edge |
| **Database** | Neon PostgreSQL | Serverless, branching |
| **Cache** | Upstash Redis | Serverless Redis |
| **Storage** | Cloudflare R2 | S3-compatible, barato |
| **Monitoring** | Sentry + Vercel Analytics | Erros e métricas |

### Ferramentas de Desenvolvimento

| Ferramenta | Uso |
|------------|-----|
| **ESLint + Prettier** | Linting e formatação |
| **Husky + lint-staged** | Pre-commit hooks |
| **Jest + Testing Library** | Testes unitários e integração |
| **Playwright** | Testes E2E |
| **GitHub Actions** | CI/CD |

---

## 4. Modelo de Dados (PostgreSQL + Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ==================== AUTENTICAÇÃO ====================

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  image         String?
  role          UserRole  @default(ANALYST)
  organizationId String?
  organization  Organization? @relation(fields: [organizationId], references: [id])
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  fields        Field[]
  reports       Report[]
  sessions      Session[]
  accounts      Account[]
}

model Organization {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  plan        Plan     @default(STARTER)
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  users       User[]
  fields      Field[]
  apiKeys     ApiKey[]
}

enum UserRole {
  ADMIN
  MANAGER
  ANALYST
  VIEWER
}

enum Plan {
  STARTER    // 10 talhões
  BUSINESS   // 100 talhões
  ENTERPRISE // Ilimitado
}

// ==================== CORE BUSINESS ====================

model Field {
  id              String      @id @default(cuid())
  name            String
  description     String?
  crop            Crop        @default(SOJA)
  seasonStartDate DateTime
  status          FieldStatus @default(ACTIVE)
  
  // Localização
  city            String?
  state           String?
  latitude        Float?
  longitude       Float?
  areaHa          Float?
  
  // Geometria (GeoJSON armazenado)
  geometryUrl     String?     // URL do arquivo no S3/R2
  geometryHash    String?     // Hash para detectar mudanças
  
  // Relações
  userId          String
  user            User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  organizationId  String?
  organization    Organization? @relation(fields: [organizationId], references: [id])
  
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  
  reports         Report[]
  alerts          Alert[]
  ndviData        NdviDataPoint[]
  
  @@index([userId])
  @@index([organizationId])
  @@index([status])
}

model Report {
  id              String       @id @default(cuid())
  type            ReportType   @default(FULL)
  status          ReportStatus @default(PENDING)
  
  // Dados do Relatório
  ndviCurrent     Float?
  volumeEstimatedKg Float?
  areaHa          Float?
  
  // Fenologia
  plantingDate    DateTime?
  sosDate         DateTime?
  eosDate         DateTime?
  peakDate        DateTime?
  cycleDays       Int?
  phenologyMethod String?      // ALGORITHM | PROJECTION
  confidenceScore Int?         // 0-100
  historicalCorrelation Float? // 0-100
  
  // Análise de IA
  aiStatus        String?      // NORMAL | ALERTA | CRITICO
  aiSummary       String?
  aiRisks         Json?        // String[]
  aiRecommendations Json?      // String[]
  aiRawResponse   Json?        // Full Gemini response
  
  // Dados brutos (para debug/audit)
  rawMerxData     Json?
  
  // Relações
  fieldId         String
  field           Field        @relation(fields: [fieldId], references: [id], onDelete: Cascade)
  userId          String
  user            User         @relation(fields: [userId], references: [id])
  
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  processedAt     DateTime?
  
  @@index([fieldId])
  @@index([userId])
  @@index([createdAt])
}

model NdviDataPoint {
  id          String   @id @default(cuid())
  date        DateTime
  ndviRaw     Float?
  ndviSmooth  Float?
  ndviInterp  Float?
  cloudCover  Float?
  isHistorical Boolean @default(false)
  seasonYear  Int?     // Ano da safra (ex: 2024)
  
  fieldId     String
  field       Field    @relation(fields: [fieldId], references: [id], onDelete: Cascade)
  
  @@unique([fieldId, date, seasonYear])
  @@index([fieldId, date])
}

model Alert {
  id          String      @id @default(cuid())
  type        AlertType
  severity    AlertSeverity
  title       String
  message     String
  isRead      Boolean     @default(false)
  isDismissed Boolean     @default(false)
  
  fieldId     String
  field       Field       @relation(fields: [fieldId], references: [id], onDelete: Cascade)
  
  createdAt   DateTime    @default(now())
  expiresAt   DateTime?
  
  @@index([fieldId, isRead])
}

// ==================== ENUMS ====================

enum Crop {
  SOJA
  MILHO
  ALGODAO
  CAFE
  CANA
  TRIGO
}

enum FieldStatus {
  ACTIVE
  ARCHIVED
  PENDING
}

enum ReportType {
  FULL
  QUICK
  HISTORICAL
}

enum ReportStatus {
  PENDING
  PROCESSING
  SUCCESS
  FAILED
}

enum AlertType {
  NDVI_DROP
  PHENOLOGY_DELAY
  WEATHER_RISK
  HARVEST_APPROACHING
  ANOMALY_DETECTED
}

enum AlertSeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

// ==================== AUTH (NextAuth) ====================

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model ApiKey {
  id             String       @id @default(cuid())
  name           String
  keyHash        String       @unique
  lastUsedAt     DateTime?
  expiresAt      DateTime?
  
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  createdAt      DateTime     @default(now())
}
```

---

## 5. Arquitetura de Pastas (Next.js App Router)

```
merx-agro-monitor/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   │
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   │   └── page.tsx          # Carteira de Monitoramento
│   │   ├── fields/
│   │   │   ├── page.tsx          # Lista de Talhões
│   │   │   ├── new/
│   │   │   │   └── page.tsx      # Cadastrar Talhão
│   │   │   └── [id]/
│   │   │       ├── page.tsx      # Relatório do Talhão
│   │   │       └── settings/
│   │   │           └── page.tsx  # Configurações do Talhão
│   │   ├── reports/
│   │   │   └── page.tsx          # Histórico de Relatórios
│   │   ├── alerts/
│   │   │   └── page.tsx          # Central de Alertas
│   │   ├── settings/
│   │   │   └── page.tsx          # Configurações do Usuário
│   │   └── layout.tsx            # Layout com Sidebar
│   │
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   │       └── route.ts
│   │   ├── fields/
│   │   │   ├── route.ts          # GET (list), POST (create)
│   │   │   └── [id]/
│   │   │       ├── route.ts      # GET, PUT, DELETE
│   │   │       ├── analyze/
│   │   │       │   └── route.ts  # POST - Trigger análise
│   │   │       └── report/
│   │   │           └── route.ts  # GET - Último relatório
│   │   ├── reports/
│   │   │   └── route.ts
│   │   ├── upload/
│   │   │   └── route.ts          # Upload de KML/GeoJSON
│   │   └── webhooks/
│   │       └── route.ts          # Webhooks externos
│   │
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                  # Landing page
│
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── forms/
│   │   ├── field-form.tsx
│   │   └── login-form.tsx
│   ├── charts/
│   │   ├── ndvi-chart.tsx
│   │   └── comparison-chart.tsx
│   ├── maps/
│   │   ├── field-drawer.tsx
│   │   └── field-preview.tsx
│   ├── reports/
│   │   ├── metric-card.tsx
│   │   ├── phenology-timeline.tsx
│   │   ├── risk-panel.tsx
│   │   └── full-report.tsx
│   └── layout/
│       ├── sidebar.tsx
│       ├── header.tsx
│       └── mobile-nav.tsx
│
├── lib/
│   ├── prisma.ts                 # Prisma client singleton
│   ├── auth.ts                   # NextAuth config
│   ├── validations/
│   │   ├── field.ts              # Zod schemas
│   │   └── report.ts
│   ├── services/
│   │   ├── merx.service.ts       # API Merx integration
│   │   ├── gemini.service.ts     # AI analysis
│   │   ├── geocoding.service.ts  # Location detection
│   │   └── phenology.service.ts  # Phenology calculations
│   └── utils/
│       ├── geo.ts                # Geometry helpers
│       ├── dates.ts              # Date formatting
│       └── formatters.ts         # Number formatters
│
├── hooks/
│   ├── use-fields.ts             # React Query hooks
│   ├── use-reports.ts
│   └── use-map.ts
│
├── types/
│   ├── field.ts
│   ├── report.ts
│   └── api.ts
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
├── public/
│   └── ...
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── .env.local
├── .env.example
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 6. Funcionalidades a Implementar

### Fase 1: Fundação (MVP Robusto)

| Feature | Prioridade | Esforço |
|---------|------------|---------|
| Setup Next.js + Prisma + Postgres | CRÍTICA | 1 dia |
| Autenticação (NextAuth + Magic Link) | CRÍTICA | 1 dia |
| CRUD de Talhões com persistência | CRÍTICA | 2 dias |
| Upload de arquivos para S3/R2 | CRÍTICA | 1 dia |
| Migração dos serviços existentes | CRÍTICA | 1 dia |
| Relatórios salvos no banco | CRÍTICA | 1 dia |
| UI básica com shadcn/ui | ALTA | 2 dias |

**Total Fase 1: ~9 dias**

### Fase 2: Experiência do Usuário

| Feature | Prioridade | Esforço |
|---------|------------|---------|
| Dashboard com métricas agregadas | ALTA | 2 dias |
| Sistema de Alertas | ALTA | 2 dias |
| Notificações (Email/Push) | MÉDIA | 2 dias |
| Exportação PDF/Excel | MÉDIA | 1 dia |
| Histórico de análises por talhão | MÉDIA | 1 dia |
| Modo escuro | BAIXA | 0.5 dia |
| PWA + Offline básico | BAIXA | 1 dia |

**Total Fase 2: ~9.5 dias**

### Fase 3: Escala e Negócio

| Feature | Prioridade | Esforço |
|---------|------------|---------|
| Multi-tenancy (Organizações) | ALTA | 3 dias |
| Planos e limites (STARTER/BUSINESS/ENTERPRISE) | ALTA | 2 dias |
| Billing (Stripe) | MÉDIA | 2 dias |
| API pública + API Keys | MÉDIA | 2 dias |
| Webhooks para integrações | MÉDIA | 1 dia |
| Audit Log | BAIXA | 1 dia |
| White-label | BAIXA | 2 dias |

**Total Fase 3: ~13 dias**

### Fase 4: Inteligência Avançada

| Feature | Prioridade | Esforço |
|---------|------------|---------|
| Suporte a múltiplas culturas | ALTA | 2 dias |
| Alertas preditivos (ML simples) | MÉDIA | 3 dias |
| Comparação entre safras | MÉDIA | 1 dia |
| Benchmark regional | BAIXA | 2 dias |
| Integração com dados climáticos | BAIXA | 2 dias |

**Total Fase 4: ~10 dias**

---

## 7. Melhorias de Performance

### Caching Strategy

```typescript
// lib/cache.ts
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

export const cache = {
  // Cache de geocodificação (1 semana)
  async getLocation(lat: number, lng: number) {
    const key = `geo:${lat.toFixed(4)}:${lng.toFixed(4)}`
    const cached = await redis.get(key)
    if (cached) return cached
    
    const location = await fetchFromNominatim(lat, lng)
    await redis.setex(key, 604800, location) // 7 dias
    return location
  },
  
  // Cache de relatório (1 hora)
  async getReport(fieldId: string) {
    const key = `report:${fieldId}`
    return redis.get(key)
  },
  
  async setReport(fieldId: string, data: any) {
    await redis.setex(`report:${fieldId}`, 3600, data)
  }
}
```

### Otimizações de Banco

```sql
-- Índices para queries frequentes
CREATE INDEX idx_fields_user_status ON "Field"("userId", "status");
CREATE INDEX idx_reports_field_created ON "Report"("fieldId", "createdAt" DESC);
CREATE INDEX idx_ndvi_field_date ON "NdviDataPoint"("fieldId", "date");

-- Particionamento de NdviDataPoint por ano (se volume alto)
-- Considerar TimescaleDB para séries temporais
```

### Background Jobs

```typescript
// Para análises que demoram, usar Vercel Functions com timeout maior
// ou implementar queue com Upstash QStash

import { Client } from '@upstash/qstash'

const qstash = new Client({ token: process.env.QSTASH_TOKEN })

export async function queueAnalysis(fieldId: string) {
  await qstash.publishJSON({
    url: `${process.env.APP_URL}/api/jobs/analyze`,
    body: { fieldId },
    retries: 3
  })
}
```

---

## 8. Segurança

### Checklist de Segurança

- [ ] API Keys do Gemini e Merx no backend apenas (env vars)
- [ ] Validação de entrada com Zod em todas as rotas
- [ ] Rate limiting por IP e por usuário
- [ ] CORS configurado corretamente
- [ ] Headers de segurança (CSP, HSTS, etc)
- [ ] Sanitização de uploads (validar KML/GeoJSON)
- [ ] Audit log de ações sensíveis
- [ ] Criptografia de dados sensíveis em repouso
- [ ] Autenticação em todas as rotas de API
- [ ] Verificação de ownership em operações

### Exemplo de Middleware de Auth

```typescript
// middleware.ts
import { withAuth } from 'next-auth/middleware'

export default withAuth({
  callbacks: {
    authorized: ({ token, req }) => {
      // Rotas públicas
      if (req.nextUrl.pathname.startsWith('/api/public')) return true
      
      // Rotas autenticadas
      return !!token
    }
  }
})

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*']
}
```

---

## 9. Estimativa de Custos (Mensal)

### Cenário: 100 usuários, 1000 talhões

| Serviço | Tier | Custo |
|---------|------|-------|
| Vercel Pro | Pro | $20 |
| Neon PostgreSQL | Launch | $19 |
| Upstash Redis | Pay-as-you-go | ~$5 |
| Cloudflare R2 | Pay-as-you-go | ~$5 |
| Sentry | Team | $26 |
| Gemini API | Pay-per-use | ~$50 |
| **Total** | | **~$125/mês** |

### Cenário: 1000 usuários, 10000 talhões

| Serviço | Tier | Custo |
|---------|------|-------|
| Vercel Pro | Pro | $20 |
| Neon PostgreSQL | Scale | $69 |
| Upstash Redis | Pro | $50 |
| Cloudflare R2 | Pay-as-you-go | ~$20 |
| Sentry | Team | $26 |
| Gemini API | Pay-per-use | ~$300 |
| **Total** | | **~$485/mês** |

---

## 10. Próximos Passos Recomendados

### Imediato (Semana 1)
1. Criar projeto Next.js com App Router
2. Configurar Prisma + PostgreSQL (Neon)
3. Implementar autenticação com NextAuth
4. Migrar componentes existentes

### Curto Prazo (Semanas 2-3)
5. Implementar CRUD de talhões
6. Configurar upload de arquivos (R2)
7. Migrar serviços Merx e Gemini
8. Implementar sistema de relatórios

### Médio Prazo (Semanas 4-6)
9. Dashboard com métricas
10. Sistema de alertas
11. Exportação de relatórios
12. Testes automatizados

### Longo Prazo (Mês 2+)
13. Multi-tenancy
14. Billing
15. API pública
16. Features avançadas de IA
