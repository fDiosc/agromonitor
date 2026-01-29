# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

---

## [0.3.0] - 2026-01-29

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

## [0.1.0] - 2026-01-29

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
