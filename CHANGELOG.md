# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## Versionamento

| Fase | Versão | Status |
|------|--------|--------|
| **ALPHA** | 0.0.x | Em desenvolvimento ativo, pode haver bugs e instabilidades |
| **BETA** | 0.1.x | Funcionalidades estáveis, em validação com usuários |
| **V1** | 1.x.x | Versão de produção |

---

# ALPHA (0.0.x)

Versão em desenvolvimento ativo. Pode haver bugs, indisponibilidades e perda de dados.

---

## [0.0.9] - 2026-01-30

### Adicionado

#### Extensão de Históricos até EOS
- Linhas históricas agora são projetadas até a data de EOS prevista
- Permite ao usuário visualizar como safras anteriores se comportaram no período de colheita
- Projeção usa modelo de decaimento exponencial baseado na tendência observada
- Aplicado apenas quando há tendência de queda detectada (slope < -0.002)

### Corrigido

#### Deploy CapRover
- Criada pasta `public/` (antes ausente)
- Atualizado Dockerfile para Node 20 (compatibilidade com @google/genai)
- Adicionado `DATABASE_URL` placeholder para build
- Adicionado endpoint `/api/health` para health checks
- Configurada porta 3000 corretamente no CapRover

---

## [0.0.8] - 2026-01-30

### Adicionado

#### Disclaimer de Termos Alpha
- Modal obrigatório exibido no primeiro login de cada usuário
- 7 termos de uso cobrindo: versão Alpha, bugs, verificação de dados, reporte, disponibilidade, persistência e descontinuação
- Campos no usuário: `hasAcceptedDisclaimer`, `disclaimerAcceptedAt`, `disclaimerVersionAccepted`
- API `/api/auth/accept-disclaimer` para registrar aceitação

#### Abas no Diagnóstico Logístico
- Reestruturação em 3 abas: **Overview**, **Produtor**, **Unidade de Recebimento**
- **Overview**: Visão consolidada (conteúdo original)
- **Produtor**: Filtro por um ou mais produtores
  - Seleção múltipla com chips visuais
  - Recálculo dinâmico de métricas, timeline, curva e mapa
  - Exibe apenas produtores vinculados a talhões processados
- **Unidade de Recebimento**: Placeholder (em desenvolvimento)

#### Versionamento Estruturado
- Convenção de versões: Alpha (0.0.x), Beta (0.1.x), V1 (1.x.x)
- Helper `getCurrentPhase()` para identificar fase atual
- Tabela de versionamento no CHANGELOG

### Alterado
- Versão atualizada de 0.7.0 para 0.0.8 (formato Alpha)
- API `/api/logistics/diagnostic` agora retorna `producerId` e `producerName` dos talhões

---

## [0.0.7] - 2026-01-29

### Adicionado

#### Modelo de Projeção Adaptativa por Fase Fenológica
- Detecção automática de fase fenológica usando regressão linear:
  - **Vegetativo** (slope > 0.5%/dia): NDVI subindo
  - **Reprodutivo** (|slope| < 0.5%/dia): NDVI estável (platô)
  - **Senescência** (slope < -0.5%/dia): NDVI caindo
- Lógica de projeção diferenciada por fase:
  - **Vegetativo**: 60% tendência + 40% histórico (limite 0.92)
  - **Vegetativo (platô)**: min(tendência, histórico) quando NDVI > 0.80
  - **Reprodutivo**: usa histórico (padrão típico)
  - **Senescência**: decaimento exponencial (limite 0.18)
- Validação estatística com R² e teste de significância

#### EOS Dinâmico (Previsão de Colheita)
- Cálculo dinâmico da data de colheita baseado em tendência de senescência
- Critérios rigorosos: slope < -1%/dia, R² > 70%, NDVI < 85% do pico
- Modelo exponencial para projetar quando NDVI cruza threshold de EOS
- Exemplo: EOS dinâmico 17 dias antes do fixo (05/02 vs 22/02)

#### Fundamentos Científicos
- Regressão Linear Simples (OLS) para detecção de tendência
- Modelo de decaimento exponencial: `NDVI(t) = MIN + (NDVI_0 - MIN) × e^(-k×t)`
- Princípio biológico: senescência é processo irreversível
- R² > 0.7 para EOS dinâmico (confiança alta)

### Corrigido
- Projeção não mais "sobe" quando dados reais mostram queda
- Curva de projeção agora é suave (exponencial), sem linha reta no limite
- Data de colheita agora reflete tendência real, não apenas ciclo típico
- Projeção vegetativa não mais sobe indefinidamente quando próximo do platô
- Limite biológico de NDVI máximo (0.92) aplicado

### Documentação
- Nova seção no METHODOLOGY.md: "Projeção Adaptativa por Fase Fenológica"
- Subseção "EOS Dinâmico" com exemplos práticos
- Explicação completa dos fundamentos estatísticos e biológicos

---

## [0.0.6] - 2026-01-29

### Adicionado

#### Cadastro de Produtores
- Nova entidade `Producer` com nome (obrigatório) e CPF (opcional)
- Página `/producers` para gestão de produtores
- API CRUD completa (`/api/producers`)
- Vinculação de produtor ao talhão (opcional)

#### Tipos de Cultura
- Campo `cropType` com opções SOJA e MILHO
- Ciclos e limiares ajustados por cultura
- Default: SOJA

#### Data de Plantio Informada
- Campo opcional `plantingDateInput` no cadastro de talhão
- Quando informada, é usada como base confiável para cálculos
- Aumenta o score de confiança da análise (+25 pontos)
- SOS e EOS são calculados a partir da data informada

### Alterado
- Formulário de cadastro de talhão com novos campos
- Serviço de fenologia agora aceita data de plantio do produtor
- Templates de análise usam `cropType` em vez de `crop`

---

## [0.0.5] - 2026-01-29

### Adicionado

#### Gestão de Workspaces (SUPER_ADMIN)
- Nova página `/admin/workspaces` para gerenciar empresas/clientes
- API `/api/admin/workspaces` para CRUD de workspaces
- Criação de workspace com admin inicial (opcional)
- Limites configuráveis: máximo de usuários e talhões por workspace
- Toggle de ativação/desativação de workspaces
- Visualização de detalhes e usuários por workspace

#### Hierarquia de Permissões
- Role `SUPER_ADMIN` para gestão global da plataforma
- `SUPER_ADMIN` pode criar/gerenciar workspaces
- `SUPER_ADMIN` pode adicionar usuários a qualquer workspace
- `ADMIN` gerencia apenas usuários do próprio workspace

### Alterado
- Sidebar agora exibe item "Workspaces" apenas para SUPER_ADMIN
- Documentação atualizada com fluxos de multi-tenancy

---

## [0.0.4] - 2026-01-29

### Adicionado

#### Multi-tenancy
- Modelo `Workspace` para segregação de dados por empresa
- Modelo `User` com autenticação e roles
- Isolamento completo de dados entre workspaces
- Middleware de autenticação e proteção de rotas
- Filtro automático de dados por `workspaceId`

#### Sistema de Autenticação
- Página de login (`/login`)
- Página de troca de senha (`/change-password`)
- JWT para gerenciamento de sessões
- Fluxo de primeiro acesso com senha temporária
- Endpoints de autenticação (`/api/auth/*`)

#### Nova Interface (Sidebar)
- Layout com sidebar fixa à esquerda
- Navegação organizada por módulos
- Menu de administração (Admin/Operator)
- Rodapé com versão e changelog
- Modal de changelog com histórico de versões

#### Gestão de Usuários
- Página `/admin/users` para CRUD de usuários
- Reset de senha por admin
- Ativação/desativação de usuários
- Validação de roles e permissões

### Alterado
- Estrutura de rotas migrada para route groups `(authenticated)`
- Todas APIs filtram dados por workspace do usuário logado
- Header substituído por Sidebar

---

## [0.0.3] - 2026-01-29

### Adicionado

#### Módulo de Diagnóstico Logístico
- Nova página `/dashboard/logistics` com visão consolidada
- Cards de métricas agregadas (talhões, área, volume, carretas)
- Timeline de janela de colheita (primeira, pico, última)
- Gráfico de curva de recebimento (bell curve) com Recharts
- Tabela de cronograma por talhão com ordenação
- Indicadores críticos (dias até colheita, pico, risco, capacidade)
- Mapa interativo com propriedades e marcadores por status
- Botão de acesso no header principal

#### Sistema de Status Parcial
- Novo status `PARTIAL` para talhões com dados incompletos
- Validação de dados críticos (SOS, EOS, confiança)
- Badge amarelo com ícone de alerta na UI
- Mensagem de erro visível na tabela (hover para detalhes)
- Endpoint `/api/admin/fix-status` para correção de status inconsistentes

#### Logging Estruturado
- Logs detalhados no processamento de talhões
- Mensagens de erro salvas no campo `errorMessage`
- Warnings capturados e persistidos

### Corrigido
- Query Prisma inválida no diagnóstico logístico (filtro de eosDate)
- Talhões sem dados fenológicos não aparecem mais como SUCCESS
- Pico de colheita na tabela agora mostra pico logístico (não fenológico)
- yAxisId ausente no ReferenceLine do gráfico

### Alterado
- Filtro de talhões no diagnóstico: apenas SUCCESS com eosDate válido
- Campo `errorMessage` agora retornado na API `/api/fields`

---

## [0.2.0] - 2026-01-29

### Adicionado

#### Visualização de Gráfico NDVI
- Linhas de referência para plantio, emergência (SOS) e colheita (EOS)
- Curvas históricas de anos anteriores (H1, H2, H3)
- Linha de projeção baseada em correlação histórica
- Janela de colheita (início e fim) com linhas no gráfico
- Tooltip personalizado com informações detalhadas

#### Cálculo de Janela de Colheita
- Harvest Start = EOS Date (fim do ciclo)
- Harvest End = Start + (área / 50 ha/dia)
- Integração com API de talhões

#### Serviço de Correlação Robusta
- Métrica composta: Pearson + RMSE + Aderência
- Alinhamento fenológico preferencial
- Fallback para alinhamento por índice

### Corrigido
- ReferenceLines não aparecendo (X axis mismatch)
- Curvas históricas não visíveis (filtro muito restritivo)
- Inconsistência entre percentuais do gráfico e cards

---

## [0.0.1] - 2026-01-27

### Adicionado

#### Infraestrutura Base
- Projeto Next.js 14 com App Router
- Prisma ORM com PostgreSQL (Neon)
- Estrutura de API Routes
- Componentes Shadcn/ui

#### Monitoramento de Talhões
- CRUD completo de talhões
- Upload de geometria (KML/GeoJSON)
- Desenho de polígonos no mapa
- Geocodificação reversa automática
- Validação de geometrias

#### Integração Merx API
- Consulta NDVI (atual e histórico)
- Consulta precipitação
- Consulta solo
- Consulta área de lavoura
- Tratamento de erros e timeouts

#### Detecção de Fenologia
- Identificação de SOS (emergência)
- Identificação de EOS (colheita)
- Identificação de Peak (pico NDVI)
- Detecção de replantio
- Cálculo de dias de ciclo
- Score de confiança

#### Sistema de Templates
- Template de Crédito
- Template de Logística
- Template de Matriz de Risco
- Integração com Gemini AI para análises

#### Relatórios
- Página de relatório detalhado por talhão
- Cards de métricas
- Gráfico NDVI base
- Componente de reprocessamento

### Documentação
- produto.md - Visão do produto
- melhorias.md - Análise de melhorias
- IMPLEMENTACAO.md - Plano de implementação
- logic.md - Melhorias de lógica
- METHODOLOGY.md - Metodologias técnicas
- DIAGNOSTICOLOG.md - Especificação módulo logístico

---

## Legenda

- **Adicionado** - Novas funcionalidades
- **Alterado** - Mudanças em funcionalidades existentes
- **Depreciado** - Funcionalidades que serão removidas em breve
- **Removido** - Funcionalidades removidas
- **Corrigido** - Correções de bugs
- **Segurança** - Correções de vulnerabilidades
