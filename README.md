# MERX AGRO Monitor - MVP

Sistema de monitoramento agronômico para análise de risco logístico e previsão de colheita.

## Visão Geral

O **MERX AGRO Monitor** é uma plataforma multi-tenant que transforma dados de satélite e clima em insights acionáveis para planejamento logístico e análise de risco agrícola.

### Principais Funcionalidades

- **Multi-tenancy** - Isolamento completo de dados por empresa/workspace
- **Autenticação** - Sistema de login com gestão de usuários e roles
- **Cadastro de Produtores** - Gestão de produtores vinculados aos talhões
- **Monitoramento de Talhões** - Cadastro e acompanhamento de áreas agrícolas
- **Tipos de Cultura** - Suporte a Soja e Milho com ciclos diferenciados
- **Detecção de Fenologia** - Identificação automática de plantio, emergência e colheita
- **Curvas NDVI** - Visualização histórica e projeções com correlação
- **Diagnóstico Logístico** - Visão consolidada para planejamento de recebimento
- **Caixas Logísticas** - Gestão de armazéns com raio de cobertura
- **Filtros Avançados** - Por status, caixa logística e tipo de atribuição
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
├── app/
│   ├── (authenticated)/        # Rotas protegidas (requer login)
│   │   ├── layout.tsx          # Layout com Sidebar
│   │   ├── page.tsx            # Dashboard principal (Carteira)
│   │   ├── admin/
│   │   │   ├── users/          # Gestão de usuários
│   │   │   └── workspaces/     # Gestão de workspaces (SUPER_ADMIN)
│   │   ├── producers/          # Gestão de produtores
│   │   ├── fields/             # Gerenciar Talhões (atribuições)
│   │   ├── dashboard/
│   │   │   ├── logistics/      # Diagnóstico logístico
│   │   │   └── logistics-units/# Gestão de Caixas Logísticas
│   │   ├── fields/new/         # Cadastro de talhões
│   │   ├── settings/           # Configurações do workspace
│   │   └── reports/[id]/       # Relatórios detalhados
│   ├── login/                  # Página de login
│   ├── change-password/        # Troca de senha (primeiro acesso)
│   └── api/
│       ├── auth/               # Autenticação (login, logout, etc)
│       ├── admin/
│       │   ├── users/          # CRUD de usuários
│       │   └── workspaces/     # CRUD de workspaces
│       ├── producers/          # CRUD de produtores
│       ├── fields/             # CRUD de talhões
│       ├── logistics/          # Diagnóstico logístico
│       ├── logistics-units/    # Caixas logísticas e cobertura
│       ├── workspace/          # Configurações do workspace
│       └── templates/          # Templates de análise
├── components/
│   ├── layout/                 # Sidebar, AppLayout, Changelog
│   ├── fields/                 # Componentes de talhões
│   ├── map/                    # Componentes de mapa
│   └── ui/                     # Shadcn/ui components
├── lib/
│   ├── auth.ts                 # Utilitários de autenticação (JWT)
│   ├── version.ts              # Versão e changelog
│   ├── prisma.ts               # Cliente Prisma
│   └── services/               # Serviços de negócio
│       ├── distance.service.ts # Cálculo de distâncias
│       └── logistics-distance.service.ts # Persistência de distâncias
├── prisma/
│   ├── schema.prisma           # Schema do banco
│   └── seed.ts                 # Seed inicial
└── middleware.ts               # Proteção de rotas
```

---

## Documentação

| Documento | Descrição | Status |
|-----------|-----------|--------|
| [README.md](./README.md) | Este documento - visão geral | ✅ Atualizado |
| [CHANGELOG.md](./CHANGELOG.md) | Histórico de mudanças | ✅ Atualizado |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Arquitetura detalhada | ✅ Atualizado |
| [METHODOLOGY.md](./METHODOLOGY.md) | Metodologias técnicas | ✅ Atualizado |
| [DIAGNOSTICOLOG.md](./DIAGNOSTICOLOG.md) | Especificação módulo logístico | ✅ Atualizado |
| [REFATORACAO1.md](./REFATORACAO1.md) | Plano de multi-tenancy e auth | ✅ Concluído |

### Documentos Legados (raiz do projeto)

| Documento | Descrição | Status |
|-----------|-----------|--------|
| [../produto.md](../produto.md) | Visão original do produto | 📦 Legado |
| [../melhorias.md](../melhorias.md) | Análise de melhorias | 📦 Legado |
| [../IMPLEMENTACAO.md](../IMPLEMENTACAO.md) | Plano de implementação | 📦 Legado |
| [../logic.md](../logic.md) | Melhorias de lógica | 📦 Legado |

---

## Multi-tenancy e Autenticação

### Hierarquia de Permissões

| Role | Pode fazer |
|------|-----------|
| `SUPER_ADMIN` | Criar/gerenciar workspaces, criar usuários em qualquer workspace, criar outros SUPER_ADMINs |
| `ADMIN` | Gerenciar usuários do próprio workspace (criar, resetar senha, ativar/desativar) |
| `OPERATOR` | Criar/editar talhões, produtores |
| `VIEWER` | Apenas visualizar |

### Fluxo de Primeiro Acesso

1. **Admin cria usuário** no sistema com senha temporária
2. **Comunica credenciais** manualmente (WhatsApp, email, etc)
3. **Usuário faz login** em `/login`
4. **Sistema detecta** `mustChangePassword = true`
5. **Redireciona** para `/change-password`
6. **Após trocar senha**, acessa o dashboard normalmente

### Isolamento de Dados

- Cada workspace é completamente isolado
- Usuários só veem dados do próprio workspace
- APIs filtram automaticamente por `workspaceId`
- SUPER_ADMIN pode acessar workspaces específicos

### Credenciais Iniciais (Dev/Demo)

```
Email: admin@merx.tech
Senha: Admin@123
```

> A senha será solicitada para troca no primeiro login.

---

## Produtores e Culturas

### Cadastro de Produtores

Produtores podem ser cadastrados para vinculação aos talhões:

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| Nome | ✅ Sim | Nome completo do produtor |
| CPF | ❌ Não | CPF (formatado automaticamente) |

### Tipos de Cultura

| Cultura | Ciclo (dias) | Emergência (dias) | Produtividade Base (kg/ha) |
|---------|--------------|-------------------|---------------------------|
| **Soja** | 120 | 8 | 3.500 |
| **Milho** | 140 | 7 | 9.000 |

### Data de Plantio Informada

Se o produtor informar a data de plantio no cadastro do talhão:

- É usada como base **100% confiável** para cálculos
- SOS (emergência) = plantio + dias de emergência da cultura
- EOS (colheita) = plantio + ciclo da cultura
- **+25 pontos** no score de confiança

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
- Mapa de propriedades com caixas logísticas
- Indicadores críticos
- Filtro por uma ou mais caixas logísticas

### 4. Caixas Logísticas

Gestão de unidades de recebimento:
- Cadastro com coordenadas e raio de cobertura
- Visualização de cobertura e interseções
- Atribuição de talhões (manual, herdada, automática)
- Hierarquia: Manual > Produtor > Automático (mais próximo)

### 5. Filtros e Gestão

Dashboard com filtros avançados:
- Status: Todos, Processado, Processando, Pendente, Erro
- Caixa Logística: Todas, Sem atribuição, ou específica
- Tipo de Atribuição: Manual (M), Produtor (P), Automático (A)

Gerenciamento de talhões:
- Cards clicáveis como filtros
- Resolução de interseções (talhões em múltiplos raios)
- Atribuição manual de caixa logística

### 6. Templates de Análise

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

### Autenticação

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/auth/login` | Login com email/senha |
| POST | `/api/auth/logout` | Encerrar sessão |
| POST | `/api/auth/change-password` | Trocar senha |
| GET | `/api/auth/me` | Dados do usuário logado |

### Talhões (requer autenticação)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/fields` | Listar talhões (do workspace) |
| POST | `/api/fields` | Criar talhão |
| GET | `/api/fields/[id]` | Detalhes do talhão |
| DELETE | `/api/fields/[id]` | Excluir talhão |
| POST | `/api/fields/[id]/process` | Processar talhão |
| POST | `/api/fields/[id]/analyze/[templateId]` | Executar análise |

### Produtores

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/producers` | Listar produtores (do workspace) |
| POST | `/api/producers` | Criar produtor |
| GET | `/api/producers/[id]` | Detalhes do produtor |
| PUT | `/api/producers/[id]` | Atualizar produtor |
| DELETE | `/api/producers/[id]` | Excluir produtor |

### Diagnóstico Logístico

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/logistics/diagnostic` | Dados agregados (do workspace) |

### Caixas Logísticas

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/logistics-units` | Listar caixas logísticas |
| POST | `/api/logistics-units` | Criar caixa logística |
| GET | `/api/logistics-units/[id]` | Detalhes da caixa |
| PUT | `/api/logistics-units/[id]` | Atualizar caixa |
| DELETE | `/api/logistics-units/[id]` | Excluir/desativar caixa |
| GET | `/api/logistics-units/coverage` | Relatório de cobertura |
| POST | `/api/logistics-units/reprocess` | Reprocessar distâncias |

### Admin - Usuários (ADMIN/SUPER_ADMIN)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/admin/users` | Listar usuários do workspace |
| POST | `/api/admin/users` | Criar usuário |
| GET | `/api/admin/users/[id]` | Detalhes do usuário |
| PUT | `/api/admin/users/[id]` | Atualizar usuário |
| DELETE | `/api/admin/users/[id]` | Excluir usuário |
| POST | `/api/admin/users/[id]/reset-password` | Resetar senha |

### Admin - Workspaces (SUPER_ADMIN)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/admin/workspaces` | Listar todos workspaces |
| POST | `/api/admin/workspaces` | Criar workspace (com admin opcional) |
| GET | `/api/admin/workspaces/[id]` | Detalhes do workspace |
| PUT | `/api/admin/workspaces/[id]` | Atualizar workspace |
| DELETE | `/api/admin/workspaces/[id]` | Excluir workspace |

### Utilitários

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
