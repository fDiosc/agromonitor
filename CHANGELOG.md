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

## [0.0.31] - 2026-02-11

### Dashboard Avançado: Tabela Ordenável e Filtros Expandidos

Redesign completo da tabela de monitoramento do dashboard com colunas individuais ordenáveis, filtros avançados de fenologia e IA, e correção da exibição de dados de validação visual.

**Tabela Ordenável (13 colunas)**:
- Cada dado agora é uma coluna independente: Status, Talhão, Área, Volume, Emergência, Colheita, Confiança, IA, EOS IA, Pronta, Conf. IA, Caixa Log., Ações
- Clique em qualquer cabeçalho para ordenar (asc/desc)
- Ordenação padrão: colheita prevista mais próxima primeiro
- Valores nulos sempre aparecem no final, independente da direção
- Scroll horizontal para telas menores com `min-w-[1200px]`

**Filtros Avançados** (novo layout em 2 linhas):
- Linha 1: Status, Tipo de atribuição, Caixa logística (existentes, otimizados)
- Linha 2 (novos):
  - **Janela de Colheita**: Passada, 30 dias, 60 dias, 90 dias, Sem data
  - **Confiança Modelo**: Alta (>75%), Média (40-75%), Baixa (<40%), Sem dado
  - **Validação IA**: Com IA, Sem IA
  - **Resultado IA**: Confirmado, Questionado, Rejeitado

**Correção: Dados de IA não apareciam no dashboard** (`app/api/fields/route.ts`):
- Campos `aiValidationResult` e `aiValidationAgreement` estavam com uso invertido na API
- `aiValidationResult` armazena o agreement ("CONFIRMED"/"QUESTIONED"/"REJECTED")
- `aiValidationAgreement` armazena JSON detalhado (harvestReadiness, etc.)
- API agora lê corretamente de cada campo e extrai `harvestReady` do JSON certo

**Otimização de API** (`app/api/fields/route.ts`):
- Processamento server-side de `rawAreaData` → retorna apenas `fusedEosDate` (string)
- Processamento server-side de `aiValidationAgreement` JSON → retorna apenas `harvestReady` (boolean)
- Evita envio de blobs JSON grandes para o client em cada polling

**Card de Validação IA atualizado** (`reports/[id]/page.tsx`):
- Adicionados sensores faltantes nos feature pills: Landsat 8/9, Sentinel-3 OLCI
- Total de 6 fontes de dados exibidas: Sentinel-2, Sentinel-1 SAR, Landsat 8/9, Sentinel-3 OLCI, NDVI Colorizado, Gemini Vision

---

## [0.0.30] - 2026-02-11

### Correção do Pipeline de Dados EOS (Single Source of Truth)

Correção crítica do fluxo de dados de fusão EOS que eliminava divergências entre componentes do sistema. Todas as datas de colheita agora convergem para um único valor canônico calculado no servidor.

**Bug 1 - Fusão EOS com fallback incorreto** (`eos-fusion.service.ts`):
- Quando GDD atingia 100% e a data NDVI já estava no passado, o sistema defaultava para "hoje", criando uma data de colheita móvel
- **Fix**: Agora usa a data real de EOS (NDVI ou média ponderada com GDD) mesmo quando no passado
- Adicionado campo `passed: boolean` ao resultado de fusão indicando se a colheita já ocorreu

**Bug 2 - GDD sem data de maturação** (`thermal.service.ts`):
- Quando GDD acumulado atingia 100%, `projectedEos` ficava como `null`, impedindo uso pelo serviço de fusão
- **Fix**: Implementado backtracking na série temporal para encontrar a data exata em que 100% do GDD foi atingido

**Bug 3 - Mapeamento de stress hídrico PT→EN** (`process/route.ts`):
- `water-balance.service` retornava `stressLevel` em português ('CRITICO') mas `eos-fusion.service` esperava inglês ('CRITICAL')
- **Fix**: Adicionado mapeamento explícito PT→EN antes de passar para a fusão

**Bug 4 - `stressDays` inexistente** (`process/route.ts`):
- `eosAdjustment?.stressDays` era `undefined` pois `stressDays` vive em `WaterBalanceResult.data`, não em `EosAdjustment`
- **Fix**: Extraído corretamente de `waterBalanceResult.data.stressDays`

**Bug 5 - Divergência cliente/servidor na fusão** (`reports/[id]/page.tsx`):
- O relatório recalculava a fusão EOS no client-side com inputs derivados diferentemente do servidor
- **Fix**: Client agora prioriza `fusedEos` do servidor (API), usando cálculo local apenas para tooltip detalhado

**Bug 6 - API de talhão usa EOS bruto** (`fields/[id]/route.ts`):
- `harvestWindowInfo` e `chartOverlayData` usavam `agroData.eosDate` (NDVI puro) em vez do fusionado
- **Fix**: Introduzido `bestEosDate` que prioriza `rawAreaData.fusedEos.date`; API agora retorna `fusedEos` no response

**Bug 7 - Schema do Juiz IA desalinhado** (`judge-prompt.ts`, `AIValidationPanel.tsx`):
- Prompt usava `isReady`/`overall` (PT) mas panel esperava `ready`/`overallRisk` (EN)
- `riskAssessment` não tinha array `factors`, apenas strings soltas
- **Fix**: Schema atualizado para `ready`, `overallRisk`, `factors[]`; normalização bidirecional no panel e no service

**Bug 8 - Critérios de decisão vagos do Juiz** (`judge-prompt.ts`):
- Juiz não tinha critérios quantitativos para decidir CONFIRMED/QUESTIONED/REJECTED
- **Fix**: Adicionados critérios explícitos (divergência <7d = CONFIRMED, 7-14d = QUESTIONED, >14d = REJECTED)

**Normalização de Dados**:
- `ai-validation.service.ts`: Pós-processamento normaliza output do Juiz (PT→EN, old→new schema)
- `AIValidationPanel.tsx`: Aceita tanto schema antigo quanto novo, com mapeamento graceful
- `judge.ts`: Parsing resiliente com fallbacks para campos antigos

---

## [0.0.29] - 2026-02-11

### Validação Visual IA (Pipeline Completo)

Nova funcionalidade de validação visual por IA multimodal que analisa imagens de satélite para confirmar ou questionar as projeções algorítmicas de fenologia.

**Arquitetura de Agentes (Fase 1 + 2)**:
- Agente Curador: seleciona e pontua as melhores imagens de satélite
- Agente Juiz: valida projeções algorítmicas usando visão computacional
- Serviço orquestrador (`ai-validation.service.ts`) coordena o pipeline completo
- Busca automática de imagens via Sentinel Hub Process API
- Suporte multi-sensor: Sentinel-2, Sentinel-1 (radar), Landsat, Sentinel-3
- Adaptado para SDK `@google/genai` (Gemini 3 Flash Preview + 2.5 Flash Lite)

**Integração no Processamento (Fase 3)**:
- Bloco de validação visual no `process/route.ts` com feature flag guard
- Três modos de trigger: MANUAL, ON_PROCESS (automático), ON_LOW_CONFIDENCE (<50%)
- Resultados persistidos no AgroData (concordância, alertas visuais, custo)
- Graceful degradation: falhas na IA não impactam o processamento existente

**Enriquecimento de Templates (Fase 4)**:
- `AnalysisContext` expandido com dados de validação visual
- Templates Logística, Crédito e Matriz de Risco recebem dados de concordância IA
- Template de análise registra se validação visual foi usada (`aiValidationUsed`)

**Interface de Configuração (Fase 5)**:
- **Settings > Módulos**: Toggle para habilitar/desabilitar validação visual IA
  - Selector de trigger (Manual / Automático / Baixa confiança)
  - Selector de modelo do Curador (Flash Lite vs Flash Preview)
- **Settings > Visualizações**: Toggle para mostrar/esconder painel no relatório
- **Relatório**: Novo painel "Validação Visual IA" com:
  - Badge de concordância (Confirmado / Questionado / Rejeitado)
  - Métricas: confiança IA, estágio fenológico, EOS ajustado, colheita
  - Fatores de risco visuais e alertas detalhados
  - Recomendações do agente Juiz

**Schema (Prisma)**:
- `WorkspaceSettings`: `enableAIValidation`, `aiValidationTrigger`, `aiCuratorModel`, `showAIValidation`
- `AgroData`: 8 campos opcionais para resultados da validação
- `Analysis`: `aiValidationUsed`, `aiValidationAgreement`

---

## [0.0.28] - 2026-02-06

### Gestão Avançada de Talhões

Nova funcionalidade de edição de talhões com opções de renomear e migrar entre produtores.

**Renomear Talhão**:
- Botão de edição (lápis) disponível na listagem de talhões
- Modal intuitivo para alterar nome do talhão
- Validação de nome obrigatório

**Migrar Talhão para Outro Produtor**:
- Seletor dropdown com todos os produtores do workspace
- Aviso visual quando produtor será alterado: "O talhão será migrado para outro produtor"
- Opção de desvincular talhão de qualquer produtor

**Alterar Caixa Logística**:
- Atribuição manual de caixa logística por talhão
- Override da atribuição automática por raio

**Acesso**:
- Aba Produtores: expandir produtor → botão de edição no talhão
- Aba Gerenciar Talhões: botão de edição em cada linha da tabela

---

## [0.0.27] - 2026-02-06

### Redesign do Modal de Processamento

Reformulação completa do modal de processamento com design moderno e profissional.

**Visual Moderno**:
- Header com gradiente emerald/teal (cores da marca MERX)
- Padrões decorativos de fundo para visual premium
- Ícone de satélite com backdrop blur e animação suave
- Badge destacado mostrando tempo decorrido

**Indicadores de Progresso Aprimorados**:
- Barra de progresso com contador "X de Y etapas"
- Etapa atual exibida no header
- Cards de etapas com bordas coloridas por status
- Ícones circulares numerados (pendente) ou com símbolo (completo/erro)

**Animações e Interações**:
- Entrada com fade-in e zoom suave
- Animação de bounce (3 pontos) para etapa em execução
- Transições suaves entre estados
- Backdrop clicável para voltar ao dashboard

**UX Melhorado**:
- Botão "Voltar para Dashboard" escuro e destacado
- Scroll automático se houver muitas etapas
- Mensagem clara sobre processamento em background

**Técnico**:
- Componente refatorado em `contexts/processing-context.tsx`
- Função `getStepStyles()` para estilos dinâmicos por status
- Animações CSS nativas (sem dependências)

---

## [0.0.26] - 2026-02-04

### UX de Processamento e Performance

Reestruturação completa da experiência de processamento de talhões com foco em não bloquear a navegação do usuário.

**Modal de Processamento Contextual**:
- Modal com overlay aparece APENAS dentro da página do talhão (`/reports/[id]`)
- Dashboard mostra status "Processando" com spinner no card do talhão
- Usuário pode fechar o modal e sair da página - processamento continua em background
- Se voltar ao talhão em processamento, modal reaparece

**Bloqueio Inteligente**:
- Botão "Ver" no dashboard fica desabilitado durante processamento
- Impede acesso a relatório antes dos dados estarem prontos
- Botão de reprocessar fica desabilitado enquanto processando

**Endpoint de Status Leve**:
- Novo `GET /api/fields/[id]/status` retorna apenas: id, status, errorMessage, updatedAt
- Usado no polling durante processamento
- Evita recálculo de análises a cada verificação de status
- Reduz carga de CPU e tempo de resposta

**Correção de Loops de Re-renderização**:
- Fixed `useEffect` dependencies que causavam múltiplas chamadas
- Polling só é acionado quando necessário
- Cleanup adequado de intervals ao desmontar componentes

**Técnico**:
- Removido overlay global do `ProcessingProvider`
- `ProcessingModal` exportado como componente para uso local
- Dashboard não depende mais do `useProcessing` context
- Polling usa endpoint leve em vez de buscar dados completos

---

## [0.0.25] - 2026-02-04

### [BETA] Fusão Adaptativa SAR-NDVI (Machine Learning Avançado)

Implementação de técnica avançada de fusão de dados que combina NDVI óptico (Sentinel-2) com radar SAR (Sentinel-1) usando modelos de Machine Learning adaptativos.

**Arquitetura Adaptativa**:
- Seleção automática de features SAR por talhão (VH, VV, ou VV+VH)
- Escolha de melhor modelo via Leave-One-Out Cross-Validation
- Três modelos disponíveis: GPR, KNN, Regressão Linear (fallback)

**Seleção de Features**:
- VH priorizado se correlação com NDVI > 70%
- VV usado se correlação supera VH em 15%+
- VV+VH combinado como fallback robusto

**Modelos de ML**:
- **Gaussian Process Regression (GPR)**: Predições com estimativa de incerteza
- **K-Nearest Neighbors (KNN)**: Robusto a outliers (k=3)
- **Linear Regression**: Fallback simples, sempre disponível

**Ajuste de Confiança**:
- Score de confiança de colheita ajustado baseado em fonte de dados
- ≤30% SAR: ajuste mínimo (0% a -5%)
- 30-60% SAR: ajuste moderado (-5% a -15%)
- >60% SAR: ajuste significativo (-15% a -25%)
- `confidenceNote` adicionada aos dados indicando fonte

**Fallback Gracioso**:
- Sistema funciona normalmente se feature desabilitada
- Em caso de erro, reverte para fusão RVI clássica
- Em caso de dados insuficientes, usa NDVI óptico puro

**Nova Feature Flag**:
- `enableSarNdviFusion`: Toggle BETA em WorkspaceSettings
- Sub-opção de `useRadarForGaps`
- Badge BETA com explicação detalhada na UI

**UI de Settings**:
- Novo toggle "Fusão Adaptativa SAR-NDVI" com badge BETA
- Caixa informativa amarela explicando funcionalidade BETA
- Descrição técnica do funcionamento

**Técnico**:
- Novo serviço `lib/services/sar-ndvi-adaptive.service.ts`
- Funções: `fuseSarNdvi`, `isSarFusionEnabled`, `calculateHarvestConfidence`
- Calibração persistida em `agroData.rawAreaData.sarCalibration`
- Integração no `process/route.ts` com try-catch para fallback

**Documentação**:
- Nova seção 4.4 no METHODOLOGY.md
- Diagramas de arquitetura e fluxo
- Tabelas de ajuste de confiança
- Estratégia de fallback documentada

---

## [0.0.24] - 2026-01-29

### Calibração Local RVI-NDVI (Machine Learning Hyperlocal)

Implementação de calibração local para conversão RVI→NDVI baseada em metodologia científica SNAF.

**Base Científica**:
- Pelta et al. (2022) "SNAF: Sentinel-1 to NDVI for Agricultural Fields Using Hyperlocal Dynamic Machine Learning Approach" - Remote Sensing, 14(11), 2600
- Metodologia alcança RMSE 0.06 e R² 0.92 com modelos específicos por talhão

**Coleta Automática de Pares NDVI-RVI**:
- Durante processamento, identifica datas coincidentes (±1 dia) entre NDVI óptico e RVI radar
- Salva pares na nova tabela `RviNdviPair` para treinamento futuro
- Filtra por qualidade (cloudCover < 50%, NDVI > 0, RVI > 0)

**Treinamento de Modelo Local**:
- Quando ≥15 pares disponíveis, treina regressão linear OLS por talhão
- Calcula coeficientes a, b, R² e RMSE
- Modelo só é usado se R² ≥ 0.5 (validação de qualidade)
- Salva calibração na nova tabela `RviNdviCalibration`

**Cascade de 3 Níveis (Fallback)**:
1. Calibração Local (se `useLocalCalibration=true` e modelo existe com R²≥0.5)
2. Coeficientes Fixos da Literatura (Filgueiras et al., Veloso et al.)
3. NDVI Óptico puro (se radar desabilitado ou indisponível)

**Nova Feature Flag**:
- `useLocalCalibration`: Toggle para habilitar/desabilitar treinamento local
- Sub-opção de `useRadarForGaps` (só aparece quando radar habilitado)
- Permite controle de processamento (desabilitar reduz carga computacional)

**UI de Settings**:
- Novo toggle "Calibração Local (Machine Learning)" na aba Cálculos
- Badge "Novo" indicando feature recente
- Descrição explicando funcionamento e requisitos

**Técnico**:
- Novo serviço `lib/services/rvi-calibration.service.ts`
- Novos modelos Prisma: `RviNdviCalibration`, `RviNdviPair`
- Integração no `process/route.ts` para coleta e treinamento automático
- `FusionResult` agora inclui `calibrationR2` quando modelo local é usado

---

## [0.0.23] - 2026-02-04

### Integração Completa Sentinel-1 (Radar)

Implementação completa da integração Sentinel-1 conforme Metodologia V2.

**Statistical API do Copernicus**:
- Substituída Process API por Statistical API para obter valores VH/VV
- Cálculo de RVI real (não mais placeholder 0.5)
- Conversão para dB e cálculo correto do índice de vegetação radar

**Fusão NDVI Óptico + Radar**:
- Serviço de fusão conectado ao pipeline de processamento
- Gaps no NDVI óptico preenchidos automaticamente com estimativas de radar
- Métricas de fusão salvas em `rawAreaData.fusionMetrics`

**Boost de Confiança (Base Científica)**:
- Confiança aumentada baseada em literatura:
  - Planet Fusion (2021): Série contínua +10%
  - MDPI 2024: Gaps preenchidos por radar +8%
  - Radar em fase de senescência: +5% adicional
- Detalhes do boost exibidos nos fatores da previsão

**Visualização no Gráfico NDVI**:
- Overlay de radar (linha roxa pontilhada) quando `showRadarOverlay` habilitado
- Conversão RVI→NDVI por cultura (SOJA, MILHO, ALGODAO)
- Legenda atualizada com indicador "Radar (Sentinel-1)"

**Feature Flags**:
- `enableRadarNdvi`: Buscar dados Sentinel-1 (já existia)
- `useRadarForGaps`: Executar fusão para preencher gaps
- `showRadarOverlay`: Exibir overlay de radar no gráfico

---

## [0.0.22] - 2026-02-04

### Correções de Exibição de Dados

**Precipitação - "Últimos 10 dias"**:
- Corrigido bug que fazia o valor não aparecer na UI
- O `harvestAdjustment` agora é sempre calculado (antes dependia de feature flag)
- Métricas como `recentPrecipMm` e `grainQualityRisk` agora sempre disponíveis

**Sentinel-1 "Não integrado" corrigido**:
- Card de satélite agora mostra data do último dado de radar
- Parsing dos dados de radar adicionado na página de relatório
- Próxima passagem S1 calculada com base na última cena Sentinel-1

---

## [0.0.21] - 2026-02-04

### Gráfico de Precipitação Aprimorado e Sentinel-1

**Gráfico de Precipitação**:
- Corrigido cálculo de "Últimos 10 dias" que mostrava 0mm incorretamente
- Agora calcula os 10 dias até hoje (se colheita é futura) ou até a colheita
- Adicionada linha de precipitação acumulada desde emergência (SOS)
- Adicionadas linhas pontilhadas de Plantio e Emergência (similar ao NDVI)
- Segundo eixo Y para visualização do acumulado

**Integração Sentinel-1**:
- Adicionada chamada ao serviço Sentinel-1 no processamento de talhões
- Dados de radar agora são salvos em `rawAreaData.radar`
- Verificação de credenciais Copernicus funcionando corretamente

---

## [0.0.20] - 2026-02-04

### Parsing Robusto de APIs Merx

**Correção Crítica - APIs não reconheciam dados**:
- API Merx retorna dados com key dinâmica (nome do talhão, ex: "Talhão 24")
- Código esperava keys fixas (`talhao_0`, `fazenda_1`)
- Resultado: dados existiam mas eram tratados como indisponíveis

**Solução**:
- Nova função `extractApiDataArray()` aplicada em todos os serviços
- Busca primeiro arrays conhecidos (`talhao_0`, `fazenda_1`, etc.)
- Se não encontrar, busca qualquer array não-vazio na resposta
- Logs identificam quando key dinâmica é usada

**Serviços Corrigidos**:
- `thermal.service.ts` - Soma Térmica (GDD)
- `water-balance.service.ts` - Balanço Hídrico  
- `precipitation.service.ts` - Precipitação
- `climate-envelope.service.ts` - Envelope Climático Histórico

**Diagnóstico Identificado**:
- Balanço Hídrico 422 para região PR: limitação de cobertura geográfica da API Merx (não é bug)
- Temperatura para PR: funciona corretamente após correção

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
- README atualizado com nova seção "Fusão EOS" e tabela de serviços
- Tabela de documentação reorganizada com docs/METHODOLOGY-V2.md

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
