# API de Monitoramento Agrícola - Endpoints

**Base URL:** `https://homolog.api.merx.tech/api/monitoramento`

---

## Health Check

### GET /health

Verificação completa de saúde da API.

**Parâmetros:**
| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| detailed | query | Não | Se `true`, inclui verificações detalhadas (default: true) |

```bash
curl -X GET "https://homolog.api.merx.tech/api/monitoramento/health?detailed=true"
```

**Resposta:**

```json
{
  "status": "healthy",
  "message": "Todos os serviços operacionais",
  "services": {
    "database": { "status": "healthy" },
    "gee": { "status": "healthy" }
  }
}
```

### GET /health/ready

Verificação de prontidão (Kubernetes readiness probe).

```bash
curl -X GET "https://homolog.api.merx.tech/api/monitoramento/health/ready"
```

### GET /health/live

Verificação de vitalidade (Kubernetes liveness probe).

```bash
curl -X GET "https://homolog.api.merx.tech/api/monitoramento/health/live"
```

---

## NDVI

### POST /consulta-ndvi

Valores diários de NDVI via upload de arquivo.

**Parâmetros (form-data):**
| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| arquivo | file | Sim | Arquivo .kml ou .geojson (máx 10MB, máx 10 talhões) |
| start_date | string | Sim | Data início (YYYY-MM-DD) |
| end_date | string | Sim | Data fim (YYYY-MM-DD) |

```bash
curl -X POST "https://homolog.api.merx.tech/api/monitoramento/consulta-ndvi" \
  -F "arquivo=@talhao.geojson" \
  -F "start_date=2024-01-01" \
  -F "end_date=2024-01-31"
```

**Resposta:**

```json
{
  "talhao_0": [
    { "date": "2024-01-01", "ndvi": 0.65 },
    { "date": "2024-01-02", "ndvi": 0.68 }
  ]
}
```

### POST /consulta-ndvi-json

Valores diários de NDVI via GeoJSON no body.

**Body (JSON):**

```json
{
  "geojson": { "type": "FeatureCollection", "features": [...] },
  "start_date": "2024-01-01",
  "end_date": "2024-01-31"
}
```

```bash
curl -X POST "https://homolog.api.merx.tech/api/monitoramento/consulta-ndvi-json" \
  -H "Content-Type: application/json" \
  -d '{"geojson":{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"nome":"Talhao1"},"geometry":{"type":"Polygon","coordinates":[[[-47.0,-22.0],[-47.0,-22.1],[-46.9,-22.1],[-46.9,-22.0],[-47.0,-22.0]]]}}]},"start_date":"2024-01-01","end_date":"2024-01-31"}'
```

### POST /analise-fenologica

Análise fenológica por cultura e safra.

**Parâmetros (form-data):**
| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| arquivo | file | Sim | Arquivo .kml ou .geojson (máx 5 talhões) |
| cultura | string | Sim | SOJA, MILHO, CAFE, CITROS, CANA |
| ano_safra | string | Sim | Ano da safra (YYYY) entre 2015-2030 |

```bash
curl -X POST "https://homolog.api.merx.tech/api/monitoramento/analise-fenologica" \
  -F "arquivo=@talhao.geojson" \
  -F "cultura=SOJA" \
  -F "ano_safra=2024"
```

---

## Biomassa

### POST /consulta-biomassa

Dados de biomassa via upload de arquivo.

**Parâmetros (form-data):**
| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| arquivo | file | Sim | Arquivo .kml ou .geojson |
| start_date | string | Sim | Data início (YYYY-MM-DD) |
| end_date | string | Sim | Data fim (YYYY-MM-DD) |

```bash
curl -X POST "https://homolog.api.merx.tech/api/monitoramento/consulta-biomassa" \
  -F "arquivo=@talhao.geojson" \
  -F "start_date=2024-01-01" \
  -F "end_date=2024-01-31"
```

### POST /consulta-biomassa-json

Dados de biomassa via GeoJSON no body.

**Body (JSON):**

```json
{
  "geojson": { "type": "FeatureCollection", "features": [...] },
  "start_date": "2024-01-01",
  "end_date": "2024-01-31"
}
```

```bash
curl -X POST "https://homolog.api.merx.tech/api/monitoramento/consulta-biomassa-json" \
  -H "Content-Type: application/json" \
  -d '{"geojson":{...},"start_date":"2024-01-01","end_date":"2024-01-31"}'
```

---

## Precipitacao

### POST /consulta-precipitacao

Precipitação por coordenadas (recomendado).

**Body (JSON):**

```json
{
  "pontos": [
    { "latitude": -23.5505, "longitude": -46.6333, "nome": "fazenda_1" }
  ],
  "start_date": "2024-01-01",
  "end_date": "2024-01-31"
}
```

```bash
curl -X POST "https://homolog.api.merx.tech/api/monitoramento/consulta-precipitacao" \
  -H "Content-Type: application/json" \
  -d '{"pontos":[{"latitude":-23.5505,"longitude":-46.6333,"nome":"fazenda_1"}],"start_date":"2024-01-01","end_date":"2024-01-31"}'
```

**Resposta:**

```json
{
  "fazenda_1": [
    { "date": "2024-01-01", "GPM_mm_day": 12.34 },
    { "date": "2024-01-02", "GPM_mm_day": 0.0 }
  ]
}
```

### POST /consulta-precipitacao-talhao

Precipitação via upload de arquivo (legado).

**Parâmetros (form-data):**
| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| arquivo | file | Sim | Arquivo .kml ou .geojson (máx 15 talhões) |
| start_date | string | Sim | Data início (YYYY-MM-DD) |
| end_date | string | Sim | Data fim (YYYY-MM-DD) |

```bash
curl -X POST "https://homolog.api.merx.tech/api/monitoramento/consulta-precipitacao-talhao" \
  -F "arquivo=@talhao.geojson" \
  -F "start_date=2024-01-01" \
  -F "end_date=2024-01-31"
```

### POST /consulta-precipitacao-talhao-json

Precipitação por talhão via GeoJSON no body.

**Body (JSON):**

```json
{
  "geojson": { "type": "FeatureCollection", "features": [...] },
  "start_date": "2024-01-01",
  "end_date": "2024-01-31"
}
```

---

## Temperatura

### POST /consulta-temperatura

Valores diários de temperatura via upload.

**Parâmetros (form-data):**
| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| arquivo | file | Sim | Arquivo .kml ou .geojson (máx 15 talhões) |
| start_date | string | Sim | Data início (YYYY-MM-DD) |
| end_date | string | Sim | Data fim (YYYY-MM-DD, máx 3 anos) |

```bash
curl -X POST "https://homolog.api.merx.tech/api/monitoramento/consulta-temperatura" \
  -F "arquivo=@talhao.geojson" \
  -F "start_date=2024-01-01" \
  -F "end_date=2024-03-31"
```

**Resposta:**

```json
{
  "talhao_0": [{ "date": "2024-01-01", "value": 28.5 }]
}
```

### POST /consulta-temperatura-json

Temperatura via GeoJSON no body.

**Body (JSON):**

```json
{
  "geojson": { "type": "FeatureCollection", "features": [...] },
  "start_date": "2024-01-01",
  "end_date": "2024-03-31"
}
```

---

## Solo

### POST /consulta-solo

Tipo de solo na propriedade via upload.

**Parâmetros (form-data):**
| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| arquivo | file | Sim | Arquivo .kml ou .geojson |

```bash
curl -X POST "https://homolog.api.merx.tech/api/monitoramento/consulta-solo" \
  -F "arquivo=@talhao.geojson"
```

**Resposta:**

```json
{
  "talhao_0": [{ "tipo_solo": "LATOSSOLO VERMELHO", "textura": "Argilosa" }]
}
```

### POST /consulta-solo-json

Tipo de solo via GeoJSON no body.

**Body (JSON):**

```json
{
  "geojson": { "type": "FeatureCollection", "features": [...] }
}
```

```bash
curl -X POST "https://homolog.api.merx.tech/api/monitoramento/consulta-solo-json" \
  -H "Content-Type: application/json" \
  -d '{"geojson":{...}}'
```

---

## ZARC (Zoneamento Agrícola de Risco Climático)

### POST /consulta-zarc

ZARC por decênio via upload.

**Parâmetros (form-data):**
| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| arquivo | file | Sim | Arquivo .kml ou .geojson |
| data_plantio | string | Sim | Data de plantio (YYYY-MM-DD) |

```bash
curl -X POST "https://homolog.api.merx.tech/api/monitoramento/consulta-zarc" \
  -F "arquivo=@talhao.geojson" \
  -F "data_plantio=2024-10-15"
```

### POST /consulta-zarc-json

ZARC via GeoJSON no body.

**Body (JSON):**

```json
{
  "geojson": { "type": "FeatureCollection", "features": [...] },
  "data_plantio": "2024-10-15"
}
```

### POST /consulta-zarc-anual

Histórico anual ZARC via upload.

**Parâmetros (form-data):**
| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| arquivo | file | Sim | Arquivo .kml ou .geojson |
| ano | integer | Sim | Ano (2015-2030) |

```bash
curl -X POST "https://homolog.api.merx.tech/api/monitoramento/consulta-zarc-anual" \
  -F "arquivo=@talhao.geojson" \
  -F "ano=2024"
```

### POST /consulta-zarc-anual-json

Histórico anual ZARC via GeoJSON no body.

**Body (JSON):**

```json
{
  "geojson": { "type": "FeatureCollection", "features": [...] },
  "ano": 2024
}
```

---

## Vazio Sanitário

### POST /consulta-vazio-sanitario

Períodos de vazio sanitário via upload.

**Parâmetros (form-data):**
| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| arquivo | file | Sim | Arquivo .kml ou .geojson |

```bash
curl -X POST "https://homolog.api.merx.tech/api/monitoramento/consulta-vazio-sanitario" \
  -F "arquivo=@talhao.geojson"
```

### POST /consulta-vazio-sanitario-json

Vazio sanitário via GeoJSON no body.

**Body (JSON):**

```json
{
  "geojson": { "type": "FeatureCollection", "features": [...] }
}
```

---

## Lavoura

### POST /consulta-idade-lavoura

Idade da lavoura por cultura via upload.

**Parâmetros (form-data):**
| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| arquivo | file | Sim | Arquivo .kml ou .geojson |
| cultura | string | Sim | Cultura (SOJA, MILHO, etc.) |

```bash
curl -X POST "https://homolog.api.merx.tech/api/monitoramento/consulta-idade-lavoura" \
  -F "arquivo=@talhao.geojson" \
  -F "cultura=SOJA"
```

### POST /consulta-idade-lavoura-json

Idade da lavoura via GeoJSON no body.

**Body (JSON):**

```json
{
  "geojson": { "type": "FeatureCollection", "features": [...] },
  "cultura": "SOJA"
}
```

### POST /consulta-area-lavoura

Área da lavoura por cultura via upload.

**Parâmetros (form-data):**
| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| arquivo | file | Sim | Arquivo .kml ou .geojson |
| cultura | string | Sim | Cultura (SOJA, MILHO, etc.) |

```bash
curl -X POST "https://homolog.api.merx.tech/api/monitoramento/consulta-area-lavoura" \
  -F "arquivo=@talhao.geojson" \
  -F "cultura=SOJA"
```

### POST /consulta-area-lavoura-json

Área da lavoura via GeoJSON no body.

**Body (JSON):**

```json
{
  "geojson": { "type": "FeatureCollection", "features": [...] },
  "cultura": "SOJA"
}
```

---

## Água Disponível

### POST /consulta-agua-disponivel

Água disponível na propriedade via upload.

**Parâmetros (form-data):**
| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| arquivo | file | Sim | Arquivo .kml ou .geojson |

```bash
curl -X POST "https://homolog.api.merx.tech/api/monitoramento/consulta-agua-disponivel" \
  -F "arquivo=@talhao.geojson"
```

### POST /consulta-agua-disponivel-json

Água disponível via GeoJSON no body (retorna geometrias).

**Body (JSON):**

```json
{
  "geojson": { "type": "FeatureCollection", "features": [...] }
}
```

---

## Balanço Hídrico

### POST /consulta-balanco-hidrico

Balanço hídrico via upload.

**Parâmetros (form-data):**
| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| arquivo | file | Sim | Arquivo .kml ou .geojson |
| data_plantio | string | Sim | Data de plantio (YYYY-MM-DD) |
| cultura | string | Sim | SOJA, MILHO, FEIJAO, ARROZ, ALGODAO, CITRUS |

```bash
curl -X POST "https://homolog.api.merx.tech/api/monitoramento/consulta-balanco-hidrico" \
  -F "arquivo=@talhao.geojson" \
  -F "data_plantio=2024-10-15" \
  -F "cultura=SOJA"
```

### POST /consulta-balanco-hidrico-json

Balanço hídrico via GeoJSON no body.

**Body (JSON):**

```json
{
  "geojson": { "type": "FeatureCollection", "features": [...] },
  "data_plantio": "2024-10-15",
  "cultura": "SOJA"
}
```

```bash
curl -X POST "https://homolog.api.merx.tech/api/monitoramento/consulta-balanco-hidrico-json" \
  -H "Content-Type: application/json" \
  -d '{"geojson":{...},"data_plantio":"2024-10-15","cultura":"SOJA"}'
```

---

## Produtividade

### POST /consulta-produtividade

Produtividade histórica via upload.

**Parâmetros (form-data):**
| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| arquivo | file | Sim | Arquivo .kml ou .geojson |
| cultura | string | Sim | SOJA, MILHO, FEIJAO, ARROZ, ALGODAO, CITRUS |

```bash
curl -X POST "https://homolog.api.merx.tech/api/monitoramento/consulta-produtividade" \
  -F "arquivo=@talhao.geojson" \
  -F "cultura=SOJA"
```

### POST /consulta-produtividade-json

Produtividade histórica via GeoJSON no body.

**Body (JSON):**

```json
{
  "geojson": { "type": "FeatureCollection", "features": [...] },
  "cultura": "SOJA"
}
```

---

## Formato GeoJSON de Exemplo

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "nome": "Talhao 1"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [-47.0, -22.0],
            [-47.0, -22.1],
            [-46.9, -22.1],
            [-46.9, -22.0],
            [-47.0, -22.0]
          ]
        ]
      }
    }
  ]
}
```

---

## Códigos de Erro Comuns

| Código | Descrição                                          |
| ------ | -------------------------------------------------- |
| 400    | Parâmetro inválido ou arquivo mal formatado        |
| 408    | Timeout - tente com período menor ou menos talhões |
| 422    | Nenhum dado encontrado para os parâmetros          |
| 500    | Erro interno do servidor                           |
| 503    | Serviço indisponível (GEE ou banco de dados)       |

---

## Limites

| Recurso                                      | Limite  |
| -------------------------------------------- | ------- |
| Tamanho máximo de arquivo                    | 10MB    |
| Máximo de talhões (padrão)                   | 10      |
| Máximo de talhões (precipitação/temperatura) | 15      |
| Máximo de talhões (análise fenológica)       | 5       |
| Período máximo (padrão)                      | 10 anos |
| Período máximo (temperatura)                 | 3 anos  |
