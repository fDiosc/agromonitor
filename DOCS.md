# Índice de Documentação

## Documentos Atualizados (MVP)

Documentação técnica do projeto localizada em `/merx-agro-mvp/`:

| Documento | Descrição | Última Atualização |
|-----------|-----------|-------------------|
| [README.md](./README.md) | Visão geral do projeto, quick start e estrutura | 29/01/2026 |
| [CHANGELOG.md](./CHANGELOG.md) | Histórico de mudanças por versão | 29/01/2026 |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Arquitetura do sistema, fluxos e integrações | 29/01/2026 |
| [METHODOLOGY.md](./METHODOLOGY.md) | Metodologias técnicas de análise agrícola | 29/01/2026 |
| [DIAGNOSTICOLOG.md](./DIAGNOSTICOLOG.md) | Especificação do módulo de diagnóstico logístico | 29/01/2026 |

---

## Documentos Legados

Documentação original do projeto localizada na raiz (`/`):

| Documento | Descrição | Status |
|-----------|-----------|--------|
| [produto.md](../produto.md) | Visão original do produto e funcionalidades | 📦 Legado |
| [melhorias.md](../melhorias.md) | Análise de stack e melhorias arquiteturais | 📦 Legado |
| [IMPLEMENTACAO.md](../IMPLEMENTACAO.md) | Plano de implementação do MVP | 📦 Legado |
| [logic.md](../logic.md) | Propostas de melhorias de código | 📦 Legado |

> **Nota:** Os documentos legados contêm análises e planos iniciais que serviram como base para o MVP. A documentação atualizada está em `/merx-agro-mvp/`.

---

## Guia de Leitura Recomendado

### Para Novos Desenvolvedores

1. **[README.md](./README.md)** - Comece aqui para entender o projeto
2. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Entenda a estrutura do código
3. **[METHODOLOGY.md](./METHODOLOGY.md)** - Entenda a lógica de negócio

### Para Entender o Módulo Logístico

1. **[DIAGNOSTICOLOG.md](./DIAGNOSTICOLOG.md)** - Especificação completa
2. **[METHODOLOGY.md](./METHODOLOGY.md)** - Seção 8.2 (Análise Logística)

### Para Acompanhar Mudanças

1. **[CHANGELOG.md](./CHANGELOG.md)** - Histórico completo de versões

---

## Estrutura de Arquivos

```
Logistic Monitor/
├── merx-agro-mvp/              # Projeto MVP atual
│   ├── README.md               # ← DOCUMENTO CENTRAL
│   ├── CHANGELOG.md            # Histórico de mudanças
│   ├── ARCHITECTURE.md         # Arquitetura do sistema
│   ├── METHODOLOGY.md          # Metodologias técnicas
│   ├── DIAGNOSTICOLOG.md       # Módulo logístico
│   ├── DOCS.md                 # Este índice
│   ├── app/                    # Código Next.js
│   ├── components/             # Componentes React
│   ├── lib/                    # Serviços e utilitários
│   └── prisma/                 # Schema do banco
│
├── produto.md                  # (Legado) Visão do produto
├── melhorias.md                # (Legado) Análise de melhorias
├── IMPLEMENTACAO.md            # (Legado) Plano de implementação
├── logic.md                    # (Legado) Melhorias de código
└── README.md                   # (Legado) README original
```

---

## Convenções de Documentação

### Nomenclatura

- `README.md` - Documento principal de entrada
- `CHANGELOG.md` - Histórico de versões
- `*.md` em MAIÚSCULAS - Documentos importantes
- `*.md` em minúsculas - Documentos secundários

### Formatação

- Títulos: `#` para seções principais
- Tabelas: Para comparações e listas estruturadas
- Diagramas: ASCII art para arquitetura
- Código: Blocos com syntax highlighting

### Atualizações

Ao modificar funcionalidades:
1. Atualizar `CHANGELOG.md` com a mudança
2. Atualizar documentos afetados
3. Manter status de implementação em dia

---

## Links Úteis

- **Repositório**: [Em desenvolvimento local]
- **Neon Dashboard**: https://console.neon.tech
- **Merx API Docs**: [Interno]
- **Next.js Docs**: https://nextjs.org/docs
- **Prisma Docs**: https://www.prisma.io/docs
