# Metodologia V2 - Detecção de Colheita Avançada

**Versão:** 3.1  
**Data:** Fevereiro 2026  
**Status:** Implementado (Fase 9 pendente, IA Visual v0.0.29, EOS Fix v0.0.30, Dashboard v0.0.31)

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura do Sistema](#2-arquitetura-do-sistema)
3. [Fontes de Dados](#3-fontes-de-dados)
4. [Metodologias de Cálculo](#4-metodologias-de-cálculo)
5. [Feature Flags e Configuração](#5-feature-flags-e-configuração)
6. [Graceful Degradation](#6-graceful-degradation)
7. [Validação Visual por IA](#7-validação-visual-por-ia-v0029)
8. [Correção do Pipeline EOS](#8-correção-do-pipeline-eos-v0030)
9. [Status de Implementação](#9-status-de-implementação)
10. [Referências Bibliográficas](#10-referências-bibliográficas)

---

## 1. Visão Geral

A Metodologia V2 representa uma evolução significativa no sistema de detecção de colheita, integrando múltiplas fontes de dados para melhorar a precisão das estimativas fenológicas e projeções de EOS (End of Season).

### Objetivos Principais

- **Maior precisão na detecção de EOS** através da fusão de múltiplas fontes de dados
- **Single Source of Truth (v0.0.30)**: Data canônica calculada no servidor, eliminando divergências
- **Validação Visual por IA (v0.0.29)**: Agentes multimodais confirmam ou questionam projeções
- **Robustez contra falhas** com graceful degradation em cada camada
- **Transparência** com badges de status indicando a qualidade dos dados
- **Configurabilidade** por workspace via feature flags
- **Continuidade de dados** usando radar para preencher gaps de nuvens

### Componentes Principais

```
┌─────────────────────────────────────────────────────────────────────┐
│                    METODOLOGIA V2 - VISÃO GERAL                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │ Sentinel-2  │  │ Sentinel-1  │  │   Clima     │  │   Solo     │ │
│  │   (NDVI)    │  │   (Radar)   │  │ (Precip/T)  │  │  (Textura) │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘ │
│         │                │                │                │       │
│         v                v                v                v       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              ENGINE DE PROCESSAMENTO                          │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │  │
│  │  │ Fenologia│ │  Fusão   │ │ Envelope │ │ Balanço Hídrico  │ │  │
│  │  │  NDVI    │ │ Óptico+  │ │Climático │ │  + Ajuste EOS    │ │  │
│  │  │          │ │  Radar   │ │          │ │                  │ │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                     │
│                              v                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    PROJEÇÕES FINAIS                           │  │
│  │  • Data de EOS fusionada (single source of truth - v0.0.30) │  │
│  │  • Janela de colheita (baseada em fusedEos)                  │  │
│  │  • Estimativa de produtividade                                │  │
│  │  • Nível de confiança + campo `passed`                        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                     │
│                              v                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              VALIDAÇÃO VISUAL IA (v0.0.29)                    │  │
│  │  • Busca de imagens Sentinel Hub (True Color, NDVI, Radar)   │  │
│  │  • Curador: seleciona melhores imagens                        │  │
│  │  • Juiz: valida projeções com visão multimodal                │  │
│  │  • Concordância: CONFIRMED / QUESTIONED / REJECTED            │  │
│  │  • Feature flag: enableAIValidation                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Arquitetura do Sistema

### 2.1 Estrutura de Serviços

```
lib/services/
├── feature-flags.service.ts    # Gerenciamento de flags por workspace
├── precipitation.service.ts    # Dados de precipitação + ajuste colheita
├── water-balance.service.ts    # Balanço hídrico + ajuste EOS
├── thermal.service.ts          # Soma térmica (GDD)
├── climate-envelope.service.ts # Bandas históricas (Bollinger-like)
├── sentinel1.service.ts        # Integração radar Copernicus
├── rvi-calibration.service.ts  # Calibração local RVI→NDVI (ML)
├── ndvi-fusion.service.ts      # Fusão óptico + radar
├── eos-fusion.service.ts       # Fusão EOS (NDVI + GDD + Hídrico)
├── satellite-schedule.service.ts # Previsão de passagens
└── phenology.service.ts        # Cálculos fenológicos (existente)
```

### 2.2 Fluxo de Processamento

```
1. COLETA DE DADOS
   ├── Sentinel-2 NDVI (API Merx)
   ├── Sentinel-1 Radar (Copernicus - se configurado)
   ├── Precipitação (API Merx)
   ├── Temperatura (API Merx)
   ├── Balanço Hídrico (API Merx)
   └── Solo (API Merx)

2. PROCESSAMENTO
   ├── Fusão NDVI (óptico + radar)
   ├── Cálculo fenológico (SOS, Peak, EOS)
   ├── Envelope climático histórico
   ├── Soma térmica (GDD)
   └── Análise de estresse hídrico

3. AJUSTES DE EOS
   ├── Por precipitação recente (+0 a +7 dias)
   ├── Por estresse hídrico (-12 a 0 dias)
   ├── Por soma térmica (projeção GDD)
   └── Por anomalias climáticas

4. OUTPUT
   ├── EOS ajustado final
   ├── Janela de colheita (start/end)
   ├── Estimativa de produtividade
   ├── Badges de status por fonte
   └── Próximas passagens de satélite
```

---

## 3. Fontes de Dados

### 3.1 Sentinel-2 (NDVI Óptico)

**Endpoint:** `/consulta-ndvi-json`  
**Resolução Temporal:** 5 dias (revisita)  
**Resolução Espacial:** 10m  

O NDVI (Normalized Difference Vegetation Index) é calculado a partir das bandas NIR e RED:

```
NDVI = (NIR - RED) / (NIR + RED)
```

**Limitações:**
- Afetado por cobertura de nuvens
- Gaps podem ocorrer em períodos chuvosos

### 3.2 Sentinel-1 (Radar SAR)

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

#### Calibração Local (Machine Learning Hyperlocal) - NOVO

Baseado em: **Pelta et al. (2022)** "SNAF: Sentinel-1 to NDVI for Agricultural Fields Using Hyperlocal Dynamic Machine Learning Approach" - Remote Sensing, 14(11), 2600

**Conceito**: A relação RVI-NDVI varia por talhão, cultura, solo e condições locais. O SNAF demonstrou que modelos específicos por campo alcançam RMSE de 0.06 e R² de 0.92.

**Implementação**:
- **Coleta de Pares**: Durante processamento, identifica datas coincidentes (±1 dia) entre NDVI óptico e RVI radar
- **Treinamento**: Quando existem ≥15 pares, treina regressão linear OLS para o talhão
- **Validação**: Modelo local só é usado se R² ≥ 0.5
- **Fallback**: Se modelo local não disponível, usa coeficientes fixos da literatura

**Feature Flag**: `useLocalCalibration` (sub-opção de `useRadarForGaps`)

**Benefícios**:
- Maior precisão na conversão RVI→NDVI por adaptar-se às condições locais
- Melhora progressiva com mais dados históricos
- Qualidade dos pontos radar elevada de 0.7 para 0.85 × R²

Referências: Pelta et al. (2022), Filgueiras et al. (2019), Veloso et al. (2017)

### 3.3 Precipitação

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

### 3.4 Temperatura

**Endpoint:** `/consulta-temperatura-json`  
**Fonte:** ERA5 / MODIS LST  
**Resolução Temporal:** Diária  
**Histórico Disponível:** Até 3 anos  

### 3.5 Balanço Hídrico

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

### 3.6 Solo

**Endpoint:** `/consulta-solo-json`  
**Informações:** Tipo de solo, textura  

**Classificação de Retenção de Água:**

| Textura         | Retenção | Impacto no Balanço Hídrico |
|-----------------|----------|---------------------------|
| Argilosa        | ALTA     | Maior reserva de água     |
| Média           | MÉDIA    | Equilíbrio                |
| Arenosa         | BAIXA    | Menor reserva, mais déficit|

---

## 4. Metodologias de Cálculo

### 4.1 Detecção Fenológica (Existente)

**SOS (Start of Season):**
- Ponto onde NDVI cruza 20% da amplitude para cima
- Confirmado por 3+ dias consecutivos de aumento

**Peak:**
- Máximo NDVI suavizado na série
- Usado para estimativa de produtividade

**EOS (End of Season):**
- Ponto onde NDVI cruza 20% da amplitude para baixo
- Projetado a partir de correlação histórica ou modelo GDD

### 4.2 Soma Térmica (GDD)

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

### 4.3 Envelope Climático (Bandas Históricas)

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

**Impacto de Anomalias:**

| Eventos Extremos | Nível    | Ajuste EOS | Impacto Prod. |
|------------------|----------|------------|---------------|
| 0-1              | BAIXO    | 0 dias     | 0%            |
| 2-4              | MÉDIO    | 2-3 dias   | -5%           |
| 5+               | ALTO     | 5-7 dias   | -10-15%       |

### 4.4 Fusão NDVI (Óptico + Radar)

**Identificação de Gaps:**
```
Gap = período > 10 dias sem NDVI óptico válido
```

**Preenchimento com Radar:**
1. Buscar cenas Sentinel-1 no período do gap
2. Calcular RVI médio
3. Converter para NDVI usando modelo de regressão
4. Inserir na série temporal

**Qualidade da Fusão:**
- Pontos ópticos: qualidade 1.0
- Pontos radar: qualidade 0.7
- Pontos interpolados: qualidade 0.5

### 4.5 Fusão de EOS (NDVI + GDD + Balanço Hídrico)

**Serviço:** `lib/services/eos-fusion.service.ts`

A fusão de EOS combina múltiplas fontes de dados para determinar a data de colheita mais precisa, baseada em metodologias científicas estabelecidas.

#### Referências Científicas

| Conceito | Referência | Aplicação |
|----------|------------|-----------|
| Fusão NDVI + GDD | PhenoCrop Framework (Sakamoto et al., 2020) | 77% acurácia milho, 71% soja |
| Threshold NDVI senescência | Kumudini et al. (2021) | 85% redução vs R5 = maturidade |
| GDD por Grupo Maturidade | Mourtzinis et al. (2017) | MG 0.4 = 1862 AGDD |
| Threshold EOS | MDPI Remote Sensing (2022) | 40% amplitude sazonal NDVI |
| Estresse Hídrico | Desclaux et al. (2003) | Estresse acelera senescência |

#### Algoritmo de Seleção (atualizado v0.0.30)

```
ENTRADA:
  - EOS_NDVI: Data projetada por curva NDVI histórica
  - EOS_GDD: Data projetada por soma térmica (com backtracking v0.0.30)
  - NDVI_atual: Valor NDVI mais recente
  - GDD_progress: Percentual de GDD acumulado
  - taxa_declínio: Taxa de queda do NDVI
  - estresse_hídrico: Nível de estresse (NONE/LOW/MEDIUM/HIGH/CRITICAL) [EN]
  - stressDays: Dias de estresse hídrico (de waterBalanceResult.data)
  - yieldImpact: Impacto na produtividade (%)

PROCESSO:

1. SE GDD >= 100% E NDVI < 0.65 E taxa_declínio > 0.5%:
   → Maturação fisiológica atingida
   → EOS = EOS_NDVI (ou média ponderada NDVI+GDD)
   → NÃO usa "hoje" como fallback (fix v0.0.30)
   → Confiança = max(conf_ndvi, conf_gdd)
   → passed = EOS < hoje (campo adicionado v0.0.30)

2. SE EOS_NDVI já passou E NDVI > 0.7:
   → Planta ainda verde, projeção NDVI desatualizada
   → EOS = EOS_GDD
   → Confiança = conf_gdd

3. SE |EOS_NDVI - EOS_GDD| < 7 dias:
   → Projeções convergentes
   → EOS = média ponderada por confiança
   → Confiança = média ponderada

4. AJUSTE POR ESTRESSE HÍDRICO:
   | Nível    | Ajuste      | Base Científica |
   |----------|-------------|-----------------|
   | NONE     | 0 dias      | -               |
   | LOW      | 0 dias      | -               |
   | MEDIUM   | -2 dias     | Acelera senescência |
   | HIGH     | -4 dias     | Acelera senescência |
   | CRITICAL | -7 dias     | Acelera senescência significativamente |

   Nota: Estresse hídrico ADIANTA a maturidade, não atrasa.
   Referência: Desclaux et al. (2003) - "Water stress accelerates senescence"

   IMPORTANTE (fix v0.0.30): O mapeamento PT→EN é feito no process/route.ts:
   CRITICO→CRITICAL, SEVERO→HIGH, MODERADO→MEDIUM, BAIXO→LOW, NENHUM→NONE

5. FALLBACK:
   → Se apenas NDVI disponível: usar EOS_NDVI
   → Se apenas GDD disponível: usar EOS_GDD
   → Se nenhum: projeção com baixa confiança

SAÍDA:
  - eos: Date         (data canônica)
  - confidence: number (0-1)
  - method: string     (NDVI_ONLY | GDD_ONLY | NDVI_GDD_FUSED | ...)
  - passed: boolean    (true se colheita já ocorreu - v0.0.30)
  - phenologicalStage: string
  - explanation: string
  - factors: string[]
```

**Persistência (Single Source of Truth - v0.0.30):**

O resultado da fusão é persistido no servidor em `rawAreaData.fusedEos`:

```json
{
  "fusedEos": {
    "date": "2026-02-17",
    "method": "NDVI_GDD_FUSED",
    "confidence": 0.85,
    "passed": false
  }
}
```

Todos os componentes downstream (API de talhão, relatório, diagnóstico logístico) priorizam este valor canônico sobre cálculos locais.

#### Estágios Fenológicos

| Estágio | Indicadores | Descrição |
|---------|-------------|-----------|
| VEGETATIVO | NDVI > 0.7, GDD < 50% | Crescimento vegetativo |
| REPRODUTIVO | GDD 50-70% | Floração e formação de vagens |
| ENCHIMENTO | NDVI 0.65-0.85, GDD 70-90% | Enchimento de grãos |
| SENESCÊNCIA | NDVI em declínio >15%, GDD > 90% | Perda de clorofila |
| MATURAÇÃO | NDVI < 0.5, GDD > 100% | Pronto para colheita |

#### Thresholds de NDVI

Baseados em literatura científica (Kumudini et al., 2021):

| Threshold | Valor | Significado |
|-----------|-------|-------------|
| VEGETATIVO_MIN | 0.70 | Mínimo para considerar vegetativo |
| SENESCENCE_START | 0.65 | Início de senescência |
| MATURITY | 0.50 | Maturidade fisiológica |
| DECLINE_RATE_FAST | 0.5%/pt | Taxa de declínio rápida |
| DECLINE_RATE_SLOW | 0.1%/pt | Taxa de declínio lenta |

#### Tooltip de Explicação

O sistema gera automaticamente uma explicação para o usuário:

```
Exemplo 1 (Guarapuava, PR):
  EOS: 12/02/2026
  Confiança: 85%
  Método: GDD (Soma Térmica)
  Explicação: "Projeção NDVI histórica já passou, mas NDVI atual 
              indica planta ainda verde. Usando soma térmica (GDD)."
  Fatores:
    - NDVI atual: 88% (ainda alto)
    - GDD: 94% concluído
    - EOS NDVI (18/01) já passou - ajustado para GDD

Exemplo 2 (Nova Bandeirantes, MT):
  EOS: 18/02/2026
  Confiança: 75%
  Método: NDVI + Ajuste Hídrico
  Explicação: "Maturação fisiológica atingida (GDD 100%), 
              senescência ativa confirmada por NDVI."
  Fatores:
    - GDD: 120% - maturação fisiológica atingida
    - NDVI: 70% - em declínio
    - Taxa declínio: 0.92%/pt
    - Ajuste hídrico: -5 dias (estresse crítico)
```

---

## 5. Feature Flags e Configuração

### 5.1 Módulos de Dados

| Flag                   | Default | Descrição                              |
|------------------------|---------|----------------------------------------|
| enablePrecipitation    | true    | Buscar dados de precipitação           |
| enableWaterBalance     | false   | Buscar balanço hídrico                 |
| enableRadarNdvi        | false   | Buscar dados Sentinel-1                |
| enableThermalSum       | false   | Calcular soma térmica (GDD)            |
| enableSoilData         | false   | Buscar dados de solo                   |
| enableClimateEnvelope  | false   | Calcular envelope climático            |

### 5.2 Visualizações

| Flag                   | Default | Descrição                              |
|------------------------|---------|----------------------------------------|
| showPrecipitationChart | true    | Mostrar gráfico de precipitação        |
| showWaterBalanceChart  | false   | Mostrar gráfico de balanço hídrico     |
| showGddChart           | false   | Mostrar gráfico de GDD                 |
| showClimateEnvelope    | false   | Mostrar envelope climático             |
| showSatelliteSchedule  | true    | Mostrar próximas passagens             |
| showSoilInfo           | true    | Mostrar informações de solo            |

### 5.3 Cálculos Avançados

| Flag                   | Default | Descrição                              |
|------------------------|---------|----------------------------------------|
| useRadarForGaps        | false   | Usar radar para preencher gaps NDVI    |
| useLocalCalibration    | false   | Treinar modelo local RVI→NDVI por talhão (sub-opção de useRadarForGaps) |
| useGddForEos           | false   | Usar GDD na projeção de EOS            |
| useWaterBalanceAdjust  | false   | Ajustar EOS por estresse hídrico       |
| usePrecipitationAdjust | true    | Ajustar colheita por precipitação      |

### 5.4 Validação Visual IA (v0.0.29)

| Flag                   | Default    | Descrição                              |
|------------------------|------------|----------------------------------------|
| enableAIValidation     | false      | Habilita pipeline de validação visual  |
| aiValidationTrigger    | 'MANUAL'   | Modo: MANUAL / ON_PROCESS / ON_LOW_CONFIDENCE |
| aiCuratorModel         | 'FLASH_LITE' | Modelo do Curador                    |
| showAIValidation       | true       | Mostrar painel no relatório            |

### 5.5 Credenciais Externas

| Campo                  | Descrição                              |
|------------------------|----------------------------------------|
| copernicusClientId     | Client ID OAuth2 do Copernicus         |
| copernicusClientSecret | Client Secret (armazenado com segurança)|
| googleMapsApiKey       | API Key para cálculo de rotas          |

---

## 6. Graceful Degradation

O sistema foi projetado para funcionar mesmo quando algumas fontes de dados falham.

### 6.1 Estratégia por Componente

```
┌────────────────────────────────────────────────────────────────┐
│  COMPONENTE          │ FALLBACK                               │
├────────────────────────────────────────────────────────────────┤
│  Precipitação API    │ Usar cache local → Continuar sem       │
│  Balanço Hídrico     │ Usar só precipitação → Continuar sem   │
│  Sentinel-1 Radar    │ Usar só NDVI óptico                    │
│  Temperatura         │ Usar média histórica → Sem GDD         │
│  Envelope Climático  │ Continuar sem anomalias                │
│  Solo                │ Assumir textura média                  │
└────────────────────────────────────────────────────────────────┘
```

### 6.2 Badges de Status

Cada fonte de dados exibe um badge indicando seu status:

| Status       | Cor      | Significado                        |
|--------------|----------|------------------------------------|
| SUCCESS      | Verde    | Dados completos e atualizados      |
| PARTIAL      | Amarelo  | Dados parciais ou desatualizados   |
| UNAVAILABLE  | Vermelho | Falha na obtenção dos dados        |
| DISABLED     | Cinza    | Feature desabilitada               |

---

## 7. Validação Visual por IA (v0.0.29)

### 7.1 Arquitetura de Agentes

O sistema implementa um pipeline de dois agentes de IA multimodal para validar projeções algorítmicas usando imagens de satélite reais.

```
┌─────────────────────────────────────────────────────────────────┐
│                  PIPELINE DE VALIDAÇÃO VISUAL                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  BUSCA DE IMAGENS (Sentinel Hub Process API)                     │
│  ├── True Color Sentinel-2 (RGB com correção atmosférica)        │
│  ├── NDVI Colorizado (escala contínua com legenda)               │
│  ├── Radar Composto Sentinel-1 (VV/VH falsa-cor)                │
│  └── Fallback: Landsat 8/9, Sentinel-3 OLCI                     │
│                                                                  │
│  CURADOR (gemini-2.5-flash-lite ou gemini-3-flash-preview)       │
│  ├── Avalia qualidade: nuvens, cobertura, resolução              │
│  ├── Pontua cada imagem (0-100)                                  │
│  └── Seleciona top N imagens para o Juiz                         │
│                                                                  │
│  JUIZ (gemini-3-flash-preview - multimodal)                      │
│  ├── Recebe: imagens curadas + dados agronômicos completos       │
│  │   (NDVI, GDD, precipitação, balanço hídrico, ZARC)            │
│  ├── Analisa: estágio fenológico visual vs projeção              │
│  ├── Decide: CONFIRMED / QUESTIONED / REJECTED                  │
│  ├── Ajusta EOS baseado em evidência visual                      │
│  └── Emite: alertas visuais + recomendações                      │
│                                                                  │
│  NORMALIZAÇÃO (ai-validation.service.ts - v0.0.30)               │
│  ├── PT → EN: CRITICO→CRITICAL, MODERADO→MEDIUM, etc.           │
│  ├── Schema: isReady→ready, overall→overallRisk                  │
│  └── Formato: valida YYYY-MM-DD para eosAdjustedDate             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Critérios de Decisão do Juiz (v0.0.30)

| Concordância | Critério |
|-------------|----------|
| **CONFIRMED** | Divergência EOS algorítmico vs visual < 7 dias E estágio fenológico compatível |
| **QUESTIONED** | Divergência 7-14 dias OU estágio visual parcialmente compatível |
| **REJECTED** | Divergência > 14 dias OU estágio visual claramente incompatível |

### 7.3 Dados de Saída

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `agreement` | string | CONFIRMED / QUESTIONED / REJECTED |
| `eosAdjustedDate` | string | Data EOS ajustada pelo Juiz (YYYY-MM-DD) |
| `confidenceAI` | number | Confiança do Juiz (0-100) |
| `phenologicalStageVisual` | string | Estágio observado na imagem |
| `harvestReadiness.ready` | boolean | Se está pronta para colheita |
| `harvestReadiness.delayRisk` | string | NONE / RAIN / MOISTURE / MATURITY |
| `riskAssessment.overallRisk` | string | LOW / MEDIUM / HIGH / CRITICAL |
| `riskAssessment.factors[]` | array | Fatores de risco categorizados |
| `visualAlerts[]` | array | Alertas visuais com severidade |
| `recommendations[]` | array | Recomendações acionáveis |
| `costUsd` | number | Custo acumulado da validação |

### 7.4 Feature Flags

| Flag | Default | Descrição |
|------|---------|-----------|
| `enableAIValidation` | false | Habilita pipeline de validação visual |
| `aiValidationTrigger` | 'MANUAL' | Modo: MANUAL / ON_PROCESS / ON_LOW_CONFIDENCE |
| `aiCuratorModel` | 'FLASH_LITE' | Modelo do Curador |
| `showAIValidation` | true | Mostrar painel no relatório |

### 7.5 Evalscripts (Sentinel Hub)

| Script | Sensor | Saída |
|--------|--------|-------|
| `trueColorS2.ts` | Sentinel-2 L2A | RGB (B04, B03, B02) com brightness enhance |
| `ndviColorS2.ts` | Sentinel-2 L2A | NDVI colorizado (vermelho→amarelo→verde) |
| `radarCompositeS1.ts` | Sentinel-1 GRD | Falsa-cor (VV, VH, VV/VH) |
| `trueColorL8.ts` | Landsat 8/9 | RGB (B4, B3, B2) |
| `trueColorS3.ts` | Sentinel-3 OLCI | RGB regional (B8, B6, B4) |

### 7.6 Persistência

Resultados são armazenados em `AgroData`:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `aiValidationAgreement` | String? | CONFIRMED / QUESTIONED / REJECTED |
| `aiValidationConfidence` | Float? | 0-100 |
| `aiVisualAlerts` | String? | JSON array de alertas visuais |
| `aiRecommendations` | String? | JSON array de recomendações |
| `aiEosAdjusted` | String? | Data EOS ajustada pelo Juiz |
| `aiPhenologicalStage` | String? | Estágio fenológico visual |
| `aiValidationCost` | Float? | Custo em USD |
| `aiValidationDate` | DateTime? | Data/hora da execução |

---

## 8. Correção do Pipeline EOS (v0.0.30)

### 8.1 Problemas Identificados

Análise extensiva do fluxo de dados revelou 8 bugs que causavam divergência nas datas de colheita entre diferentes componentes:

| Bug | Arquivo | Problema |
|-----|---------|----------|
| 1 | `eos-fusion.service.ts` | Fallback para "hoje" quando EOS no passado → data móvel |
| 2 | `thermal.service.ts` | `projectedEos = null` quando GDD 100% → fusão sem GDD |
| 3 | `process/route.ts` | Stress level em PT ('CRITICO') vs EN ('CRITICAL') esperado |
| 4 | `process/route.ts` | `eosAdjustment?.stressDays` inexistente no tipo |
| 5 | `reports/[id]/page.tsx` | Re-cálculo client-side com inputs diferentes do servidor |
| 6 | `fields/[id]/route.ts` | `harvestWindowInfo` usando `eosDate` (bruto) vs fusionado |
| 7 | `judge-prompt.ts` | `isReady`/`overall` vs `ready`/`overallRisk` esperados pela UI |
| 8 | `judge-prompt.ts` | Sem critérios quantitativos para CONFIRMED/QUESTIONED/REJECTED |

### 8.2 Estratégia: Single Source of Truth

```
┌──────────────────────────────────────────────────────────────────┐
│               PIPELINE DE DADOS EOS (CORRIGIDO)                  │
│                                                                  │
│  SERVIDOR (process/route.ts):                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 1. phenology.service → EOS_NDVI (data bruta)              │  │
│  │ 2. thermal.service → EOS_GDD (com backtracking)           │  │
│  │ 3. water-balance → stress_level (mapeado PT→EN)           │  │
│  │ 4. eos-fusion.service → FUSED EOS (canônico)              │  │
│  │ 5. Persiste em rawAreaData.fusedEos                       │  │
│  └────────────────────────────────────────────────────────────┘  │
│                          │                                       │
│              ┌───────────┼───────────┐                           │
│              ▼           ▼           ▼                           │
│  ┌──────────────┐ ┌──────────┐ ┌──────────────┐                │
│  │ fields/[id]  │ │reports/  │ │  logistics   │                │
│  │  route.ts    │ │[id]/page │ │  diagnostic  │                │
│  │              │ │          │ │              │                │
│  │ bestEosDate  │ │ server   │ │ usa fusedEos │                │
│  │ = fusedEos   │ │ EOS >    │ │ p/ curva     │                │
│  │   > bruto    │ │ client   │ │ recebimento  │                │
│  └──────────────┘ └──────────┘ └──────────────┘                │
└──────────────────────────────────────────────────────────────────┘
```

### 8.3 Correções Implementadas

1. **eos-fusion.service.ts**: Usa data real de EOS mesmo quando no passado (não "hoje"); campo `passed: boolean`
2. **thermal.service.ts**: Backtracking na série GDD para encontrar data exata de 100% de acumulação
3. **process/route.ts**: Mapeamento explícito PT→EN para stress levels; extração correta de `stressDays` de `waterBalanceResult.data`
4. **reports/[id]/page.tsx**: Prioriza `fusedEos` do servidor sobre cálculo client-side
5. **fields/[id]/route.ts**: `bestEosDate` prioriza `rawAreaData.fusedEos.date`; retorna `fusedEos` no response
6. **judge-prompt.ts**: Schema alinhado (`ready`, `overallRisk`, `factors[]`); critérios quantitativos de decisão
7. **AIValidationPanel.tsx**: Normalização bidirecional old/new schema com mapeamento PT→EN
8. **ai-validation.service.ts**: Pós-processamento normaliza output do Juiz

---

## 9. Status de Implementação

### 9.1 Fases Completadas

| Fase | Descrição                                          | Status      |
|------|---------------------------------------------------|-------------|
| 1    | Sistema de Feature Flags                          | ✅ COMPLETO |
| 2    | Integração Precipitação + Ajuste Colheita         | ✅ COMPLETO |
| 2b   | Envelope Climático (Bandas Históricas)            | ✅ COMPLETO |
| 3    | Balanço Hídrico + Ajuste EOS                      | ✅ COMPLETO |
| 4    | Sentinel-1 Radar + Fusão NDVI                     | ✅ COMPLETO |
| 5    | Soma Térmica (GDD)                                | ✅ COMPLETO |
| 6    | Dados de Solo                                     | ✅ COMPLETO |
| 7    | Badges de Status (Graceful Degradation)           | ✅ COMPLETO |
| 8    | Previsão de Passagens de Satélite                 | ✅ COMPLETO |
| AI-1 | Agentes IA: Curador + Juiz                        | ✅ COMPLETO |
| AI-2 | Integração no Processamento                       | ✅ COMPLETO |
| AI-3 | Enriquecimento de Templates                       | ✅ COMPLETO |
| AI-4 | Interface de Configuração                         | ✅ COMPLETO |
| AI-5 | Painel de Validação Visual no Relatório           | ✅ COMPLETO |
| FIX  | Correção Pipeline EOS (Single Source of Truth)    | ✅ COMPLETO |
| UI   | Dashboard Avançado: Tabela Ordenável + Filtros    | ✅ COMPLETO |

### 9.2 Fases Pendentes

| Fase | Descrição                                          | Status      | Requisitos           |
|------|---------------------------------------------------|-------------|----------------------|
| 9    | Auto-Reprocessamento                              | ⏳ PENDENTE | Redis + Bull Queue   |

**Detalhes da Fase 9:**

O sistema de auto-reprocessamento permitirá:
- Reprocessar talhões automaticamente quando novos dados de satélite estiverem disponíveis
- Configuração de frequência: ON_NEW_DATA, DAILY, WEEKLY
- Notificações por email ou webhook
- Fila de processamento com Redis/Bull para escalabilidade

**Requisitos de Infraestrutura:**
- Redis Server
- Pacotes: `bull`, `ioredis`
- Cronjob ou worker process

---

## 10. Referências Bibliográficas

### 10.1 NDVI e Fenologia

1. **Rouse, J.W. et al. (1974)**  
   "Monitoring vegetation systems in the Great Plains with ERTS"  
   *NASA Special Publication*, 351, 309-317.

2. **White, M.A. et al. (2009)**  
   "Intercomparison, interpretation, and assessment of spring phenology in North America"  
   *Global Change Biology*, 15(10), 2335-2359.

### 10.2 Radar e Vegetação

3. **Kim, Y. & van Zyl, J.J. (2009)**  
   "A time-series approach to estimate soil moisture using polarimetric radar data"  
   *IEEE Transactions on Geoscience and Remote Sensing*, 47(8), 2519-2527.

4. **Filgueiras, R. et al. (2019)**  
   "Crop NDVI monitoring based on Sentinel 1"  
   *Remote Sensing*, 11(12), 1441.

5. **Veloso, A. et al. (2017)**  
   "Understanding the temporal behavior of crops using Sentinel-1 and Sentinel-2-like data for agricultural applications"  
   *Remote Sensing of Environment*, 199, 415-426.

### 10.3 Soma Térmica

6. **McMaster, G.S. & Wilhelm, W.W. (1997)**  
   "Growing degree-days: one equation, two interpretations"  
   *Agricultural and Forest Meteorology*, 87(4), 291-300.

7. **Fehr, W.R. & Caviness, C.E. (1977)**  
   "Stages of soybean development"  
   *Iowa State University Special Report*, 80.

### 10.4 Balanço Hídrico

8. **Allen, R.G. et al. (1998)**  
   "Crop evapotranspiration: guidelines for computing crop water requirements"  
   *FAO Irrigation and Drainage Paper*, 56.

9. **Thornthwaite, C.W. & Mather, J.R. (1955)**  
   "The water balance"  
   *Publications in Climatology*, 8(1).

### 10.5 Fusão de Dados e Detecção de Maturidade

10. **Sakamoto, T. et al. (2020)**  
    "PhenoCrop: An integrated satellite-based framework to estimate physiological growth stages of corn and soybeans"  
    *International Journal of Applied Earth Observation and Geoinformation*, 92, 102187.

11. **Kumudini, S. et al. (2021)**  
    "Modeling canopy senescence to calculate soybean maturity date using NDVI"  
    *Crop Science*, 61(3), 2083-2095.  
    *Nota: 85% redução NDVI vs R5 = threshold para maturidade*

12. **Mourtzinis, S. et al. (2017)**  
    "Developing a growing degree day model for North Dakota and Northern Minnesota soybean"  
    *Agricultural and Forest Meteorology*, 239, 134-140.  
    *Nota: MG 0.4 = 1862 AGDD, MG 1.0 = 2030 AGDD*

13. **Desclaux, D. et al. (2003)**  
    "Short Periods of Water Stress during Seed Filling, Leaf Senescence, and Yield of Soybean"  
    *Crop Science*, 43(6), 2083-2095.  
    *Nota: Estresse hídrico acelera senescência*

14. **NSF/USDA (2024)**  
    "From satellite-based phenological metrics to crop planting dates"  
    *USDA National Institute of Food and Agriculture*.  
    *Nota: Fusão NDVI + GDD = 77% acurácia milho, 71% soja*

### 10.6 ZARC e Riscos

15. **MAPA/EMBRAPA (2023)**  
    "Zoneamento Agrícola de Risco Climático"  
    *Ministério da Agricultura, Pecuária e Abastecimento*.

---

## Apêndice A: Configuração de Credenciais Copernicus

### Passo a Passo

1. Acesse [dataspace.copernicus.eu](https://dataspace.copernicus.eu)
2. Crie uma conta gratuita
3. Vá em **User Settings** → **OAuth clients**
4. Clique em **Create**
5. Defina um nome e data de expiração
6. Copie o **Client ID** e **Client Secret**
7. No sistema, acesse **Configurações** → **Integração Sentinel-1**
8. Cole as credenciais e salve
9. Habilite as flags:
   - `enableRadarNdvi: true`
   - `useRadarForGaps: true`

---

## Apêndice B: Estrutura de Arquivos

```
merx-agro-mvp/
├── lib/
│   ├── agents/                          # IA Visual Validation (v0.0.29)
│   │   ├── curator.ts                   # Agente Curador
│   │   ├── judge.ts                     # Agente Juiz
│   │   ├── curator-prompt.ts            # Prompt do Curador
│   │   ├── judge-prompt.ts              # Prompt do Juiz (critérios v0.0.30)
│   │   └── types.ts                     # Tipos compartilhados
│   ├── evalscripts.ts                   # Scripts Sentinel Hub (S2 TC, S2 NDVI, S1 Radar, Landsat NDVI, S3 NDVI)
│   └── services/
│       ├── ai-validation.service.ts     # Orquestrador IA (v0.0.29)
│       ├── eos-fusion.service.ts        # Fusão EOS (corrigido v0.0.30)
│       ├── thermal.service.ts           # GDD (backtracking v0.0.30)
│       ├── feature-flags.service.ts
│       ├── precipitation.service.ts
│       ├── water-balance.service.ts
│       ├── climate-envelope.service.ts
│       ├── sentinel1.service.ts
│       ├── ndvi-fusion.service.ts
│       ├── pricing.service.ts           # Custos de API
│       ├── satellite-schedule.service.ts
│       └── phenology.service.ts
├── components/
│   ├── fields/
│   │   └── field-table.tsx              # Tabela ordenável 13 cols (v0.0.31)
│   ├── ai-validation/                   # UI de Validação Visual (v0.0.29)
│   │   └── AIValidationPanel.tsx        # Painel com normalização (v0.0.30)
│   ├── charts/
│   │   ├── PrecipitationChart.tsx
│   │   ├── WaterBalanceChart.tsx
│   │   ├── GddChart.tsx
│   │   └── ClimateEnvelopeChart.tsx
│   ├── cards/
│   │   └── SoilInfoCard.tsx
│   ├── satellite/
│   │   └── SatelliteScheduleCard.tsx
│   └── ui/
│       └── DataSourceBadge.tsx
├── app/
│   ├── api/
│   │   ├── fields/
│   │   │   ├── route.ts                 # GET lista (server-side processing v0.0.31)
│   │   │   └── [id]/
│   │   │       ├── route.ts             # GET talhão (fusedEos v0.0.30)
│   │   │       ├── process/route.ts     # POST (EOS fix + IA v0.0.30)
│   │   │       └── ai-validate/route.ts # POST validação manual (v0.0.29)
│   │   └── workspace/settings/route.ts
│   └── (authenticated)/
│       ├── page.tsx                     # Dashboard (filtros avançados v0.0.31)
│       ├── reports/[id]/page.tsx        # Relatório (6 sensores v0.0.31)
│       └── settings/page.tsx           # Config IA + módulos
├── prisma/
│   └── schema.prisma                    # +AI fields (v0.0.29)
└── docs/
    ├── METHODOLOGY-V2.md                # ← Este documento
    └── PLAN-AI-VISUAL-VALIDATION.md     # Plano original da IA Visual
```

---

*Documento gerado automaticamente. Última atualização: Fevereiro 2026 (v0.0.31)*
