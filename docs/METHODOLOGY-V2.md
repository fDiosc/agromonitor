# Metodologia V2 - Detecção de Colheita Avançada

**Versão:** 4.1  
**Data:** Fevereiro 2026  
**Status:** Implementado (Fase 9 pendente, IA Visual v0.0.29, EOS Fix v0.0.30, Dashboard v0.0.31, Crop Criticality v0.0.32, EOS Sanity + ATYPICAL Refinement v0.0.33)

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
9. [Pipeline de Criticidade de Cultura](#9-pipeline-de-criticidade-de-cultura-v0032)
10. [Status de Implementação](#10-status-de-implementação)
11. [Referências Bibliográficas](#11-referências-bibliográficas)

---

## 1. Visão Geral

A Metodologia V2 representa uma evolução significativa no sistema de detecção de colheita, integrando múltiplas fontes de dados para melhorar a precisão das estimativas fenológicas e projeções de EOS (End of Season).

### Objetivos Principais

- **Maior precisão na detecção de EOS** através da fusão de múltiplas fontes de dados
- **Single Source of Truth (v0.0.30)**: Data canônica calculada no servidor, eliminando divergências
- **Validação Visual por IA (v0.0.29)**: Agentes multimodais confirmam ou questionam projeções
- **Criticidade de Cultura (v0.0.32)**: Verificação algorítmica + IA se a cultura declarada existe
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
│  │           CRITICIDADE DE CULTURA (v0.0.32)                    │  │
│  │  • crop-pattern.service: validação algorítmica (custo zero)  │  │
│  │  • 8 culturas: soja, milho, gergelim, cevada, algodão,      │  │
│  │    arroz, cana (semi-perene), café (perene)                  │  │
│  │  • NO_CROP → short-circuit total (sem EOS, GDD, IA)         │  │
│  │  • ANOMALOUS → Verificador IA confirma visualmente          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                     │
│                              v                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │       VALIDAÇÃO VISUAL IA (v0.0.29 + Verifier v0.0.32)       │  │
│  │  • Busca de imagens Sentinel Hub (True Color, NDVI, Radar)   │  │
│  │  • Curador: seleciona melhores imagens                        │  │
│  │  • Verificador: confirma presença da cultura (se necessário) │  │
│  │  • Juiz: valida projeções com visão multimodal                │  │
│  │  • Short-circuit: NO_CROP/MISMATCH → sem Judge               │  │
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
├── crop-pattern.service.ts     # Análise algorítmica de padrão de cultura (v0.0.32)
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

2b. CRITICIDADE DE CULTURA (v0.0.32) — executa após fenologia
   ├── Análise algorítmica (crop-pattern.service)
   │   ├── NO_CROP → SHORT-CIRCUIT (para processamento)
   │   ├── ANOMALOUS → chama Verificador IA
   │   ├── ATYPICAL → chama Verificador IA
   │   └── TYPICAL → prossegue normalmente
   └── Verificador IA (opcional)
       ├── NO_CROP / MISMATCH → SHORT-CIRCUIT (sem Judge)
       ├── CROP_FAILURE → flagged, mas prossegue
       ├── SUSPICIOUS → prossegue com alerta
       └── CONFIRMED → prossegue normalmente

3. AJUSTES DE EOS (somente se cultura confirmada)
   ├── Por precipitação recente (+0 a +7 dias)
   ├── Por estresse hídrico (-12 a 0 dias)
   ├── Por soma térmica (projeção GDD)
   └── Por anomalias climáticas

4. OUTPUT
   ├── EOS ajustado final
   ├── Janela de colheita (start/end)
   ├── Estimativa de produtividade
   ├── Badges de status por fonte
   ├── Status de criticidade de cultura (NO_CROP/ANOMALOUS/ATYPICAL/TYPICAL)
   ├── Verificação IA de cultura (CONFIRMED/SUSPICIOUS/MISMATCH/NO_CROP/CROP_FAILURE)
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

5. FALLBACK (GDD-only com sanity check — fix v0.0.33):
   → Se apenas GDD disponível:
     a) SE EOS_GDD no passado E NDVI_atual > 0.55:
        → Contradição: GDD sugere maturidade mas planta ainda verde
        → EOS = hoje + (dias restantes estimados por GDD residual)
        → Confiança = conf_gdd * 0.5 (redução por contradição)
        → Método = 'GDD_OVERRIDE_FUTURE'
        → Explicação: "GDD EOS no passado contradiz NDVI ativo"
     b) SENÃO: usar EOS_GDD normalmente
   → Se apenas NDVI disponível: usar EOS_NDVI
   → Se nenhum: projeção com baixa confiança

5b. DETERMINAÇÃO DO ESTÁGIO FENOLÓGICO (fix v0.0.33):
   → NDVI PREVALECE sobre GDD quando há contradição:
     - SE NDVI_atual > 0.7: estágio = VEGETATIVE (crescimento ativo)
     - SE NDVI_atual > 0.55: estágio = REPRODUCTIVE (mesmo que GDD>90%)
     - SE GDD >= 100% MAS NDVI > 0.65: NÃO declara MATURATION
   → Lógica anterior confiava cegamente no GDD para determinar maturação
   → Resultado: evita projeções de colheita passada com alta confiança
     quando os dados NDVI ao vivo contradizem o modelo GDD

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

O sistema implementa um pipeline de três agentes de IA multimodal (Curador + Verificador + Juiz) para validar projeções algorítmicas usando imagens de satélite reais. O Verificador (v0.0.32) é condicional — acionado apenas quando a análise algorítmica de padrão de cultura detecta anomalias.

```
┌─────────────────────────────────────────────────────────────────┐
│         PIPELINE DE VALIDAÇÃO VISUAL (Curador+Verifier+Judge)    │
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
│  └── Seleciona top N imagens para análise                        │
│                                                                  │
│  VERIFICADOR (gemini-2.5-flash-lite) — CONDICIONAL (v0.0.32)    │
│  ├── Acionado se: cropPatternResult.shouldCallVerifier = true    │
│  ├── Recebe: imagens curadas + NDVI time series + área           │
│  ├── Foco exclusivo: confirmar identidade da cultura declarada   │
│  ├── Decide: CONFIRMED / SUSPICIOUS / MISMATCH / NO_CROP /      │
│  │           CROP_FAILURE                                         │
│  ├── NO_CROP / MISMATCH → short-circuit (sem Judge)             │
│  └── Outros → prossegue para o Juiz                              │
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
| `cropPatternStatus` | String? | NO_CROP / ANOMALOUS / ATYPICAL / TYPICAL (v0.0.32) |
| `cropPatternData` | String? | JSON stringified CropPatternResult (v0.0.32) |
| `aiCropVerificationStatus` | String? | CONFIRMED / SUSPICIOUS / MISMATCH / NO_CROP / CROP_FAILURE (v0.0.32) |
| `aiCropVerificationData` | String? | JSON stringified CropVerification (v0.0.32) |

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
8. **eos-fusion.service.ts (v0.0.33)**: `determinePhenologicalStage` prioriza NDVI sobre GDD — NDVI > 0.7 = VEGETATIVE, NDVI > 0.55 = REPRODUCTIVE, mesmo que GDD > 90%. Evita declarar MATURATION quando planta está visualmente verde.
9. **eos-fusion.service.ts (v0.0.33)**: GDD-only fallback com sanity check — se EOS_GDD no passado mas NDVI > 0.55, projeta data futura com confiança reduzida em 50% (GDD_OVERRIDE_FUTURE)
8. **ai-validation.service.ts**: Pós-processamento normaliza output do Juiz

---

## 9. Pipeline de Criticidade de Cultura (v0.0.32)

### 9.1 Motivação

O pipeline de processamento anterior assumia que a cultura declarada no cadastro do talhão era fidedigna. Na prática, existem cenários críticos que invalidam essa premissa:

- **Solo exposto**: Talhão declarado como "Soja" mas sem cultivo ativo (pousio, preparo)
- **Cultura divergente**: Talhão declarado como "Milho" mas com padrão visual/NDVI de pastagem
- **Falha de safra**: Plantio ocorreu mas a cultura falhou (seca, praga, granizo)
- **Padrão anômalo**: Curva NDVI com forma que não corresponde à cultura declarada

Sem essa verificação, o sistema gera datas de EOS, estimativas de produtividade e janelas de colheita para talhões que podem não ter sequer uma lavoura em pé — representando risco operacional e financeiro.

### 9.2 Arquitetura: Duas Camadas

```
┌────────────────────────────────────────────────────────────────────────┐
│                 PIPELINE DE CRITICIDADE DE CULTURA                      │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  CAMADA 1: ANÁLISE ALGORÍTMICA (custo zero, executa sempre)            │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  crop-pattern.service.ts                                          │  │
│  │  ├── Recebe: série temporal NDVI + tipo de cultura                │  │
│  │  ├── Calcula métricas: peakNdvi, amplitude, cycleDuration,        │  │
│  │  │   basalNdvi, growthRate, meanNdvi, stdNdvi                     │  │
│  │  ├── Compara com thresholds específicos por cultura               │  │
│  │  │   (8 culturas, 3 categorias: Annual/Semi-Perennial/Perennial) │  │
│  │  └── Classifica: TYPICAL / ATYPICAL / ANOMALOUS / NO_CROP        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                          │                                              │
│          ┌───────────────┼───────────────┐                              │
│          ▼               ▼               ▼                              │
│   ┌──────────┐   ┌────────────┐   ┌──────────┐                        │
│   │ TYPICAL  │   │ ATYPICAL / │   │ NO_CROP  │                        │
│   │          │   │ ANOMALOUS  │   │          │                        │
│   │ Prossegue│   │ Chama      │   │ SHORT-   │                        │
│   │ pipeline │   │ Verificador│   │ CIRCUIT  │                        │
│   │ normal   │   │ IA         │   │ TOTAL    │                        │
│   └──────────┘   └─────┬──────┘   └──────────┘                        │
│                         │                                               │
│  CAMADA 2: VERIFICADOR IA (condicional, gemini-2.5-flash-lite)         │
│  ┌──────────────────────┴───────────────────────────────────────────┐  │
│  │  verifier.ts + verifier-prompt.ts                                 │  │
│  │  ├── Recebe: imagens curadas + NDVI tabela + área + cultura       │  │
│  │  ├── Padrões visuais por cultura (CROP_VISUAL_PATTERNS)           │  │
│  │  ├── Foco exclusivo: "A cultura X realmente existe neste campo?"  │  │
│  │  └── Decide:                                                       │  │
│  │      ├── CONFIRMED → cultura confirmada, prossegue                │  │
│  │      ├── SUSPICIOUS → alerta, mas prossegue                       │  │
│  │      ├── MISMATCH → SHORT-CIRCUIT (cultura errada)                │  │
│  │      ├── NO_CROP → SHORT-CIRCUIT (sem cultivo)                    │  │
│  │      └── CROP_FAILURE → flagged (falha de safra)                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

### 9.3 Culturas Suportadas e Thresholds

O sistema define thresholds específicos para 8 culturas organizadas em 3 categorias:

#### Culturas Anuais (ANNUAL)

| Cultura | Peak NDVI Min | Amplitude Min | Ciclo (dias) | Growth Rate Min |
|---------|--------------|---------------|-------------|-----------------|
| SOJA | 0.55 | 0.30 | 80-160 | 0.003 |
| MILHO | 0.60 | 0.35 | 90-180 | 0.004 |
| GERGELIM | 0.45 | 0.25 | 70-150 | 0.002 |
| CEVADA | 0.50 | 0.28 | 70-140 | 0.003 |
| ALGODÃO | 0.55 | 0.30 | 120-200 | 0.002 |
| ARROZ | 0.55 | 0.30 | 90-170 | 0.003 |

#### Culturas Semi-Perenes (SEMI_PERENNIAL)

| Cultura | Peak NDVI Min | Amplitude Min | Growth Rate Min |
|---------|--------------|---------------|-----------------|
| CANA | 0.50 | 0.20 | 0.001 |

#### Culturas Perenes (PERENNIAL)

| Cultura | Mean NDVI Min | Std NDVI Max | Peak NDVI Min |
|---------|--------------|-------------|--------------|
| CAFÉ | 0.35 | - | 0.40 |

### 9.4 Lógica de Classificação

#### Culturas Anuais

```
SE peakNdvi < threshold.noCropPeak E amplitude < threshold.noCropAmplitude:
  → NO_CROP (shouldShortCircuit = true)

SE peakNdvi < threshold.anomalousPeak OU
   (!hasCycle E amplitude < threshold.expectedAmplitude × 0.6):
  → ANOMALOUS (shouldCallVerifier = true)

SE peakNdvi < threshold.peakMinNdvi OU
   ciclo detectado mas fora do range (min-max dias) OU
   SOS/EOS não detectados para cultura anual/semi-perene OU
   amplitude < threshold.expectedAmplitude × 0.85:
  → ATYPICAL (shouldCallVerifier = true)

SENÃO:
  → TYPICAL (prossegue normalmente)
```

> **Nota (v0.0.33):** Para culturas anuais e semi-perenes, a ausência de detecção
> de SOS/EOS (`cycleDurationDays = null`) é tratada como ATYPICAL, pois uma cultura
> anual saudável DEVE apresentar curva bell-shape com emergência e senescência
> detectáveis. Amplitude abaixo de 85% do esperado para a cultura declarada também
> aciona ATYPICAL, mesmo que o pico NDVI esteja acima do limiar mínimo.

#### Culturas Perenes

```
SE meanNdvi < 0.20 OU peakNdvi < 0.25:
  → NO_CROP (shouldShortCircuit = true)

SE meanNdvi < threshold.meanNdviMin OU
   peakNdvi < threshold.peakNdviMin:
  → ANOMALOUS (shouldCallVerifier = true)

SE meanNdvi < threshold.meanNdviMin × 1.15 OU
   peakNdvi < threshold.peakNdviMin × 1.1:
  → ATYPICAL (shouldCallVerifier = true)

SENÃO:
  → TYPICAL
```

### 9.5 Lógica de Short-Circuit

O short-circuit é o mecanismo central que impede a geração de dados errôneos para talhões sem cultivo confirmado.

#### No Pipeline de Processamento (`process/route.ts`)

```
                     analyzeCropPattern(ndviData, cropType)
                                    │
                  ┌─────────────────┼─────────────────┐
                  ▼                                    ▼
        shouldShortCircuit = true              shouldShortCircuit = false
        (NO_CROP algorítmico)                  (ATYPICAL/ANOMALOUS/TYPICAL)
                  │                                    │
                  ▼                                    ▼
        Salva AgroData mínimo:              Prossegue pipeline completo:
        - cropPatternStatus                 - Dados complementares
        - cropPatternData                   - Balanço hídrico
        - campo status = PARTIAL            - GDD
        - Limpa dados EOS/IA anteriores     - Fusão EOS
        RETORNA IMEDIATAMENTE               - Validação IA (com Verifier)
```

#### No Pipeline de Validação IA (`ai-validation.service.ts`)

```
        Curador selecionou imagens
                    │
                    ▼
    cropPatternResult.shouldCallVerifier?
                    │
            ┌───────┴───────┐
            ▼               ▼
          true            false
            │               │
            ▼               ▼
    runVerifier()     Pula direto para Judge
            │
            ▼
    verifier.status == NO_CROP ou MISMATCH?
            │
     ┌──────┴──────┐
     ▼             ▼
    SIM           NÃO
     │             │
     ▼             ▼
  RETORNA       Prossegue
  REJECTED      para Judge
  (sem Judge)
```

### 9.6 Verificador IA — Detalhes

#### Modelo e Custo

- **Modelo**: `gemini-2.5-flash-lite` (baixo custo, alta velocidade)
- **Imagens enviadas**: Máximo 8 (curadas pelo Curador)
- **Input**: Imagens + tabela NDVI + área do talhão + cultura declarada + resultado algorítmico

#### Padrões Visuais por Cultura (CROP_VISUAL_PATTERNS)

O prompt do Verificador inclui padrões visuais esperados para cada uma das 8 culturas suportadas, como:

- **Soja**: Linhas paralelas regulares, verde escuro homogêneo, espaçamento 0.45-0.5m
- **Milho**: Linhas mais espaçadas, verde escuro alto, plantas maiores que soja
- **Cana**: Linhas largas espaçadas, ciclo longo, crescimento contínuo
- **Café**: Arbustos em grid regular, verde perene, cobertura permanente
- etc.

#### Formato de Resposta

```json
{
  "status": "CONFIRMED | SUSPICIOUS | MISMATCH | NO_CROP | CROP_FAILURE",
  "declaredCrop": "SOJA",
  "visualAssessment": "Texto descritivo do que o agente observa",
  "hypotheses": ["Hipótese 1", "Hipótese 2"],
  "confidence": 0.85,
  "evidence": ["Evidência visual 1", "Evidência visual 2"]
}
```

### 9.7 Interface do Usuário

#### Dashboard — Colunas "Cultura" e "Status" (v0.0.33)

A tabela de talhões possui duas colunas dedicadas à cultura:

1. **Cultura**: Exibe o tipo de cultura declarado (SOJA, MILHO, etc.) — dado informado pelo usuário
2. **Status**: Exibe o resultado da análise algorítmica de padrão NDVI com badges coloridos:

| Status | Cor | Label | Descrição |
|--------|-----|-------|-----------|
| NO_CROP | Vermelho | Sem Cultivo | Solo exposto ou sem vegetação ativa |
| ANOMALOUS | Laranja | Anômalo | Padrão NDVI não corresponde à cultura |
| ATYPICAL | Âmbar | Atípico | Padrão NDVI parcialmente compatível |
| TYPICAL | Verde | Detectada | Padrão NDVI normal para a cultura |
| null | Cinza | Pendente | Análise ainda não executada |

Se `aiCropVerificationStatus` estiver presente e não for `CONFIRMED`, uma segunda linha mostra o status da verificação IA.

Adicionalmente, quando `hasCropIssue` é detectado, as colunas **Colheita (prev.)** e **Confiança Modelo** exibem "—" em vez de dados potencialmente enganosos.

#### Dashboard — Supressão de Resultados IA (v0.0.33)

Quando um talhão apresenta **problema de cultura** (crop issue), os resultados do agente Judge são **suprimidos** na tabela do dashboard. As colunas afetadas exibem "—":

| Coluna | Comportamento com Crop Issue |
|--------|------------------------------|
| IA (Acordo) | "—" (suprimido) |
| EOS IA | "—" (suprimido) |
| Pronta | "—" (suprimido) |
| Conf. IA | "—" (suprimido) |

**Condição de ativação (`hasCropIssue`)**:
```
cropPatternStatus ∈ {NO_CROP, ANOMALOUS, ATYPICAL}
  OU
aiCropVerificationStatus ∉ {CONFIRMED, null}
```

**Justificativa**: Quando a identidade da cultura está em questão, os resultados do Judge (que assume cultura correta) não são confiáveis e podem induzir o usuário a decisões erradas. Apenas a coluna "Cultura" com o status algorítmico/verificador permanece visível.

**Implementação**: `field-table.tsx` — variáveis `aiAgreement`, `aiConf`, `aiEos`, `ready` são forçadas a `null` quando `hasCropIssue === true`.

#### Dashboard — Filtro "Cultura"

Novo grupo de filtros permite selecionar:
- **Todos**: Sem filtro
- **Problemas**: `NO_CROP` + `ANOMALOUS` (agrupado)
- **NO_CROP**, **ANOMALOUS**, **ATYPICAL**, **TYPICAL**: Individual

#### Relatório — Layout Orientado por Crop Issue (v0.0.33)

O status de crop pattern é o **balizador de toda a interface** do relatório. Quando há problema de cultura, a página inteira reflete isso de forma coerente, sem apresentar dados contraditórios.

**Cenário 1 — Crop Issue detectado** (NO_CROP, ANOMALOUS, ATYPICAL, ou Verifier ≠ CONFIRMED):

O `CropAlertCard` é o primeiro elemento exibido (no TOPO, acima de todos os cards de dados). Os demais elementos da página são suprimidos ou limpos:

| Componente | Comportamento |
|------------|---------------|
| **Alerta de Cultura** | Exibido no TOPO da página |
| **MetricCards** | Área mantida; Volume, Aderência Histórica e Confiança exibem `---` |
| **PhenologyTimeline** | EOS exibe `---` e "Sem projeção disponível"; Plantio/SOS mantidos |
| **NDVI Chart** | Mantido (dados brutos são válidos para diagnóstico) |
| **AnalysisTabs** | GDD, harvestWindow e eosAdjustment suprimidos; precipitação e solo mantidos |
| **Seção AI Validation** | Completamente omitida (Judge não é relevante) |

- Justificativa: quando a cultura é duvidosa, EOS/GDD/Volume são inválidos e induziriam o usuário a decisões erradas
- O card é exibido imediatamente após processamento, mesmo antes da validação IA ser executada

**Cenário 2 — Cultura confirmada** (TYPICAL + Verifier CONFIRMED ou ausente):
- Todos os cards de dados exibidos normalmente
- Painel completo de validação visual do Judge disponível
- Comportamento padrão com resultados de Curador + Verificador + Juiz

**Card de Alerta de Cultura** contém:
- Status algorítmico com ícone e cor (vermelho para crítico, âmbar para warning)
- Métricas NDVI relevantes (peak, amplitude, etc.)
- Hipóteses geradas pelo serviço algorítmico
- Dados do Verificador IA (se disponíveis)
- Aviso claro: "Nenhum cálculo de EOS/colheita foi gerado" (para NO_CROP/MISMATCH)

#### Relatório — Visualização do Polígono (v0.0.33)

O header do relatório inclui um botão **"Ver no Mapa"** (ícone MapPin) que abre um modal com a visualização do polígono do talhão no mapa. Disponível apenas quando `field.geometryJson` existe.

**Componente**: `FieldMapModal.tsx` (`components/modals/`)

| Característica | Detalhe |
|----------------|---------|
| **Camada padrão** | Satélite ESRI (World Imagery) |
| **Camada alternativa** | OpenStreetMap (toggle via Layer Control) |
| **Auto-fit** | Bounds ajustados automaticamente ao polígono com padding |
| **Estilo do polígono** | Preenchimento verde (#10b981, 25% opacidade), borda #059669 |
| **Fullscreen** | Botão de expandir/reduzir no header do modal |
| **Escala** | Controle de escala métrica (canto inferior esquerdo) |
| **Leaflet** | Import dinâmico (SSR-safe), CSS injetado em runtime |

O modal é read-only — apenas visualização, sem controles de edição de geometria.

#### Status de Processamento — Crop Issue ≠ Erro

Crop issue é um resultado **válido** de processamento, não uma falha parcial:

| Situação | Status | Justificativa |
|----------|--------|---------------|
| NO_CROP / MISMATCH (short-circuit) | `SUCCESS` | Identificação correta de ausência de cultura |
| ATYPICAL / ANOMALOUS (pipeline completo) | `SUCCESS` | SOS/EOS não detectados é esperado, não erro |
| Sem dados NDVI da API | `PARTIAL` | Falha real de dados |
| API timeout / erro de rede | `ERROR` | Falha de infraestrutura |

**Implementação**: `process/route.ts` — flag `hasCropIssue` impede que missing SOS/EOS degrade o status para PARTIAL quando causado por problema de cultura.

### 9.8 Hipóteses Geradas

O serviço algorítmico gera hipóteses explanatórias para cada classificação:

#### NO_CROP
- "Solo exposto ou em preparo — sem vegetação ativa detectada"
- "Possível área de pousio ou recém-dessecada"
- "NDVI consistentemente abaixo do mínimo para qualquer cultura"

#### ANOMALOUS
- "Pico de NDVI (X) abaixo do esperado (Y) para [cultura]"
- "Amplitude da curva (X) muito baixa para ciclo agrícola"
- "Taxa de crescimento insuficiente para [cultura]"

#### ATYPICAL
- "Duração do ciclo (X dias) fora da faixa esperada (Y-Z dias)"
- "SOS/EOS não detectados — ciclo indefinido para cultura anual"
- "Amplitude (X) abaixo do esperado (Y) para [cultura]"
- "Valores marginais — possível estresse ou plantio tardio"
- "[cultura] sob estresse severo (hídrico, nutricional ou sanitário)"
- "Plantio muito tardio ou replantio com ciclo comprimido"

---

## 10. Status de Implementação

### 10.1 Fases Completadas

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
| CP   | Pipeline de Criticidade de Cultura (Verifier)     | ✅ COMPLETO |
| FIX2 | EOS Sanity Check (GDD contradiction + NDVI priority) | ✅ COMPLETO |
| CP2  | ATYPICAL Refinement (no-cycle + low-amplitude)    | ✅ COMPLETO |
| UI2  | Supressão IA no Dashboard + Relatório para Crop Issues | ✅ COMPLETO |

### 10.2 Fases Pendentes

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

## 11. Referências Bibliográficas

### 11.1 NDVI e Fenologia

1. **Rouse, J.W. et al. (1974)**  
   "Monitoring vegetation systems in the Great Plains with ERTS"  
   *NASA Special Publication*, 351, 309-317.

2. **White, M.A. et al. (2009)**  
   "Intercomparison, interpretation, and assessment of spring phenology in North America"  
   *Global Change Biology*, 15(10), 2335-2359.

### 11.2 Radar e Vegetação

3. **Kim, Y. & van Zyl, J.J. (2009)**  
   "A time-series approach to estimate soil moisture using polarimetric radar data"  
   *IEEE Transactions on Geoscience and Remote Sensing*, 47(8), 2519-2527.

4. **Filgueiras, R. et al. (2019)**  
   "Crop NDVI monitoring based on Sentinel 1"  
   *Remote Sensing*, 11(12), 1441.

5. **Veloso, A. et al. (2017)**  
   "Understanding the temporal behavior of crops using Sentinel-1 and Sentinel-2-like data for agricultural applications"  
   *Remote Sensing of Environment*, 199, 415-426.

### 11.3 Soma Térmica

6. **McMaster, G.S. & Wilhelm, W.W. (1997)**  
   "Growing degree-days: one equation, two interpretations"  
   *Agricultural and Forest Meteorology*, 87(4), 291-300.

7. **Fehr, W.R. & Caviness, C.E. (1977)**  
   "Stages of soybean development"  
   *Iowa State University Special Report*, 80.

### 11.4 Balanço Hídrico

8. **Allen, R.G. et al. (1998)**  
   "Crop evapotranspiration: guidelines for computing crop water requirements"  
   *FAO Irrigation and Drainage Paper*, 56.

9. **Thornthwaite, C.W. & Mather, J.R. (1955)**  
   "The water balance"  
   *Publications in Climatology*, 8(1).

### 11.5 Fusão de Dados e Detecção de Maturidade

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

### 11.6 ZARC e Riscos

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
│   ├── agents/                          # IA Visual Validation (v0.0.29 + v0.0.32)
│   │   ├── curator.ts                   # Agente Curador
│   │   ├── verifier.ts                  # Agente Verificador de Cultura (v0.0.32)
│   │   ├── judge.ts                     # Agente Juiz
│   │   ├── curator-prompt.ts            # Prompt do Curador
│   │   ├── verifier-prompt.ts           # Prompt do Verificador (v0.0.32)
│   │   ├── judge-prompt.ts              # Prompt do Juiz (critérios v0.0.30)
│   │   └── types.ts                     # Tipos compartilhados (+CropVerification v0.0.32)
│   ├── evalscripts.ts                   # Scripts Sentinel Hub (S2 TC, S2 NDVI, S1 Radar, Landsat NDVI, S3 NDVI)
│   └── services/
│       ├── ai-validation.service.ts     # Orquestrador IA (v0.0.29, +Verifier v0.0.32)
│       ├── crop-pattern.service.ts     # Análise algorítmica de padrão de cultura (v0.0.32)
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
│   │   └── field-table.tsx              # Tabela ordenável 14 cols (+Cultura v0.0.32)
│   ├── ai-validation/                   # UI de Validação Visual (v0.0.29)
│   │   └── AIValidationPanel.tsx        # Painel com normalização (v0.0.30) + Alerta Cultura (v0.0.32)
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
│   │   │   ├── route.ts                 # GET lista (+cropPatternStatus v0.0.32)
│   │   │   └── [id]/
│   │   │       ├── route.ts             # GET talhão (fusedEos v0.0.30)
│   │   │       ├── process/route.ts     # POST (+crop-pattern short-circuit v0.0.32)
│   │   │       └── ai-validate/route.ts # POST validação manual (+verifier v0.0.32)
│   │   └── workspace/settings/route.ts
│   └── (authenticated)/
│       ├── page.tsx                     # Dashboard (+filtro Cultura v0.0.32)
│       ├── reports/[id]/page.tsx        # Relatório (+Alerta Cultura v0.0.32)
│       └── settings/page.tsx           # Config IA + módulos
├── prisma/
│   └── schema.prisma                    # +AI fields (v0.0.29), +cropPattern/verification (v0.0.32)
└── docs/
    ├── METHODOLOGY-V2.md                # ← Este documento
    └── PLAN-AI-VISUAL-VALIDATION.md     # Plano original da IA Visual
```

---

*Documento gerado automaticamente. Última atualização: Fevereiro 2026 (v0.0.32)*
