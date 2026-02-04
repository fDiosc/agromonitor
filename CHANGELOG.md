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

> **Nota**: Este changelog foi consolidado. Versões intermediárias com correções que foram posteriormente refinadas foram mescladas nas versões finais.

---

## [0.0.19] - 2026-02-04

### Fusão de EOS e Melhorias de Precisão

**Algoritmo de Fusão EOS (NDVI + GDD + Balanço Hídrico)**:
- Novo serviço `eos-fusion.service.ts` baseado em metodologias científicas (PhenoCrop, Kumudini, Mourtzinis, Desclaux)
- Combina projeções NDVI histórico, Soma Térmica (GDD) e ajuste por estresse hídrico
- Detecta inconsistências (ex: EOS NDVI passou mas planta ainda verde) e ajusta automaticamente
- Estresse hídrico acelera senescência (-2 a -7 dias conforme severidade)
- Determina estágio fenológico atual (Vegetativo, Reprodutivo, Enchimento, Senescência, Maturação)

**Tooltip de Confiança no EOS**:
- Badge interativo mostrando método usado (NDVI, GDD, Fusão)
- Nível de confiança (Alta/Média/Baixa) com cores
- Tooltip detalhado com explicação, fatores e projeções individuais
- Comparativo NDVI vs GDD com status de cada projeção
- Alertas quando há divergências ou ajustes

**Linha de Colheita no Gráfico NDVI**:
- Linha de "Início Colheita" agora usa data da fusão EOS (mais precisa)
- Prioriza `eosFusion.eos` sobre dados antigos do banco

**Confiança do Modelo Unificada**:
- Card "Confiança Modelo" agora usa confiança da fusão EOS quando disponível
- Fallback para confiança NDVI quando não há fusão

**Correções**:
- Bug do "0" ao lado da badge de Risco Qualidade (condição `0 && x > 0` renderizava "0")
- Removidos console.logs de debug

**Documentação**:
- Nova seção 4.5 na Metodologia V2: Fusão de EOS
- Referências científicas atualizadas (Sakamoto 2020, Kumudini 2021, Mourtzinis 2017, Desclaux 2003)
- Thresholds de NDVI e algoritmo de seleção documentados

---

## [0.0.18] - 2026-02-03

### Gestão de Usuários e Estabilidade

**Gestão de Usuários Aprimorada**:
- SUPER_ADMIN pode criar usuários em qualquer workspace
- Seletor de workspace no formulário de criação de usuário
- SUPER_ADMIN pode criar outros SUPER_ADMINs
- Validação de limites de usuários por workspace

**Estabilidade de Processamento**:
- Reprocessamento com polling assíncrono (fire and forget)
- Suporte a processamentos de até 6 minutos
- Verificação de status a cada 10 segundos
- Feedback correto quando processamento termina

**Técnico**:
- API `/api/admin/users` aceita `workspaceId` para SUPER_ADMIN
- Frontend usa polling em vez de aguardar resposta HTTP

---

## [0.0.17] - 2026-02-03

### Filtros e Gestão de Talhões

**Visualização de Produtores**:
- Clique em um produtor para expandir e ver todos os talhões vinculados
- Informações exibidas: nome, localização, área, volume, status
- Link direto para relatório de cada talhão

**Filtros Avançados no Dashboard**:
- Filtro por status: Todos, Processado, Processando, Pendente, Erro
- Filtro por caixa logística: Todas, Sem atribuição, ou caixa específica
- Filtro por tipo de atribuição: Manual, Produtor, Automático, Sem
- Contador de talhões filtrados

**Gerenciar Talhões**:
- Cards de estatísticas agora são clicáveis (funcionam como filtros)
- Título dinâmico baseado no filtro ativo
- Contador "X de Y talhões"

**Badges de Atribuição**:
- Layout compacto em única linha: `[M] Nome da Caixa`
- **M** (azul) = Manual/Direta
- **P** (roxo) = Herdada do Produtor
- **A** (verde) = Automática por raio
- **!** (vermelho) = Sem cobertura

**Correções**:
- Glitch na sidebar: seleção duplicada ao navegar entre rotas similares
- Filtro de caixas logísticas respeita atribuições manuais (não mostra em outras caixas)
- Tabela de cobertura com colunas fixas e textos truncados

---

## [0.0.16] - 2026-02-03

### Distâncias Persistentes e UX Simplificada

**Persistência de Distâncias no Banco de Dados**:
- Novo modelo `FieldLogisticsDistance` para armazenar distâncias calculadas
- Distâncias entre talhões e caixas logísticas agora são persistidas
- Performance melhorada: leitura do banco vs cálculo on-demand

**Processamento Automático**:
- Ao criar/editar uma caixa logística, calcula distâncias para todos os talhões
- Ao criar um talhão, calcula distâncias para todas as caixas logísticas
- Processamento assíncrono não bloqueia a resposta da API

**Reprocessamento Manual**:
- Botão na página de configurações para reprocessar todas as distâncias
- Útil ao mudar método de cálculo (linha reta → rodoviário)
- Feedback visual do resultado (talhões e distâncias processadas)

**UX Simplificada - Diagnóstico Logístico**:
- Seletor de caixas logísticas integrado no header do Overview
- Ao selecionar caixas, filtra todos os dados (talhões, volumes, gráficos)
- Removida aba "Unidade de Recebimento" (redundante com Overview filtrado)
- Link direto para gerenciar caixas logísticas

**Técnico**:
- Novo serviço `logistics-distance.service.ts`
- Endpoint `POST /api/logistics-units/reprocess`
- APIs de cobertura e diagnóstico lêem dados persistidos do banco

---

## [0.0.15] - 2026-02-03

### Caixas Logísticas (Unidades de Recebimento)

**Novo Módulo de Caixas Logísticas**:
- Cadastro de caixas logísticas (armazéns) com coordenadas e endereço
- Raio de cobertura configurável (em km) para cada caixa
- Mapa interativo com visualização de cobertura e interseções
- Identificação automática de talhões em múltiplas áreas de cobertura

**Integração com Diagnóstico Logístico**:
- Aba "Unidade de Recebimento" agora funcional
- Filtro por uma ou mais caixas logísticas
- Estatísticas agregadas por caixa (volume, talhões, carretas)
- Comparativo entre caixas selecionadas

**Atribuição de Talhões a Caixas**:
- Atribuição automática: talhão vai para caixa mais próxima dentro do raio
- Atribuição herdada: talhão herda caixa padrão do produtor
- Atribuição direta: override manual no cadastro do talhão
- Indicador visual de interseções (talhão em múltiplos raios)

**Configurações do Workspace**:
- Nova página de configurações (`/settings`)
- Toggle para método de cálculo de distância:
  - Linha reta (Haversine) - padrão
  - Distância rodoviária (Google Maps) - requer API key

**Técnico**:
- Novo modelo `LogisticsUnit` no Prisma
- Serviço de cálculo de distância (`distance.service.ts`)
- API `/api/logistics-units` com CRUD completo
- API `/api/logistics-units/coverage` para relatório de cobertura
- API `/api/logistics/diagnostic` aceita filtro `logisticsUnitIds`

---

## [0.0.14] - 2026-01-30

### Análise Híbrida e IA Aprimorada

**Arquitetura Híbrida** - Separação clara entre cálculos algorítmicos e análise por IA:

| Tipo | Métricas | Fonte |
|------|----------|-------|
| **Algorítmico** | Início/Fim Colheita, Pico, Volume Diário, Carretas | Fórmulas determinísticas |
| **IA Qualitativa** | Risco Clima, Risco Qualidade, Recomendações | Gemini 3 Flash Preview |

**Melhorias de UX**:
- Tooltips explicando cálculo de cada métrica (ícone ℹ️)
- Badge "Análise por IA" apenas na seção qualitativa
- Reprocessamento com atualização automática (polling a cada 2s)
- Correção de timezone nas datas (EOS, Plantio)

**Técnico**:
- Modelo IA: `gemini-3-flash-preview`
- Queue chama `runAnalysis()` diretamente (bypass HTTP)
- Limite de 30 tentativas no polling (1 minuto)

---

## [0.0.10] - 2026-01-30

### ZARC e Reprocessamento Automático

**ZARC (Zoneamento Agrícola de Risco Climático)**:
- Janela de plantio por cultura e região (dados oficiais MAPA)
- Indicador visual: Janela Ideal / Risco Moderado / Risco Alto
- Integrado ao card de Plantio Estimado

**Reprocessamento Automático**:
- Análises reprocessam automaticamente ao atualizar talhão
- Sistema de fila com 3 tentativas e backoff exponencial
- Indicadores visuais: "Atualizado", "Na fila", "Processando", "Falhou"
- Botão de reprocessar manual para análises com falha

**Alinhamento Histórico**:
- Históricos alinhados por calendário agrícola (mesmo mês/dia)
- Linhas históricas estendidas até EOS (decaimento exponencial)

---

## [0.0.8] - 2026-01-30

### Diagnóstico Logístico Avançado

**Abas**:
- **Overview**: Visão consolidada de todos os talhões
- **Produtor**: Filtro por produtor(es) com recálculo dinâmico
- **Unidade de Recebimento**: Em desenvolvimento

**Disclaimer Alpha**:
- Modal obrigatório no primeiro login
- 7 termos cobrindo: bugs, verificação de dados, disponibilidade, persistência

**Deploy**:
- CapRover configurado com Dockerfile Node 20
- Endpoint `/api/health` para monitoramento

---

## [0.0.7] - 2026-01-29

### Projeção Adaptativa por Fase Fenológica

**Detecção de Fase** (regressão linear últimos 14 dias):
- **Vegetativo** (slope > 0.5%/dia): 60% tendência + 40% histórico
- **Reprodutivo** (|slope| < 0.5%/dia): Usa histórico
- **Senescência** (slope < -0.5%/dia): Decaimento exponencial

**EOS Dinâmico**:
- Colheita calculada por tendência real de senescência
- Critérios: slope < -1%/dia, R² > 70%, NDVI < 85% do pico

**Limites Biológicos**:
- NDVI máximo: 0.92 (platô vegetativo)
- NDVI mínimo: 0.18 (solo/palha residual)

---

## [0.0.5] - 2026-01-29

### Multi-tenancy Completo

**Workspaces**:
- Isolamento completo de dados por empresa
- Limites configuráveis (usuários e talhões)
- Ativação/desativação de workspaces

**Autenticação**:
- Login com JWT
- Primeiro acesso com senha temporária
- Interface com sidebar

**Hierarquia de Permissões**:
- `SUPER_ADMIN` → `ADMIN` → `OPERATOR`

**Produtores e Culturas**:
- Cadastro de produtores (nome, CPF opcional)
- Culturas: Soja e Milho com thresholds específicos
- Data de plantio informada (+25 pontos confiança)

---

## [0.0.3] - 2026-01-29

### Diagnóstico Logístico

**Módulo Novo** (`/dashboard/logistics`):
- Cards de métricas agregadas (talhões, área, volume, carretas)
- Curva de recebimento (bell curve)
- Timeline de janela de colheita
- Mapa interativo com propriedades

**Status Parcial**:
- Status `PARTIAL` para dados incompletos
- Badge amarelo com hover para detalhes

---

## [0.0.1] - 2026-01-27

### MVP Inicial

**Infraestrutura**:
- Next.js 14 com App Router
- Prisma ORM + PostgreSQL (Neon)
- Componentes Shadcn/ui

**Monitoramento de Talhões**:
- Cadastro com desenho no mapa ou upload KML/GeoJSON
- Geocodificação reversa automática

**Integração Merx API**:
- NDVI (atual e histórico 3 safras)
- Precipitação, solo, área cultivada

**Detecção de Fenologia**:
- SOS, EOS, Peak, Replantio
- Score de confiança

**Templates de Análise com IA**:
- Crédito (risco de garantias)
- Logística (planejamento de colheita)
- Matriz de Risco (visão 360°)

---

## Legenda

- **Adicionado** - Novas funcionalidades
- **Alterado** - Mudanças em funcionalidades existentes
- **Corrigido** - Correções de bugs
- **Técnico** - Detalhes de implementação
