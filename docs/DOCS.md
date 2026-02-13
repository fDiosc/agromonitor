# Índice de Documentação

> Documentação do projeto **Merx Agro MVP**. Este índice reflete o estado atual da documentação.

---

## Active Documents (root + docs/)

| Document | Description | Status |
|----------|-------------|--------|
| [README.md](../README.md) | Visão geral do projeto, quick start e estrutura | ✅ Atualizado (v0.0.36) |
| [CHANGELOG.md](../CHANGELOG.md) | Histórico de mudanças por versão | ✅ Atualizado (v0.0.36) |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Arquitetura do sistema, fluxos e integrações | ✅ Atualizado (v0.0.36) |
| [METHODOLOGY.md](./METHODOLOGY.md) | Metodologia unificada de análise agrícola | ✅ Atualizado (v0.0.33) |
| [DIAGNOSTICOLOG.md](./DIAGNOSTICOLOG.md) | Especificação do módulo de diagnóstico logístico | ✅ Atualizado |
| [DEPLOY.md](./DEPLOY.md) | Guia de deploy no CapRover | ✅ Atualizado (v0.0.34) |

---

## Technical Documents (in docs/)

| Document | Description | Status |
|----------|-------------|--------|
| [Apisproject.md](./Apisproject.md) | Documentação completa de APIs (externas + internas, incl. S3) | ✅ Atualizado (v0.0.36) |
| [SCIENTIFIC-COMPLIANCE.md](./SCIENTIFIC-COMPLIANCE.md) | Compliance científica dos algoritmos agronômicos | ✅ Atualizado (v0.0.33) |
| [REPORT-MERX-NDVI-GAP.md](./REPORT-MERX-NDVI-GAP.md) | Relatório técnico sobre gap de dados NDVI | ✅ Concluído |

---

## Archived Documents (in docs/archive/)

These are historical planning documents that have been fully implemented. They are kept for reference.

| Document | Description | Original Status |
|----------|-------------|-----------------|
| [archive/METHODOLOGY-V2.md](./archive/METHODOLOGY-V2.md) | Metodologia V2 original (conteúdo unificado em METHODOLOGY.md) | Substituído |
| [archive/REFATORACAO1.md](./archive/REFATORACAO1.md) | Plano de multi-tenancy e auth | ✅ Implementado |
| [archive/PLAN-AI-VISUAL-VALIDATION.md](./archive/PLAN-AI-VISUAL-VALIDATION.md) | Plano de validação visual IA | ✅ Implementado |
| [archive/PLAN-HYBRID-ANALYSIS.md](./archive/PLAN-HYBRID-ANALYSIS.md) | Plano de análise híbrida | ✅ Implementado |
| [archive/PLAN-REPROCESS-ANALYSIS.md](./archive/PLAN-REPROCESS-ANALYSIS.md) | Plano de reprocessamento | ✅ Implementado |
| [archive/PLAN-ZARC-ALIGNMENT.md](./archive/PLAN-ZARC-ALIGNMENT.md) | Plano de alinhamento ZARC | ✅ Implementado |

---

## Legacy Documents (in parent directory /Logistic Monitor/)

| Document | Status |
|----------|--------|
| produto.md | 📦 Legado |
| melhorias.md | 📦 Legado |
| IMPLEMENTACAO.md | 📦 Legado |
| logic.md | 📦 Legado |

---

## Guia de Leitura Recomendado

### Para Novos Desenvolvedores

1. [README.md](../README.md) - Comece aqui
2. [ARCHITECTURE.md](./ARCHITECTURE.md) - Entenda a estrutura
3. [METHODOLOGY.md](./METHODOLOGY.md) - Entenda a lógica de negócio

### Para Entender APIs

1. [Apisproject.md](./Apisproject.md) - Documentação completa (externas + internas)

### Para Entender o Módulo Logístico

1. [DIAGNOSTICOLOG.md](./DIAGNOSTICOLOG.md) - Especificação completa
2. [METHODOLOGY.md](./METHODOLOGY.md) - Seção 15.2 (Análise Logística)

### Para Entender Validação Visual IA e Criticidade de Cultura

1. [METHODOLOGY.md](./METHODOLOGY.md) - Seção 13 (Pipeline de Criticidade) + Seção 14 (Validação Visual)

### Para Entender Análise Visual, Subtalhões e Edição Agronômica

1. [ARCHITECTURE.md](./ARCHITECTURE.md) - Fluxo de Análise Visual, integração S3
2. [Apisproject.md](./Apisproject.md) - Seção 1.7 (AWS S3) + endpoints `subfields`, `images`, `PATCH fields`
3. [CHANGELOG.md](../CHANGELOG.md) - Versões 0.0.34 a 0.0.36

### Para Deploy

1. [DEPLOY.md](./DEPLOY.md) - Guia completo de deploy no CapRover

### Para Acompanhar Mudanças

1. [CHANGELOG.md](../CHANGELOG.md) - Histórico completo de versões

---

## Estrutura de Arquivos

```
merx-agro-mvp/
├── README.md               # ← DOCUMENTO CENTRAL
├── CHANGELOG.md            # Histórico de mudanças
├── docs/
│   ├── DOCS.md             # Este índice
│   ├── ARCHITECTURE.md     # Arquitetura do sistema
│   ├── METHODOLOGY.md      # Metodologia unificada
│   ├── DIAGNOSTICOLOG.md   # Módulo logístico
│   ├── DEPLOY.md           # Guia de deploy
│   ├── Apisproject.md      # Documentação completa de APIs
│   ├── SCIENTIFIC-COMPLIANCE.md  # Compliance científica
│   ├── REPORT-MERX-NDVI-GAP.md  # Gap NDVI técnico
│   ├── revisao.md          # Guia de revisão periódica
│   └── archive/            # Documentos históricos
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
├── app/                    # Código Next.js
├── components/
│   ├── visual-analysis/    # ImageComparisonSlider, VisualAnalysisTab
│   ├── maps/               # SubFieldMap (Leaflet + leaflet-draw)
│   ├── modals/             # EditFieldModal, FieldMapModal, etc.
│   └── ...                 # Demais componentes React
├── lib/
│   ├── s3.ts               # Cliente AWS S3 (upload, download, presigned URLs)
│   ├── agents/             # Agentes IA (Curador + Verificador + Juiz)
│   ├── services/           # Serviços de negócio (incl. field-images.service.ts)
│   └── templates/          # Templates de análise (Credit, Logistics, Risk Matrix)
└── prisma/                 # Schema do banco (incl. FieldImage, sub-fields)
```

---

## Convenções de Documentação

- README.md - Documento principal de entrada
- CHANGELOG.md - Histórico de versões
- *.md em MAIÚSCULAS na raiz - Documentos importantes
- docs/ - Documentos técnicos detalhados
- docs/archive/ - Documentos históricos (planos implementados)

---

## Links Úteis

- Neon Dashboard: https://console.neon.tech
- Merx API: https://homolog.api.merx.tech/api/monitoramento
- Next.js Docs: https://nextjs.org/docs
- Prisma Docs: https://www.prisma.io/docs
