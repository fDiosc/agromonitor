# MERX AGRO Monitor - Documentação do Produto

## Visão Geral

O **MERX AGRO Monitor** é uma plataforma avançada de monitoramento agronômico focada em **análise de risco de crédito e mercado agrícola**. O sistema transforma dados de satélite e clima em relatórios interativos com insights gerados por IA, especialmente voltado para **culturas de soja**.

### Público-Alvo

| Segmento | Necessidade |
|----------|-------------|
| **Tradings** | Monitorar entregas de grãos contratados, identificar riscos de washout |
| **Fundos de Crédito** | Validar garantias (CPRs), monitorar LTV, antecipar inadimplência |
| **Bancos Agrícolas** | Análise de risco para concessão e acompanhamento de crédito rural |
| **Seguradoras** | Validação de sinistros e monitoramento de carteira segurada |

---

## Stack Tecnológica Atual

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| **React** | 19.2.3 | Framework frontend |
| **TypeScript** | 5.8.2 | Tipagem estática |
| **Vite** | 6.2.0 | Build tool e dev server |
| **Recharts** | 3.6.0 | Gráficos e visualizações |
| **Leaflet** | 1.9.4 | Mapas interativos |
| **Lucide React** | 0.562.0 | Biblioteca de ícones |
| **Google Gemini AI** | 1.34.0 | Análise inteligente via IA |
| **API Merx** | - | Dados de satélite e monitoramento |

---

## Funcionalidades Detalhadas

### 1. Dashboard - Carteira de Monitoramento

Painel central que exibe todos os talhões cadastrados na carteira do usuário.

**Recursos:**
- Tabela interativa com informações resumidas
- Status de processamento em tempo real (pending/loading/success/error)
- Informações exibidas: nome do talhão, localização, área (ha), volume estimado (ton)
- Ações rápidas: visualizar relatório detalhado, excluir talhão
- Estado vazio com mensagem orientativa

**Dados Exibidos por Talhão:**
```
| Status | Talhão | Área | Volume Est. | Ações |
```

---

### 2. Cadastro de Talhões

Sistema dual de entrada de dados geográficos:

#### 2.1 Upload de Arquivo
- Formatos suportados: **KML** e **GeoJSON**
- Interface de drag-and-drop intuitiva
- Validação automática de formato
- Extração de coordenadas do arquivo

#### 2.2 Desenho Interativo no Mapa
- Mapa com tiles de satélite (Google Satellite)
- Clique para adicionar vértices do polígono
- Visualização em tempo real da área sendo desenhada
- Marcadores diferenciados (ponto inicial em azul, demais em verde)
- Controles:
  - Desfazer último ponto
  - Limpar todos os pontos
  - Confirmar talhão (mínimo 3 pontos)
- Geração automática de arquivo GeoJSON

**Campos do Cadastro:**
- Nome do talhão
- Data de início da safra
- Arquivo/Geometria do talhão

---

### 3. Geocodificação Automática

Sistema de detecção automática de localização:

**Fluxo:**
1. Extrai coordenadas centrais do arquivo KML/GeoJSON
2. Consulta API Nominatim (OpenStreetMap) para geocodificação reversa
3. Identifica cidade e estado automaticamente
4. Fallback para coordenadas padrão do MT se falhar

**Dados Extraídos:**
- Cidade
- Estado
- Latitude/Longitude centrais

---

### 4. Integração com API Merx

Conexão com a plataforma de monitoramento satelital da Merx.

#### Endpoints Consumidos:

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/consulta-ndvi` | POST | Índice de vegetação por diferença normalizada |
| `/consulta-precipitacao` | POST | Dados pluviométricos da região |
| `/consulta-area-lavoura` | POST | Cálculo de área cultivada |
| `/consulta-solo` | POST | Características do solo |
| `/consulta-idade-lavoura` | POST | Idade/estágio da cultura |
| `/consulta-zarc-anual` | POST | Zoneamento de risco climático |

#### Tratamento de CORS:
- Tentativa direta primeiro
- Fallback via proxy CORS (corsproxy.io)

#### Dados Históricos:
- Busca automática das 3 safras anteriores
- Mesma janela temporal para comparação

---

### 5. Cálculo de Área Local

Algoritmo de fallback quando a API não retorna área:

**Implementação:**
- Algoritmo de Shoelace esférico
- Raio da Terra: 6.371.000 metros
- Conversão automática de m² para hectares
- Suporte a Polygon e MultiPolygon

---

### 6. Análise Fenológica Automatizada

Detecção de estágios fenológicos da cultura:

#### Datas Detectadas:
| Estágio | Sigla | Método de Detecção |
|---------|-------|-------------------|
| Plantio | - | SOS - 8 dias |
| Emergência | SOS | NDVI cruza limiar 0.38 (subindo) |
| Pico Vegetativo | - | Máximo NDVI |
| Colheita | EOS | NDVI cruza limiar 0.40 (descendo) |

#### Métricas Calculadas:
- **Ciclo padrão:** 120 dias
- **Volume estimado:** 5 ton/ha × área
- **Método:** ALGORITHM (detecção real) ou PROJECTION (estimativa)
- **Correlação histórica:** 0-100%
- **Score de confiança:** 0-100%
- **Nível de confiança:** HIGH / MEDIUM / LOW

#### Lógica de Confiança:
```
Score = 15 (base)
+ 25 se SOS detectado
+ 20 se pico antes do fim da série
+ 30 se método = ALGORITHM
+ 10 se correlação > 70%
```

---

### 7. Análise de Risco com IA (Gemini)

Sistema de inteligência artificial especializado em risco agrícola.

#### Persona da IA:
> "Analista de Risco de Crédito e Mercado Agri Sênior, Expert em Monitoramento Satelital para Financiamento e Trading"

#### Foco da Análise:
- **NÃO** é manejo agronômico (pragas, adubação)
- **É** segurança de garantia e risco de default/washout

#### Classificação de Status:

| Status | Significado |
|--------|-------------|
| **NORMAL** | Garantia performando bem. Expectativa de volume OK. Risco baixo. |
| **ALERTA** | Potencial quebra ou atraso. Monitorar LTV e fluxo. |
| **CRÍTICO** | Perda severa. Alta probabilidade de não entrega ou default. |

#### Output Estruturado (JSON):
```json
{
  "summary": "Parecer executivo (max 25 palavras)",
  "status": "NORMAL | ALERTA | CRITICO",
  "phenology_validation": {
    "is_accurate": boolean,
    "confirmed_planting_date": "YYYY-MM-DD",
    "confirmed_sos_date": "YYYY-MM-DD",
    "confirmed_eos_date": "YYYY-MM-DD",
    "cycle_analysis": "string",
    "ai_confidence": 0-100
  },
  "soil_analysis": "string",
  "risks": ["Risco 1", "Risco 2"],
  "recommendations": ["Ação 1", "Ação 2"],
  "current_stage": "string",
  "critical_events": [
    {
      "type": "string",
      "title": "string",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD",
      "severity": "string"
    }
  ]
}
```

---

### 8. Relatório Visual Completo

Dashboard de visualização do talhão analisado.

#### Seção 1: Cards de Métricas
| Métrica | Descrição |
|---------|-----------|
| Área Processada | Hectares validados |
| Volume Estimado | Produção esperada em toneladas |
| Aderência Histórica | Correlação com safras anteriores |
| Confiança do Modelo | Precisão da análise |

#### Seção 2: Timeline Fenológica
- Card de Plantio Estimado (azul)
- Card de Emergência Detectada (verde)
- Card de Previsão de Colheita (âmbar)

#### Seção 3: Gráfico Comparativo NDVI
- **Eixo X:** Data (formato DD/MM)
- **Eixo Y:** NDVI (0 a 1)
- **Curvas:**
  - Safra Atual (área preenchida verde)
  - Safra -1 (linha tracejada cinza claro)
  - Safra -2 (linha tracejada cinza médio)
  - Safra -3 (linha tracejada cinza escuro)
- **Linhas de Referência:**
  - Plantio (azul)
  - Emergência (verde)
  - Colheita Prevista (âmbar)
- **Projeção:** 60 dias futuros baseado em histórico

#### Seção 4: Painel de IA
- Parecer executivo (citação estilizada)
- Matriz de Riscos de Crédito (lista vermelha)
- Estratégias de Mitigação (lista verde)

---

## Estrutura de Dados

### Interfaces TypeScript

```typescript
interface FieldData {
  id: string;
  name: string;
  file: File;
  location?: { city: string; state: string; lat: number; lng: number };
  status: 'pending' | 'loading' | 'success' | 'error';
  reportData?: any;
  aiInsight?: any;
  addedAt: Date;
  errorMessage?: string;
}

interface FieldInfo {
  name: string;
  area: number;
  city: string;
  state: string;
  crop: string;
  plantingDate: string;
}

interface MonitoringResult {
  ndvi: {
    current: number;
    history: { date: string; value: number }[];
    status: 'good' | 'average' | 'critical';
  };
  climate: {
    temperature: number;
    precipitation: number;
    accumulatedPrecipitation: number;
    history: { date: string; temp: number; rain: number }[];
  };
  soil: {
    moisture: number;
    availableWater: number;
    texture: string;
  };
  productivity: {
    estimated: number;
    historical: { year: string; yield: number }[];
  };
  zarc: {
    risk: { period: string; probability: number }[];
  };
}

interface GeminiInsight {
  status: string;
  risks: string[];
  recommendations: string[];
  summary: string;
}

interface PhenologyResult {
  planting_date: string | null;
  sos_date: string | null;
  eos_date: string | null;
  peak_date: string | null;
  cycle_days: number | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence_score: number;
  method: 'ALGORITHM' | 'PROJECTION';
  estimated_volume_kg: number;
  historical_correlation: number;
}
```

---

## Fluxo de Uso

```
┌─────────────────────────────────────────────────────────────────┐
│                     1. ACESSO AO DASHBOARD                       │
│                    (Carteira de Monitoramento)                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    2. CADASTRO DE TALHÃO                         │
│         ┌─────────────────┬─────────────────────┐               │
│         │  Upload KML/    │  Desenhar no Mapa   │               │
│         │    GeoJSON      │   Interativamente   │               │
│         └─────────────────┴─────────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                3. DETECÇÃO DE LOCALIZAÇÃO                        │
│              (Geocodificação Reversa Automática)                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                 4. CONSULTA API MERX                             │
│    ┌──────────┬──────────┬──────────┬──────────┬──────────┐     │
│    │   NDVI   │  Precip  │   Área   │   Solo   │ Histórico│     │
│    └──────────┴──────────┴──────────┴──────────┴──────────┘     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│               5. ANÁLISE FENOLÓGICA                              │
│         (Detecção de Plantio, Emergência, Colheita)              │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                6. ANÁLISE DE RISCO (IA)                          │
│          (Status, Riscos, Recomendações via Gemini)              │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              7. RELATÓRIO VISUAL COMPLETO                        │
│    ┌──────────┬──────────┬──────────┬──────────────────┐        │
│    │  Cards   │ Timeline │ Gráfico  │  Painel de IA    │        │
│    │ Métricas │Fenológica│   NDVI   │ Riscos/Mitigação │        │
│    └──────────┴──────────┴──────────┴──────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Propósito e Valor do Produto

### Problema que Resolve

Instituições financeiras e tradings que operam com crédito agrícola ou compra antecipada de grãos enfrentam o desafio de **monitorar remotamente garantias rurais em escala**. Visitas físicas são caras e inviáveis para grandes carteiras.

### Solução

O MERX AGRO Monitor oferece:

1. **Validação de safras em tempo real** via imagens de satélite
2. **Antecipação de riscos** de inadimplência ou não-entrega
3. **Decisões baseadas em dados** (vistoria, hedge, cobrança antecipada)
4. **Comparação com histórico** para identificar anomalias
5. **Análise automatizada com IA** especializada em risco agrícola

### Diferencial Competitivo

- Foco em **risco de crédito**, não em manejo agronômico
- IA treinada com **perspectiva de credor/comprador**
- Integração com **dados reais de satélite** (API Merx)
- Interface **moderna e intuitiva**
- Projeção de **60 dias futuros** baseada em histórico

---

## Limitações Atuais

| Limitação | Impacto |
|-----------|---------|
| Sem persistência de dados | Dados perdidos ao recarregar página |
| Sem autenticação | Não há controle de acesso |
| Cultura fixa (Soja) | Não suporta outras culturas |
| Sem API própria | Dependência total da API Merx |
| Sem notificações | Usuário precisa verificar manualmente |
| Sem exportação | Não exporta relatórios em PDF/Excel |
