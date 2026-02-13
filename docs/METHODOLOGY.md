# Metodologia de Monitoramento Agrícola

**Versão:** 0.0.33 (ALPHA)

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Fontes de Dados](#2-fontes-de-dados)
   - [2.1 Sentinel-2 (NDVI Óptico)](#21-sentinel-2-ndvi-óptico)
   - [2.2 Sentinel-1 (Radar SAR)](#22-sentinel-1-radar-sar)
   - [2.3 API Merx](#23-api-merx)
   - [2.4 Precipitação](#24-precipitação)
   - [2.5 Temperatura](#25-temperatura)
   - [2.6 Balanço Hídrico](#26-balanço-hídrico)
   - [2.7 Solo](#27-solo)
3. [Detecção Fenológica](#3-detecção-fenológica)
4. [Interpolação e Suavização](#4-interpolação-e-suavização)
5. [Fusão Adaptativa SAR-NDVI [BETA]](#5-fusão-adaptativa-sar-ndvi-beta)
6. [Correlação Histórica](#6-correlação-histórica)
7. [Projeção Adaptativa por Fase Fenológica](#7-projeção-adaptativa-por-fase-fenológica)
8. [Soma Térmica (GDD)](#8-soma-térmica-gdd)
9. [Envelope Climático](#9-envelope-climático)
10. [Fusão EOS (NDVI + GDD + Balanço Hídrico)](#10-fusão-eos-ndvi--gdd--balanço-hídrico)
11. [Níveis de Confiança](#11-níveis-de-confiança)
12. [Estimativa de Produtividade](#12-estimativa-de-produtividade)
13. [Pipeline de Criticidade de Cultura](#13-pipeline-de-criticidade-de-cultura)
14. [Validação Visual por IA](#14-validação-visual-por-ia)
15. [Análises por Template](#15-análises-por-template)
16. [Feature Flags e Configuração](#16-feature-flags-e-configuração)
17. [Graceful Degradation](#17-graceful-degradation)
18. [Transparência de IA](#18-transparência-de-ia)
19. [Limitações e Considerações](#19-limitações-e-considerações)
20. [Referências Bibliográficas](#referências-bibliográficas)
21. [Changelog](#changelog)

---

## 1. Visão Geral

O sistema de monitoramento agrícola utiliza dados de sensoriamento remoto (satélite) para detectar automaticamente o ciclo fenológico de culturas, estimar produtividade e gerar análises de risco para diferentes finalidades comerciais.

### Objetivos Principais

- **Maior precisão na detecção de EOS** através da fusão de múltiplas fontes de dados
- **Single Source of Truth (v0.0.30)**: Data canônica calculada no servidor, eliminando divergências
- **Validação Visual por IA (v0.0.29)**: Agentes multimodais confirmam ou questionam projeções
- **Criticidade de Cultura (v0.0.32)**: Verificação algorítmica + IA se a cultura declarada existe
- **Robustez contra falhas** com graceful degradation em cada camada
- **Transparência** com badges de status indicando a qualidade dos dados
- **Configurabilidade** por workspace via feature flags
- **Continuidade de dados** usando radar para preencher gaps de nuvens

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

## 2. Fontes de Dados

### 2.1 Sentinel-2 (NDVI Óptico)

**Endpoint:** `/consulta-ndvi-json` (via API Merx)  
**Resolução Temporal:** 5 dias (revisita)  
**Resolução Espacial:** 10m  

O NDVI (Normalized Difference Vegetation Index) é calculado a partir das bandas NIR e RED:

```
NDVI = (NIR - RED) / (NIR + RED)
```

| Valor NDVI | Interpretação |
|------------|---------------|
| < 0.2 | Solo exposto, água, áreas urbanas |
| 0.2 - 0.35 | Vegetação esparsa ou senescente |
| 0.35 - 0.5 | Vegetação em desenvolvimento inicial |
| 0.5 - 0.7 | Vegetação moderada |
| 0.7 - 0.9 | Vegetação densa e saudável |
| > 0.9 | Vegetação muito densa (raro) |

**Limitações:** Afetado por cobertura de nuvens; gaps podem ocorrer em períodos chuvosos.

### 2.2 Sentinel-1 (Radar SAR)

**Endpoint:** Copernicus Data Space API  
**Resolução Temporal:** 6 dias  
**Resolução Espacial:** 10m  
**Polarizações:** VV, VH  

**Índice Utilizado - RVI (Radar Vegetation Index):**

```
RVI = 4 × VH / (VV + VH)
```

Referência: Kim & van Zyl (2009)

**Conversão RVI → NDVI:**

```
NDVI_estimado = a × RVI + b
```

#### Coeficientes Fixos (Literatura)

| Cultura  | a     | b      | R²   | Fonte                    |
|----------|-------|--------|------|--------------------------|
| SOJA     | 1.15  | -0.15  | 0.78 | Filgueiras et al. (2019) |
| MILHO    | 1.10  | -0.12  | 0.75 | Filgueiras et al. (2019) |
| ALGODÃO  | 1.20  | -0.18  | 0.72 | Veloso et al. (2017)     |

#### Calibração Local (Machine Learning Hyperlocal)

Baseado em: **Pelta et al. (2022)** "SNAF: Sentinel-1 to NDVI for Agricultural Fields Using Hyperlocal Dynamic Machine Learning Approach" - Remote Sensing, 14(11), 2600

**Conceito**: A relação RVI-NDVI varia por talhão, cultura, solo e condições locais. O SNAF demonstrou que modelos específicos por campo alcançam RMSE de 0.06 e R² de 0.92.

**Implementação:**
- **Coleta de Pares**: Durante processamento, identifica datas coincidentes (±1 dia) entre NDVI óptico e RVI radar
- **Treinamento**: Quando existem ≥15 pares, treina regressão linear OLS para o talhão
- **Validação**: Modelo local só é usado se R² ≥ 0.5
- **Fallback**: Se modelo local não disponível, usa coeficientes fixos da literatura

**Feature Flag**: `useLocalCalibration` (sub-opção de `useRadarForGaps`)

### 2.3 API Merx

O sistema utiliza a API Merx para obtenção de dados de sensoriamento remoto:

| Endpoint | Descrição | Retorno |
|----------|-----------|---------|
| `/consulta-ndvi` | Série temporal NDVI | Pontos com data, NDVI bruto, interpolado e suavizado |
| `/consulta-precipitacao` | Dados de precipitação | Chuva diária/acumulada |
| `/consulta-solo` | Características do solo | Tipo, textura, capacidade |
| `/consulta-area-lavoura` | Área cultivada | Hectares detectados |
| `/consulta-zarc-anual` | Zoneamento agrícola | Risco climático por região |

### 2.4 Precipitação

**Endpoint:** `/consulta-precipitacao`  
**Fonte:** GPM (Global Precipitation Measurement)  
**Resolução Temporal:** Diária  

**Métricas Calculadas:**
- Total acumulado (mm)
- Dias com chuva (>0.1mm)
- Precipitação recente (últimos 7 dias)

**Ajuste de Colheita por Precipitação:**

| Precipitação Recente | Risco de Qualidade | Atraso Recomendado |
|---------------------|-------------------|-------------------|
| < 10mm              | BAIXO             | 0 dias            |
| 10-30mm             | MODERADO          | 2-3 dias          |
| 30-60mm             | ALTO              | 5-7 dias          |
| > 60mm              | CRÍTICO           | 7+ dias           |

### 2.5 Temperatura

**Endpoint:** `/consulta-temperatura-json`  
**Fonte:** ERA5 / MODIS LST  
**Resolução Temporal:** Diária  
**Histórico Disponível:** Até 3 anos  

### 2.6 Balanço Hídrico

**Endpoint:** `/consulta-balanco-hidrico-json`  
**Parâmetros:** Geometria, data de plantio, cultura  

**Métricas Calculadas:**
- ETc (Evapotranspiração da cultura)
- ETr (Evapotranspiração real)
- Déficit hídrico diário
- Excedente hídrico

**Ajuste de EOS por Estresse Hídrico:**

| Déficit Acumulado | Dias de Estresse | Nível      | Ajuste EOS | Impacto Prod. |
|-------------------|------------------|------------|------------|---------------|
| < 25mm            | < 7              | BAIXO      | 0 dias     | 0%            |
| 25-50mm           | 7-14             | MODERADO   | -3 dias    | -5%           |
| 50-100mm          | 14-21            | SEVERO     | -7 dias    | -15%          |
| > 100mm           | > 21             | CRÍTICO    | -12 dias   | -30%          |

### 2.7 Solo

**Endpoint:** `/consulta-solo-json`  
**Informações:** Tipo de solo, textura  

**Classificação de Retenção de Água:**

| Textura         | Retenção | Impacto no Balanço Hídrico |
|-----------------|----------|---------------------------|
| Argilosa        | ALTA     | Maior reserva de água     |
| Média           | MÉDIA    | Equilíbrio                |
| Arenosa         | BAIXA    | Menor reserva, mais déficit|

### 2.8 Histórico

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

> **Nota:** O enum `CropType` no Prisma contém apenas SOJA e MILHO. O `phenology.service` usa estes thresholds para **cálculos fenológicos** (SOS, EOS, produtividade). O `crop-pattern.service` suporta 8 culturas para **detecção de padrão** (ver seção 13).

```javascript
const CROP_THRESHOLDS = {
  SOJA: {
    sosNdvi: 0.35,      // Threshold para emergência
    eosNdvi: 0.38,      // Threshold para colheita
    peakMinNdvi: 0.70,  // Pico mínimo esperado
    cycleDays: 120,     // Ciclo típico
    emergenceDays: 8,   // Dias plantio→emergência
    baseYieldKgHa: 3500
  },
  MILHO: {
    sosNdvi: 0.30,
    eosNdvi: 0.35,
    peakMinNdvi: 0.65,
    cycleDays: 140,
    emergenceDays: 7,
    baseYieldKgHa: 9000
  },
  ALGODAO: {
    sosNdvi: 0.32,
    eosNdvi: 0.40,
    peakMinNdvi: 0.60,
    cycleDays: 180,
    emergenceDays: 10,
    baseYieldKgHa: 4500
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

## 5. Fusão Adaptativa SAR-NDVI [BETA]

O sistema implementa uma técnica avançada de fusão de dados que combina NDVI óptico (Sentinel-2) com dados de radar SAR (Sentinel-1) para preencher lacunas causadas por cobertura de nuvens.

### Arquitetura do Módulo

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

### Seleção Adaptativa de Features

| Regra | Feature Selecionada | Critério |
|-------|---------------------|----------|
| 1 | VH | `corr(VH, NDVI) > 0.70` |
| 2 | VV | `corr(VV, NDVI) > corr(VH, NDVI) + 0.15` |
| 3 | VV+VH | Nenhuma acima atendida → combina ambas |

### Modelos de Machine Learning

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

### Ajuste de Confiança

| Proporção SAR | Ajuste de Confiança | Fonte Indicada |
|---------------|---------------------|----------------|
| ≤ 30% | +0% a -5% | OPTICAL |
| 30-60% | -5% a -15% | MIXED |
| > 60% | -15% a -25% | SAR_HEAVY |

### Fallback Gracioso

```
┌─────────────────────────────────────────────────────────────┐
│                    ESTRATÉGIA DE FALLBACK                   │
├─────────────────────────────────────────────────────────────┤
│  1. Se enableSarNdviFusion = false                          │
│     → Usa fusão RVI clássica (se useRadarForGaps = true)    │
│     → Ou usa apenas NDVI óptico                             │
│  2. Se fusão adaptativa falha (erro/exceção)                │
│     → Log do erro → Fallback para fusão RVI clássica        │
│  3. Se dados SAR insuficientes (< 5 pontos coincidentes)    │
│     → Marca calibration.valid = false → Usa NDVI óptico     │
│  4. Se modelo tem R² < 0.3                                  │
│     → Marca como calibração de baixa qualidade              │
└─────────────────────────────────────────────────────────────┘
```

### Integração com Detecção de Colheita

Os dados SAR-fusionados alimentam diretamente o algoritmo de detecção fenológica:

1. **Entrada**: Série NDVI fusionada (óptico + SAR-estimado)
2. **Processamento**: Algoritmo de detecção de EOS inalterado
3. **Saída**: Data de colheita com `confidenceNote` indicando fonte de dados

**Exemplo de nota de confiança:**
- "Dados 100% ópticos" → `confidenceScore` sem ajuste
- "Fusão SAR moderada (45% SAR, R²=82%)" → Ajuste de -8%
- "Fusão SAR pesada (72% SAR, R²=68%)" → Ajuste de -18%

**Fórmula de ajuste:**
```javascript
function calculateHarvestConfidence(baseConfidence, fusionR2, sarRatio) {
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

### Habilitação (Feature Flag)

| Flag | WorkspaceSettings | Descrição |
|------|-------------------|-----------|
| `enableSarNdviFusion` | Boolean @default(false) | Habilita fusão adaptativa [BETA] |
| `useRadarForGaps` | Boolean @default(false) | Habilita fusão RVI clássica |
| `useLocalCalibration` | Boolean @default(false) | Treina modelo local por talhão |

> **Importante**: `enableSarNdviFusion` está em fase BETA. Se desabilitada ou em caso de falha, o sistema reverte automaticamente para o comportamento anterior.

---

## 6. Correlação Histórica

### 6.1 Objetivo

Determinar quão similar a safra atual está em relação às safras passadas, permitindo:
- Identificar safras anômalas
- Validar qualidade dos dados
- Projetar comportamento futuro

### 6.2 Métricas de Correlação

#### 6.2.1 Correlação de Pearson (40% do peso)

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
| < 0.3 | Correlação muito fraca |

#### 6.2.2 RMSE Score (30% do peso)

Mede diferença absoluta média (0 = perfeito, 1 = máximo erro):

```javascript
function normalizedRMSE(actual, predicted) {
  let sumSquaredError = 0
  for (let i = 0; i < n; i++) {
    sumSquaredError += Math.pow(actual[i] - predicted[i], 2)
  }
  return Math.sqrt(sumSquaredError / n)
}
```

#### 6.2.3 Aderência ao Envelope (30% do peso)

Percentual de pontos dentro do min/max histórico:

```javascript
const margin = 0.05
if (current >= historicalMin - margin && current <= historicalMax + margin) {
  pointsInEnvelope++
}
adherenceScore = (pointsInEnvelope / totalPoints) * 100
```

### 6.3 Alinhamento Fenológico

**Problema**: Safras diferentes começam em datas diferentes.

**Solução**: Alinhar por **dia do ciclo** (dias desde emergência).

### 6.4 Score Composto

```javascript
compositeScore = pearsonScore * 0.4 + rmseScore * 0.3 + adherenceScore * 0.3
```

---

## 7. Projeção Adaptativa por Fase Fenológica

### 7.1 Problema da Projeção Tradicional

A abordagem tradicional de usar **apenas a média histórica** ignora tendência atual, variabilidade entre safras e pode violar limites biológicos.

### 7.2 Modelo Adaptativo

O sistema detecta a **fase fenológica atual** e aplica lógica diferenciada:

- **VEGETATIVO** (slope > 0.5%/dia): 60% tendência + 40% histórico; limite máximo NDVI = 0.92
- **REPRODUTIVO** (|slope| < 0.5%/dia): Usar histórico diretamente
- **SENESCÊNCIA** (slope < -0.5%/dia, R² > 70%): Decaimento exponencial; limite mínimo NDVI = 0.18

### 7.3 Detecção de Fase Fenológica

```javascript
const SLOPE_THRESHOLD = 0.005  // 0.5% por dia
if (regression.slope > SLOPE_THRESHOLD) return 'vegetative'
else if (regression.slope < -SLOPE_THRESHOLD) return 'senescence'
else return 'reproductive'
```

### 7.4 EOS Dinâmico (Previsão de Colheita)

Quando senescência é detectada com alta confiança (slope < -0.01, R² > 0.7, NDVI < 85% do pico), a data de EOS é calculada dinamicamente via modelo exponencial.

### 7.5 Extensão de Históricos até EOS

As linhas históricas são estendidas até a data de EOS prevista usando projeção exponencial quando tendência de queda é detectada.

---

## 8. Soma Térmica (GDD)

**Cálculo Diário:**
```
GDD = max(0, T_média - T_base)
```

**Requisitos por Cultura:**

| Cultura  | T_base | GDD Total | GDD até Floração | GDD Floração→Maturação |
|----------|--------|-----------|------------------|------------------------|
| SOJA     | 10°C   | 1300      | 700              | 600                    |
| MILHO    | 10°C   | 1500      | 800              | 700                    |
| ALGODÃO  | 12°C   | 1800      | 900              | 900                    |
| TRIGO    | 5°C    | 1100      | 600              | 500                    |

Referências: McMaster & Wilhelm (1997), Fehr & Caviness (1977), EMBRAPA

**Projeção de EOS por GDD:**
```
Dias_para_maturação = (GDD_total - GDD_acumulado) / GDD_médio_recente
EOS_projetado = Data_atual + Dias_para_maturação
```

---

## 9. Envelope Climático

Inspirado em Bandas de Bollinger, calcula faixas normais baseadas em histórico.

**Cálculo por Dia do Ano:**
```
Para cada dia do ano (1-365):
  média = mean(valores_históricos)
  σ = stddev(valores_históricos)
  banda_superior = média + 1.5σ
  banda_inferior = média - 1.5σ
```

**Detecção de Anomalias:**

| Desvio (σ)  | Classificação    |
|-------------|------------------|
| < 1.5       | Normal           |
| 1.5 - 2.5   | Anomalia         |
| > 2.5       | Evento Extremo   |

---

## 10. Fusão EOS (NDVI + GDD + Balanço Hídrico)

**Serviço:** `lib/services/eos-fusion.service.ts`

A fusão de EOS combina múltiplas fontes de dados para determinar a data de colheita mais precisa.

### Referências Científicas

| Conceito | Referência | Aplicação |
|----------|------------|-----------|
| Fusão NDVI + GDD | PhenoCrop Framework (Sakamoto et al., 2020) | 77% acurácia milho, 71% soja |
| Threshold NDVI senescência | Kumudini et al. (2021) | 85% redução vs R5 = maturidade |
| GDD por Grupo Maturidade | Mourtzinis et al. (2017) | MG 0.4 = 1862 AGDD |
| Estresse Hídrico | Desclaux et al. (2003) | Estresse acelera senescência |

### Algoritmo de Seleção (v0.0.30 + v0.0.33)

```
ENTRADA:
  - EOS_NDVI, EOS_GDD, NDVI_atual, GDD_progress, taxa_declínio
  - estresse_hídrico (NONE/LOW/MEDIUM/HIGH/CRITICAL) [EN]
  - stressDays, yieldImpact

PROCESSO:

1. SE GDD >= 100% E NDVI < 0.65 E taxa_declínio > 0.5%:
   → Maturação fisiológica atingida
   → EOS = EOS_NDVI (ou média ponderada NDVI+GDD)
   → NÃO usa "hoje" como fallback (fix v0.0.30)
   → passed = EOS < hoje

2. SE EOS_NDVI já passou E NDVI > 0.7:
   → Planta ainda verde, projeção NDVI desatualizada
   → EOS = EOS_GDD

3. SE |EOS_NDVI - EOS_GDD| < 7 dias:
   → Projeções convergentes → média ponderada

4. AJUSTE POR ESTRESSE HÍDRICO:
   | Nível    | Ajuste      |
   |----------|-------------|
   | NONE     | 0 dias      |
   | LOW      | 0 dias      |
   | MEDIUM   | -2 dias     |
   | HIGH     | -4 dias     |
   | CRITICAL | -7 dias     |

   IMPORTANTE (fix v0.0.30): Mapeamento PT→EN em process/route.ts:
   CRITICO→CRITICAL, SEVERO→HIGH, MODERADO→MEDIUM, BAIXO→LOW, NENHUM→NONE

5. FALLBACK GDD-only (fix v0.0.33):
   a) SE EOS_GDD no passado E NDVI_atual > 0.55:
      → Contradição: GDD sugere maturidade mas planta ainda verde
      → EOS = hoje + dias restantes estimados
      → Confiança = conf_gdd * 0.5
      → Método = 'GDD_OVERRIDE_FUTURE'
   b) SENÃO: usar EOS_GDD normalmente

5b. NDVI PREVALECE sobre GDD (fix v0.0.33):
   → SE NDVI_atual > 0.7: estágio = VEGETATIVE
   → SE NDVI_atual > 0.55: estágio = REPRODUCTIVE (mesmo que GDD>90%)
   → SE GDD >= 100% MAS NDVI > 0.65: NÃO declara MATURATION
```

### Persistência (Single Source of Truth)

O resultado é persistido em `rawAreaData.fusedEos`. Todos os componentes downstream priorizam este valor canônico.

### Estágios Fenológicos

| Estágio | Indicadores |
|---------|-------------|
| VEGETATIVO | NDVI > 0.7, GDD < 50% |
| REPRODUTIVO | GDD 50-70% |
| ENCHIMENTO | NDVI 0.65-0.85, GDD 70-90% |
| SENESCÊNCIA | NDVI em declínio >15%, GDD > 90% |
| MATURAÇÃO | NDVI < 0.5, GDD > 100% |

---

## 11. Níveis de Confiança

### 11.1 Score de Confiança (0-100)

```javascript
function calculateConfidenceScore(params) {
  let score = 10  // Base
  if (params.hasInputPlantingDate) score += 25  // Data do produtor
  if (params.hasSos) score += 20
  if (params.hasEos) score += 15
  if (params.hasPeak) score += 15
  if (params.method === 'ALGORITHM') score += 10
  if (params.correlation > 70) score += 10
  if (params.dataPoints >= 20) score += 5
  if (params.peakNdvi >= params.peakMinNdvi) score += 5
  return Math.min(100, score)
}
```

### 11.2 Classificação

| Score | Nível | Descrição |
|-------|-------|-----------|
| > 75 | HIGH | Dados completos, fenologia clara |
| 40-75 | MEDIUM | Alguns dados faltantes ou incerteza |
| < 40 | LOW | Dados insuficientes ou anomalias |

### 11.3 Saúde Fenológica

EXCELLENT (maxNdvi ≥ 0.75, correlation ≥ 70, método ALGORITHM, sem avisos) → GOOD → FAIR → POOR

---

## 12. Estimativa de Produtividade

### 12.1 Modelo

```javascript
ndviFactor = Math.min(1, Math.max(0.3, (maxNdvi - 0.3) / 0.5))
return baseYieldKgHa * ndviFactor * areaHa
```

### 12.2 Produtividade Base por Cultura

| Cultura | Base (kg/ha) |
|---------|-------------|
| SOJA | 3.500 |
| MILHO | 9.000 |
| ALGODÃO | 4.500 |
| TRIGO | 3.000 |

---

## 13. Pipeline de Criticidade de Cultura

> **Distinção importante:** O enum `CropType` no Prisma contém apenas **SOJA** e **MILHO**. O `crop-pattern.service` suporta **8 culturas** para detecção de padrão NDVI (soja, milho, gergelim, cevada, algodão, arroz, cana, café). O cadastro de talhão usa CropType; a detecção usa o código acima para validar se a curva NDVI corresponde à cultura declarada.

### 13.1 Motivação

O pipeline anterior assumia que a cultura declarada era fidedigna. Cenários críticos invalidam essa premissa: solo exposto, cultura divergente, falha de safra, padrão anômalo. Sem verificação, o sistema gera EOS e volume para talhões sem lavoura.

### 13.2 Arquitetura: Duas Camadas

- **Camada 1 — Análise Algorítmica** (custo zero): `crop-pattern.service` classifica TYPICAL / ATYPICAL / ANOMALOUS / NO_CROP
- **NO_CROP** → short-circuit total (sem EOS, GDD, IA)
- **ANOMALOUS / ATYPICAL** → chama Verificador IA
- **Camada 2 — Verificador IA** (condicional): confirma visualmente presença da cultura

### 13.3 Culturas Suportadas e Thresholds (código atual)

#### Culturas Anuais (ANNUAL)

| Cultura | peakMinNdvi | noCropPeak | noCropAmplitude | anomalousPeak | Ciclo (dias) | expectedAmplitude |
|---------|-------------|------------|-----------------|--------------|--------------|-------------------|
| SOJA | 0.70 | 0.45 | 0.15 | 0.55 | 80-160 | 0.35 |
| MILHO | 0.65 | 0.40 | 0.15 | 0.50 | 100-180 | 0.30 |
| GERGELIM | 0.55 | 0.35 | 0.12 | 0.42 | 80-130 | 0.22 |
| CEVADA | 0.65 | 0.40 | 0.15 | 0.50 | 80-150 | 0.30 |
| ALGODAO | 0.60 | 0.38 | 0.12 | 0.48 | 140-220 | 0.25 |
| ARROZ | 0.65 | 0.35 | 0.15 | 0.48 | 90-150 | 0.30 |

#### Semi-Perene (SEMI_PERENNIAL)

| Cultura | peakMinNdvi | noCropPeak | noCropAmplitude | anomalousPeak | Ciclo (dias) | expectedAmplitude |
|---------|-------------|------------|-----------------|--------------|--------------|-------------------|
| CANA | 0.70 | 0.35 | 0.10 | 0.50 | 300-540 | 0.35 |

#### Perene (PERENNIAL)

| Cultura | baselineMinNdvi | baselineMaxNdvi | noCropBaseline | seasonalAmplitude | anomalousDrop |
|---------|-----------------|----------------|---------------|------------------|----------------|
| CAFE | 0.50 | 0.75 | 0.30 | 0.15 | 0.25 |

### 13.4 Lógica de Classificação

**Anuais:**
- **NO_CROP**: peakNdvi < noCropPeak E amplitude < noCropAmplitude
- **ANOMALOUS**: peakNdvi < anomalousPeak OU (sem ciclo E amplitude < expectedAmplitude × 0.6)
- **ATYPICAL** (v0.0.33): peakNdvi < peakMinNdvi OU ciclo fora do range OU **SOS/EOS não detectados** (ciclo indefinido) OU amplitude < expectedAmplitude × 0.85
- **TYPICAL**: demais casos

**Perenes (Café):**
- **NO_CROP**: meanNdvi < noCropBaseline E stdNdvi < 0.05
- **ANOMALOUS**: meanNdvi < baselineMinNdvi
- **ATYPICAL**: amplitude > anomalousDrop

### 13.5 Short-Circuit

- **NO_CROP** (algorítmico): Salva AgroData mínimo, retorna imediatamente — sem EOS, GDD, IA
- **NO_CROP / MISMATCH** (Verificador IA): Retorna sem executar Judge

### 13.6 Interface do Usuário

#### Dashboard

- **Coluna Cultura**: Tipo declarado + Status (badge: Detectada/Atípico/Anômalo/Sem Cultivo/Pendente)
- **Supressão**: Quando `hasCropIssue`, colunas Colheita e Confiança exibem "—"
- **Filtro Cultura**: Todos, Problemas, NO_CROP, ANOMALOUS, ATYPICAL, TYPICAL

#### Relatório (Layout orientado por Crop Issue — v0.0.33)

- **Crop Issue**: Alerta de Cultura no TOPO; Volume, EOS, GDD, Confiança suprimidos; status = SUCCESS
- **Cultura confirmada**: Cards normais, painel IA completo
- **Botão "Ver no Mapa"**: Modal Leaflet com polígono (ESRI satélite, OSM toggle)

### 13.7 Status de Processamento

| Situação | Status | Justificativa |
|----------|--------|---------------|
| NO_CROP / MISMATCH | SUCCESS | Identificação correta |
| ATYPICAL / ANOMALOUS | SUCCESS | Resultado esperado |
| Sem dados NDVI | PARTIAL | Falha real |
| API timeout | ERROR | Falha de infraestrutura |

### 13.8 Hipóteses Geradas

O serviço algorítmico gera hipóteses explanatórias para cada classificação:

**NO_CROP:**
- "Solo exposto ou em preparo — sem vegetação ativa detectada"
- "Possível área de pousio ou recém-dessecada"
- "NDVI consistentemente abaixo do mínimo para qualquer cultura"

**ANOMALOUS:**
- "Pico de NDVI (X) abaixo do esperado (Y) para [cultura]"
- "Amplitude da curva (X) muito baixa para ciclo agrícola"
- "Taxa de crescimento insuficiente para [cultura]"

**ATYPICAL:**
- "Duração do ciclo (X dias) fora da faixa esperada (Y-Z dias)"
- "SOS/EOS não detectados — ciclo indefinido para cultura anual"
- "Amplitude (X) abaixo do esperado (Y) para [cultura]"
- "[cultura] sob estresse severo (hídrico, nutricional ou sanitário)"
- "Plantio muito tardio ou replantio com ciclo comprimido"

---

## 14. Validação Visual por IA

### 14.1 Arquitetura de Agentes

O sistema implementa um pipeline de três agentes de IA multimodal (Curador + Verificador + Juiz):

```
┌─────────────────────────────────────────────────────────────────┐
│         PIPELINE DE VALIDAÇÃO VISUAL (Curador+Verifier+Judge)    │
├─────────────────────────────────────────────────────────────────┤
│  BUSCA DE IMAGENS (Sentinel Hub Process API)                     │
│  ├── True Color Sentinel-2 (RGB)                                 │
│  ├── NDVI Colorizado (escala com legenda)                        │
│  ├── Radar Composto Sentinel-1 (VV/VH falsa-cor)                │
│  └── Fallback: Landsat 8/9, Sentinel-3 OLCI                     │
│                                                                  │
│  CURADOR (gemini-2.5-flash-lite)                                │
│  ├── Avalia qualidade: nuvens, cobertura, resolução             │
│  ├── Pontua cada imagem (0-100)                                  │
│  └── Seleciona top N imagens                                     │
│                                                                  │
│  VERIFICADOR (gemini-2.5-flash-lite) — CONDICIONAL               │
│  ├── Acionado se: cropPatternResult.shouldCallVerifier = true    │
│  ├── Foco: confirmar identidade da cultura declarada             │
│  ├── Decide: CONFIRMED / SUSPICIOUS / MISMATCH / NO_CROP /      │
│  │           CROP_FAILURE                                         │
│  └── NO_CROP / MISMATCH → short-circuit (sem Judge)              │
│                                                                  │
│  JUIZ (gemini-3-flash-preview - multimodal)                      │
│  ├── Recebe: imagens + dados agronômicos completos               │
│  ├── Valida estágio fenológico visual vs projeção                 │
│  ├── Decide: CONFIRMED / QUESTIONED / REJECTED                  │
│  └── Ajusta EOS baseado em evidência visual                      │
│                                                                  │
│  NORMALIZAÇÃO (ai-validation.service.ts)                         │
│  └── PT → EN: CRITICO→CRITICAL, isReady→ready, etc.              │
└─────────────────────────────────────────────────────────────────┘
```

### 14.2 Critérios do Juiz (v0.0.30)

| Concordância | Critério |
|-------------|----------|
| **CONFIRMED** | Divergência EOS < 7 dias E estágio visual compatível |
| **QUESTIONED** | Divergência 7-14 dias OU estágio parcialmente compatível |
| **REJECTED** | Divergência > 14 dias OU estágio incompatível |

### 14.3 Dados de Saída

```typescript
interface AIValidationResult {
  agreement: 'CONFIRMED' | 'QUESTIONED' | 'REJECTED'
  eosAdjustedDate: string
  confidenceAI: number
  phenologicalStageVisual: string
  harvestReadiness: { ready, estimatedDate, delayRisk, delayDays, notes }
  riskAssessment: { overallRisk, factors[] }
  visualAlerts: { type, severity, description }[]
  recommendations: string[]
  costUsd: number
}
```

### 14.4 Feature Flags

| Flag | Default | Descrição |
|------|---------|-----------|
| `enableAIValidation` | false | Habilita pipeline de validação visual |
| `aiValidationTrigger` | 'MANUAL' | MANUAL / ON_PROCESS / ON_LOW_CONFIDENCE |
| `aiCuratorModel` | 'gemini-2.5-flash-lite' | Modelo do Curador |
| `showAIValidation` | true | Mostrar painel no relatório |

### 14.5 Integração com Templates

Templates de Logística, Crédito e Matriz de Risco recebem `aiValidationAgreement` quando disponível.

---

## 15. Análises por Template

### 15.1 Análise de Crédito

**Objetivo**: Avaliar risco de garantias agrícolas (CPRs, penhor rural).

**Classificação**: NORMAL (correlação > 70%, NDVI pico > 0.65) | ALERTA | CRÍTICO

### 15.2 Análise Logística (Híbrida)

**Objetivo**: Planejar recepção e transporte de grãos.

**Métricas Algorítmicas**: Início Colheita (EOS - 5d), Fim Colheita, Volume Diário, Carretas (ceil(volTon/35))

**Análise Qualitativa**: Riscos climáticos e recomendações por IA

### 15.3 Matriz de Risco

**Objetivo**: Visão 360° consolidada. Categorias: Climático, Fenológico, Operacional, Comercial. Score 0-100, Tendência: IMPROVING / STABLE / WORSENING.

---

## 16. Feature Flags e Configuração

Flags correspondem ao modelo `WorkspaceSettings` no schema Prisma:

### Módulos de Dados

| Flag | Default | Descrição |
|------|---------|-----------|
| enablePrecipitation | true | Buscar dados de precipitação |
| enableWaterBalance | false | Buscar balanço hídrico |
| enableRadarNdvi | false | Buscar dados Sentinel-1 |
| enableThermalSum | false | Calcular soma térmica (GDD) |
| enableSoilData | false | Buscar dados de solo |
| enableClimateEnvelope | false | Calcular envelope climático |

### Visualizações

| Flag | Default | Descrição |
|------|---------|-----------|
| showPrecipitationChart | true | Gráfico de precipitação |
| showWaterBalanceChart | false | Gráfico de balanço hídrico |
| showRadarOverlay | false | Overlay de radar |
| showGddChart | false | Gráfico de GDD |
| showSoilInfo | true | Informações de solo |
| showClimateEnvelope | false | Envelope climático |
| showSatelliteSchedule | true | Próximas passagens |

### Cálculos Avançados

| Flag | Default | Descrição |
|------|---------|-----------|
| useRadarForGaps | false | Usar radar para preencher gaps NDVI |
| useLocalCalibration | false | Treinar modelo local RVI→NDVI por talhão |
| enableSarNdviFusion | false | [BETA] Fusão adaptativa SAR-NDVI com GPR/KNN |
| useGddForEos | false | Usar GDD na projeção de EOS |
| useWaterBalanceAdjust | false | Ajustar EOS por estresse hídrico |
| usePrecipitationAdjust | true | Ajustar colheita por precipitação |

### Validação Visual IA

| Flag | Default | Descrição |
|------|---------|-----------|
| enableAIValidation | false | Habilita pipeline de validação visual |
| aiValidationTrigger | 'MANUAL' | Modo de trigger |
| aiCuratorModel | 'gemini-2.5-flash-lite' | Modelo do Curador |
| showAIValidation | true | Mostrar painel no relatório |

### Credenciais Externas

| Campo | Descrição |
|-------|-----------|
| copernicusClientId | Client ID OAuth2 Copernicus |
| copernicusClientSecret | Client Secret |
| googleMapsApiKey | API Key Google Maps |

---

## 17. Graceful Degradation

| Componente | Fallback |
|------------|----------|
| Precipitação API | Cache local → Continuar sem |
| Balanço Hídrico | Usar só precipitação |
| Sentinel-1 Radar | Usar só NDVI óptico |
| Temperatura | Média histórica → Sem GDD |
| Envelope Climático | Continuar sem anomalias |
| Solo | Assumir textura média |

**Badges de Status**: SUCCESS (verde) | PARTIAL (amarelo) | UNAVAILABLE (vermelho) | DISABLED (cinza)

---

## 18. Transparência de IA

### 18.1 Modelos Utilizados

| Uso | Modelo |
|-----|--------|
| Templates de Análise | gemini-3-flash-preview |
| Agente Curador | gemini-2.5-flash-lite |
| Agente Verificador | gemini-2.5-flash-lite |
| Agente Juiz | gemini-3-flash-preview |

### 18.2 Identificação Visual

- Badge "Gerado por IA" / "Análise por Regras"
- Badge de Concordância IA: Confirmado (verde) / Questionado (amarelo) / Rejeitado (vermelho)
- Tooltip explicativo
- Painel de Validação Visual

---

## 19. Limitações e Considerações

### 19.1 Sensoriamento Remoto

1. Cobertura de nuvens: imagens >50% nuvens descartadas
2. Resolução temporal: 5-10 dias (revisita)
3. Resolução espacial: 10-30m
4. Mistura de pixels nas bordas

### 19.2 Modelo

1. Thresholds fixos podem não se aplicar a todas as regiões
2. Produtividade simplificada (não considera pragas, doenças)
3. Requer mínimo 3 safras para correlação
4. Safrinha pode ter comportamento diferente

### 19.3 Recomendações

| Situação | Recomendação |
|----------|--------------|
| Confiança LOW | Vistoria presencial |
| Correlação < 50% | Verificar geometria |
| Sem SOS detectado | Verificar data de início |
| NDVI máx < 0.5 | Verificar in loco |

---

## Referências Bibliográficas

### NDVI e Fenologia

1. **Rouse, J.W. et al. (1974)** — "Monitoring vegetation systems in the Great Plains with ERTS" — NASA Special Publication, 351, 309-317.
2. **White, M.A. et al. (2009)** — "Intercomparison, interpretation, and assessment of spring phenology in North America" — Global Change Biology, 15(10), 2335-2359.

### Radar e Vegetação

3. **Kim, Y. & van Zyl, J.J. (2009)** — "A time-series approach to estimate soil moisture using polarimetric radar data" — IEEE Transactions on Geoscience and Remote Sensing, 47(8), 2519-2527.
4. **Filgueiras, R. et al. (2019)** — "Crop NDVI monitoring based on Sentinel 1" — Remote Sensing, 11(12), 1441.
5. **Veloso, A. et al. (2017)** — "Understanding the temporal behavior of crops using Sentinel-1 and Sentinel-2-like data for agricultural applications" — Remote Sensing of Environment, 199, 415-426.

### Soma Térmica

6. **McMaster, G.S. & Wilhelm, W.W. (1997)** — "Growing degree-days: one equation, two interpretations" — Agricultural and Forest Meteorology, 87(4), 291-300.
7. **Fehr, W.R. & Caviness, C.E. (1977)** — "Stages of soybean development" — Iowa State University Special Report, 80.

### Balanço Hídrico

8. **Allen, R.G. et al. (1998)** — "Crop evapotranspiration: guidelines for computing crop water requirements" — FAO Irrigation and Drainage Paper, 56.
9. **Thornthwaite, C.W. & Mather, J.R. (1955)** — "The water balance" — Publications in Climatology, 8(1).

### Fusão de Dados e Detecção de Maturidade

10. **Sakamoto, T. et al. (2020)** — "PhenoCrop: An integrated satellite-based framework to estimate physiological growth stages of corn and soybeans" — International Journal of Applied Earth Observation and Geoinformation, 92, 102187.
11. **Kumudini, S. et al. (2021)** — "Modeling canopy senescence to calculate soybean maturity date using NDVI" — Crop Science, 61(3), 2083-2095.
12. **Mourtzinis, S. et al. (2017)** — "Developing a growing degree day model for North Dakota and Northern Minnesota soybean" — Agricultural and Forest Meteorology, 239, 134-140.
13. **Desclaux, D. et al. (2003)** — "Short Periods of Water Stress during Seed Filling, Leaf Senescence, and Yield of Soybean" — Crop Science, 43(6), 2083-2095.
14. **NSF/USDA (2024)** — "From satellite-based phenological metrics to crop planting dates" — USDA National Institute of Food and Agriculture.
15. **MAPA/EMBRAPA (2023)** — "Zoneamento Agrícola de Risco Climático" — Ministério da Agricultura.

---

## Changelog

| Versão | Data | Alterações |
|--------|------|------------|
| 1.0.0 | 2024-01 | Versão inicial |
| 1.1.0 | 2025-01 | Correlação robusta com Pearson |
| 1.2.0 | 2026-01 | Alinhamento fenológico por SOS |
| 1.3.0 | 2026-01 | Estado PARTIAL para dados incompletos |
| 1.4.0 | 2026-01 | Projeção Adaptativa por fase fenológica |
| 1.5.0 | 2026-01 | Dados ZARC integrados |
| 1.6.0 | 2026-01 | Transparência de IA: badges e tooltips |
| 2.0.0 | 2026-01 | Arquitetura Híbrida: Métricas algorítmicas + IA |
| 2.1.0 | 2026-01 | Gemini 3 Flash Preview, correção timezone |
| 2.2.0 | 2026-02 | [BETA] Fusão Adaptativa SAR-NDVI |
| 2.3.0 | 2026-02 | UX de Processamento: modal contextual, polling |
| 3.0.0 | 2026-02 | Validação Visual IA: Curador + Juiz |
| 3.1.0 | 2026-02 | Correção Pipeline EOS: Single source of truth, GDD backtracking |
| 3.2.0 | 2026-02 | Dashboard Avançado: 13 colunas, filtros |
| 4.0.0 | 2026-02 | Pipeline de Criticidade de Cultura (8 culturas) |
| 4.1.0 | 2026-02 | EOS Sanity + ATYPICAL: NDVI prevalece sobre GDD, supressão IA para crop issues |

---

## Documentos Relacionados

- [README.md](../README.md) - Visão geral do projeto
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Arquitetura do sistema
- [DIAGNOSTICOLOG.md](./DIAGNOSTICOLOG.md) - Módulo de diagnóstico logístico
- [DOCS.md](./DOCS.md) - Índice completo de documentação

---

*Documento unificado. Versão 0.0.33 (ALPHA).*
