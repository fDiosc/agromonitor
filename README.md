# MERX AGRO Monitor - MVP

Sistema de monitoramento agronômico para análise de risco logístico e previsão de colheita.

## Visão Geral

O **MERX AGRO Monitor** é uma plataforma que transforma dados de satélite e clima em insights acionáveis para planejamento logístico e análise de risco agrícola.

### Principais Funcionalidades

- **Monitoramento de Talhões** - Cadastro e acompanhamento de áreas agrícolas
- **Detecção de Fenologia** - Identificação automática de plantio, emergência e colheita
- **Curvas NDVI** - Visualização histórica e projeções com correlação
- **Diagnóstico Logístico** - Visão consolidada para planejamento de recebimento
- **Templates de Análise** - Crédito, Logística, Matriz de Risco

---

## Quick Start

### Pré-requisitos

- Node.js 18+
- PostgreSQL (ou Neon para cloud)

### Instalação

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env.local
# Editar .env.local com suas credenciais

# Gerar cliente Prisma
npx prisma generate

# Aplicar migrations
npx prisma db push

# Iniciar servidor de desenvolvimento
npm run dev
```

### Variáveis de Ambiente

```env
DATABASE_URL="postgresql://..."
MERX_API_KEY="sua-chave-merx"
GEMINI_API_KEY="sua-chave-gemini"
```

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│                    Next.js 14 (App Router)                       │
│         React + TypeScript + TailwindCSS + Shadcn/ui            │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API ROUTES (Backend)                        │
│                   Next.js Route Handlers                         │
│       /api/fields, /api/logistics, /api/templates               │
└─────────────────────────────────────────────────────────────────┘
                               │
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
        ┌───────────┐   ┌───────────┐   ┌───────────┐
        │  Prisma   │   │ Merx API  │   │ Gemini AI │
        │ PostgreSQL│   │ Satellite │   │ Analysis  │
        └───────────┘   └───────────┘   └───────────┘
```

### Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| Frontend | Next.js 14, React 18, TypeScript |
| Styling | TailwindCSS, Shadcn/ui |
| Charts | Recharts |
| Maps | Leaflet, React-Leaflet |
| ORM | Prisma |
| Database | PostgreSQL (Neon) |
| AI | Google Gemini |
| APIs | Merx API (satellite/climate data) |

---

## Estrutura do Projeto

```
merx-agro-mvp/
├── app/                        # Next.js App Router
│   ├── api/                    # API Routes
│   │   ├── fields/             # CRUD de talhões
│   │   ├── logistics/          # Diagnóstico logístico
│   │   ├── templates/          # Templates de análise
│   │   └── admin/              # Endpoints administrativos
│   ├── dashboard/              # Páginas do dashboard
│   │   └── logistics/          # Módulo de diagnóstico logístico
│   ├── fields/                 # Páginas de talhões
│   └── reports/                # Relatórios detalhados
├── components/                 # Componentes React
│   ├── fields/                 # Componentes de talhões
│   ├── layout/                 # Header, Footer, etc
│   ├── map/                    # Componentes de mapa
│   └── ui/                     # Shadcn/ui components
├── lib/                        # Utilitários e serviços
│   ├── services/               # Serviços de negócio
│   │   ├── merx.service.ts     # Integração Merx API
│   │   ├── phenology.service.ts# Cálculos fenológicos
│   │   ├── cycle-analysis.service.ts # Análise de ciclo
│   │   └── correlation.service.ts    # Correlação histórica
│   └── utils/                  # Funções utilitárias
├── prisma/                     # Schema e migrations
└── docs/                       # Documentação adicional
```

---

## Documentação

| Documento | Descrição | Status |
|-----------|-----------|--------|
| [README.md](./README.md) | Este documento - visão geral | ✅ Atualizado |
| [CHANGELOG.md](./CHANGELOG.md) | Histórico de mudanças | ✅ Atualizado |
| [METHODOLOGY.md](./METHODOLOGY.md) | Metodologias técnicas | ✅ Atualizado |
| [DIAGNOSTICOLOG.md](./DIAGNOSTICOLOG.md) | Especificação módulo logístico | ✅ Atualizado |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Arquitetura detalhada | ✅ Novo |

### Documentos Legados (raiz do projeto)

| Documento | Descrição | Status |
|-----------|-----------|--------|
| [../produto.md](../produto.md) | Visão original do produto | 📦 Legado |
| [../melhorias.md](../melhorias.md) | Análise de melhorias | 📦 Legado |
| [../IMPLEMENTACAO.md](../IMPLEMENTACAO.md) | Plano de implementação | 📦 Legado |
| [../logic.md](../logic.md) | Melhorias de lógica | 📦 Legado |

---

## Módulos Principais

### 1. Monitoramento de Talhões

Cadastro e processamento de áreas agrícolas:
- Upload de geometria (KML/GeoJSON) ou desenho no mapa
- Geocodificação automática
- Busca de dados via Merx API
- Detecção de fenologia (SOS, EOS, Peak)

### 2. Relatórios Detalhados

Visualização completa por talhão:
- Gráfico NDVI com curvas históricas
- Linhas de referência (plantio, emergência, colheita)
- Projeção baseada em correlação
- Cards de métricas e alertas

### 3. Diagnóstico Logístico

Visão consolidada para planejamento:
- Métricas agregadas (área, volume, carretas)
- Curva de recebimento (bell curve)
- Cronograma por talhão
- Mapa de propriedades
- Indicadores críticos

### 4. Templates de Análise

Sistema extensível de análises:
- **Crédito**: Avaliação de garantias e CPRs
- **Logística**: Previsão de colheita e transporte
- **Matriz de Risco**: Visão consolidada de riscos

---

## Estados de Processamento

| Status | Descrição | Badge |
|--------|-----------|-------|
| `PENDING` | Aguardando processamento | 🔵 Cinza |
| `PROCESSING` | Em processamento | 🟡 Animado |
| `SUCCESS` | Processado com sucesso | 🟢 Verde |
| `PARTIAL` | Dados incompletos | 🟡 Amarelo |
| `ERROR` | Erro no processamento | 🔴 Vermelho |

---

## API Endpoints

### Talhões

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/fields` | Listar talhões |
| POST | `/api/fields` | Criar talhão |
| GET | `/api/fields/[id]` | Detalhes do talhão |
| DELETE | `/api/fields/[id]` | Excluir talhão |
| POST | `/api/fields/[id]/process` | Processar talhão |
| POST | `/api/fields/[id]/analyze/[templateId]` | Executar análise |

### Diagnóstico Logístico

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/logistics/diagnostic` | Dados agregados |

### Admin

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/admin/fix-status` | Preview de status inconsistentes |
| POST | `/api/admin/fix-status` | Corrigir status |

---

## Contribuição

1. Clone o repositório
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Add: nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

---

## Licença

Proprietary - MERX © 2026
