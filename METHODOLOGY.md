# Metodologia de Monitoramento Agrícola

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Fonte de Dados](#2-fonte-de-dados)
3. [Detecção Fenológica](#3-detecção-fenológica)
4. [Interpolação e Suavização](#4-interpolação-e-suavização)
   - [Fusão Adaptativa SAR-NDVI [BETA]](#44-fusão-adaptativa-sar-ndvi-beta)
5. [Correlação Histórica](#5-correlação-histórica)
6. [Projeção Adaptativa](#6-projeção-adaptativa-por-fase-fenológica)
7. [Níveis de Confiança](#7-níveis-de-confiança)
8. [Estimativa de Produtividade](#8-estimativa-de-produtividade)
9. [Análises por Template](#9-análises-por-template)
   - [Análise de Crédito](#91-análise-de-crédito)
   - [Análise Logística](#92-análise-logística)
   - [Matriz de Risco](#93-matriz-de-risco)
10. [Limitações e Considerações](#10-limitações-e-considerações)
11. [Validação Visual por IA](#11-validação-visual-por-ia-v0029)
12. [Transparência de IA](#12-transparência-de-ia)

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

### 4.4 Fusão Adaptativa SAR-NDVI [BETA]

O sistema implementa uma técnica avançada de fusão de dados que combina NDVI óptico (Sentinel-2) com dados de radar SAR (Sentinel-1) para preencher lacunas causadas por cobertura de nuvens.

#### Arquitetura do Módulo

```
┌─────────────────┐    ┌─────────────────┐
│   NDVI Óptico   │    │   SAR Sentinel-1│
│   (Sentinel-2)  │    │   (VV / VH)     │
└────────┬────────┘    └────────┬────────┘
         │                      │
         ▼                      ▼
┌─────────────────────────────────────────┐
│      SELEÇÃO ADAPTATIVA DE FEATURES     │
│  - Correlação VH vs NDVI               │
│  - Correlação VV vs NDVI               │
│  - Correlação VV+VH vs NDVI            │
│  → Escolhe melhor feature por talhão    │
└────────────────────┬────────────────────┘
                     ▼
┌─────────────────────────────────────────┐
│      CALIBRAÇÃO LOCAL POR TALHÃO        │
│  - Gaussian Process Regression (GPR)    │
│  - K-Nearest Neighbors (KNN)            │
│  - Linear Regression (fallback)         │
│  → Treina modelo específico por talhão  │
└────────────────────┬────────────────────┘
                     ▼
┌─────────────────────────────────────────┐
│         PREDIÇÃO EM GAPS                │
│  - Identifica gaps no NDVI óptico       │
│  - Aplica modelo para estimar NDVI      │
│  - Calcula incerteza da predição        │
└────────────────────┬────────────────────┘
                     ▼
┌─────────────────────────────────────────┐
│       SÉRIE NDVI FUSIONADA              │
│  → Dados ópticos + SAR-estimados        │
│  → Melhora detecção de EOS              │
│  → Ajusta score de confiança            │
└─────────────────────────────────────────┘
```

#### Seleção Adaptativa de Features

O sistema seleciona automaticamente a melhor combinação de polarizações SAR por talhão:

| Regra | Feature Selecionada | Critério |
|-------|---------------------|----------|
| 1 | VH | `corr(VH, NDVI) > 0.70` |
| 2 | VV | `corr(VV, NDVI) > corr(VH, NDVI) + 0.15` |
| 3 | VV+VH | Nenhuma acima atendida → combina ambas |

**Justificativa Científica:**
- **VH**: Mais sensível à estrutura da vegetação (biomassa)
- **VV**: Mais sensível à umidade do solo e superfície
- **VV+VH**: Combinação robusta quando correlações individuais são baixas

#### Modelos de Machine Learning

O sistema seleciona o melhor modelo via Leave-One-Out Cross-Validation:

| Modelo | Descrição | Vantagem |
|--------|-----------|----------|
| **GPR** | Gaussian Process Regression | Fornece incerteza das predições |
| **KNN** | K-Nearest Neighbors (k=3) | Robusto a outliers |
| **Linear** | Regressão Linear (fallback) | Simples, sempre disponível |

**Critérios de seleção:**
```javascript
// Escolhe modelo com menor RMSE no LOOCV
const bestModel = ['GPR', 'KNN', 'LINEAR']
  .map(m => ({ model: m, rmse: loocvRmse(m) }))
  .sort((a, b) => a.rmse - b.rmse)[0]
```

#### Ajuste de Confiança

A presença de dados SAR-fusionados afeta o score de confiança da detecção de colheita:

| Proporção SAR | Ajuste de Confiança | Fonte Indicada |
|---------------|---------------------|----------------|
| ≤ 30% | +0% a -5% | OPTICAL |
| 30-60% | -5% a -15% | MIXED |
| > 60% | -15% a -25% | SAR_HEAVY |

**Fórmula:**
```javascript
function calculateHarvestConfidence(baseConfidence, fusionR2, sarRatio) {
  // sarRatio: proporção de pontos SAR-fusionados (0-1)
  // fusionR2: R² do modelo de calibração (0-1)
  
  let adjustment = 1.0
  if (sarRatio > 0.6) {
    adjustment = 0.75 + 0.15 * fusionR2  // -10% a -25%
  } else if (sarRatio > 0.3) {
    adjustment = 0.85 + 0.10 * fusionR2  // -5% a -15%
  } else {
    adjustment = 0.95 + 0.05 * fusionR2  // 0% a -5%
  }
  
  return baseConfidence * adjustment
}
```

#### Fallback Gracioso

O sistema garante funcionamento mesmo quando a fusão falha:

```
┌─────────────────────────────────────────────────────────────┐
│                    ESTRATÉGIA DE FALLBACK                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Se enableSarNdviFusion = false                          │
│     → Usa fusão RVI clássica (se useRadarForGaps = true)    │
│     → Ou usa apenas NDVI óptico                             │
│                                                             │
│  2. Se fusão adaptativa falha (erro/exceção)                │
│     → Log do erro                                           │
│     → Fallback para fusão RVI clássica                      │
│     → Se RVI falha → usa NDVI óptico                        │
│                                                             │
│  3. Se dados SAR insuficientes (< 5 pontos coincidentes)    │
│     → Marca calibration.valid = false                       │
│     → Usa NDVI óptico apenas                                │
│                                                             │
│  4. Se modelo tem R² < 0.3                                  │
│     → Marca como calibração de baixa qualidade              │
│     → Predições SAR recebem alta incerteza                  │
│     → Peso reduzido no score de confiança                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Integração com Detecção de Colheita

Os dados SAR-fusionados alimentam diretamente o algoritmo de detecção fenológica:

1. **Entrada**: Série NDVI fusionada (óptico + SAR-estimado)
2. **Processamento**: Algoritmo de detecção de EOS inalterado
3. **Saída**: Data de colheita com `confidenceNote` indicando fonte de dados

**Exemplo de nota de confiança:**
- "Dados 100% ópticos" → `confidenceScore` sem ajuste
- "Fusão SAR moderada (45% SAR, R²=82%)" → Ajuste de -8%
- "Fusão SAR pesada (72% SAR, R²=68%)" → Ajuste de -18%

#### Habilitação (Feature Flag)

| Flag | Localização | Descrição |
|------|-------------|-----------|
| `enableSarNdviFusion` | WorkspaceSettings | Habilita fusão adaptativa [BETA] |
| `useRadarForGaps` | WorkspaceSettings | Habilita fusão RVI clássica |
| `useLocalCalibration` | WorkspaceSettings | Treina modelo local por talhão |

> **Importante**: `enableSarNdviFusion` está em fase BETA. A funcionalidade opera de forma transparente - se desabilitada ou em caso de falha, o sistema reverte automaticamente para o comportamento anterior.

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

## 6. Projeção Adaptativa por Fase Fenológica

### 6.1 Problema da Projeção Tradicional

A abordagem tradicional de usar **apenas a média histórica** para projeção apresenta limitações:

1. **Ignora tendência atual**: Dados recentes mostram direção do NDVI (subindo/caindo)
2. **Variabilidade entre safras**: Cada safra tem timing diferente
3. **Violação biológica**: Projeção pode "subir" quando planta está em senescência

### 6.2 Modelo Adaptativo

O sistema detecta a **fase fenológica atual** e aplica lógica diferenciada:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         MODELO ADAPTATIVO DE PROJEÇÃO                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Detectar fase usando regressão linear dos últimos 14 dias               │
│                                                                              │
│  2. Calcular tendência (slope) e qualidade do ajuste (R²)                   │
│                                                                              │
│  3. Aplicar lógica por fase:                                                 │
│                                                                              │
│     VEGETATIVO (slope > 0.5%/dia):                                           │
│       SE NDVI > 0.80 (próximo platô):                                        │
│         → min(tendência, histórico) - histórico mostra quando cai           │
│       SENÃO:                                                                 │
│         → 60% tendência + 40% histórico                                      │
│       Limite máximo: NDVI = 0.92                                             │
│                                                                              │
│     REPRODUTIVO (|slope| < 0.5%/dia):                                        │
│       → Usar histórico diretamente                                           │
│       Racional: padrão típico de platô → senescência                        │
│                                                                              │
│     SENESCÊNCIA (slope < -0.5%/dia, R² > 70%):                               │
│       → Decaimento exponencial: NDVI(t) = MIN + (N₀-MIN) × e^(-k×t)         │
│       Limite mínimo: NDVI = 0.18                                             │
│       Racional: curva suave até colheita                                     │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Detecção de Fase Fenológica

```javascript
function detectPhenologicalPhase(data, windowDays = 14) {
  // Regressão linear nos últimos N dias
  const regression = linearRegression(lastNDays)
  
  const SLOPE_THRESHOLD = 0.005  // 0.5% por dia
  
  if (regression.slope > SLOPE_THRESHOLD && regression.rSquared > 0.5) {
    return 'vegetative'   // NDVI subindo
  } else if (regression.slope < -SLOPE_THRESHOLD && regression.rSquared > 0.5) {
    return 'senescence'   // NDVI caindo
  } else {
    return 'reproductive' // NDVI estável (platô)
  }
}
```

### 6.4 Fundamento Estatístico

A detecção de tendência usa **regressão linear simples (OLS)**:

```
y = a + bx

onde:
- y = NDVI
- x = dias
- b = slope (taxa de mudança)
- a = intercept
```

**Métricas de validação:**

| Métrica | Descrição | Uso |
|---------|-----------|-----|
| R² | Coeficiente de determinação | Qualidade do ajuste (0-1) |
| p-value | Significância do slope | Se < 0.05, tendência é real |
| Slope | Taxa de mudança diária | Direção e velocidade |

### 6.5 Fundamento Biológico

O modelo respeita princípios agronômicos fundamentais:

| Fase | Comportamento Biológico | Regra de Projeção |
|------|------------------------|-------------------|
| **Vegetativo** | Planta crescendo, acumulando biomassa | Tendência limitada pelo platô (~0.92) |
| **Vegetativo (platô)** | Próximo ao máximo (NDVI > 0.80) | min(tendência, histórico) |
| **Reprodutivo** | Floração/enchimento, NDVI estável | Histórico é melhor preditor |
| **Senescência** | Maturação, perda de clorofila | Decaimento exponencial |

> **Princípios Fundamentais**:
> 1. Uma planta não pode crescer indefinidamente (limite ~0.92)
> 2. Uma planta em senescência não pode reverter o processo
> 3. O histórico mostra o padrão típico de transição entre fases

### 6.6 Exemplos Práticos

#### Caso 1: Senescência (NDVI caindo)

Talhão com NDVI caindo de 0.85 para 0.62 em 14 dias

**Modelo Antigo:** Projeção subia para 0.88 (errado)

**Modelo Adaptativo:** Projeção segue a queda (0.53, 0.41, 0.28)

O modelo detecta **senescência** (slope = -1.75%/dia, R² = 93%) e usa decaimento exponencial.

#### Caso 2: Próximo ao Platô (NDVI alto e subindo)

Talhão com NDVI = 0.90, slope = +1%/dia

**Modelo Antigo:** Projeção continua subindo indefinidamente (biologicamente impossível)

**Modelo Adaptativo:**
```
+7 dias: 0.886  (segue histórico, não tendência)
+30 dias: 0.736  (histórico mostra início da senescência)
+60 dias: 0.580  (histórico mostra senescência)
```

Quando NDVI > 0.80, o modelo dá prioridade ao histórico porque:
- A planta está próxima do platô máximo (~0.92)
- O histórico mostra quando começa a transição para senescência
- Continuar subindo indefinidamente viola limites biológicos

### 6.7 Extensão de Históricos até EOS

Para permitir ao usuário visualizar como as safras anteriores se comportaram no período equivalente (próximo à colheita), as linhas históricas são estendidas até a data de EOS prevista da safra atual.

**Metodologia:**

1. **Detecção de tendência**: Calcula-se o slope dos últimos 10 pontos de cada safra histórica
2. **Projeção exponencial**: Se a tendência é de queda (slope < -0.002), projeta-se usando decaimento exponencial
3. **Limite físico**: A projeção converge para MIN_NDVI (0.18 - solo/palha residual)

```javascript
// Para cada safra histórica com tendência de queda
if (slope < -0.002 && lastPointDate < eosTime) {
  const decayRate = Math.abs(slope) / (lastValue - MIN_NDVI)
  
  // Projeção exponencial até EOS + 7 dias
  projectedValue = MIN_NDVI + (lastValue - MIN_NDVI) * exp(-decayRate * days)
}
```

**Benefícios:**
- Usuário visualiza padrão completo de declínio das safras anteriores
- Comparação direta entre projeção atual e comportamento histórico
- Contexto para decisões de planejamento logístico

### 6.8 EOS Dinâmico (Previsão de Colheita)

Quando senescência é detectada com alta confiança, a data de EOS é calculada dinamicamente:

```javascript
// Critérios para EOS dinâmico:
if (slope < -0.01 && rSquared > 0.7 && ndvi_atual < ndvi_pico * 0.85) {
  // Calcular quando projeção cruza threshold de colheita
  // Fórmula: t = -ln((threshold - MIN) / (NDVI_0 - MIN)) / k
  eosDate = calculateDynamicEos(...)
}
```

**Exemplo real:**

| Método | Data EOS | Diferença |
|--------|----------|-----------|
| Fixo (plantio + 120d) | 22/02/2026 | - |
| **Dinâmico (tendência)** | **05/02/2026** | **17 dias antes** |

O EOS dinâmico é mais preciso porque usa dados reais de senescência observada, não assunções genéricas sobre ciclo típico.

---

## 7. Níveis de Confiança

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

## 8. Estimativa de Produtividade

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

## 9. Análises por Template

### 9.1 Análise de Crédito

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

### 9.2 Análise Logística (v2.0 - Híbrida)

**Objetivo**: Planejar recepção e transporte de grãos.

**Público**: Tradings, cooperativas, transportadoras.

**Arquitetura**: Híbrida (Algorítmica + IA)

#### Métricas Algorítmicas (Calculadas pelo Sistema)

Estas métricas são determinísticas e replicáveis:

```javascript
// Início da colheita = EOS - 5 dias (preparação)
const harvestStart = new Date(eosDate)
harvestStart.setDate(harvestStart.getDate() - 5)

// Duração baseada na área: 2 dias a cada 80 ha, mínimo 5 dias
const daysToHarvest = Math.max(5, Math.ceil(areaHa / 80) * 2)

// Fim da colheita
const harvestEnd = new Date(harvestStart)
harvestEnd.setDate(harvestEnd.getDate() + daysToHarvest)

// Pico: começa 2 dias após início, termina 2 dias antes do fim
const peakStart = harvestStart + 2 dias
const peakEnd = harvestEnd - 2 dias

// Volume diário (80 ha/dia de colheita típico)
const dailyVolume = (volumeTon / areaHa) * 80

// Carretas necessárias (35 ton por viagem)
const trucksNeeded = Math.ceil(volumeTon / 35)
```

| Métrica | Fórmula | Fonte |
|---------|---------|-------|
| Início Colheita | EOS - 5 dias | ALGORITMO |
| Fim Colheita | Início + max(5, ceil(área/80)*2) | ALGORITMO |
| Início Pico | Início + 2 dias | ALGORITMO |
| Fim Pico | Fim - 2 dias | ALGORITMO |
| Volume Diário | (volTon / área) × 80 | ALGORITMO |
| Carretas | ceil(volTon / 35) | ALGORITMO |

#### Análise Qualitativa (Gerada por IA)

A IA recebe as métricas pré-calculadas e foca na interpretação:

| Análise | Critério | Fonte |
|---------|----------|-------|
| Risco Clima | Período da colheita vs sazonalidade | IA |
| Risco Qualidade | Clima + área + duração | IA |
| Riscos Identificados | Contexto regional | IA |
| Recomendações | Ações práticas | IA |

#### Classificação de Status

| Status | Critério |
|--------|----------|
| **ÓTIMO** | weatherRisk = BAIXO |
| **ATENÇÃO** | weatherRisk = MEDIO |
| **CRÍTICO** | weatherRisk = ALTO |

#### Interface de Saída

```typescript
interface LogisticsAnalysisResult {
  status: 'OTIMO' | 'ATENCAO' | 'CRITICO'
  metrics: {
    // Algorítmico
    harvestStart: string
    harvestEnd: string
    peakStart: string
    peakEnd: string
    dailyVolume: number
    trucksNeeded: number
    daysToHarvest: number
    metricsSource: 'ALGORITHM'
    // IA
    weatherRisk: 'BAIXO' | 'MEDIO' | 'ALTO'
    grainQualityRisk: 'BAIXO' | 'MEDIO' | 'ALTO'
    analysisSource: 'AI' | 'FALLBACK'
  }
  risks: string[]
  recommendations: string[]
  summary: string
}
```

---

### 9.3 Matriz de Risco

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

## 10. Limitações e Considerações

### 10.1 Limitações do Sensoriamento Remoto

1. **Cobertura de nuvens**: Imagens com >50% nuvens são descartadas, gerando gaps
2. **Resolução temporal**: Revisita do satélite a cada 5-10 dias
3. **Resolução espacial**: Pixels de 10-30m podem não capturar variabilidade interna
4. **Mistura de pixels**: Bordas do talhão podem ter contaminação de áreas vizinhas

### 10.2 Limitações do Modelo

1. **Detecção de SOS/EOS**: Depende de thresholds fixos que podem não se aplicar a todas as regiões
2. **Produtividade**: Modelo simplificado baseado apenas em NDVI; não considera pragas, doenças, fertilidade
3. **Histórico**: Requer mínimo de 3 safras para correlação confiável
4. **Segunda safra**: Modelo otimizado para safra principal; safrinha pode ter comportamento diferente

### 10.3 Recomendações de Uso

| Situação | Recomendação |
|----------|--------------|
| Confiança LOW | Solicitar vistoria presencial |
| Correlação < 50% | Verificar se geometria está correta |
| Sem SOS detectado | Verificar data de início de safra |
| NDVI máx < 0.5 | Possível problema grave; verificar in loco |

### 10.4 Atualização dos Dados

- **Frequência**: Dados atualizados a cada passagem do satélite (5-10 dias)
- **Latência**: Processamento das imagens pode levar 1-3 dias
- **Reprocessamento**: Usuário pode forçar reprocessamento a qualquer momento

---

## 11. Validação Visual por IA (v0.0.32)

### 11.1 Visão Geral

O sistema implementa um pipeline de criticidade de cultura e validação visual que usa análise algorítmica de padrões NDVI e IA multimodal (Google Gemini) para verificar a presença da cultura declarada e confirmar ou questionar as projeções algorítmicas.

### 11.1a Pipeline de Criticidade de Cultura (v0.0.32)

Antes da validação visual, uma análise algorítmica (custo zero) verifica se a curva NDVI é compatível com a cultura declarada:

- **Culturas suportadas**: Soja, Milho, Gergelim, Cevada, Algodão, Arroz (anuais), Cana (semi-perene), Café (perene)
- **Classificações**: TYPICAL, ATYPICAL, ANOMALOUS, NO_CROP
- **NO_CROP**: Short-circuit total — nenhum cálculo de EOS, GDD, volume ou IA é executado
- **ANOMALOUS**: Agente Verificador IA confirma visualmente antes de prosseguir ao Judge
- **ATYPICAL (v0.0.33)**: Inclui culturas anuais sem detecção de SOS/EOS (ciclo indefinido) e amplitude NDVI abaixo de 85% do esperado
- **Agente Verificador**: Modelo flash-lite, especializado em identificar presença/ausência de cultura
- **Supressão IA (v0.0.33)**: Quando crop issue detectado (NO_CROP, ANOMALOUS, ATYPICAL ou Verifier ≠ CONFIRMED), resultados do Judge são suprimidos no dashboard e relatório
- **Layout orientado por crop issue (v0.0.33)**: Alerta de Cultura no TOPO do relatório; cards de Volume, EOS, GDD, Confiança suprimidos; status de processamento é `SUCCESS` (não `PARTIAL`)

### 11.2 Arquitetura de Agentes

```
┌─────────────────────────────────────────────────────────────────┐
│             PIPELINE DE CRITICIDADE + VALIDAÇÃO VISUAL           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  0. VERIFICAÇÃO DE PADRÃO (algorítmico, custo zero)              │
│     ├── Analisa curva NDVI vs thresholds por cultura             │
│     ├── 8 culturas em 3 categorias (anual/semi-perene/perene)   │
│     ├── NO_CROP → short-circuit (nenhum cálculo posterior)       │
│     └── ANOMALOUS → aciona Verificador IA                        │
│                                                                  │
│  1. BUSCA DE IMAGENS (Sentinel Hub Process API)                  │
│     ├── True Color (Sentinel-2 L2A)                              │
│     ├── NDVI Colorizado (com legenda de threshold)               │
│     ├── Radar Composto (Sentinel-1 GRD - VV/VH)                 │
│     ├── Landsat 8/9 NDVI (campos > 200 ha)                      │
│     └── Sentinel-3 OLCI NDVI (campos > 500 ha)                  │
│                                                                  │
│  2. AGENTE CURADOR                                               │
│     ├── Modelo: gemini-2.5-flash-lite (padrão)                   │
│     ├── Avalia qualidade das imagens (nuvens, cobertura)         │
│     ├── Pontua cada imagem (0-100)                               │
│     └── Seleciona as melhores para Verificador/Juiz              │
│                                                                  │
│  2.5 AGENTE VERIFICADOR (se ANOMALOUS ou ATYPICAL)              │
│     ├── Modelo: gemini-2.5-flash-lite                            │
│     ├── Verifica se cultura declarada está presente              │
│     ├── Status: CONFIRMED/SUSPICIOUS/MISMATCH/NO_CROP/FAILURE   │
│     └── NO_CROP/MISMATCH → short-circuit (Judge não executa)    │
│                                                                  │
│  3. AGENTE JUIZ                                                  │
│     ├── Modelo: gemini-3-flash-preview                           │
│     ├── Recebe imagens curadas + dados agronômicos completos     │
│     ├── Valida estágio fenológico visual vs projeção             │
│     ├── Ajusta EOS baseado em evidência visual                   │
│     └── Emite concordância: CONFIRMED / QUESTIONED / REJECTED    │
│                                                                  │
│  4. NORMALIZAÇÃO (ai-validation.service.ts)                      │
│     ├── Mapeia PT → EN (stress levels, risk levels)              │
│     ├── Converte schema antigo → novo (isReady→ready, etc.)     │
│     └── Valida formato de datas (YYYY-MM-DD)                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 11.3 Critérios de Decisão do Juiz (v0.0.30)

| Concordância | Critério |
|-------------|----------|
| **CONFIRMED** | Divergência EOS < 7 dias E estágio fenológico visual compatível |
| **QUESTIONED** | Divergência EOS 7-14 dias OU estágio visual parcialmente compatível |
| **REJECTED** | Divergência EOS > 14 dias OU estágio visual claramente incompatível |

### 11.4 Dados de Saída

```typescript
interface AIValidationResult {
  agreement: 'CONFIRMED' | 'QUESTIONED' | 'REJECTED'
  eosAdjustedDate: string              // YYYY-MM-DD
  confidenceAI: number                 // 0-100
  phenologicalStageVisual: string      // Estágio observado na imagem
  harvestReadiness: {
    ready: boolean
    estimatedDate: string | null
    delayRisk: 'NONE' | 'RAIN' | 'MOISTURE' | 'MATURITY'
    delayDays: number
    notes: string
  }
  riskAssessment: {
    overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    factors: {
      category: 'CLIMATIC' | 'PHYTOSANITARY' | 'OPERATIONAL'
      severity: 'LOW' | 'MEDIUM' | 'HIGH'
      description: string
    }[]
  }
  visualAlerts: {
    type: string
    severity: 'LOW' | 'MEDIUM' | 'HIGH'
    description: string
  }[]
  recommendations: string[]
  costUsd: number                      // Custo acumulado da validação
}
```

### 11.5 Feature Flags

| Flag | Default | Descrição |
|------|---------|-----------|
| `enableAIValidation` | false | Habilita pipeline de validação visual |
| `aiValidationTrigger` | 'MANUAL' | Modo: MANUAL / ON_PROCESS / ON_LOW_CONFIDENCE |
| `aiCuratorModel` | 'FLASH_LITE' | Modelo do Curador |
| `showAIValidation` | true | Mostrar painel no relatório |

### 11.6 Integração com Templates

Quando a validação visual está disponível, os dados são injetados no `AnalysisContext`:
- Templates de Logística, Crédito e Matriz de Risco recebem `aiValidationAgreement`
- Campo `aiValidationUsed` registrado na análise

---

## 12. Transparência de IA

### 12.1 Modelos Utilizados

O sistema utiliza múltiplos modelos do **Google Gemini**:

| Uso | Modelo | SDK | Contexto |
|-----|--------|-----|----------|
| Templates de Análise | `gemini-3-flash-preview` | `@google/genai` | Riscos, recomendações |
| Agente Curador | `gemini-2.5-flash-lite` (padrão) | `@google/genai` | Seleção de imagens |
| Agente Verificador | `gemini-2.5-flash-lite` | `@google/genai` | Confirmação visual de cultura |
| Agente Juiz | `gemini-3-flash-preview` | `@google/genai` | Validação visual multimodal |

**Fallback**: Regras automáticas quando IA indisponível (tanto para templates quanto validação visual).

### 12.2 Identificação Visual

Todas as análises geradas por modelos de linguagem (LLM) exibem:

- **Badge "Gerado por IA"**: Indicador visual roxo com ícone de sparkles
- **Badge "Análise por Regras"**: Quando fallback é usado
- **Badge de Concordância IA**: Confirmado (verde) / Questionado (amarelo) / Rejeitado (vermelho)
- **Tooltip explicativo**: Ao passar o mouse, exibe como os dados foram calculados
- **Painel de Validação Visual**: Métricas, alertas e recomendações do Juiz IA

### 12.3 Metodologias por Template

| Template | Métricas | Fonte de Cálculo |
|----------|----------|------------------|
| **Logística** | Início/Fim Colheita | EOS ± dias baseado em área |
| **Logística** | Volume Diário | Área × Produtividade ÷ Dias |
| **Logística** | Riscos | Análise climática regional |
| **Crédito** | Score | Correlação histórica + confiança |
| **Crédito** | Garantia | Volume × preço mercado |
| **Risco** | Scores | Matriz multidimensional |

### 12.4 Dados ZARC (Zoneamento Agrícola)

- **Fonte**: Dados oficiais do MAPA (Ministério da Agricultura)
- **Uso**: Apenas informativo (badge no card de Plantio)
- **Não afeta**: Cálculos de alinhamento ou projeção

---

## Changelog

| Versão | Data | Alterações |
|--------|------|------------|
| 1.0.0 | 2024-01 | Versão inicial |
| 1.1.0 | 2025-01 | Adicionado serviço de correlação robusta com Pearson |
| 1.2.0 | 2026-01 | Alinhamento fenológico por SOS |
| 1.3.0 | 2026-01 | Adicionado estado PARTIAL para dados incompletos |
| 1.4.0 | 2026-01 | Modelo de Projeção Adaptativa com detecção de fase fenológica |
| 1.5.0 | 2026-01 | Dados ZARC integrados para informação de janela de plantio |
| 1.6.0 | 2026-01 | Transparência de IA: badges e tooltips explicativos |
| 2.0.0 | 2026-01 | **Arquitetura Híbrida**: Métricas algorítmicas + análise qualitativa por IA |
| 2.1.0 | 2026-01 | Gemini 3 Flash Preview, correção timezone, polling automático |
| 2.2.0 | 2026-02 | **[BETA] Fusão Adaptativa SAR-NDVI**: GPR/KNN para estimar NDVI de Sentinel-1, seleção adaptativa de features (VH/VV/VV+VH), calibração local por talhão, ajuste de confiança baseado em fonte de dados, fallback gracioso |
| 2.3.0 | 2026-02 | **UX de Processamento**: Modal contextual na página do talhão, endpoint leve `/api/fields/[id]/status` para polling eficiente, correção de loops de re-renderização |
| 3.0.0 | 2026-02 | **Validação Visual IA**: Pipeline Curador + Juiz multimodal com Gemini, busca de imagens Sentinel Hub, 3 modos de trigger, normalização PT→EN, critérios de decisão quantitativos |
| 3.1.0 | 2026-02 | **Correção Pipeline EOS**: Single source of truth, GDD backtracking, mapeamento stress PT→EN, server-side canonical fusedEos, eliminação de divergência client/server |
| 3.2.0 | 2026-02 | **Dashboard Avançado**: Tabela ordenável com 13 colunas, filtros de janela de colheita/confiança/IA, correção mapeamento de campos AI na API, 6 fontes de dados no card IA |
| 4.0.0 | 2026-02 | **Pipeline de Criticidade de Cultura**: Verificação algorítmica de padrão NDVI para 8 culturas (3 categorias), Agente Verificador IA, short-circuit NO_CROP, dashboard com coluna/filtro de cultura |
| 4.1.0 | 2026-02 | **Sanidade EOS + ATYPICAL**: NDVI prevalece sobre GDD em contradições, GDD override para datas passadas, ATYPICAL refinado (ciclo indefinido + baixa amplitude), supressão de resultados Judge no dashboard/relatório para crop issues |

---

## Documentos Relacionados

- [README.md](./README.md) - Visão geral do projeto
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Arquitetura do sistema
- [DIAGNOSTICOLOG.md](./DIAGNOSTICOLOG.md) - Módulo de diagnóstico logístico
- [DOCS.md](./DOCS.md) - Índice completo de documentação

---

*Documento gerado automaticamente. Para dúvidas técnicas, consulte o código-fonte nos arquivos de serviço.*
