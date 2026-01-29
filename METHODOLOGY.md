# Metodologia de Monitoramento Agrícola

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Fonte de Dados](#2-fonte-de-dados)
3. [Detecção Fenológica](#3-detecção-fenológica)
4. [Interpolação e Suavização](#4-interpolação-e-suavização)
5. [Correlação Histórica](#5-correlação-histórica)
6. [Níveis de Confiança](#6-níveis-de-confiança)
7. [Estimativa de Produtividade](#7-estimativa-de-produtividade)
8. [Análises por Template](#8-análises-por-template)
   - [Análise de Crédito](#81-análise-de-crédito)
   - [Análise Logística](#82-análise-logística)
   - [Matriz de Risco](#83-matriz-de-risco)
9. [Limitações e Considerações](#9-limitações-e-considerações)

---

## 1. Visão Geral

O sistema de monitoramento agrícola utiliza dados de sensoriamento remoto (satélite) para detectar automaticamente o ciclo fenológico de culturas, estimar produtividade e gerar análises de risco para diferentes finalidades comerciais.

### Fluxo de Processamento

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Geometria  │───▶│  API Merx   │───▶│  Fenologia  │───▶│  Análises   │
│  (KML/JSON) │    │  (Satélite) │    │  Detection  │    │  Templates  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                          │
                          ▼
              ┌─────────────────────┐
              │  NDVI Histórico     │
              │  (3 safras)         │
              └─────────────────────┘
```

---

## 2. Fonte de Dados

### 2.1 API Merx

O sistema utiliza a API Merx para obtenção de dados de sensoriamento remoto:

| Endpoint | Descrição | Retorno |
|----------|-----------|---------|
| `/consulta-ndvi` | Série temporal NDVI | Pontos com data, NDVI bruto, interpolado e suavizado |
| `/consulta-precipitacao` | Dados de precipitação | Chuva diária/acumulada |
| `/consulta-solo` | Características do solo | Tipo, textura, capacidade |
| `/consulta-area-lavoura` | Área cultivada | Hectares detectados |
| `/consulta-zarc-anual` | Zoneamento agrícola | Risco climático por região |

### 2.2 NDVI (Índice de Vegetação por Diferença Normalizada)

O NDVI é calculado a partir das bandas espectrais:

```
NDVI = (NIR - RED) / (NIR + RED)
```

Onde:
- **NIR**: Banda do infravermelho próximo
- **RED**: Banda do vermelho visível

| Valor NDVI | Interpretação |
|------------|---------------|
| < 0.2 | Solo exposto, água, áreas urbanas |
| 0.2 - 0.35 | Vegetação esparsa ou senescente |
| 0.35 - 0.5 | Vegetação em desenvolvimento inicial |
| 0.5 - 0.7 | Vegetação moderada |
| 0.7 - 0.9 | Vegetação densa e saudável |
| > 0.9 | Vegetação muito densa (raro) |

### 2.3 Histórico

Para cada talhão, são obtidos dados de **3 safras anteriores** alinhados pelo calendário agrícola, permitindo comparação temporal e detecção de anomalias.

---

## 3. Detecção Fenológica

### 3.1 Estágios Fenológicos

O sistema detecta automaticamente os seguintes marcos:

| Marco | Sigla | Descrição | Método de Detecção |
|-------|-------|-----------|-------------------|
| **Plantio** | - | Data estimada de semeadura | `SOS - dias_emergência` |
| **Emergência** | SOS | Start of Season | Primeiro NDVI > threshold subindo |
| **Pico Vegetativo** | PEAK | Máximo vigor | Maior valor de NDVI da série |
| **Colheita** | EOS | End of Season | NDVI < threshold após pico |

### 3.2 Thresholds por Cultura

```javascript
const CROP_THRESHOLDS = {
  SOJA: {
    sosNdvi: 0.35,      // Threshold para emergência
    eosNdvi: 0.38,      // Threshold para colheita
    peakMinNdvi: 0.70,  // Pico mínimo esperado
    cycleDays: 120,     // Ciclo típico
    emergenceDays: 8    // Dias plantio→emergência
  },
  MILHO: {
    sosNdvi: 0.30,
    eosNdvi: 0.35,
    peakMinNdvi: 0.65,
    cycleDays: 140,
    emergenceDays: 7
  },
  ALGODAO: {
    sosNdvi: 0.32,
    eosNdvi: 0.40,
    peakMinNdvi: 0.60,
    cycleDays: 180,
    emergenceDays: 10
  }
}
```

### 3.3 Algoritmo de Detecção

```
1. SUAVIZAÇÃO: Aplicar média móvel (janela=3) na série NDVI
2. PICO: Encontrar índice do valor máximo na série suavizada
3. SOS: Percorrer do pico para trás até NDVI < sosNdvi
4. EOS: Percorrer do pico para frente até NDVI < eosNdvi
5. PLANTIO: SOS - emergenceDays
6. Se EOS não detectado: usar PROJEÇÃO (plantio + cycleDays)
```

### 3.4 Detecção de Replantio

O sistema detecta replantio quando identifica:

```
if (NDVI_anterior > 0.5 && NDVI_atual < 0.35 && NDVI_posterior > 0.5) {
  // Queda abrupta seguida de recuperação = replantio
}
```

---

## 4. Interpolação e Suavização

### 4.1 Dados Brutos vs Processados

A API Merx retorna três versões do NDVI:

| Campo | Descrição |
|-------|-----------|
| `ndvi_raw` | Valor bruto do pixel (pode ter ruído, nuvens) |
| `ndvi_interp` | Interpolado para preencher gaps |
| `ndvi_smooth` | Suavizado com filtro temporal |

### 4.2 Suavização Adicional

O sistema aplica **média móvel** adicional para detecção fenológica:

```javascript
function movingAverage(data, window = 3) {
  return data.map((_, i) => {
    const start = Math.max(0, i - Math.floor(window / 2))
    const end = Math.min(data.length, i + Math.ceil(window / 2))
    const slice = data.slice(start, end)
    return slice.reduce((a, b) => a + b, 0) / slice.length
  })
}
```

### 4.3 Interpolação de Gaps

Para linhas históricas no gráfico, gaps de até 10 pontos são interpolados linearmente:

```javascript
// Se há gap entre lastIdx e idx
if (idx - lastIdx > 1 && idx - lastIdx < 10) {
  for (let i = 1; i < steps; i++) {
    const ratio = i / steps
    data[lastIdx + i] = lastValue + (currentValue - lastValue) * ratio
  }
}
```

---

## 5. Correlação Histórica

### 5.1 Objetivo

Determinar quão similar a safra atual está em relação às safras passadas, permitindo:
- Identificar safras anômalas
- Validar qualidade dos dados
- Projetar comportamento futuro

### 5.2 Métricas de Correlação

O sistema calcula três métricas complementares:

#### 5.2.1 Correlação de Pearson (40% do peso)

Mede similaridade de **forma** da curva:

```javascript
function pearsonCorrelation(x, y) {
  const n = Math.min(x.length, y.length)
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0
  
  for (let i = 0; i < n; i++) {
    sumX += x[i]
    sumY += y[i]
    sumXY += x[i] * y[i]
    sumX2 += x[i] * x[i]
    sumY2 += y[i] * y[i]
  }
  
  const numerator = n * sumXY - sumX * sumY
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  )
  
  return numerator / denominator  // Retorna -1 a 1
}
```

| Pearson | Interpretação |
|---------|---------------|
| 0.9 - 1.0 | Correlação muito forte |
| 0.7 - 0.9 | Correlação forte |
| 0.5 - 0.7 | Correlação moderada |
| 0.3 - 0.5 | Correlação fraca |
| < 0.3 | Correlação muito fraca |

#### 5.2.2 RMSE Score (30% do peso)

Mede diferença absoluta média:

```javascript
function normalizedRMSE(actual, predicted) {
  let sumSquaredError = 0
  for (let i = 0; i < n; i++) {
    sumSquaredError += Math.pow(actual[i] - predicted[i], 2)
  }
  return Math.sqrt(sumSquaredError / n)  // 0 = perfeito, 1 = máximo erro
}
```

#### 5.2.3 Aderência ao Envelope (30% do peso)

Percentual de pontos dentro do min/max histórico:

```javascript
// Considera "dentro" se estiver entre min-5% e max+5%
const margin = 0.05
if (current >= historicalMin - margin && current <= historicalMax + margin) {
  pointsInEnvelope++
}
adherenceScore = (pointsInEnvelope / totalPoints) * 100
```

### 5.3 Alinhamento Fenológico

**Problema**: Safras diferentes começam em datas diferentes. Comparar por data absoluta gera erros.

**Solução**: Alinhar por **dia do ciclo** (dias desde emergência):

```
Safra 2024: Emergência 05/Nov → Dia 0
Safra 2023: Emergência 20/Out → Dia 0

Dia 30 de 2024 (05/Dez) compara com Dia 30 de 2023 (19/Nov)
```

### 5.4 Score Composto

```javascript
compositeScore = pearsonScore * 0.4 + rmseScore * 0.3 + adherenceScore * 0.3
```

---

## 6. Níveis de Confiança

### 6.1 Score de Confiança (0-100)

Calculado com base em múltiplos fatores:

```javascript
function calculateConfidenceScore(params) {
  let score = 10  // Base
  
  if (params.hasSos) score += 20         // Emergência detectada
  if (params.hasEos) score += 15         // Colheita detectada
  if (params.hasPeak) score += 15        // Pico detectado
  if (params.method === 'ALGORITHM') score += 20  // Não é projeção
  if (params.correlation > 70) score += 10       // Alta correlação
  if (params.dataPoints >= 20) score += 5        // Dados suficientes
  if (params.peakNdvi >= params.peakMinNdvi) score += 5  // Pico adequado
  
  return Math.min(100, score)
}
```

### 6.2 Classificação de Confiança

| Score | Nível | Descrição |
|-------|-------|-----------|
| > 75 | HIGH | Dados completos, fenologia clara |
| 40-75 | MEDIUM | Alguns dados faltantes ou incerteza |
| < 40 | LOW | Dados insuficientes ou anomalias |

### 6.3 Saúde Fenológica

```javascript
function assessPhenologyHealth(maxNdvi, correlation, method, diagnostics) {
  const errorCount = diagnostics.filter(d => d.type === 'ERROR').length
  const warningCount = diagnostics.filter(d => d.type === 'WARNING').length

  if (errorCount > 0) return 'POOR'
  if (maxNdvi >= 0.75 && correlation >= 70 && method === 'ALGORITHM' && warningCount === 0) {
    return 'EXCELLENT'
  }
  if (maxNdvi >= 0.65 && correlation >= 50) return 'GOOD'
  if (maxNdvi >= 0.50 || warningCount <= 1) return 'FAIR'
  return 'POOR'
}
```

---

## 7. Estimativa de Produtividade

### 7.1 Modelo de Estimativa

A produtividade é estimada com base no NDVI máximo:

```javascript
function estimateYield(maxNdvi, areaHa, crop) {
  const baseYield = CROP_THRESHOLDS[crop].baseYieldKgHa
  
  // Fator de ajuste: NDVI 0.8+ = 100%, 0.6 = 75%, etc
  const ndviFactor = Math.min(1, Math.max(0.3, (maxNdvi - 0.3) / 0.5))
  
  return baseYield * ndviFactor * areaHa
}
```

### 7.2 Produtividade Base por Cultura

| Cultura | Base (kg/ha) | Típico Brasil |
|---------|-------------|---------------|
| SOJA | 3.500 | 3.000 - 4.000 |
| MILHO | 9.000 | 6.000 - 12.000 |
| ALGODÃO | 4.500 | 4.000 - 5.000 |
| TRIGO | 3.000 | 2.500 - 3.500 |

### 7.3 Ajuste por NDVI

| NDVI Máximo | Fator | Produtividade (% da base) |
|-------------|-------|---------------------------|
| ≥ 0.80 | 1.00 | 100% |
| 0.70 | 0.80 | 80% |
| 0.60 | 0.60 | 60% |
| 0.50 | 0.40 | 40% |
| ≤ 0.30 | 0.00 | 0% (perda total) |

---

## 8. Análises por Template

### 8.1 Análise de Crédito

**Objetivo**: Avaliar risco de garantias agrícolas (CPRs, penhor rural).

**Público**: Tradings, fundos de crédito, bancos.

**Foco**: Segurança da garantia, risco de default/washout.

#### Classificação de Status

| Status | Critério | Ação Recomendada |
|--------|----------|------------------|
| **NORMAL** | Correlação > 70%, NDVI pico > 0.65, sem replantio | Manter monitoramento padrão |
| **ALERTA** | Correlação 50-70% OU atraso plantio > 15 dias | Intensificar monitoramento |
| **CRÍTICO** | Correlação < 50% OU NDVI pico < 0.55 OU replantio | Vistoria presencial, avaliar LTV |

#### Métricas de Saída

```typescript
interface CreditAnalysisResult {
  status: 'NORMAL' | 'ALERTA' | 'CRITICO'
  statusLabel: string
  summary: string
  volumeExpected: number        // Toneladas esperadas
  volumeSecured: number         // Toneladas "garantidas" (cenário conservador)
  ltvEstimate: number           // Loan-to-Value estimado
  harvestWindowStart: string    // Início janela colheita
  harvestWindowEnd: string      // Fim janela colheita
  risks: string[]               // Lista de riscos identificados
  recommendations: string[]     // Ações recomendadas
}
```

---

### 8.2 Análise Logística

**Objetivo**: Planejar recepção e transporte de grãos.

**Público**: Tradings, cooperativas, transportadoras.

**Foco**: Quando começa colheita, volume diário, pico de demanda.

#### Cálculos Logísticos

```javascript
// Capacidade de colheita
const harvestDays = Math.ceil(areaHa / 60)  // ~60 ha/dia por colheitadeira

// Volume diário
const dailyVolume = volumeTotal / harvestDays

// Carretas necessárias
const trucksNeeded = Math.ceil(volumeTotal / 35)  // ~35 ton por carreta
```

#### Classificação de Status

| Status | Critério |
|--------|----------|
| **ÓTIMO** | Janela clara, sem risco climático, EOS fora período chuvoso |
| **ATENÇÃO** | Janela apertada OU colheita prevista Jan-Mar (chuvas) |
| **CRÍTICO** | Alto risco de atraso OU colheita em período crítico de chuvas |

#### Métricas de Saída

```typescript
interface LogisticsAnalysisResult {
  status: 'OTIMO' | 'ATENCAO' | 'CRITICO'
  harvestStart: string          // Data início colheita (DD/MM)
  harvestEnd: string            // Data fim colheita
  dailyVolume: number           // Toneladas por dia
  peakStart: string             // Início do pico
  peakEnd: string               // Fim do pico
  trucksNeeded: number          // Carretas totais
  weatherRisk: 'BAIXO' | 'MEDIO' | 'ALTO'
  qualityRisk: 'BAIXO' | 'MEDIO' | 'ALTO'
  risks: string[]
  recommendations: string[]
}
```

---

### 8.3 Matriz de Risco

**Objetivo**: Visão consolidada 360° de todos os riscos.

**Público**: Gestores, analistas de risco, compliance.

**Foco**: Priorização de atenção e tomada de decisão rápida.

#### Categorias de Risco

| Categoria | Fatores Avaliados |
|-----------|-------------------|
| **Climático** | Seca, excesso chuva, granizo, geada, veranicos |
| **Fenológico** | Atraso plantio, replantio, baixo vigor, ciclo irregular |
| **Operacional** | Dificuldade colheita, janela apertada, perdas |
| **Comercial** | Washout, atraso vs contrato, inadimplência |

#### Score Geral

| Score | Nível | Descrição |
|-------|-------|-----------|
| 80-100 | EXCELENTE | Baixo risco geral |
| 60-79 | BOM | Riscos menores |
| 40-59 | ATENÇÃO | Requer monitoramento |
| 0-39 | CRÍTICO | Ação imediata |

#### Tendência

| Tendência | Descrição |
|-----------|-----------|
| IMPROVING | Indicadores melhorando vs última leitura |
| STABLE | Sem mudanças significativas |
| WORSENING | Indicadores piorando |

#### Métricas de Saída

```typescript
interface RiskMatrixResult {
  overallScore: number          // 0-100
  overallLevel: 'EXCELENTE' | 'BOM' | 'ATENCAO' | 'CRITICO'
  trend: 'IMPROVING' | 'STABLE' | 'WORSENING'
  
  categories: {
    climatic: { score: number; risks: string[] }
    phenological: { score: number; risks: string[] }
    operational: { score: number; risks: string[] }
    commercial: { score: number; risks: string[] }
  }
  
  topRisks: { category: string; description: string; severity: string }[]
  recommendations: string[]
  nextReviewDate: string
}
```

---

## 9. Limitações e Considerações

### 9.1 Limitações do Sensoriamento Remoto

1. **Cobertura de nuvens**: Imagens com >50% nuvens são descartadas, gerando gaps
2. **Resolução temporal**: Revisita do satélite a cada 5-10 dias
3. **Resolução espacial**: Pixels de 10-30m podem não capturar variabilidade interna
4. **Mistura de pixels**: Bordas do talhão podem ter contaminação de áreas vizinhas

### 9.2 Limitações do Modelo

1. **Detecção de SOS/EOS**: Depende de thresholds fixos que podem não se aplicar a todas as regiões
2. **Produtividade**: Modelo simplificado baseado apenas em NDVI; não considera pragas, doenças, fertilidade
3. **Histórico**: Requer mínimo de 3 safras para correlação confiável
4. **Segunda safra**: Modelo otimizado para safra principal; safrinha pode ter comportamento diferente

### 9.3 Recomendações de Uso

| Situação | Recomendação |
|----------|--------------|
| Confiança LOW | Solicitar vistoria presencial |
| Correlação < 50% | Verificar se geometria está correta |
| Sem SOS detectado | Verificar data de início de safra |
| NDVI máx < 0.5 | Possível problema grave; verificar in loco |

### 9.4 Atualização dos Dados

- **Frequência**: Dados atualizados a cada passagem do satélite (5-10 dias)
- **Latência**: Processamento das imagens pode levar 1-3 dias
- **Reprocessamento**: Usuário pode forçar reprocessamento a qualquer momento

---

## Changelog

| Versão | Data | Alterações |
|--------|------|------------|
| 1.0.0 | 2024-01 | Versão inicial |
| 1.1.0 | 2025-01 | Adicionado serviço de correlação robusta com Pearson |
| 1.2.0 | 2026-01 | Alinhamento fenológico por SOS |
| 1.3.0 | 2026-01 | Adicionado estado PARTIAL para dados incompletos |

---

## Documentos Relacionados

- [README.md](./README.md) - Visão geral do projeto
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Arquitetura do sistema
- [DIAGNOSTICOLOG.md](./DIAGNOSTICOLOG.md) - Módulo de diagnóstico logístico
- [DOCS.md](./DOCS.md) - Índice completo de documentação

---

*Documento gerado automaticamente. Para dúvidas técnicas, consulte o código-fonte nos arquivos de serviço.*
