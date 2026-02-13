# Guia de Revisão Periódica de Codebase e Documentação

## Introdução

Este documento serve como um **prompt estruturado** para orientar um modelo de IA (vibe coder) a executar uma revisão completa da codebase e documentação do projeto Merx Agro MVP.

### Por que revisar periodicamente?

Projetos de software em desenvolvimento ativo acumulam **dívida de documentação** naturalmente: novas features são implementadas sem atualizar docs existentes, arquivos de planejamento ficam obsoletos após implementação, referências cruzadas quebram, e citações científicas podem ficar desatualizadas. Sem revisões periódicas:

1. **Novos desenvolvedores** perdem tempo tentando distinguir documentação atual de obsoleta
2. **Decisões técnicas** são tomadas com base em informações desatualizadas
3. **Duplicação** cresce silenciosamente, criando fontes conflitantes de verdade
4. **Referências científicas** podem não refletir o estado atual dos algoritmos implementados
5. **Links internos** quebram à medida que arquivos são movidos ou renomeados

**Frequência recomendada:** A cada 5-10 versões significativas, ou quando houver mudança arquitetural relevante.

**Última revisão:** v0.0.36 (2026-02-13)

---

## Prompt de Revisão

> Cole o prompt abaixo em uma conversa com o assistente de IA, adaptando a versão e contexto conforme necessário.

---

### PROMPT

```
Preciso que você execute uma revisão completa da codebase e documentação deste projeto.
O projeto é o Merx Agro MVP — uma plataforma de monitoramento agronômico por satélite.

Siga os passos abaixo em ordem, usando agentes em paralelo quando possível para maximizar eficiência.

---

FASE 1: INVENTÁRIO E COMPREENSÃO DO CÓDIGO

1.1. Leia o README.md na raiz do projeto para entender a visão geral.
1.2. Leia o docs/DOCS.md para entender a estrutura atual da documentação.
1.3. Liste todos os arquivos .md do projeto (raiz + docs/ + docs/archive/).
1.4. Leia os seguintes arquivos de código-fonte para entender o estado atual:
     - prisma/schema.prisma (modelos, enums, fields)
     - lib/version.ts (versão atual e changelog)
     - middleware.ts (autenticação e rotas)
     - .env.local (variáveis — apenas nomes, sem expor valores sensíveis)
     - package.json (dependências e scripts)
1.5. Liste todos os diretórios em app/api/ para mapear as rotas da API.
1.6. Liste todos os arquivos em lib/services/ para mapear os serviços.
1.7. Liste todos os arquivos em lib/agents/ para mapear os agentes IA.
1.8. Liste todos os arquivos em lib/templates/ para mapear os templates de análise.
1.9. Liste todos os arquivos em scripts/ para mapear scripts utilitários.

---

FASE 2: VERIFICAÇÃO DE DOCUMENTAÇÃO vs CÓDIGO

Para cada documento ativo em docs/, verifique:

2.1. ARCHITECTURE.md
     - Diagrama de camadas reflete os serviços e agentes atuais?
     - Tabelas de serviços, agentes e modelos estão completas?
     - Fluxos (processamento, validação visual, EOS, logística) estão corretos?
     - Integrações externas estão todas listadas?

2.2. METHODOLOGY.md
     - Thresholds documentados coincidem com o código-fonte?
       * phenology.service.ts → CROP_THRESHOLDS (seção 3)
       * crop-pattern.service.ts → CROP_PATTERN_THRESHOLDS (seção 13)
       * thermal.service.ts → CROP_GDD_REQUIREMENTS (seção 8)
       * eos-fusion.service.ts → NDVI_THRESHOLDS, GDD_THRESHOLDS (seção 10)
       * water-balance.service.ts → WATER_STRESS_THRESHOLDS (seção 10)
       * precipitation.service.ts → PRECIP_THRESHOLDS (seção 11)
     - Feature flags documentadas coincidem com WorkspaceSettings no schema?
     - Pipeline de agentes IA (Curador→Verificador→Juiz) está correto?
     - Templates de análise (Credit, Logistics, Risk Matrix) estão corretos?
     - Versão do documento corresponde à versão do código (lib/version.ts)?

2.3. Apisproject.md
     - Todas as rotas em app/api/ estão documentadas?
     - Parâmetros de request/response conferem com o código?
     - Integrações externas (Merx, Copernicus, Gemini) estão atualizadas?

2.4. DEPLOY.md
     - Variáveis de ambiente listadas conferem com .env.local e o código?

2.5. DIAGNOSTICOLOG.md
     - A interface e fluxo de dados descritos conferem com a implementação?

2.6. SCIENTIFIC-COMPLIANCE.md
     - Algoritmos listados ainda conferem com o código?
     - Algum novo algoritmo foi adicionado desde a última revisão?
     - Referências bibliográficas citadas no código conferem com o documento?

---

FASE 3: DETECÇÃO DE PROBLEMAS

3.1. Identificar DUPLICAÇÃO entre documentos (mesma informação em 2+ lugares)
3.2. Identificar INCONSISTÊNCIAS (informação diferente para o mesmo item)
3.3. Identificar DOCUMENTAÇÃO FALTANTE (features no código sem documentação)
3.4. Identificar LINKS QUEBRADOS (referências a arquivos movidos ou deletados)
3.5. Verificar se docs/archive/ contém apenas documentos realmente aposentados
3.6. Verificar se há algum documento que deveria estar em archive/ mas não está

---

FASE 4: CORREÇÕES

Para cada problema encontrado:

4.1. Corrigir inconsistências — o CÓDIGO é a fonte da verdade
4.2. Eliminar duplicações — manter a informação em UM lugar e referenciar
4.3. Documentar features faltantes
4.4. Corrigir links quebrados
4.5. Mover documentos obsoletos para docs/archive/
4.6. Atualizar docs/DOCS.md (índice) com a nova estrutura

---

FASE 5: COMPLIANCE CIENTÍFICA

5.1. Ler todos os serviços em lib/services/ que implementam algoritmos agronômicos
5.2. Para cada algoritmo, verificar:
     - A lógica implementada condiz com a documentação em METHODOLOGY.md?
     - As referências bibliográficas citadas no código são reais e corretas?
     - Os thresholds e constantes são embasados em literatura científica?
5.3. Pesquisar na web as referências citadas para confirmar sua existência e precisão
5.4. Atualizar docs/SCIENTIFIC-COMPLIANCE.md com os resultados

---

FASE 6: RELATÓRIO FINAL

Ao final, compile um relatório com:
- Número total de problemas encontrados (por categoria)
- Problemas corrigidos
- Recomendações de melhoria (priorizadas por impacto)
- Atualize a data da "Última revisão" neste arquivo (docs/revisao.md)

---

REGRAS GERAIS:

- NÃO crie novos arquivos desnecessariamente — prefira editar os existentes
- O CÓDIGO é a fonte da verdade, NUNCA a documentação
- Mantenha os documentos em português (BR)
- Preserve toda informação única — ao unificar, não perca conteúdo
- Ao mover arquivos, atualize TODAS as referências em TODOS os documentos
- README.md e CHANGELOG.md ficam na raiz; toda documentação técnica fica em docs/
- Documentos aposentados ficam em docs/archive/
```

---

## Estrutura Esperada dos Documentos

```
merx-agro-mvp/
├── README.md                          # Ponto de entrada (raiz)
├── CHANGELOG.md                       # Histórico de versões (raiz)
├── docs/
│   ├── DOCS.md                        # Índice de documentação
│   ├── ARCHITECTURE.md                # Arquitetura do sistema
│   ├── METHODOLOGY.md                 # Metodologia unificada
│   ├── DIAGNOSTICOLOG.md              # Módulo logístico
│   ├── DEPLOY.md                      # Guia de deploy
│   ├── Apisproject.md                 # APIs (externas + internas)
│   ├── SCIENTIFIC-COMPLIANCE.md       # Compliance científica
│   ├── REPORT-MERX-NDVI-GAP.md       # Relatório técnico NDVI
│   ├── revisao.md                     # Este documento
│   └── archive/                       # Documentos históricos
│       ├── METHODOLOGY-V2.md
│       ├── REFATORACAO1.md
│       ├── PLAN-AI-VISUAL-VALIDATION.md
│       ├── PLAN-HYBRID-ANALYSIS.md
│       ├── PLAN-REPROCESS-ANALYSIS.md
│       ├── PLAN-ZARC-ALIGNMENT.md
│       ├── IMPLEMENTACAO.md
│       ├── melhorias.md
│       ├── logic.md
│       └── produto.md
```

## Convenções

| Regra | Descrição |
|-------|-----------|
| Localização | Documentação técnica em `docs/`, apenas README e CHANGELOG na raiz |
| Aposentadoria | Documentos obsoletos vão para `docs/archive/` com nota de status |
| Fonte da verdade | Código-fonte sempre prevalece sobre documentação |
| Referências | Links relativos entre documentos; README usa `./docs/`, docs usam `./` entre si e `../` para raiz |
| Idioma | Português (BR) para documentação, inglês para código e comentários técnicos |
| Versionamento | Documentos refletem a versão do `lib/version.ts` |

## Checagem de Cobertura de Testes

### Como rodar os testes

```bash
# Rodar todos os testes
npm test

# Rodar em modo watch (re-executa ao salvar)
npm run test:watch

# Rodar com relatório de cobertura
npm run test:coverage
```

### Interpretando o relatório de cobertura

O comando `npm run test:coverage` gera uma tabela com 4 métricas por arquivo:

| Métrica | Significado |
|---------|-------------|
| **% Stmts** | Percentual de instruções (statements) executadas |
| **% Branch** | Percentual de ramificações (if/else/ternário) cobertas |
| **% Funcs** | Percentual de funções chamadas pelo menos 1 vez |
| **% Lines** | Percentual de linhas executadas |

**Meta mínima recomendada:** 70% Stmts e 60% Branch para serviços agronômicos.

### Estado atual da cobertura (v0.0.34 — 2026-02-13)

| Serviço | Stmts | Branch | Funcs | Lines | Observação |
|---------|-------|--------|-------|-------|------------|
| `phenology/` | 86.9% | 66.2% | 95.6% | 88.1% | Boa cobertura |
| `crop-pattern/` | 85.5% | 70.2% | 95.6% | 87.5% | Boa cobertura |
| `eos-fusion/` | 83.0% | 71.0% | 100% | 83.0% | Boa cobertura |
| `thermal.service.ts` | 48.2% | 32.5% | 43.7% | 49.0% | **Precisa mais testes** (maturation, backtracking) |
| `water-balance.service.ts` | 38.5% | 25.3% | 21.4% | 40.2% | **Precisa mais testes** (stress calculation, EOS adjust) |

**Total de testes:** 110 (6 suites)  
**Status:** Todos passando

### Serviços sem testes (precisam de cobertura)

Os seguintes serviços ainda não possuem suites de teste dedicadas:

| Serviço | Linhas | Prioridade | Motivo |
|---------|--------|------------|--------|
| `cycle-analysis/` | ~975 (split em 5 módulos) | **Alta** | Algoritmo complexo de detecção de ciclos, impacto direto no relatório |
| `sar-ndvi-adaptive/` | ~771 (split em 5 módulos) | **Alta** | Fusão SAR-NDVI, modelo de regressão crítico para qualidade de dados |
| `sentinel1/` | ~669 (split em 6 módulos) | Média | Integração com API externa — testar lógica de parsing e retry |
| `climate-envelope/` | ~625 (split em 3 módulos) | Média | Cálculos de envelope climático, comparação com ZARC |
| `rvi-calibration/` | ~501 (split em 4 módulos) | Média | Calibração RVI-NDVI, regressão linear/polinomial |
| `merx.service.ts` | ~350 | Média | Integração Merx — testar parsing de resposta e tratamento de erros |
| `ndvi-fusion.service.ts` | ~280 | Baixa | Consolidação de fontes NDVI |
| `ai-validation.service.ts` | ~250 | Baixa | Integração Gemini — mock da API, testar prompt engineering |
| `precipitation.service.ts` | ~200 | Baixa | Cálculo de precipitação, testar thresholds |

### Como adicionar novos testes

1. Crie o arquivo em `__tests__/services/<nome-servico>.test.ts`
2. Importe fixtures de `__tests__/fixtures/` (NDVI, temperatura, precipitação, geometria)
3. Use os helpers de `__tests__/helpers/test-utils.ts` para gerar dados
4. Siga o padrão dos testes existentes: `describe` por função, `it` por cenário
5. Rode `npm run test:coverage` para verificar impacto na cobertura

---

## Checagem de Arquivos para Refatoração

### Critérios de refatoração

| Faixa de linhas | Ação recomendada |
|-----------------|------------------|
| **> 500 linhas** | Refatoração **obrigatória** — dividir em subdirectory com módulos especializados |
| **300–500 linhas** | Avaliar necessidade — se tiver múltiplas responsabilidades, dividir |
| **< 300 linhas** | Geralmente OK — manter atômico |

### Como identificar arquivos grandes

Execute os comandos abaixo na raiz do projeto para listar arquivos que excedem os limites:

```powershell
# Listar serviços > 300 linhas (Windows PowerShell)
Get-ChildItem -Recurse -Include *.ts,*.tsx -Path lib/services | Where-Object {
  (Get-Content $_.FullName | Measure-Object -Line).Lines -gt 300
} | ForEach-Object {
  $lines = (Get-Content $_.FullName | Measure-Object -Line).Lines
  Write-Output "$lines`t$($_.FullName)"
} | Sort-Object -Descending

# Listar páginas UI > 300 linhas
Get-ChildItem -Recurse -Include *.tsx -Path app | Where-Object {
  (Get-Content $_.FullName | Measure-Object -Line).Lines -gt 300
} | ForEach-Object {
  $lines = (Get-Content $_.FullName | Measure-Object -Line).Lines
  Write-Output "$lines`t$($_.FullName)"
} | Sort-Object -Descending

# Listar componentes > 300 linhas
Get-ChildItem -Recurse -Include *.tsx -Path components | Where-Object {
  (Get-Content $_.FullName | Measure-Object -Line).Lines -gt 300
} | ForEach-Object {
  $lines = (Get-Content $_.FullName | Measure-Object -Line).Lines
  Write-Output "$lines`t$($_.FullName)"
} | Sort-Object -Descending
```

```bash
# Alternativa Linux/macOS (bash)
find lib/services app components -name "*.ts" -o -name "*.tsx" | \
  xargs wc -l | sort -rn | awk '$1 > 300'
```

### Arquivos já refatorados (v0.0.34)

Os seguintes arquivos foram refatorados com sucesso e servem como **referência de padrão**:

#### Serviços (padrão: subdirectory + barrel re-export)

| Serviço original | Antes | Depois (barrel) | Módulos criados |
|------------------|-------|-----------------|-----------------|
| `phenology.service.ts` | 574 | re-export | `phenology/{types,helpers,calculate}.ts` |
| `crop-pattern.service.ts` | 579 | re-export | `crop-pattern/{types,helpers,classify,analyze}.ts` |
| `eos-fusion.service.ts` | 513 | re-export | `eos-fusion/{types,helpers,calculate}.ts` |
| `cycle-analysis.service.ts` | 975 | re-export | `cycle-analysis/{types,helpers,detection,chart-data,historical-overlay-projection}.ts` |
| `sar-ndvi-adaptive.service.ts` | 771 | re-export | `sar-ndvi/{types,statistics,models,calibration,fusion}.ts` |
| `sentinel1.service.ts` | 669 | re-export | `sentinel1/{types,auth,helpers,statistics,api,process}.ts` |
| `climate-envelope.service.ts` | 625 | re-export | `climate-envelope/{types,api,analysis}.ts` |
| `rvi-calibration.service.ts` | 501 | re-export | `rvi-calibration/{types,math,data,calibration}.ts` |

#### Pipeline de processamento (padrão: orchestrator + steps)

| Arquivo original | Antes | Depois | Estrutura |
|------------------|-------|--------|-----------|
| `app/api/fields/[id]/process/route.ts` | 1248 | 99 | `lib/services/processing/{pipeline,types,steps/01..08,helpers/status}.ts` |

#### Páginas UI (padrão: componentes extraídos + hooks customizados)

| Página | Antes | Depois | Componentes/Hooks extraídos |
|--------|-------|--------|-----------------------------|
| `reports/[id]/page.tsx` | 1730 | ~315 | `AnalysisTabs`, `NdviChartCard`, `AIValidationSection` + `useReportData`, `useProcessingModal` |
| `settings/page.tsx` | 894 | ~223 | `FeatureToggle`, 4 tab components + `useWorkspaceSettings` |
| `fields/page.tsx` | 671 | ~384 | `FieldsStatsCards`, `FieldsCoverageRow`, `FieldsSearchFilters` |
| `page.tsx` (dashboard) | 605 | ~235 | `DashboardFilters` + `useDashboardFields` |
| `producers/page.tsx` | 593 | ~347 | `ProducerCard`, `ProducerFormModal` |
| `fields/new/page.tsx` | 514 | ~381 | `NewFieldFormFields`, `FieldSummaryCard` |
| `admin/users/page.tsx` | 477 | ~298 | `CreateUserModal`, `UserTableRow` |

### Arquivos que ainda podem precisar de atenção

> Execute os comandos acima periodicamente. Abaixo, os arquivos que na data desta revisão estavam próximos ou acima do limite de 300 linhas mas não foram refatorados por serem suficientemente coesos:

| Arquivo | Linhas (~) | Motivo de não refatorar | Ação futura |
|---------|------------|------------------------|-------------|
| `thermal.service.ts` | ~370 | Funções coesas, lógica GDD sequencial | Monitorar se crescer acima de 500 |
| `water-balance.service.ts` | ~330 | Cálculos encapsulados, poucas responsabilidades | Monitorar se crescer acima de 500 |
| `merx.service.ts` | ~350 | Integração HTTP com parsing — coesa | Monitorar se crescer acima de 500 |
| `fields/new/page.tsx` | ~381 | Formulário com validação inline — difícil separar sem perder contexto | Considerar hook de form se crescer |
| `fields/page.tsx` | ~384 | Já extraiu 3 componentes — restante é orquestração | OK para o tamanho atual |

### Padrões de refatoração para referência

**Para serviços (> 500 linhas):**
1. Criar subdirectory `lib/services/<nome>/`
2. Extrair `types.ts` (interfaces, enums, constantes)
3. Extrair `helpers.ts` (funções puras utilitárias)
4. Agrupar lógica de negócio em módulos temáticos
5. Transformar arquivo original em barrel re-export (`export * from './subdir/...'`)
6. **Não alterar a API pública** — imports existentes devem continuar funcionando

**Para páginas UI (> 400 linhas):**
1. Extrair componentes visuais para `components/<feature>/`
2. Extrair lógica de estado/fetch para `hooks/use<Feature>.ts`
3. Extrair utilitários para `lib/utils/`
4. Extrair tipos compartilhados para `lib/types/`
5. A página principal deve ser uma **orquestração** de componentes, não implementação

**Para componentes (> 300 linhas):**
1. Extrair sub-componentes por responsabilidade visual
2. Extrair configurações/constantes para `<component>-config.ts`
3. Extrair tipos para `<component>-types.ts`

---

## Histórico de Revisões

| Data | Versão | Executor | Resumo |
|------|--------|----------|--------|
| 2026-02-12 | 0.0.33 | Auditoria IA | Revisão completa: unificação de metodologias, eliminação de duplicações, criação de compliance científica, reorganização de docs |
| 2026-02-12 | 0.0.34 | Auditoria IA | Atualização de docs: Análise Visual, persistência S3, edição agronômica, subtalhões, novos endpoints e variáveis de ambiente |
| 2026-02-13 | 0.0.34 | Refatoração IA | **Refatoração atômica completa**: 110 testes unitários (Jest+ts-jest), pipeline de processamento (8 steps), 10 serviços divididos em subdirs, 6 god-files UI eliminados (reports 1730→315, process 1248→99, settings 894→223), 6 hooks customizados extraídos, compliance científica auditada (13 algoritmos, 2 erratas corrigidas) |
| 2026-02-13 | 0.0.36 | Implementação IA | **Edição de Subtalhões + Mapa + Breadcrumb**: Modal de edição com campos herdados travados (produtor/logística), botão editar no dashboard e página de subtalhões, polígonos filhos no mapa do pai, breadcrumb de navegação pai→filho, API estendida com parentField e subFields |
