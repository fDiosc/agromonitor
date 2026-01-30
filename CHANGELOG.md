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
