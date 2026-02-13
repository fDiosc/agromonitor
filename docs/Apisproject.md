# Merx Agro MVP -- Documentacao Completa de APIs

> Documento gerado em: Fevereiro 2026
> Projeto: merx-agro-mvp
> Workspace: c:\Users\felip\Documents\Logistic Monitor\merx-agro-mvp

---

## Indice

- [1. APIs Externas](#1-apis-externas)
  - [1.1 Merx API (Dados Agronomicos e Climaticos)](#11-merx-api-dados-agronomicos-e-climaticos)
    - [1.1.1 consulta-ndvi](#111-consulta-ndvi)
    - [1.1.2 consulta-area-lavoura](#112-consulta-area-lavoura)
    - [1.1.3 consulta-solo](#113-consulta-solo)
    - [1.1.4 consulta-precipitacao](#114-consulta-precipitacao)
    - [1.1.5 consulta-temperatura-json](#115-consulta-temperatura-json)
    - [1.1.6 consulta-balanco-hidrico-json](#116-consulta-balanco-hidrico-json)
    - [1.1.7 consulta-idade-lavoura](#117-consulta-idade-lavoura)
    - [1.1.8 consulta-zarc-anual](#118-consulta-zarc-anual)
  - [1.2 Copernicus Data Space (Sentinel Hub)](#12-copernicus-data-space-sentinel-hub)
    - [1.2.1 OAuth Token](#121-oauth-token)
    - [1.2.2 Catalog Search](#122-catalog-search)
    - [1.2.3 Statistical API](#123-statistical-api)
    - [1.2.4 Process API (Imagens Satelite)](#124-process-api-imagens-satelite)
  - [1.3 Google Gemini (IA Generativa)](#13-google-gemini-ia-generativa)
    - [1.3.1 AI Analysis (Templates)](#131-ai-analysis-templates)
    - [1.3.2 Curator Agent](#132-curator-agent)
    - [1.3.3 Verifier Agent](#133-verifier-agent)
    - [1.3.4 Judge Agent](#134-judge-agent)
  - [1.4 Nominatim / OpenStreetMap (Geocoding)](#14-nominatim--openstreetmap-geocoding)
    - [1.4.1 Reverse Geocoding (Server)](#141-reverse-geocoding-server)
    - [1.4.2 Search (Client)](#142-search-client)
  - [1.5 Google Maps Distance Matrix](#15-google-maps-distance-matrix)
  - [1.6 CDN / Tile Services](#16-cdn--tile-services)
- [2. APIs Internas (Next.js Routes)](#2-apis-internas-nextjs-routes)
  - [2.1 Auth](#21-auth)
  - [2.2 Fields](#22-fields)
  - [2.3 Producers](#23-producers)
  - [2.4 Logistics Units](#24-logistics-units)
  - [2.5 Logistics Diagnostic](#25-logistics-diagnostic)
  - [2.6 Templates](#26-templates)
  - [2.7 Upload](#27-upload)
  - [2.8 Workspace Settings](#28-workspace-settings)
  - [2.9 Admin](#29-admin)
  - [2.10 Debug](#210-debug)
  - [2.11 Health](#211-health)
- [3. Variaveis de Ambiente](#3-variaveis-de-ambiente)
- [4. Mapa de Dependencias](#4-mapa-de-dependencias)

---

## 1. APIs Externas

### 1.1 Merx API (Dados Agronomicos e Climaticos)

| Atributo | Valor |
|----------|-------|
| **Base URL** | `https://homolog.api.merx.tech/api/monitoramento` |
| **Configuravel via** | `MERX_API_URL` (env) |
| **Autenticacao** | Nenhuma (API interna Merx) |
| **Fallback** | CORS Proxy via `CORS_PROXY_URL` (default: `https://corsproxy.io/?`) |
| **Timeout padrao** | 30-60s por endpoint |

**Arquivos fonte:**
- `lib/services/merx.service.ts` -- servico principal (NDVI, solo, area, idade, ZARC, precipitacao)
- `lib/services/thermal.service.ts` -- temperatura
- `lib/services/precipitation.service.ts` -- precipitacao standalone
- `lib/services/water-balance.service.ts` -- balanco hidrico
- `lib/services/climate-envelope.service.ts` -- envelope climatico (usa precipitacao + temperatura)

**Quando e chamada:** Durante o processamento de um Field (`POST /api/fields/[id]/process`). Todas as chamadas sao disparadas em paralelo pelo `merx.service.ts` via `Promise.allSettled`.

---

#### 1.1.1 consulta-ndvi

| Atributo | Valor |
|----------|-------|
| **Endpoint** | `POST {MERX_API_BASE}/consulta-ndvi` |
| **Content-Type** | `multipart/form-data` |
| **Arquivo fonte** | `lib/services/merx.service.ts` |
| **Proposito** | Serie temporal de NDVI para o poligono do talhao |

**Request (FormData):**

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `arquivo` | File (Blob) | GeoJSON do talhao (`application/geo+json`, filename: `geometry.geojson`) |
| `start_date` | string | Data inicio (YYYY-MM-DD) |
| `end_date` | string | Data fim (YYYY-MM-DD) |

**Construcao do payload:**
```typescript
const formData = new FormData()
const blob = new Blob([geometryJson], { type: 'application/geo+json' })
formData.append('arquivo', blob, 'geometry.geojson')
formData.append('start_date', '2024-10-01')
formData.append('end_date', '2025-02-11')
```

**Response:** JSON com array de pontos NDVI por data.
```json
{
  "talhao_0": [
    { "date": "2024-10-05", "value": 0.42 },
    { "date": "2024-10-10", "value": 0.55 }
  ]
}
```

**Parsing:** `extractFieldData(res)` extrai o array buscando chaves que iniciam com `talhao_` ou `ponto_`.

---

#### 1.1.2 consulta-area-lavoura

| Atributo | Valor |
|----------|-------|
| **Endpoint** | `POST {MERX_API_BASE}/consulta-area-lavoura` |
| **Content-Type** | `multipart/form-data` |
| **Arquivo fonte** | `lib/services/merx.service.ts` |
| **Proposito** | Calculo de area efetiva de lavoura dentro do poligono |

**Request (FormData):**

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `arquivo` | File (Blob) | GeoJSON do talhao |
| `cultura` | string | `"SOJA"` ou `"MILHO"` |

**Response:** JSON com dados de area.

---

#### 1.1.3 consulta-solo

| Atributo | Valor |
|----------|-------|
| **Endpoint** | `POST {MERX_API_BASE}/consulta-solo` |
| **Content-Type** | `multipart/form-data` |
| **Arquivo fonte** | `lib/services/merx.service.ts` |
| **Proposito** | Dados de solo (tipo, textura, capacidade) para o poligono |

**Request (FormData):**

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `arquivo` | File (Blob) | GeoJSON do talhao |

**Response:** JSON com dados de solo (tipo, textura, etc.).

---

#### 1.1.4 consulta-precipitacao

| Atributo | Valor |
|----------|-------|
| **Endpoint** | `POST {MERX_API_BASE}/consulta-precipitacao` |
| **Content-Type** | `application/json` |
| **Arquivo fonte** | `lib/services/merx.service.ts`, `lib/services/precipitation.service.ts`, `lib/services/climate-envelope.service.ts` |
| **Proposito** | Dados diarios de precipitacao (GPM) por ponto |

**Request (JSON):**
```json
{
  "pontos": [
    {
      "latitude": -13.65,
      "longitude": -54.80,
      "nome": "talhao_0"
    }
  ],
  "start_date": "2024-10-01",
  "end_date": "2025-02-11"
}
```

**Response:**
```json
{
  "talhao_0": [
    { "date": "2024-10-01", "GPM_mm_day": 3.2 },
    { "date": "2024-10-02", "GPM_mm_day": 0.0 }
  ]
}
```

**Parsing (precipitation.service.ts):**
```typescript
const points = rawPoints.map((p) => ({
  date: p.date,
  precipMm: p.GPM_mm_day || p.precip || p.value || 0
}))
```

**Dados derivados:** `totalMm`, `avgDailyMm`, `maxDailyMm`, `rainyDays`, `dryDays`.

---

#### 1.1.5 consulta-temperatura-json

| Atributo | Valor |
|----------|-------|
| **Endpoint** | `POST {MERX_API_BASE}/consulta-temperatura-json` |
| **Content-Type** | `application/json` |
| **Timeout** | 60000ms |
| **Arquivo fonte** | `lib/services/thermal.service.ts`, `lib/services/climate-envelope.service.ts` |
| **Proposito** | Temperatura diaria (min, media, max) para calculo de GDD e projecao de maturidade |

**Request (JSON):**
```json
{
  "geojson": "{\"type\":\"FeatureCollection\",\"features\":[...]}",
  "start_date": "2024-10-01",
  "end_date": "2025-02-11"
}
```

**Response:**
```json
{
  "talhao_0": [
    { "date": "2024-10-01", "temp_media": 28.5, "temp_min": 22.0, "temp_max": 35.0 },
    { "date": "2024-10-02", "temp_media": 27.8, "temp_min": 21.5, "temp_max": 34.2 }
  ]
}
```

**Parsing (thermal.service.ts):**
```typescript
const points = rawPoints.map((p) => ({
  date: p.date || p.data,
  value: p.value || p.temp_media || p.temperatura,
  tmin: p.tmin || p.temp_min,
  tmax: p.tmax || p.temp_max
}))
```

**Dados derivados:** `avgTemp`, `minTemp`, `maxTemp` + serie temporal para GDD.

---

#### 1.1.6 consulta-balanco-hidrico-json

| Atributo | Valor |
|----------|-------|
| **Endpoint** | `POST {MERX_API_BASE}/consulta-balanco-hidrico-json` |
| **Content-Type** | `application/json` |
| **Timeout** | 60000ms |
| **Arquivo fonte** | `lib/services/water-balance.service.ts` |
| **Proposito** | Balanco hidrico (ETc, ETr, deficit, excedente) para ajuste de EOS |

**Request (JSON):**
```json
{
  "geojson": "{\"type\":\"FeatureCollection\",\"features\":[...]}",
  "data_plantio": "2024-11-15",
  "cultura": "SOJA"
}
```

Mapeamento de culturas:
| CropType | Valor API |
|----------|-----------|
| SOJA | `"SOJA"` |
| MILHO | `"MILHO"` |
| ALGODAO | `"ALGODAO"` |
| TRIGO | `"FEIJAO"` |

**Response:**
```json
{
  "talhao_0": [
    {
      "date": "2024-11-15",
      "ETc": 4.5,
      "ETr": 3.8,
      "excedente": 0,
      "umidade": 85.0
    }
  ]
}
```

**Parsing (water-balance.service.ts):**
```typescript
const points = rawPoints.map((p) => {
  const ETc = p.ETc || p.etc || 0
  const ETr = p.ETr || p.etr || p.ETreal || 0
  const deficit = Math.max(0, ETc - ETr)
  const excess = p.excedente || p.excess || Math.max(0, ETr - ETc)
  return { date: p.date || p.data, ETc, ETr, deficit, excess, balance: excess - deficit, soilMoisture: p.umidade }
})
```

**Dados derivados:** `totalDeficit`, `totalExcess`, `avgDeficit`, `maxDeficit`, `stressDays`, `excessDays`.

---

#### 1.1.7 consulta-idade-lavoura

| Atributo | Valor |
|----------|-------|
| **Endpoint** | `POST {MERX_API_BASE}/consulta-idade-lavoura` |
| **Content-Type** | `multipart/form-data` |
| **Arquivo fonte** | `lib/services/merx.service.ts` |
| **Proposito** | Idade da lavoura (dias desde plantio) baseado em sensoriamento remoto |

**Request (FormData):**

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `arquivo` | File (Blob) | GeoJSON do talhao |
| `cultura` | string | `"SOJA"` ou `"MILHO"` |
| `data_plantio` | string | Data de plantio (YYYY-MM-DD) |

---

#### 1.1.8 consulta-zarc-anual

| Atributo | Valor |
|----------|-------|
| **Endpoint** | `POST {MERX_API_BASE}/consulta-zarc-anual` |
| **Content-Type** | `multipart/form-data` |
| **Arquivo fonte** | `lib/services/merx.service.ts` |
| **Proposito** | Zoneamento Agricola de Risco Climatico (janela de plantio recomendada) |

**Request (FormData):**

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `arquivo` | File (Blob) | GeoJSON do talhao |
| `ano` | string | Ano safra (ex: `"2025"`) |
| `cultura` | string | `"SOJA"` ou `"MILHO"` |

---

### 1.2 Copernicus Data Space (Sentinel Hub)

| Atributo | Valor |
|----------|-------|
| **Base URLs** | `https://identity.dataspace.copernicus.eu` (auth), `https://sh.dataspace.copernicus.eu` (dados) |
| **Autenticacao** | OAuth2 client_credentials |
| **Credenciais** | `copernicusClientId` e `copernicusClientSecret` (armazenados no `WorkspaceSettings`) |
| **Arquivo fonte** | `lib/services/sentinel1.service.ts` |

**Quando e chamada:** Durante processamento do Field (se `enableRadarNdvi` estiver ativo no workspace) e durante validacao visual AI (`ai-validate`).

---

#### 1.2.1 OAuth Token

| Atributo | Valor |
|----------|-------|
| **Endpoint** | `POST https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token` |
| **Content-Type** | `application/x-www-form-urlencoded` |
| **Timeout** | 30000ms |

**Request:**
```
grant_type=client_credentials&client_id={clientId}&client_secret={clientSecret}
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "expires_in": 600,
  "token_type": "Bearer"
}
```

**Cache:** Token e cacheado em memoria ate expirar. Renovado automaticamente.

---

#### 1.2.2 Catalog Search

| Atributo | Valor |
|----------|-------|
| **Endpoint** | `POST https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search` |
| **Content-Type** | `application/json` |
| **Auth** | `Authorization: Bearer {access_token}` |
| **Timeout** | 60000ms |
| **Proposito** | Buscar cenas Sentinel-1 GRD disponiveis para um bbox e periodo |

**Request:**
```json
{
  "bbox": [-55.72, -11.17, -55.70, -11.14],
  "datetime": "2024-10-01T00:00:00Z/2025-02-11T00:00:00Z",
  "collections": ["sentinel-1-grd"],
  "limit": 100
}
```

**Response:** GeoJSON FeatureCollection com metadados das cenas disponiveis.

---

#### 1.2.3 Statistical API

| Atributo | Valor |
|----------|-------|
| **Endpoint** | `POST https://sh.dataspace.copernicus.eu/api/v1/statistics` |
| **Content-Type** | `application/json` |
| **Auth** | `Authorization: Bearer {access_token}` |
| **Timeout** | 120000ms |
| **Proposito** | Estatisticas VH/VV e RVI para poligonos de talhoes |

**Request:**
```json
{
  "input": {
    "bounds": {
      "geometry": { "type": "Polygon", "coordinates": [[...]] },
      "properties": { "crs": "http://www.opengis.net/def/crs/EPSG/0/4326" }
    },
    "data": [{
      "type": "sentinel-1-grd",
      "dataFilter": {
        "timeRange": {
          "from": "2024-10-01T00:00:00Z",
          "to": "2025-02-11T00:00:00Z"
        },
        "mosaickingOrder": "mostRecent",
        "polarization": "DV"
      },
      "processing": {
        "backCoeff": "GAMMA0_TERRAIN",
        "orthorectify": true
      }
    }]
  },
  "aggregation": {
    "timeRange": {
      "from": "2024-10-01T00:00:00Z",
      "to": "2025-02-11T00:00:00Z"
    },
    "aggregationInterval": { "of": "P1D" },
    "evalscript": "...ver abaixo...",
    "width": 100,
    "height": 100
  },
  "calculations": { "default": {} }
}
```

**Evalscript usado:**
```javascript
//VERSION=3
function setup() {
  return {
    input: [{ bands: ["VV", "VH", "dataMask"], units: "LINEAR_POWER" }],
    output: [
      { id: "vv_linear", bands: 1, sampleType: "FLOAT32" },
      { id: "vh_linear", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1, sampleType: "UINT8" }
    ]
  }
}
function evaluatePixel(sample) {
  return {
    vv_linear: [sample.VV],
    vh_linear: [sample.VH],
    dataMask: [sample.dataMask]
  }
}
```

**Response:**
```json
{
  "data": [
    {
      "interval": { "from": "2024-10-05T00:00:00Z", "to": "2024-10-06T00:00:00Z" },
      "outputs": {
        "vv_linear": { "bands": { "B0": { "stats": { "mean": 0.045, "min": 0.01, "max": 0.12 } } } },
        "vh_linear": { "bands": { "B0": { "stats": { "mean": 0.008, "min": 0.002, "max": 0.03 } } } }
      }
    }
  ]
}
```

**Pos-processamento:**
```typescript
const vvDb = 10 * Math.log10(vvLin)   // Linear -> dB
const vhDb = 10 * Math.log10(vhLin)
const rvi = calculateRVI(vhDb, vvDb)   // Radar Vegetation Index
```

---

#### 1.2.4 Process API (Imagens Satelite)

| Atributo | Valor |
|----------|-------|
| **Endpoint** | `POST https://sh.dataspace.copernicus.eu/api/v1/process` |
| **Content-Type** | `application/json` |
| **Accept** | `image/png` |
| **Auth** | `Authorization: Bearer {access_token}` |
| **Timeout** | 60000ms |
| **Proposito** | Gerar imagens PNG de satelite para validacao visual AI (Curator + Verifier + Judge) |

**Request:**
```json
{
  "input": {
    "bounds": {
      "bbox": [-55.72, -11.17, -55.70, -11.14],
      "properties": { "crs": "http://www.opengis.net/def/crs/EPSG/0/4326" }
    },
    "data": [{
      "dataFilter": {
        "timeRange": { "from": "2024-12-01T00:00:00Z", "to": "2024-12-02T00:00:00Z" },
        "maxCloudCoverage": 100
      },
      "type": "sentinel-2-l2a"
    }]
  },
  "output": {
    "width": 512,
    "height": 512,
    "responses": [{ "identifier": "default", "format": { "type": "image/png" } }]
  },
  "evalscript": "...evalscript especifico por tipo de imagem..."
}
```

**Data collections suportadas:**
- `sentinel-2-l2a` (NDVI, true-color, false-color)
- `sentinel-1-grd` (SAR/radar)
- `landsat-ot-l2` (Landsat)
- `sentinel-3-olci` (Sentinel-3)

**Response:** `ArrayBuffer` (imagem PNG binaria), convertida para `Buffer` e depois `base64` para envio ao Gemini.

---

### 1.3 Google Gemini (IA Generativa)

Validacao visual AI usa um pipeline de 3 agentes: **Curator** (curadoria de imagens) → **Verifier** (confirmacao de cultura, quando necessario) → **Judge** (validacao agronomica final).

| Atributo | Valor |
|----------|-------|
| **SDK** | `@google/genai` (pacote npm `GoogleGenAI`) |
| **Autenticacao** | `GEMINI_API_KEY` (env) |
| **Modelo padrao** | `gemini-3-flash-preview` |
| **Modelo Curator** | Configuravel via `aiCuratorModel` (default: `gemini-2.5-flash-lite`) |

---

#### 1.3.1 AI Analysis (Templates)

| Atributo | Valor |
|----------|-------|
| **Arquivo fonte** | `lib/services/ai.service.ts` |
| **Quando** | `POST /api/fields/[id]/analyze/[templateId]` |
| **Proposito** | Analise agronomica por template (CREDIT, LOGISTICS, RISK_MATRIX) |

**Chamada:**
```typescript
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })
const response = await ai.models.generateContent({
  model: 'gemini-3-flash-preview',
  contents: userPrompt,
  config: {
    systemInstruction: systemPrompt,
    responseMimeType: 'application/json'
  }
})
```

**Input:** Prompt montado com dados do talhao (NDVI, fenologia, clima, solo, ZARC, etc.) formatados conforme o template.

**Output:** JSON estruturado parseado por `template.parseResponse(text, context)`.

---

#### 1.3.2 Curator Agent

| Atributo | Valor |
|----------|-------|
| **Arquivo fonte** | `lib/agents/curator.ts` |
| **Quando** | `POST /api/fields/[id]/ai-validate` ou durante processamento (se `enableAIValidation` ativo) |
| **Proposito** | Curadoria de imagens de satelite -- avalia qualidade, nuvens, artefatos |

**Chamada:**
```typescript
const ai = new GoogleGenAI({ apiKey })
const result = await ai.models.generateContent({
  model: input.model,  // gemini-2.5-flash-lite ou gemini-3-flash-preview
  contents: [{ role: 'user', parts }]
})
```

**Parts enviados:**
1. Texto: prompt com contexto (area, lista de imagens, tabela NDVI multi-sensor, tabela radar)
2. Imagens: para cada imagem, um bloco de texto (`--- Image: 2024-12-01 - ndvi ---`) seguido de `inlineData` com `mimeType: 'image/png'` e `data: base64`

**Response esperada (JSON):**
```json
{
  "scores": [
    {
      "date": "2024-12-01",
      "type": "ndvi",
      "score": 85,
      "included": true,
      "reason": "Imagem limpa, sem nuvens"
    }
  ],
  "timeSeriesFlags": [],
  "contextSummary": "Resumo de 2-3 frases",
  "timeSeriesCleaningSummary": "Resumo da limpeza"
}
```

---

#### 1.3.3 Verifier Agent

| Atributo | Valor |
|----------|-------|
| **Arquivo fonte** | `lib/agents/verifier.ts` |
| **Modelo** | `gemini-2.5-flash-lite` |
| **Proposito** | Confirma se a cultura declarada realmente esta presente no talhao. Atua como portao entre Curator e Judge |
| **Quando e chamado** | Somente quando `crop-pattern.service` define `shouldCallVerifier=true` (padroes ANOMALOUS ou ATYPICAL) |

**Input:**
- `curatedImages` — imagens curadas pelo Curator
- `multiSensorNdvi` — serie temporal NDVI multi-sensor
- `fieldArea` — area do talhao (ha)
- `cropType` — cultura declarada
- `cropCategory` — ANNUAL | SEMI_PERENNIAL | PERENNIAL
- `cropPatternResult` — resultado do algoritmo de padrao de cultura

**Output:** `CropVerification` com:
- `status`: `CONFIRMED` | `SUSPICIOUS` | `MISMATCH` | `NO_CROP` | `CROP_FAILURE`
- `visualAssessment`, `alternativeHypotheses`, `confidenceInDeclaredCrop`, `evidence`

**Curto-circuito:** Se `NO_CROP` ou `MISMATCH`, o pipeline termina antes do Judge. Se `CROP_FAILURE`, o Judge roda com contexto de perda total. Se `CONFIRMED` ou `SUSPICIOUS`, o Judge roda normalmente.

---

#### 1.3.4 Judge Agent

| Atributo | Valor |
|----------|-------|
| **Arquivo fonte** | `lib/agents/judge.ts` |
| **Quando** | Apos o Curator (e Verifier quando aplicavel), na pipeline de validacao visual AI |
| **Proposito** | Validacao agronomica final -- compara imagens com dados algoritmicos |

**Chamada:** Identica ao Curator (`ai.models.generateContent`), modelo `gemini-3-flash-preview`.

**Parts enviados:**
1. Texto: prompt com contexto completo (area, crop, plantio, SOS, EOS, metodo EOS, confianca, pico NDVI, saude fenologica, resumo do Curator, tabelas NDVI/radar, GDD, balanco hidrico, precipitacao, ZARC, metricas de fusao)
2. Imagens: curadas pelo Curator (apenas as aprovadas)

**Response esperada (JSON):**
```json
{
  "algorithmicValidation": {
    "eosAgreement": "CONFIRMED",
    "eosAdjustedDate": null,
    "eosAdjustmentReason": null,
    "stageAgreement": true,
    "stageComment": "Estagio R8 confirmado visualmente"
  },
  "visualFindings": [
    { "type": "HEALTHY_CROP", "description": "Cultura com desenvolvimento uniforme" }
  ],
  "harvestReadiness": {
    "ready": true,
    "estimatedDate": "2025-03-15",
    "delayRisk": "NONE",
    "delayDays": 0,
    "notes": "Sem indicios de atraso"
  },
  "riskAssessment": {
    "overallRisk": "LOW",
    "factors": [],
    "climatic": "Sem anomalias",
    "phytosanitary": "Sem sinais de doenca",
    "operational": "Normal"
  },
  "recommendations": ["Monitorar proximas 2 semanas para confirmacao"],
  "confidence": 87
}
```

---

### 1.4 Nominatim / OpenStreetMap (Geocoding)

| Atributo | Valor |
|----------|-------|
| **Base URL** | `https://nominatim.openstreetmap.org` |
| **Autenticacao** | Nenhuma (header `User-Agent` obrigatorio) |
| **Rate Limit** | ~1 req/s |
| **Arquivo fonte** | `lib/services/geocoding.service.ts`, `components/maps/map-drawer.tsx` |

---

#### 1.4.1 Reverse Geocoding (Server)

| Atributo | Valor |
|----------|-------|
| **Endpoint** | `GET https://nominatim.openstreetmap.org/reverse` |
| **Quando** | Criacao de Field (`POST /api/fields`) e batch import |
| **Proposito** | Converter coordenadas (lat/lng) em cidade e estado |

**Request (query params):**
```
?format=json&lat=-13.65&lon=-54.80&zoom=10
```

**Headers:**
```
User-Agent: MerxAgroMonitor/1.0
Accept-Language: pt-BR
```

**Response:**
```json
{
  "address": {
    "city": "Agua Boa",
    "town": null,
    "municipality": null,
    "county": "Agua Boa",
    "state": "Mato Grosso",
    "country": "Brasil"
  }
}
```

**Parsing:**
```typescript
const city = data.address?.city || data.address?.town || data.address?.municipality || data.address?.county || 'Zona Rural'
const state = data.address?.state || 'Estado Desconhecido'
```

**Cache:** Em memoria (`Map<string, Location>`), chave = lat/lng arredondados a 2 casas decimais.

**Fallback:** Se a API falhar, usa `getDefaultLocation(lat, lng)` que mapeia estados por faixas de coordenadas.

---

#### 1.4.2 Search (Client)

| Atributo | Valor |
|----------|-------|
| **Endpoint** | `GET https://nominatim.openstreetmap.org/search` |
| **Quando** | Busca de localizacao no componente de mapa (map-drawer) |
| **Proposito** | Buscar cidades/locais no Brasil para centralizar o mapa |

**Request (query params):**
```
?format=json&q=Agua+Boa%2C+Brasil&countrycodes=br&limit=5&addressdetails=1
```

**Headers:**
```
User-Agent: MerxAgroMonitor/1.0
Accept-Language: pt-BR
```

**Response:** Array de resultados com `lat`, `lon`, `display_name`.

**Arquivo fonte:** `components/maps/map-drawer.tsx`

---

### 1.5 Google Maps Distance Matrix

| Atributo | Valor |
|----------|-------|
| **Endpoint** | `GET https://maps.googleapis.com/maps/api/distancematrix/json` |
| **Autenticacao** | `googleMapsApiKey` (armazenado no `WorkspaceSettings`) |
| **Arquivo fonte** | `lib/services/distance.service.ts` |
| **Quando** | Calculo de distancias field-caixa logistica (se `distanceCalculationMethod = 'road_distance'`) |
| **Proposito** | Distancia rodoviaria entre talhoes e caixas logisticas |

**Request (query params):**
```
?origins=-13.65,-54.80&destinations=-14.00,-55.00&key={apiKey}
```

**Response:**
```json
{
  "status": "OK",
  "rows": [{
    "elements": [{
      "status": "OK",
      "distance": { "value": 45200, "text": "45.2 km" },
      "duration": { "value": 2400, "text": "40 min" }
    }]
  }]
}
```

**Parsing:**
```typescript
const distanceKm = element.distance.value / 1000
```

**Fallback:** Se a API falhar ou nao houver API key, usa `calculateStraightLineDistance()` (Haversine).

---

### 1.6 CDN / Tile Services

Servicos sem autenticacao usados para renderizacao de mapas e analytics.

| URL | Proposito | Usado em |
|-----|-----------|----------|
| `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` | Imagem satelite (basemap) | `map-drawer.tsx`, `PropertiesMap.tsx` |
| `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}` | Labels e fronteiras | `map-drawer.tsx` |
| `https://tiles.stadiamaps.com/tiles/stamen_toner_lines/{z}/{x}/{y}{r}.png` | Linhas de fronteira | `map-drawer.tsx` |
| `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` | Tiles OSM | `PropertiesMap.tsx` |
| `https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson` | GeoJSON estados BR | `map-drawer.tsx` |
| `https://unpkg.com/leaflet@1.9.4/dist/leaflet.css` | Leaflet CSS | `app/layout.tsx` |
| `https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.css` | Leaflet Draw CSS | `app/layout.tsx` |
| `https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon*.png` | Icones Leaflet | `map-drawer.tsx` |
| `https://www.clarity.ms/tag/vbr4xce9j5` | Microsoft Clarity (analytics) | `app/layout.tsx` |
| `https://www.googletagmanager.com/gtag/js?id=G-SCYR38N5VF` | Google Analytics (GA4) | `app/layout.tsx` |

### 1.7 AWS S3 (Armazenamento de Imagens — v0.0.34)

| Atributo | Valor |
|----------|-------|
| **SDK** | `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` |
| **Bucket** | Configuravel via `S3_BUCKET` (default: `pocs-merxlabs`) |
| **Regiao** | Configuravel via `S3_REGION` (default: `us-east-1`) |
| **Arquivo fonte** | `lib/s3.ts` |
| **Quando** | Persistencia de imagens de satelite (AI Validation + Analise Visual) |

**Operacoes:**

| Funcao | SDK Method | Proposito |
|--------|-----------|-----------|
| `uploadImage(key, buffer)` | `PutObjectCommand` | Upload de imagem PNG para S3 |
| `downloadImage(key)` | `GetObjectCommand` | Download para processamento (base64 para IA) |
| `getPresignedUrl(key)` | `getSignedUrl` | URL assinada (1h) para frontend |
| `deleteImage(key)` | `DeleteObjectCommand` | Remocao de imagem |

**Path convention:**
```
{bucket}/agro-monitor/{workspaceId}/fields/{fieldId}/{date}_{type}_{collection}.png
```

**Exemplo:**
```
pocs-merxlabs/agro-monitor/ws_abc123/fields/f_xyz789/2025-01-15_truecolor_sentinel-2-l2a.png
```

**Compatibilidade:** Suporta AWS S3, Cloudflare R2 e MinIO via `S3_ENDPOINT` opcional.

---

## 2. APIs Internas (Next.js Routes)

Todas as rotas internas ficam em `app/api/` e seguem o padrao Next.js App Router. Autenticacao e feita via cookie JWT (`auth_token`), validado pelo middleware em `lib/auth.ts`.

**Roles:** `SUPER_ADMIN`, `ADMIN`, `OPERATOR`, `VIEWER`

---

### 2.1 Auth

#### POST /api/auth/login

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/auth/login/route.ts` |
| **Auth** | Nenhuma (rota publica) |
| **Proposito** | Login do usuario |

**Request:**
```json
{ "email": "user@merx.tech", "password": "senha123" }
```

**Response:**
```json
{ "success": true, "mustChangePassword": false, "user": { "id": "...", "name": "...", "email": "...", "role": "ADMIN" } }
```

**Efeito:** Seta cookie `auth_token` (JWT, httpOnly, secure).

---

#### POST /api/auth/logout

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/auth/logout/route.ts` |
| **Auth** | Cookie JWT |
| **Proposito** | Logout |

**Response:** `{ "success": true }`

**Efeito:** Limpa cookie `auth_token`.

---

#### GET /api/auth/me

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/auth/me/route.ts` |
| **Auth** | Cookie JWT |
| **Proposito** | Retorna dados do usuario logado |

**Response:**
```json
{ "user": { "id": "...", "name": "...", "email": "...", "role": "ADMIN", "workspaceId": "...", "workspaceName": "..." } }
```

---

#### POST /api/auth/change-password

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/auth/change-password/route.ts` |
| **Auth** | Cookie JWT |

**Request:**
```json
{ "currentPassword": "antiga", "newPassword": "nova123" }
```

**Response:** `{ "success": true }`

---

#### POST /api/auth/accept-disclaimer

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/auth/accept-disclaimer/route.ts` |
| **Auth** | Cookie JWT |

**Request:**
```json
{ "version": "0.0.7" }
```

**Response:** `{ "success": true, "message": "Disclaimer aceito" }`

---

### 2.2 Fields

#### GET /api/fields

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/fields/route.ts` |
| **Auth** | Cookie JWT |
| **Query params** | `producerId?` (filtra por produtor) |

**Response (v0.0.35):**
```json
{
  "fields": [
    {
      "id": "...", "name": "Talhao 1", "cropType": "SOJA", "status": "SUCCESS",
      "city": "Agua Boa", "state": "Mato Grosso", "areaHa": 250.5,
      "plantingDateInput": "2025-11-15", "seasonStartDate": "2025-10-01",
      "editHistory": "[...]", "parentFieldId": null,
      "_count": { "subFields": 3 },
      "subFields": [
        {
          "id": "...", "name": "Talhão 1", "status": "PENDING", "cropType": "SOJA",
          "parentFieldId": "...", "agroData": { "..." }
        }
      ],
      "agroData": {
        "areaHa": 250.5, "volumeEstimatedKg": 900000,
        "confidence": "HIGH", "confidenceScore": 82,
        "eosDate": "2026-03-15", "sosDate": "2025-11-20",
        "fusedEosDate": "2026-03-10",
        "cropPatternStatus": "TYPICAL",
        "aiCropVerificationStatus": "CONFIRMED",
        "aiValidationAgreement": "CONFIRMED",
        "detectedPlantingDate": "2025-11-18",
        "detectedCropType": "SOJA",
        "detectedConfidence": "HIGH"
      },
      "producer": { "id": "...", "name": "Salvadori" },
      "logisticsUnit": { "id": "...", "name": "Unidade Norte" }
    }
  ]
}
```

> **Nota (v0.0.35):** Apenas talhões raiz são retornados (`parentFieldId: null`). Subtalhões são incluídos inline no array `subFields` de cada pai, com `agroData` processado pela mesma função de transformação (`processAgroData`). O campo `_count.subFields` permanece para contagem rápida.
```

---

#### POST /api/fields

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/fields/route.ts` |
| **Auth** | Cookie JWT (ADMIN, OPERATOR) |
| **Proposito** | Criar novo talhao |

**Request:**
```json
{
  "name": "Talhao Sul",
  "cropType": "SOJA",
  "seasonStartDate": "2025-10-01",
  "geometryJson": "{\"type\":\"FeatureCollection\",...}",
  "producerId": "cmli...",
  "plantingDateInput": "2025-11-15",
  "logisticsUnitId": "cmli..."
}
```

**Validacao:** Zod schema, `validateGeometry()`, `reverseGeocode()`.

**Response:** `{ "field": { ... } }` (201)

---

#### GET /api/fields/[id]

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/fields/[id]/route.ts` |
| **Auth** | Cookie JWT |
| **Proposito** | Dados completos do talhao (agro, NDVI, ciclo, colheita, ZARC, subtalhões, pai) |

**Response:**
```json
{
  "field": {
    "id": "...", "name": "...",
    "agroData": { ... },
    "ndviData": [...],
    "analyses": [...],
    "_count": { "subFields": 2 },
    "subFields": [
      { "id": "...", "name": "Talhão 1", "geometryJson": "{...}" },
      { "id": "...", "name": "Talhão 2", "geometryJson": "{...}" }
    ],
    "parentField": { "id": "...", "name": "Fazenda Roseira" }
  },
  "historicalNdvi": [...],
  "cycleAnalysis": { ... },
  "correlationDetails": { ... },
  "chartOverlayData": { ... },
  "harvestWindow": { ... },
  "zarcInfo": { ... },
  "fusedEos": { ... }
}
```

> **Nota (v0.0.36):** O campo `subFields` retorna id, name e geometryJson de cada subtalhão (para exibição no mapa do relatório). O campo `parentField` retorna id e name do talhão pai (para breadcrumb no relatório do subtalhão). Ambos são `null`/vazio quando não aplicável.

---

#### PATCH /api/fields/[id]

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/fields/[id]/route.ts` |
| **Auth** | Cookie JWT (ADMIN, OPERATOR) |

**Request:**
```json
{ "name": "Novo Nome", "producerId": "cmli...", "logisticsUnitId": "cmli..." }
```

> **Nota (v0.0.36):** Para subtalhões, o frontend omite `producerId` e `logisticsUnitId` do payload (herdados do pai). Os demais campos (nome, cultura, dados agronômicos) funcionam normalmente. Dados detectados (`detectedPlantingDate`, `detectedCropType`, `detectedConfidence`) são preservados no reprocessamento.

---

#### DELETE /api/fields/[id]

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/fields/[id]/route.ts` |
| **Auth** | Cookie JWT (ADMIN, OPERATOR) |

**Response:** `{ "success": true }`

---

#### POST /api/fields/[id]/process

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/fields/[id]/process/route.ts` |
| **Auth** | Cookie JWT (ADMIN, OPERATOR) |
| **Proposito** | Processamento completo do talhao (NDVI, clima, fenologia, radar, AI) |

**Fluxo:** Chama Merx API (NDVI + precipitacao + solo + area + idade + ZARC), depois temperatura, balanco hidrico, Sentinel-1 SAR, e opcionalmente validacao AI.

**Response:**
```json
{
  "success": true,
  "status": "SUCCESS",
  "processingTimeMs": 45000,
  "warnings": [],
  "agroData": { ... },
  "diagnostics": { ... }
}
```

---

#### POST /api/fields/[id]/ai-validate

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/fields/[id]/ai-validate/route.ts` |
| **Auth** | Cookie JWT (ADMIN, OPERATOR) |
| **Proposito** | Validacao visual AI sob demanda |

**Response:**
```json
{
  "success": true,
  "agreement": "CONFIRMED",
  "confidence": 85,
  "visualAlerts": [],
  "eosAdjusted": null,
  "costUSD": 0.0045,
  "processingTimeMs": 12000
}
```

---

#### GET /api/fields/[id]/status

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/fields/[id]/status/route.ts` |
| **Auth** | Cookie JWT |
| **Proposito** | Status leve para polling |

**Response:**
```json
{ "id": "...", "status": "PROCESSING", "errorMessage": null, "updatedAt": "2025-02-11T..." }
```

---

#### POST /api/fields/[id]/analyze/[templateId]

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/fields/[id]/analyze/[templateId]/route.ts` |
| **Auth** | Cookie JWT |
| **Proposito** | Executar analise AI por template |

**Response:**
```json
{ "success": true, "analysis": { "id": "...", "result": { ... }, "templateId": "..." }, "meta": { ... } }
```

---

#### POST /api/fields/[id]/analyze/[templateId]/reprocess

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/fields/[id]/analyze/[templateId]/reprocess/route.ts` |
| **Auth** | Cookie JWT (ADMIN, OPERATOR) |

**Response:** `{ "success": true, "message": "Analise reprocessada", "analysisId": "..." }`

---

#### GET /api/fields/[id]/analyze/[templateId]/reprocess

| Atributo | Valor |
|----------|-------|
| **Proposito** | Status do reprocessamento |

**Response:**
```json
{ "id": "...", "templateId": "...", "isStale": false, "reprocessStatus": "COMPLETED", "dataVersion": 3 }
```

---

#### GET /api/fields/[id]/subfields (v0.0.34, atualizado v0.0.36)

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/fields/[id]/subfields/route.ts` |
| **Auth** | Cookie JWT |
| **Feature Flag** | `enableSubFields` |
| **Proposito** | Listar talhao pai e seus subtalhoes (com dados agronômicos expandidos) |

**Response:**
```json
{
  "parentField": {
    "id": "...", "name": "Fazenda Roseira", "geometryJson": "...", "cropType": "SOJA",
    "subFields": [
      {
        "id": "...", "name": "Talhão 1", "geometryJson": "...", "cropType": "SOJA", "status": "PENDING",
        "plantingDateInput": "2025-11-15", "seasonStartDate": "2025-10-01", "editHistory": "[...]",
        "agroData": {
          "areaHa": 50.2, "volumeEstimatedKg": 175700, "confidence": "MEDIUM",
          "confidenceScore": 62, "eosDate": "2026-03-15", "sosDate": "2025-12-01",
          "cropPatternStatus": "CONFIRMED", "phenologyHealth": "NORMAL", "peakNdvi": 0.85,
          "detectedPlantingDate": "2025-11-10", "detectedCropType": "SOJA", "detectedConfidence": "HIGH"
        }
      }
    ]
  }
}
```

> **Nota (v0.0.36):** O `agroData` dos subtalhões agora inclui campos `detectedPlantingDate`, `detectedCropType` e `detectedConfidence` para referência no modal de edição (valores auto-gerados preservados). Campos `plantingDateInput`, `seasonStartDate` e `editHistory` também são retornados diretamente no subtalhão.

---

#### POST /api/fields/[id]/subfields (v0.0.34)

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/fields/[id]/subfields/route.ts` |
| **Auth** | Cookie JWT (ADMIN, OPERATOR) |
| **Feature Flag** | `enableSubFields` |
| **Proposito** | Criar subtalhao dentro do talhao pai |

**Body:**
```json
{
  "name": "Talhão Sul",
  "geometryJson": "{\"type\":\"Polygon\",\"coordinates\":[...]}",
  "cropType": "SOJA"
}
```

**Validacao:**
- Geometria do subtalhao deve estar contida no poligono pai (`@turf/boolean-contains` com buffer de 20m)
- Nome automatico se nao fornecido (Talhao 1, Talhao 2...)
- Herda propriedades do pai (workspace, producer, seasonStart)

**Response:**
```json
{ "success": true, "field": { "id": "...", "name": "Talhão Sul", "parentFieldId": "..." } }
```

---

#### GET /api/fields/[id]/subfields/comparison (v0.0.35)

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/fields/[id]/subfields/comparison/route.ts` |
| **Auth** | Cookie JWT |
| **Feature Flag** | `enableSubFieldComparison` |
| **Proposito** | Dados comparativos pai vs subtalhões para aba de comparação no relatório |

**Response:**
```json
{
  "parent": {
    "id": "...", "name": "Fazenda Roseira",
    "agroData": { "areaHa": 250, "volumeEstimatedKg": 875000, "peakNdvi": 0.82, ... },
    "ndviTimeSeries": [{ "date": "2025-10-15", "ndvi": 0.35 }, ...]
  },
  "subFields": [
    {
      "id": "...", "name": "Talhão 1",
      "agroData": { "areaHa": 50, "volumeEstimatedKg": 175000, "peakNdvi": 0.85, ... },
      "ndviTimeSeries": [{ "date": "2025-10-15", "ndvi": 0.38 }, ...]
    }
  ]
}
```

---

#### GET /api/fields/[id]/images (v0.0.34)

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/fields/[id]/images/route.ts` |
| **Auth** | Cookie JWT |
| **Proposito** | Obter imagens de satelite do talhao (URLs assinadas S3) |

**Query params:**
| Param | Tipo | Default | Descricao |
|-------|------|---------|-----------|
| `refresh` | boolean | `false` | Se `true`, busca novas imagens no Sentinel Hub (incremental) |

**Response:**
```json
{
  "images": [
    {
      "id": "...", "fieldId": "...", "date": "2025-01-15", "type": "truecolor",
      "collection": "sentinel-2-l2a", "s3Key": "agro-monitor/ws1/fields/f1/2025-01-15_truecolor_sentinel-2-l2a.png",
      "url": "https://pocs-merxlabs.s3.amazonaws.com/agro-monitor/..."
    }
  ],
  "dates": ["2025-01-15", "2025-01-30"],
  "totalCount": 36,
  "newCount": 4
}
```

**Nota:** Imagens sao compartilhadas entre AI Validation e Analise Visual. O servico `field-images.service.ts` centraliza o fetch e armazenamento.

---

#### PATCH /api/fields/[id] — Edicao Agronomica (v0.0.34)

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/fields/[id]/route.ts` |
| **Auth** | Cookie JWT (ADMIN, OPERATOR) |
| **Proposito** | Editar dados agronomicos com reprocessamento |

**Body (campos opcionais):**
```json
{
  "plantingDateInput": "2025-10-15",
  "cropType": "MILHO",
  "seasonStartDate": "2025-09-01",
  "geometryJson": "{...}"
}
```

**Comportamento:**
- Alteracoes agronomicas (`plantingDateInput`, `cropType`, `seasonStartDate`) sao registradas em `editHistory` (JSON)
- Se houver alteracao agronomica, dispara reprocessamento background (`POST /api/fields/[id]/process`)
- Dados detectados automaticamente sao preservados nos campos `detected*` do `AgroData`

**Response:**
```json
{ "success": true, "field": { ... }, "reprocessing": true }
```

---

### 2.3 Producers

#### GET /api/producers

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/producers/route.ts` |
| **Auth** | Cookie JWT |

**Response:**
```json
{
  "producers": [
    { "id": "...", "name": "Salvadori", "cpf": null, "_count": { "fields": 6 }, "defaultLogisticsUnit": { "id": "...", "name": "Norte" } }
  ]
}
```

---

#### POST /api/producers

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/producers/route.ts` |
| **Auth** | Cookie JWT (ADMIN, OPERATOR) |

**Request:**
```json
{ "name": "Joao Silva", "cpf": "12345678901", "defaultLogisticsUnitId": "cmli..." }
```

---

#### GET /api/producers/[id]

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/producers/[id]/route.ts` |
| **Auth** | Cookie JWT |

**Response:** `{ "producer": { ..., "fields": [...] } }`

---

#### PUT /api/producers/[id]

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/producers/[id]/route.ts` |
| **Auth** | Cookie JWT (ADMIN, OPERATOR) |

**Request:**
```json
{ "name": "Novo Nome", "cpf": "12345678901", "defaultLogisticsUnitId": "cmli..." }
```

---

#### DELETE /api/producers/[id]

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/producers/[id]/route.ts` |
| **Auth** | Cookie JWT (ADMIN) |

---

### 2.4 Logistics Units

#### GET /api/logistics-units

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/logistics-units/route.ts` |
| **Auth** | Cookie JWT |
| **Query** | `includeInactive=true` (opcional) |

**Response:**
```json
{
  "logisticsUnits": [
    { "id": "...", "name": "Unidade Norte", "latitude": -13.5, "longitude": -54.8, "coverageRadiusKm": 150, "isActive": true }
  ]
}
```

---

#### POST /api/logistics-units

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/logistics-units/route.ts` |
| **Auth** | Cookie JWT (ADMIN, OPERATOR) |

**Request:**
```json
{
  "name": "Unidade Sul",
  "latitude": -15.0,
  "longitude": -55.0,
  "address": "Rua X, 100",
  "city": "Cuiaba",
  "state": "MT",
  "coverageRadiusKm": 200,
  "dailyCapacityTons": 500,
  "storageCapacityTons": 5000
}
```

---

#### GET /api/logistics-units/[id]

**Response:** `{ "logisticsUnit": { ..., "producers": [...], "fields": [...] } }`

---

#### PUT /api/logistics-units/[id]

**Request:** Mesmos campos do POST (parcial).

---

#### DELETE /api/logistics-units/[id]

**Comportamento:** Desativa se houver fields vinculados; deleta se nao houver.

---

#### GET /api/logistics-units/coverage

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/logistics-units/coverage/route.ts` |
| **Proposito** | Relatorio de cobertura (field-unit assignment) |

**Response:**
```json
{ "fields": [...], "stats": { "total": 87, "covered": 80, "uncovered": 7 }, "byUnit": [...], "logisticsUnits": [...] }
```

---

#### POST /api/logistics-units/reprocess

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/logistics-units/reprocess/route.ts` |
| **Proposito** | Recalcular todas as distancias field-unit do workspace |

---

### 2.5 Logistics Diagnostic

#### GET /api/logistics/diagnostic

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/logistics/diagnostic/route.ts` |
| **Auth** | Cookie JWT |
| **Query** | `seasonYear?`, `logisticsUnitIds?` (comma-separated) |
| **Proposito** | Dashboard logistico com previsao de colheita e alertas |

**Response:**
```json
{
  "summary": { "totalFields": 87, "harvestReady": 12, "avgDaysToHarvest": 45 },
  "dailyForecast": [...],
  "fields": [...],
  "alerts": [...]
}
```

---

### 2.6 Templates

#### GET /api/templates

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/templates/route.ts` |
| **Auth** | Cookie JWT |
| **Proposito** | Listar templates de analise disponiveis |

**Response:**
```json
{ "templates": [{ "id": "...", "name": "Analise de Credito", "type": "CREDIT" }] }
```

---

### 2.7 Upload

#### POST /api/upload

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/upload/route.ts` |
| **Auth** | Cookie JWT |
| **Content-Type** | `multipart/form-data` |
| **Proposito** | Validar arquivo de geometria (KML ou GeoJSON) sem criar o field |

**Request (FormData):**

| Campo | Tipo |
|-------|------|
| `file` | File (KML ou GeoJSON) |

**Response (sucesso):**
```json
{
  "isValid": true,
  "type": "Polygon",
  "vertexCount": 25,
  "areaHa": 350.5,
  "centroid": { "lat": -13.65, "lng": -54.80 },
  "geojson": { "type": "FeatureCollection", "features": [...] },
  "warnings": []
}
```

**Response (erro):**
```json
{ "isValid": false, "errors": ["Poligono precisa de pelo menos 3 vertices"], "warnings": [] }
```

---

### 2.8 Workspace Settings

#### GET /api/workspace/settings

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/workspace/settings/route.ts` |
| **Auth** | Cookie JWT |

**Response:**
```json
{
  "settings": { "name": "Merx Asset", "slug": "merx-asset", "maxFields": 100 },
  "featureFlags": {
    "enablePrecipitation": true,
    "enableWaterBalance": false,
    "enableRadarNdvi": false,
    "enableAIValidation": false,
    "distanceCalculationMethod": "straight_line"
  }
}
```

---

#### PUT /api/workspace/settings

| Atributo | Valor |
|----------|-------|
| **Auth** | Cookie JWT (ADMIN) |

**Request:**
```json
{
  "settings": { "maxFields": 200 },
  "featureFlags": { "enableRadarNdvi": true, "copernicusClientId": "...", "copernicusClientSecret": "..." }
}
```

---

### 2.9 Admin

#### GET /api/admin/users

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/admin/users/route.ts` |
| **Auth** | Cookie JWT (ADMIN+) |

**Response:** `{ "users": [{ "id": "...", "name": "...", "email": "...", "role": "OPERATOR", "isActive": true }] }`

---

#### POST /api/admin/users

| Atributo | Valor |
|----------|-------|
| **Auth** | Cookie JWT (ADMIN+) |

**Request:**
```json
{ "name": "Novo Usuario", "email": "novo@merx.tech", "password": "temp123", "role": "OPERATOR" }
```

SUPER_ADMIN pode adicionar `workspaceId` para criar em outro workspace.

---

#### GET /api/admin/users/[id]

**Response:** `{ "user": { ... } }`

---

#### PUT /api/admin/users/[id]

**Request:** `{ "name": "...", "role": "ADMIN", "isActive": true }`

---

#### DELETE /api/admin/users/[id]

Nao permite deletar a si mesmo.

---

#### POST /api/admin/users/[id]/reset-password

**Request:** `{ "newPassword": "nova123" }`

---

#### GET /api/admin/workspaces

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/admin/workspaces/route.ts` |
| **Auth** | Cookie JWT (SUPER_ADMIN) |

**Response:** `{ "workspaces": [...] }`

---

#### POST /api/admin/workspaces

**Request:**
```json
{
  "name": "Nova Empresa",
  "slug": "nova-empresa",
  "maxFields": 50,
  "maxUsers": 5,
  "adminName": "Admin",
  "adminEmail": "admin@nova.com",
  "adminPassword": "temp123"
}
```

---

#### GET /api/admin/workspaces/[id]

**Response:** `{ "workspace": { ..., "users": [...] } }`

---

#### PUT /api/admin/workspaces/[id]

**Request:** `{ "name": "...", "isActive": true, "maxFields": 200, "maxUsers": 20 }`

---

#### DELETE /api/admin/workspaces/[id]

Deleta workspace e todos os dados associados.

---

#### GET /api/admin/fix-status

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/admin/fix-status/route.ts` |
| **Proposito** | Listar fields com status inconsistente (SUCCESS mas sem dados completos) |

**Response:**
```json
{ "total": 87, "inconsistent": 3, "fields": [...] }
```

---

#### POST /api/admin/fix-status

**Proposito:** Corrigir status SUCCESS -> PARTIAL para fields inconsistentes.

---

### 2.10 Debug

Rotas de debug para desenvolvimento. Nao sao chamadas pelo frontend em producao.

#### GET /api/debug/historical/[id]

**Proposito:** Analise historica de NDVI para um field.

#### GET /api/debug/zarc/[id]

**Proposito:** Dados ZARC detalhados para um field.

#### GET /api/debug/logistics

**Proposito:** Debug de dados logisticos (datas de colheita, etc.).

#### GET /api/debug/chart/[id]

**Proposito:** Dados de overlay de graficos para um field.

---

### 2.11 Health

#### GET /api/health

| Atributo | Valor |
|----------|-------|
| **Arquivo** | `app/api/health/route.ts` |
| **Auth** | Nenhuma (rota publica) |

**Response:**
```json
{ "status": "ok", "timestamp": "2025-02-11T19:00:00.000Z" }
```

---

## 3. Variaveis de Ambiente

| Variavel | Obrigatoria | Onde e usada | Descricao |
|----------|-------------|--------------|-----------|
| `DATABASE_URL` | Sim | Prisma | String de conexao PostgreSQL |
| `JWT_SECRET` | Sim | `lib/auth.ts`, middleware | Segredo para assinatura JWT |
| `GEMINI_API_KEY` | Sim | `ai.service.ts`, `curator.ts`, `verifier.ts`, `judge.ts` | Chave API Google Gemini |
| `MERX_API_URL` | Nao | `merx.service.ts`, `thermal.service.ts`, `precipitation.service.ts`, `water-balance.service.ts` | Base URL da Merx API (default: `https://homolog.api.merx.tech/api/monitoramento`) |
| `CORS_PROXY_URL` | Nao | `merx.service.ts` | URL do proxy CORS (default: `https://corsproxy.io/?`) |
| `copernicusClientId` | Nao* | `sentinel1.service.ts` | Client ID OAuth2 Copernicus (*em WorkspaceSettings) |
| `copernicusClientSecret` | Nao* | `sentinel1.service.ts` | Client Secret OAuth2 Copernicus (*em WorkspaceSettings) |
| `googleMapsApiKey` | Nao* | `distance.service.ts` | Chave Google Maps Distance Matrix (*em WorkspaceSettings) |
| `S3_ACCESS_KEY_ID` | Nao** | `lib/s3.ts` | AWS Access Key ID para armazenamento de imagens |
| `S3_SECRET_ACCESS_KEY` | Nao** | `lib/s3.ts` | AWS Secret Access Key |
| `S3_BUCKET` | Nao** | `lib/s3.ts` | Nome do bucket S3 (default: `pocs-merxlabs`) |
| `S3_REGION` | Nao** | `lib/s3.ts` | Regiao AWS (default: `us-east-1`) |
| `S3_ENDPOINT` | Nao | `lib/s3.ts` | Endpoint customizado para R2/MinIO (omitir para AWS S3 padrao) |

> *Nota: `copernicusClientId`, `copernicusClientSecret` e `googleMapsApiKey` sao armazenados no modelo `WorkspaceSettings` no banco de dados, nao como variaveis de ambiente.

> **Nota: Variaveis S3 sao necessarias apenas se a funcionalidade de persistencia de imagens de satelite estiver habilitada (`enableVisualAnalysis` ou AI Validation com S3). O sistema verifica `isS3Configured()` antes de tentar persistir.

---

## 4. Mapa de Dependencias

### Fluxo de processamento de um Field

```
POST /api/fields/[id]/process
  |
  +---> Merx API (paralelo via Promise.allSettled)
  |      +-- consulta-ndvi
  |      +-- consulta-precipitacao
  |      +-- consulta-solo
  |      +-- consulta-area-lavoura
  |      +-- consulta-idade-lavoura
  |      +-- consulta-zarc-anual
  |
  +---> Thermal Service
  |      +-- consulta-temperatura-json
  |
  +---> Water Balance Service (se enableWaterBalance)
  |      +-- consulta-balanco-hidrico-json
  |
  +---> Sentinel-1 Service (se enableRadarNdvi)
  |      +-- OAuth Token
  |      +-- Catalog Search
  |      +-- Statistical API (VH/VV)
  |
  +---> AI Validation (se enableAIValidation)
  |      +-- field-images.service.ts (fetch incremental)
  |      |   +-- S3 Storage (persist new images)
  |      |   +-- Sentinel Hub Process API (somente datas novas)
  |      +-- Gemini Curator Agent
  |      +-- Gemini Verifier Agent (se cropPatternResult.shouldCallVerifier)
  |      +-- Gemini Judge Agent
  |
  +---> Dual Phenology (v0.0.34)
         +-- calculatePhenology() → detectedXxx (preservado)
         +-- calculatePhenology(userInput) → valores efetivos
```

### Fluxo de criacao de Field

```
POST /api/upload (validacao geometria)
  |
  v
POST /api/fields (criacao)
  +-- validateGeometry() [geometry.service.ts]
  +-- reverseGeocode()   [Nominatim API]
  |
  v
POST /api/fields/[id]/process (processamento)
  +-- [ver fluxo acima]
```

### Fluxo de autenticacao

```
POST /api/auth/login
  +-- Valida email/password (bcrypt)
  +-- Gera JWT (JWT_SECRET)
  +-- Seta cookie auth_token
  |
  v
[Todas as rotas protegidas]
  +-- Middleware valida JWT do cookie
  +-- Extrai session (userId, workspaceId, role)
```
