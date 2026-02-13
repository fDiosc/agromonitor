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

**Última revisão:** v0.0.33 (2026-02-12)

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

## Histórico de Revisões

| Data | Versão | Executor | Resumo |
|------|--------|----------|--------|
| 2026-02-12 | 0.0.33 | Auditoria IA | Revisão completa: unificação de metodologias, eliminação de duplicações, criação de compliance científica, reorganização de docs |
| 2026-02-12 | 0.0.34 | Auditoria IA | Atualização de docs: Análise Visual, persistência S3, edição agronômica, subtalhões, novos endpoints e variáveis de ambiente |
