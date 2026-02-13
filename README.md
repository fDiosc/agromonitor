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
- **Fusão EOS (v0.0.19)** - Algoritmo científico combinando NDVI + GDD + Balanço Hídrico
- **Curvas NDVI** - Visualização histórica e projeções com correlação
- **Gráficos Avançados** - GDD, Envelope Climático, Balanço Hídrico, Precipitação
- **Diagnóstico Logístico** - Visão consolidada para planejamento de recebimento
- **Caixas Logísticas** - Gestão de armazéns com raio de cobertura
- **Filtros Avançados (v0.0.31)** - Status, tipo, caixa logística, janela de colheita, confiança, presença/resultado IA
- **Dashboard Ordenável (v0.0.31)** - 13 colunas individuais com ordenação por clique, padrão por colheita mais próxima
- **Templates de Análise** - Crédito, Logística, Matriz de Risco
- **Validação Visual IA (v0.0.29+)** - Pipeline de 3 agentes: Curador → Verificador → Juiz validam imagens de satélite com Gemini multimodal (6 fontes de dados)
- **Fusão EOS Corrigida (v0.0.30)** - Single source of truth: data canônica calculada no servidor
- **Pipeline de Criticidade de Cultura (v0.0.32)** - Validação algorítmica + IA Verificadora da cultura declarada (8 culturas, 3 categorias)
- **Sanidade EOS + ATYPICAL (v0.0.33)** - NDVI prevalece sobre GDD em contradições; classificação ATYPICAL para ciclos indefinidos; supressão automática de resultados IA quando cultura é duvidosa
- **Visualização de Polígono (v0.0.33)** - Modal Leaflet no relatório com mapa satélite/OSM exibindo o polígono do talhão
- **Análise Visual de Satélite (v0.0.34)** - Aba no relatório do talhão para navegação por imagens de satélite com slider de comparação antes/depois
- **Persistência S3 (v0.0.34)** - Imagens de satélite armazenadas em AWS S3 com segregação por workspace; compartilhamento entre IA e Análise Visual; fetch incremental
- **Edição Agronômica (v0.0.34)** - Botão editar no dashboard para ajustar plantio, cultura e safra com reprocessamento; preservação de dados algorítmicos originais
- **Subtalhões (v0.0.34)** - Hierarquia pai/filho de talhões; desenho de polígonos contidos; análise agrícola individual por subtalhão
- **Feature Flags** - Configuração de módulos por workspace (incluindo `enableVisualAnalysis`, `enableSubFields`)

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
DATABASE_URL="postgresql://..."      # PostgreSQL connection string
GEMINI_API_KEY="..."                # Google Gemini API key
MERX_API_URL="https://homolog.api.merx.tech/api/monitoramento"  # URL da API Merx (default)
CORS_PROXY_URL="https://corsproxy.io/?"  # URL do proxy CORS (default)
JWT_SECRET="..."                    # Segredo para assinatura JWT (tem fallback no código)

# Armazenamento S3 (opcional - para persistência de imagens de satélite)
S3_ACCESS_KEY_ID="..."              # AWS Access Key ID
S3_SECRET_ACCESS_KEY="..."          # AWS Secret Access Key
S3_BUCKET="pocs-merxlabs"          # Nome do bucket S3
S3_REGION="us-east-1"              # Região AWS
S3_ENDPOINT="..."                  # Endpoint customizado (apenas para R2/MinIO, omitir para AWS S3)
```

---

## Arquitetura

O sistema é uma aplicação Next.js 14 (App Router) com frontend React + TypeScript + TailwindCSS + Shadcn/ui, backend via Route Handlers, integração com Prisma/PostgreSQL, Merx API (satélite/clima), Sentinel Hub (imagens), e agentes de IA (Gemini).

Documentação completa: **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)**

---

## Estrutura do Projeto

```
merx-agro-mvp/
├── app/
│   ├── (authenticated)/        # Rotas protegidas (requer login)
│   │   ├── layout.tsx          # Layout com Sidebar
│   │   ├── page.tsx            # Dashboard principal (Carteira) + EditFieldModal
│   │   ├── admin/
│   │   │   ├── users/          # Gestão de usuários
│   │   │   └── workspaces/     # Gestão de workspaces (SUPER_ADMIN)
│   │   ├── producers/          # Gestão de produtores
│   │   ├── fields/             # Gerenciar Talhões (atribuições)
│   │   ├── dashboard/
│   │   │   ├── logistics/      # Diagnóstico logístico
│   │   │   └── logistics-units/# Gestão de Caixas Logísticas
│   │   ├── fields/new/         # Cadastro de talhões
│   │   ├── settings/           # Configurações do workspace (incl. Visual Analysis, SubFields)
│   │   └── reports/[id]/       # Relatórios detalhados (Tabs: Relatório + Análise Visual)
│   ├── login/                  # Página de login
│   ├── change-password/        # Troca de senha (primeiro acesso)
│   └── api/
│       ├── auth/               # Autenticação (login, logout, etc)
│       ├── admin/
│       │   ├── users/          # CRUD de usuários
│       │   └── workspaces/     # CRUD de workspaces
│       ├── producers/          # CRUD de produtores
│       ├── fields/             # CRUD de talhões
│       │   └── [id]/
│       │       ├── subfields/  # GET/POST subtalhões
│       │       └── images/     # GET imagens de satélite (URLs assinadas S3)
│       ├── logistics/          # Diagnóstico logístico
│       ├── logistics-units/    # Caixas logísticas e cobertura
│       ├── workspace/          # Configurações do workspace
│       └── templates/          # Templates de análise
├── components/
│   ├── layout/                 # Sidebar, AppLayout, Changelog
│   ├── fields/                 # Componentes de talhões (field-table com colunas Cultura+Status)
│   ├── modals/                 # Modais (Disclaimer, EditField, FieldMapModal)
│   ├── maps/                   # SubFieldMap (Leaflet + leaflet-draw)
│   ├── visual-analysis/        # ImageComparisonSlider, VisualAnalysisTab
│   ├── map/                    # Componentes de mapa (MapDrawer)
│   └── ui/                     # Shadcn/ui components
├── lib/
│   ├── auth.ts                 # Utilitários de autenticação (JWT)
│   ├── version.ts              # Versão e changelog
│   ├── prisma.ts               # Cliente Prisma
│   ├── s3.ts                   # Cliente AWS S3 (upload, download, presigned URLs)
│   ├── agents/                 # Agentes de IA (Visual Validation)
│   │   ├── curator.ts          # Agente Curador (seleção de imagens)
│   │   ├── verifier.ts         # Agente Verificador (confirmação visual de cultura)
│   │   ├── judge.ts            # Agente Juiz (validação fenológica)
│   │   ├── curator-prompt.ts   # Prompt do Curador
│   │   ├── verifier-prompt.ts  # Prompt do Verificador
│   │   ├── judge-prompt.ts     # Prompt do Juiz
│   │   ├── types.ts            # Tipos compartilhados dos agentes
│   │   └── evalscripts/        # Scripts Sentinel Hub (NDVI, True Color, Radar)
│   └── services/               # Serviços de negócio
│       ├── ai-validation.service.ts     # Orquestrador da validação visual IA (Curator→Verifier→Judge)
│       ├── field-images.service.ts      # Serviço compartilhado de imagens (S3 + Sentinel Hub)
│       ├── crop-pattern.service.ts      # Análise algorítmica de padrão de cultura (v0.0.32)
│       ├── eos-fusion.service.ts        # Fusão EOS (NDVI + GDD + Hídrico, sanity check v0.0.33)
│       ├── thermal.service.ts           # Soma térmica (GDD)
│       ├── water-balance.service.ts     # Balanço hídrico
│       ├── climate-envelope.service.ts  # Envelope climático histórico
│       ├── precipitation.service.ts     # Dados de precipitação
│       ├── feature-flags.service.ts     # Configuração de módulos
│       ├── phenology.service.ts         # Cálculos fenológicos
│       ├── pricing.service.ts           # Custos de API (Gemini, Sentinel Hub)
│       ├── distance.service.ts          # Cálculo de distâncias
│       └── logistics-distance.service.ts # Persistência de distâncias
├── prisma/
│   ├── schema.prisma           # Schema do banco (incl. FieldImage, sub-fields, detected*)
│   └── seed.ts                 # Seed inicial
└── middleware.ts               # Proteção de rotas
```

---

## Documentação

| Documento | Descrição | Status |
|-----------|-----------|--------|
| [README.md](./README.md) | Este documento - visão geral | ✅ Atualizado (v0.0.34) |
| [CHANGELOG.md](./CHANGELOG.md) | Histórico de mudanças | ✅ Atualizado (v0.0.34) |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Arquitetura detalhada | ✅ Atualizado (v0.0.34) |
| [METHODOLOGY.md](./docs/METHODOLOGY.md) | **Metodologia unificada** - Fenologia, Fusão EOS, GDD, Criticidade, IA Visual | ✅ Atualizado (v0.0.33) |
| [Apisproject.md](./docs/Apisproject.md) | Documentação completa de APIs (internas e externas) | ✅ Atualizado (v0.0.34) |
| [DEPLOY.md](./docs/DEPLOY.md) | Guia de deploy em produção | ✅ Atualizado (v0.0.34) |
| [DIAGNOSTICOLOG.md](./docs/DIAGNOSTICOLOG.md) | Especificação módulo logístico | ✅ Atualizado |

### Documentos Técnicos (pasta /docs)

| Documento | Descrição | Status |
|-----------|-----------|--------|
| [Apisproject.md](./docs/Apisproject.md) | APIs externas (Merx, Copernicus, Gemini, S3) + internas (35+ endpoints) | ✅ Atualizado (v0.0.34) |
| [REPORT-MERX-NDVI-GAP.md](./docs/REPORT-MERX-NDVI-GAP.md) | Relatório técnico: gap de dados NDVI | ✅ Concluído |

### Documentos Arquivados (docs/archive/)

Planos concluídos e documentos substituídos, mantidos para referência histórica: METHODOLOGY-V2, REFATORACAO1, PLAN-AI-VISUAL-VALIDATION, PLAN-HYBRID-ANALYSIS, PLAN-REPROCESS-ANALYSIS, PLAN-ZARC-ALIGNMENT.

### Documentos Legados (docs/archive/)

| Documento | Descrição | Status |
|-----------|-----------|--------|
| produto.md | Visão original do produto | 📦 Arquivado |
| melhorias.md | Análise de melhorias | 📦 Arquivado |
| IMPLEMENTACAO.md | Plano de implementação | 📦 Arquivado |
| logic.md | Melhorias de lógica | 📦 Arquivado |

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

### 5. Filtros e Gestão (v0.0.31)

Dashboard com **tabela ordenável** (13 colunas) e **filtros avançados** em 2 linhas:

**Ordenação** (clique em qualquer cabeçalho):
- Padrão: colheita prevista mais próxima primeiro
- Suporta: Status, Talhão, Área, Volume, Emergência, Colheita, Confiança, IA, EOS IA, Pronta, Conf. IA
- Nulls sempre no final, direção inteligente por tipo de dado

**Filtros Linha 1** (logística):
- Status: Todos, Processado, Processando, Pendente, Erro
- Tipo de Atribuição: Manual (M), Produtor (P), Automático (A), Sem
- Caixa Logística: Todas, Sem atribuição, ou específica

**Filtros Linha 2** (fenologia + IA):
- Janela de Colheita: Passada, 30 dias, 60 dias, 90 dias, Sem data
- Confiança Modelo: Alta (>75%), Média (40-75%), Baixa (<40%), Sem
- Validação IA: Com IA, Sem IA
- Resultado IA: Confirmado, Questionado, Rejeitado

Gerenciamento de talhões:
- Resolução de interseções (talhões em múltiplos raios)
- Atribuição manual de caixa logística

### 6. Templates de Análise

Sistema extensível de análises:
- **Crédito**: Avaliação de garantias e CPRs
- **Logística**: Previsão de colheita e transporte
- **Matriz de Risco**: Visão consolidada de riscos

### 7. Fusão EOS (Previsão de Colheita Avançada)

Algoritmo científico para previsão de data de colheita com **Single Source of Truth** (v0.0.30):

**Fontes de Dados Combinadas:**
- **NDVI Histórico**: Correlação com safras anteriores
- **Soma Térmica (GDD)**: Growing Degree Days para maturidade fisiológica
- **Balanço Hídrico**: Ajuste por estresse (acelera senescência)

**Pipeline de Dados (v0.0.30):**
- Data canônica calculada no servidor (`process/route.ts`) e persistida em `rawAreaData.fusedEos`
- API de talhão (`fields/[id]/route.ts`) prioriza EOS fusionado para janela de colheita e gráficos
- Relatório prioriza EOS do servidor, eliminando divergência client/server
- Campo `passed: boolean` indica se colheita já ocorreu
- GDD com backtracking para encontrar data exata de maturação

**Metodologias Científicas:**
| Referência | Aplicação |
|------------|-----------|
| PhenoCrop (Sakamoto 2020) | 77% acurácia milho, 71% soja |
| Kumudini 2021 | 85% redução NDVI = maturidade |
| Mourtzinis 2017 | GDD por grupo de maturidade |
| Desclaux 2003 | Estresse hídrico acelera colheita |

**Interface:**
- Tooltip interativo com método e confiança
- Comparativo NDVI vs GDD em tempo real
- Alertas de divergência automáticos

> Documentação completa: [METHODOLOGY.md](./docs/METHODOLOGY.md) seções 8-10

### 8. Validação Visual por IA (v0.0.29+)

Pipeline de validação visual que usa IA multimodal para confirmar ou questionar projeções algorítmicas:

**Arquitetura de 3 Agentes:**
- **Curador**: Seleciona e pontua as melhores imagens de satélite (True Color, NDVI, Radar)
- **Verificador**: Confirma se a cultura declarada corresponde ao observado visualmente (condicional)
- **Juiz**: Valida projeções algorítmicas usando visão computacional multimodal

**Modelos IA:**
| Agente | Modelo | SDK |
|--------|--------|-----|
| Curador | `gemini-2.5-flash-lite` ou `gemini-3-flash-preview` | `@google/genai` |
| Juiz | `gemini-3-flash-preview` | `@google/genai` |

**Imagens de Satélite (Sentinel Hub Process API) — 6 fontes:**
- **True Color**: Sentinel-2 L2A (R/G/B com correção atmosférica)
- **NDVI Colorizado**: Escala contínua com legendas de threshold
- **Radar Composto**: Sentinel-1 GRD (VV/VH, falsa-cor SAR)
- **Landsat 8/9**: NDVI para talhões >200ha (complementar ao Sentinel-2)
- **Sentinel-3 OLCI**: NDVI de larga escala para talhões >500ha
- **Gemini Vision**: Análise multimodal de todas as camadas combinadas

**Modos de Trigger:**
| Modo | Descrição |
|------|-----------|
| `MANUAL` | Botão "Validar por IA" no relatório |
| `ON_PROCESS` | Automático ao processar talhão |
| `ON_LOW_CONFIDENCE` | Automático quando confiança < 50% |

**Resultados:**
- Concordância: `CONFIRMED`, `QUESTIONED`, `REJECTED`
- EOS ajustado pela IA (com critérios quantitativos)
- Alertas visuais com severidade (LOW/MEDIUM/HIGH)
- Recomendações acionáveis do Juiz
- Fatores de risco categorizados (CLIMATIC/PHYTOSANITARY/OPERATIONAL)

**Configuração (Feature Flags):**
- `enableAIValidation` - Habilitar pipeline de validação visual
- `aiValidationTrigger` - Modo de trigger (MANUAL/ON_PROCESS/ON_LOW_CONFIDENCE)
- `aiCuratorModel` - Modelo do Curador
- `showAIValidation` - Mostrar painel no relatório

> Documentação completa: [PLAN-AI-VISUAL-VALIDATION.md](./docs/archive/PLAN-AI-VISUAL-VALIDATION.md)

### 9. Análise Visual de Satélite (v0.0.34)

Módulo de análise visual integrado como aba no relatório do talhão:

**Funcionalidades:**
- **Navegação de Imagens**: Timeline com todas as datas de satélite disponíveis
- **Toggle de Tipo**: Alternar entre True Color (RGB) e NDVI
- **Slider de Comparação**: Arrastar para comparar duas datas lado a lado (before/after)
- **Refresh Incremental**: Buscar apenas imagens novas (datas ainda não persistidas)
- **Compartilhamento com IA**: Mesmas imagens alimentam tanto a Análise Visual quanto a Validação por IA

**Infraestrutura de Imagens (S3):**
- Imagens persistidas em AWS S3 com path: `agro-monitor/{workspaceId}/fields/{fieldId}/{date}_{type}_{collection}.png`
- Metadados salvos no modelo `FieldImage` (Prisma)
- URLs assinadas (presigned) para visualização no frontend
- Segregação completa por workspace

**Configuração:**
- `enableVisualAnalysis` - Habilitar aba de Análise Visual no relatório

### 10. Edição de Dados Agronômicos (v0.0.34)

Permite ajustar dados agronômicos após o cadastro do talhão:

**Campos Editáveis:**
- Data de plantio (`plantingDateInput`)
- Tipo de cultura (`cropType`)
- Data de início da safra (`seasonStartDate`)
- Geometria (`geometryJson`)

**Comportamento:**
- Alterações agronômicas disparam reprocessamento automático
- Dados detectados algoritmicamente são **preservados** (campos `detected*` no `AgroData`)
- Histórico de edições registrado em `editHistory` (JSON com timestamp, campo, valor anterior e novo)
- Dashboard exibe badge "editado" para talhões com histórico

### 11. Subtalhões (v0.0.34)

Hierarquia pai/filho de talhões para análise granular:

**Funcionalidades:**
- Talhão pai pode ter N subtalhões com polígonos contidos no pai
- Nomeação automática (Talhão 1, Talhão 2...) com possibilidade de renomear
- Herança de cultura do pai, ajustável por subtalhão
- Análise agrícola passa a nível de subtalhão quando existem filhos
- Dashboard exibe visão folder-like (pai como pasta, filhos como itens)
- Mapa do subtalhão destaca polígono do filho, exibe irmãos e geometria do pai

**Validação:**
- Geometria do subtalhão deve estar contida no polígono pai (`@turf/boolean-contains`)
- Talhão pai com subtalhões não pode ser reprocessado diretamente

**Configuração:**
- `enableSubFields` - Habilitar funcionalidade de subtalhões

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

| Grupo | Descrição |
|-------|-----------|
| **Auth** | `/api/auth/*` — Login, logout, troca de senha, me |
| **Fields** | `/api/fields/*` — CRUD talhões, processamento, análise, subtalhões, imagens |
| **Producers** | `/api/producers/*` — CRUD produtores |
| **Logistics** | `/api/logistics/*`, `/api/logistics-units/*` — Diagnóstico e caixas logísticas |
| **Admin** | `/api/admin/*` — Usuários, workspaces (SUPER_ADMIN) |

Documentação completa: **[docs/Apisproject.md](./docs/Apisproject.md)**

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
