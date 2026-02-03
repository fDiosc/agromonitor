# Módulo de Diagnóstico Logístico

## 1. Visão Geral

### 1.1 Objetivo
O módulo de Diagnóstico Logístico fornece uma visão consolidada de todas as propriedades monitoradas para auxiliar o planejamento de recebimento de biomassa no armazém. O gestor logístico precisa se preparar para:

- **Quando** a colheita começa em cada região
- **Quanto** volume será recebido por período
- **Como** o fluxo de recebimento evolui ao longo do tempo
- **Onde** estão as propriedades e distâncias envolvidas

### 1.2 Problema que Resolve
| Dor do Usuário | Solução |
|----------------|---------|
| "Não sei quando devo preparar a estrutura de recebimento" | Curva de previsão de colheita agregada por período |
| "Não consigo prever picos de recebimento" | Gráfico de distribuição (bell curve) mostrando concentração |
| "Não sei o volume total que vou receber" | Cards com métricas agregadas de volume |
| "Não visualizo a distribuição geográfica" | Mapa com todas as propriedades e indicadores |
| "Preciso planejar equipe e equipamentos" | Cronograma de janelas de colheita por talhão |

---

## 2. Layout da Interface

### 2.1 Estrutura Geral

```
┌─────────────────────────────────────────────────────────────────────┐
│  HEADER: Diagnóstico Logístico            [Exportar] [Atualizar]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐           │
│  │ TALHÕES   │ │ ÁREA      │ │ VOLUME    │ │ CARRETAS  │           │
│  │ MONITORA- │ │ TOTAL     │ │ ESTIMADO  │ │ PREVISTAS │           │
│  │ DOS       │ │           │ │           │ │           │           │
│  │    12     │ │ 3.450 ha  │ │ 12.075 t  │ │    345    │           │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘           │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  JANELA DE COLHEITA AGREGADA                                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Primeira Colheita: 15/01  │  Pico: 05/02 - 20/02  │ Fim: 15/03│  │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  CURVA DE RECEBIMENTO PREVISTO (Bell Curve)                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                         ████                                │   │
│  │                       ████████                              │   │
│  │                     ████████████                            │   │
│  │                   ████████████████                          │   │
│  │                 ████████████████████                        │   │
│  │               ████████████████████████                      │   │
│  │             ████████████████████████████                    │   │
│  │  ──────────────────────────────────────────────────────     │   │
│  │  Jan       Fev       Mar       Abr                          │   │
│  │                                                             │   │
│  │  ── Volume Diário (ton)  ── Acumulado  -- Capacidade        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  CRONOGRAMA POR TALHÃO                                             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Talhão         Início    Pico      Fim       Volume   Status │   │
│  │ ─────────────────────────────────────────────────────────── │   │
│  │ Fazenda Norte  15/01     25/01     30/01     450 ton   🟢   │   │
│  │ Sítio Sul      20/01     01/02     05/02     320 ton   🟡   │   │
│  │ Área Oeste     01/02     10/02     15/02     680 ton   🔴   │   │
│  │ ...                                                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  INDICADORES CRÍTICOS                                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │ DIAS ATÉ    │ │ PICO DE     │ │ RISCO       │ │ CAPACIDADE  │   │
│  │ 1ª COLHEITA │ │ RECEBIMENTO │ │ CLIMÁTICO   │ │ ARMAZÉM     │   │
│  │    15 dias  │ │  850 ton/dia│ │    MÉDIO    │ │  75% usada  │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  MAPA DE PROPRIEDADES                                               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                             │   │
│  │     🟢 Fazenda Norte                                        │   │
│  │                    🟡 Sítio Sul                             │   │
│  │                                                             │   │
│  │  🔴 Área Oeste                                              │   │
│  │                         🟢 Fazenda Leste                    │   │
│  │                                                             │   │
│  │  Legenda: 🟢 Colhendo  🟡 Próximo  🔴 Atenção  ⚪ Aguardando │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Componentes Detalhados

### 3.1 Cards de Métricas Agregadas

| Card | Métrica | Cálculo |
|------|---------|---------|
| **Talhões Monitorados** | Quantidade total | `COUNT(fields)` |
| **Área Total** | Soma de hectares | `SUM(areaHa)` |
| **Volume Estimado** | Soma de volumes | `SUM(volumeEstimatedKg) / 1000` |
| **Carretas Previstas** | Total de viagens | `SUM(volume / 35)` (35t por carreta) |

### 3.2 Janela de Colheita Agregada

Mostra a timeline consolidada:
- **Primeira Colheita**: `MIN(harvestStartDate)` de todos os talhões
- **Pico**: Período com maior concentração de colheita
- **Última Colheita**: `MAX(harvestEndDate)` de todos os talhões

### 3.3 Curva de Recebimento (Bell Curve)

Gráfico de área mostrando:
1. **Eixo X**: Dias (timeline da safra)
2. **Eixo Y**: Volume em toneladas
3. **Linhas**:
   - Volume diário previsto (área preenchida)
   - Volume acumulado (linha)
   - Capacidade de recebimento do armazém (linha tracejada horizontal)

**Algoritmo de Cálculo:**
```typescript
// Para cada dia no período:
for (let day = firstHarvest; day <= lastHarvest; day++) {
  dailyVolume[day] = 0
  
  for (const field of fields) {
    if (day >= field.harvestStart && day <= field.harvestEnd) {
      // Volume distribuído uniformemente na janela de colheita
      const fieldDailyVolume = field.totalVolume / field.harvestDays
      dailyVolume[day] += fieldDailyVolume
    }
  }
}
```

### 3.4 Cronograma por Talhão (Tabela)

| Coluna | Descrição |
|--------|-----------|
| **Talhão** | Nome + localização |
| **Início** | Data início colheita |
| **Pico** | Data de pico de maturação |
| **Fim** | Data fim colheita |
| **Volume** | Volume estimado |
| **Status** | 🟢 Colhendo / 🟡 Próximo (< 7 dias) / 🔴 Atenção / ⚪ Aguardando |
| **Ações** | Ver detalhes |

Ordenação padrão: por data de início (mais próximo primeiro)

### 3.5 Indicadores Críticos

| Indicador | Cálculo | Alerta |
|-----------|---------|--------|
| **Dias até 1ª Colheita** | `MIN(harvestStart) - hoje` | < 7 dias = amarelo, < 3 = vermelho |
| **Pico de Recebimento** | `MAX(dailyVolume)` | > capacidade = vermelho |
| **Risco Climático** | Média ponderada por volume | Alto/Médio/Baixo |
| **Capacidade Armazém** | Volume previsto / capacidade total | > 80% = atenção |

### 3.6 Mapa de Propriedades

Mapa interativo mostrando:
- **Marcadores coloridos** por status de colheita
- **Popup** ao clicar: Nome, área, volume, datas
- **Clusters** quando muitos pontos próximos
- **Filtros**: Por status, por período, por volume

**Cores dos marcadores:**
- 🟢 Verde: Colhendo atualmente
- 🟡 Amarelo: Colheita próxima (< 7 dias)
- 🔴 Vermelho: Atenção/Risco identificado
- ⚪ Cinza: Aguardando (> 15 dias)

---

## 4. Dados Necessários

### 4.1 Estrutura de Dados Agregados

```typescript
interface LogisticDiagnostic {
  // Métricas agregadas
  summary: {
    totalFields: number
    totalAreaHa: number
    totalVolumeKg: number
    totalTrucks: number
    firstHarvestDate: string
    lastHarvestDate: string
    peakStartDate: string
    peakEndDate: string
  }
  
  // Curva de recebimento
  dailyForecast: {
    date: string
    volumeKg: number
    cumulativeKg: number
    fieldsHarvesting: number
  }[]
  
  // Lista de talhões com status
  fields: {
    id: string
    name: string
    city: string
    state: string
    areaHa: number
    volumeKg: number
    harvestStart: string
    harvestEnd: string
    peakDate: string
    status: 'harvesting' | 'upcoming' | 'attention' | 'waiting'
    riskLevel: 'low' | 'medium' | 'high'
    latitude: number
    longitude: number
  }[]
  
  // Indicadores críticos
  alerts: {
    daysToFirstHarvest: number
    peakDailyVolume: number
    climateRisk: 'low' | 'medium' | 'high'
    storageUtilization: number
  }
}
```

### 4.2 API Endpoint

```
GET /api/logistics/diagnostic
```

**Parâmetros:**
- `seasonYear`: Ano da safra (ex: 2025)
- `startDate`: Filtro de data inicial
- `endDate`: Filtro de data final

---

## 5. Implementação Técnica

### 5.1 Estrutura de Arquivos

```
app/
├── dashboard/
│   ├── page.tsx                    # Dashboard principal (já existe)
│   └── logistics/
│       ├── page.tsx                # Página do Diagnóstico Logístico
│       └── components/
│           ├── SummaryCards.tsx    # Cards de métricas agregadas
│           ├── HarvestTimeline.tsx # Timeline de janela de colheita
│           ├── ReceiptCurve.tsx    # Gráfico bell curve
│           ├── FieldsSchedule.tsx  # Tabela de cronograma
│           ├── CriticalAlerts.tsx  # Indicadores críticos
│           └── PropertiesMap.tsx   # Mapa com propriedades

app/api/
└── logistics/
    └── diagnostic/
        └── route.ts                # Endpoint de dados agregados
```

### 5.2 Fluxo de Implementação

1. **Fase 1: Backend**
   - [ ] Criar endpoint `/api/logistics/diagnostic`
   - [ ] Implementar agregação de dados dos talhões
   - [ ] Calcular curva de recebimento diário
   - [ ] Gerar alertas e indicadores

2. **Fase 2: Frontend - Estrutura**
   - [ ] Criar página `/dashboard/logistics`
   - [ ] Adicionar link no dashboard principal
   - [ ] Layout base com grid responsivo

3. **Fase 3: Componentes**
   - [ ] SummaryCards (métricas)
   - [ ] HarvestTimeline (datas)
   - [ ] ReceiptCurve (gráfico Recharts)
   - [ ] FieldsSchedule (tabela)
   - [ ] CriticalAlerts (indicadores)
   - [ ] PropertiesMap (Leaflet)

4. **Fase 4: Refinamentos**
   - [ ] Filtros e ordenação
   - [ ] Exportação de dados
   - [ ] Atualização automática
   - [ ] Responsividade mobile

### 5.3 Bibliotecas Utilizadas

- **Recharts**: Gráfico de curva de recebimento
- **React-Leaflet**: Mapa de propriedades
- **date-fns**: Manipulação de datas
- **Tailwind**: Estilização

---

## 6. Regras de Negócio

### 6.1 Status do Talhão

```typescript
function getFieldStatus(harvestStart: Date, harvestEnd: Date): Status {
  const today = new Date()
  const daysToStart = differenceInDays(harvestStart, today)
  
  if (today >= harvestStart && today <= harvestEnd) {
    return 'harvesting' // 🟢 Colhendo
  }
  if (daysToStart <= 7) {
    return 'upcoming' // 🟡 Próximo
  }
  if (daysToStart <= 0) {
    return 'attention' // 🔴 Atrasado ou problema
  }
  return 'waiting' // ⚪ Aguardando
}
```

### 6.2 Cálculo do Pico

```typescript
function calculatePeakPeriod(dailyForecast: DailyData[]): { start: Date, end: Date } {
  const avgVolume = dailyForecast.reduce((a, b) => a + b.volume, 0) / dailyForecast.length
  const threshold = avgVolume * 1.2 // 20% acima da média = pico
  
  const peakDays = dailyForecast.filter(d => d.volume >= threshold)
  return {
    start: peakDays[0].date,
    end: peakDays[peakDays.length - 1].date
  }
}
```

### 6.3 Risco Climático Agregado

```typescript
function aggregateClimateRisk(fields: Field[]): 'low' | 'medium' | 'high' {
  const weightedRisk = fields.reduce((sum, f) => {
    const riskValue = f.riskLevel === 'high' ? 3 : f.riskLevel === 'medium' ? 2 : 1
    return sum + (riskValue * f.volumeKg)
  }, 0)
  
  const totalVolume = fields.reduce((sum, f) => sum + f.volumeKg, 0)
  const avgRisk = weightedRisk / totalVolume
  
  if (avgRisk >= 2.5) return 'high'
  if (avgRisk >= 1.5) return 'medium'
  return 'low'
}
```

---

## 7. UX/UI Guidelines

### 7.1 Cores e Significados

| Cor | Significado | Uso |
|-----|-------------|-----|
| Verde (#10b981) | Positivo/Ativo | Colhendo, OK |
| Amarelo (#f59e0b) | Atenção/Próximo | Próximos 7 dias |
| Vermelho (#dc2626) | Crítico/Risco | Problema identificado |
| Cinza (#94a3b8) | Neutro/Aguardando | Futuro distante |
| Azul (#3b82f6) | Informativo | Links, detalhes |

### 7.2 Hierarquia Visual

1. **Mais importante**: Cards de métricas (topo)
2. **Contexto temporal**: Janela de colheita
3. **Visão analítica**: Gráfico de curva
4. **Detalhes**: Tabela de talhões
5. **Alertas**: Indicadores críticos
6. **Contexto espacial**: Mapa (base)

### 7.3 Responsividade

- **Desktop**: Layout em grid 4 colunas
- **Tablet**: Grid 2 colunas, gráfico full-width
- **Mobile**: Tudo empilhado, cards horizontais scrolláveis

---

## 8. Próximos Passos

### Implementação Imediata
1. Criar endpoint de API para agregação
2. Desenvolver página base com layout
3. Implementar cards de métricas
4. Adicionar gráfico de curva de recebimento

### Melhorias Futuras
- Notificações push para alertas
- Integração com sistema de pesagem
- Comparativo com safras anteriores
- Simulador de cenários ("what if")
- Dashboard customizável por usuário

---

## 9. Exemplo de Uso

**Cenário**: Gestor do armazém precisa planejar a equipe para a safra 2025/2026

1. Acessa o Dashboard principal
2. Clica em "Diagnóstico Logístico"
3. Visualiza que:
   - 12 talhões estão sendo monitorados
   - Volume total previsto: 12.075 toneladas
   - Primeira colheita: 15/01/2026
   - Pico entre 05/02 e 20/02
   - 3 talhões com risco climático alto

4. Ações tomadas:
   - Escala equipe extra para o período de pico
   - Prepara logística adicional de secagem
   - Contata produtores dos talhões com risco alto
   - Reserva capacidade de armazenagem

---

## 10. Caixas Logísticas (v0.0.15+)

### 10.1 Conceito

Caixas Logísticas são unidades de recebimento (armazéns) que podem ser cadastradas com:
- Coordenadas (latitude/longitude)
- Endereço (opcional)
- Raio de cobertura em km

### 10.2 Hierarquia de Atribuição

Quando um talhão está dentro do raio de cobertura de uma ou mais caixas:

| Prioridade | Tipo | Descrição |
|------------|------|-----------|
| 1 | **Manual (M)** | Atribuído diretamente no talhão |
| 2 | **Produtor (P)** | Herdado da caixa padrão do produtor |
| 3 | **Automático (A)** | Caixa mais próxima dentro do raio |

### 10.3 Filtros por Caixa Logística

O Overview agora possui um seletor de caixas logísticas que filtra:
- Todos os cards de métricas
- Gráfico de curva de recebimento
- Tabela de talhões
- Mapa de propriedades

### 10.4 Visualização no Mapa

- Caixas logísticas são exibidas como **triângulos** (diferente dos talhões)
- Círculos de cobertura mostram o raio configurado
- Cores indicam status: verde (coberto), amarelo (interseção), vermelho (fora)

---

## 11. Gestão de Talhões (v0.0.17)

### 11.1 Página Gerenciar Talhões

Acessível via sidebar, permite:
- Visualizar todos os talhões e seus status de atribuição
- Filtrar por cards clicáveis (Total, Interseção, Sem Atribuição, Direta)
- Atribuir manualmente uma caixa logística a talhões em interseção

### 11.2 Filtros no Dashboard Principal

A Carteira de Monitoramento agora possui filtros:
- **Status**: Todos, Processado, Processando, Pendente, Erro
- **Caixa Logística**: Todas, Sem atribuição, ou caixa específica
- **Tipo de Atribuição**: Manual, Produtor, Automático, Sem

### 11.3 Badges de Atribuição

| Badge | Cor | Significado |
|-------|-----|-------------|
| **M** | Azul | Manual/Direta |
| **P** | Roxo | Herdada do Produtor |
| **A** | Verde | Automática por raio |
| **!** | Vermelho | Sem cobertura |

---

## 12. Status de Implementação

| Componente | Status | Observações |
|------------|--------|-------------|
| Endpoint `/api/logistics/diagnostic` | ✅ Implementado | Suporta filtro por caixas logísticas |
| Página `/dashboard/logistics` | ✅ Implementado | Layout responsivo |
| SummaryCards | ✅ Implementado | 4 métricas principais |
| HarvestTimeline | ✅ Implementado | Primeira, pico, última colheita |
| ReceiptCurve (Bell Curve) | ✅ Implementado | Com linha de capacidade |
| FieldsSchedule (Tabela) | ✅ Implementado | Ordenável, com status |
| CriticalAlerts | ✅ Implementado | 4 indicadores |
| PropertiesMap | ✅ Implementado | Leaflet com caixas e talhões |
| Caixas Logísticas | ✅ Implementado | CRUD completo |
| Seletor de Caixas | ✅ Implementado | Multi-select no header |
| Filtros Dashboard | ✅ Implementado | Status, caixa, tipo |
| Gerenciar Talhões | ✅ Implementado | Cards clicáveis como filtros |
| Distâncias Persistidas | ✅ Implementado | Calculadas e salvas no banco |
| Filtros avançados | ⏳ Pendente | Por período, região |
| Exportação | ⏳ Pendente | PDF, Excel |
| Notificações | ⏳ Pendente | Push alerts |

---

*Documento criado em: 29/01/2026*
*Última atualização: 03/02/2026*
*Versão: 1.3*
