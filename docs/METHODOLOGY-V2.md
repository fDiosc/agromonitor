# Metodologia V2 - Detecção de Colheita Avançada

**Versão:** 2.0  
**Data:** Janeiro 2026  
**Status:** Implementado (Fase 9 pendente)

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura do Sistema](#2-arquitetura-do-sistema)
3. [Fontes de Dados](#3-fontes-de-dados)
4. [Metodologias de Cálculo](#4-metodologias-de-cálculo)
5. [Feature Flags e Configuração](#5-feature-flags-e-configuração)
6. [Graceful Degradation](#6-graceful-degradation)
7. [Status de Implementação](#7-status-de-implementação)
8. [Referências Bibliográficas](#8-referências-bibliográficas)

---

## 1. Visão Geral

A Metodologia V2 representa uma evolução significativa no sistema de detecção de colheita, integrando múltiplas fontes de dados para melhorar a precisão das estimativas fenológicas e projeções de EOS (End of Season).

### Objetivos Principais

- **Maior precisão na detecção de EOS** através da fusão de múltiplas fontes de dados
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
│  │  • Data de EOS ajustada                                       │  │
│  │  • Janela de colheita                                         │  │
│  │  • Estimativa de produtividade                                │  │
│  │  • Nível de confiança                                         │  │
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
├── ndvi-fusion.service.ts      # Fusão óptico + radar
├── eos-fusion.service.ts       # Fusão EOS (NDVI + GDD + Hídrico) ← NOVO
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

Onde (por cultura):
- SOJA:    a=1.15, b=-0.15, R²=0.78
- MILHO:   a=1.10, b=-0.12, R²=0.75
- ALGODÃO: a=1.20, b=-0.18, R²=0.72
```

Referências: Filgueiras et al. (2019), Veloso et al. (2017)

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

#### Algoritmo de Seleção

```
ENTRADA:
  - EOS_NDVI: Data projetada por curva NDVI histórica
  - EOS_GDD: Data projetada por soma térmica
  - NDVI_atual: Valor NDVI mais recente
  - GDD_progress: Percentual de GDD acumulado
  - taxa_declínio: Taxa de queda do NDVI
  - estresse_hídrico: Nível de estresse (NONE/LOW/MEDIUM/HIGH/CRITICAL)

PROCESSO:

1. SE GDD >= 100% E NDVI < 0.65 E taxa_declínio > 0.5%:
   → Maturação fisiológica atingida
   → EOS = EOS_NDVI (ou hoje se já passou)
   → Confiança = max(conf_ndvi, conf_gdd)

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

5. FALLBACK:
   → Se apenas NDVI disponível: usar EOS_NDVI
   → Se apenas GDD disponível: usar EOS_GDD
   → Se nenhum: projeção com baixa confiança
```

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
| useGddForEos           | false   | Usar GDD na projeção de EOS            |
| useWaterBalanceAdjust  | false   | Ajustar EOS por estresse hídrico       |
| usePrecipitationAdjust | true    | Ajustar colheita por precipitação      |

### 5.4 Credenciais Externas

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

## 7. Status de Implementação

### 7.1 Fases Completadas

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

### 7.2 Fases Pendentes

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

## 8. Referências Bibliográficas

### 8.1 NDVI e Fenologia

1. **Rouse, J.W. et al. (1974)**  
   "Monitoring vegetation systems in the Great Plains with ERTS"  
   *NASA Special Publication*, 351, 309-317.

2. **White, M.A. et al. (2009)**  
   "Intercomparison, interpretation, and assessment of spring phenology in North America"  
   *Global Change Biology*, 15(10), 2335-2359.

### 8.2 Radar e Vegetação

3. **Kim, Y. & van Zyl, J.J. (2009)**  
   "A time-series approach to estimate soil moisture using polarimetric radar data"  
   *IEEE Transactions on Geoscience and Remote Sensing*, 47(8), 2519-2527.

4. **Filgueiras, R. et al. (2019)**  
   "Crop NDVI monitoring based on Sentinel 1"  
   *Remote Sensing*, 11(12), 1441.

5. **Veloso, A. et al. (2017)**  
   "Understanding the temporal behavior of crops using Sentinel-1 and Sentinel-2-like data for agricultural applications"  
   *Remote Sensing of Environment*, 199, 415-426.

### 8.3 Soma Térmica

6. **McMaster, G.S. & Wilhelm, W.W. (1997)**  
   "Growing degree-days: one equation, two interpretations"  
   *Agricultural and Forest Meteorology*, 87(4), 291-300.

7. **Fehr, W.R. & Caviness, C.E. (1977)**  
   "Stages of soybean development"  
   *Iowa State University Special Report*, 80.

### 8.4 Balanço Hídrico

8. **Allen, R.G. et al. (1998)**  
   "Crop evapotranspiration: guidelines for computing crop water requirements"  
   *FAO Irrigation and Drainage Paper*, 56.

9. **Thornthwaite, C.W. & Mather, J.R. (1955)**  
   "The water balance"  
   *Publications in Climatology*, 8(1).

### 8.5 Fusão de Dados e Detecção de Maturidade

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

### 8.6 ZARC e Riscos

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
│   └── services/
│       ├── feature-flags.service.ts
│       ├── precipitation.service.ts
│       ├── water-balance.service.ts
│       ├── thermal.service.ts
│       ├── climate-envelope.service.ts
│       ├── sentinel1.service.ts
│       ├── ndvi-fusion.service.ts
│       ├── satellite-schedule.service.ts
│       └── phenology.service.ts
├── components/
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
│   │   ├── fields/[id]/process/route.ts
│   │   └── workspace/settings/route.ts
│   └── (authenticated)/
│       ├── reports/[id]/page.tsx
│       └── settings/page.tsx
├── prisma/
│   └── schema.prisma
└── docs/
    └── METHODOLOGY-V2.md  ← Este documento
```

---

*Documento gerado automaticamente. Última atualização: Janeiro 2026*
