# Plano: Alinhamento Histórico Baseado em ZARC

## Contexto

Atualmente, o alinhamento de safras históricas usa um método genérico de calendário agrícola (outubro 2024 → outubro 2025). Isso pode não ser preciso para todas as regiões e culturas.

O **ZARC (Zoneamento Agrícola de Risco Climático)** é um sistema oficial do MAPA que define as janelas de plantio ideais por:
- **Cultura** (soja, milho, etc.)
- **Município/Região**
- **Tipo de solo**
- **Ciclo da cultivar**

## Objetivo

Usar os dados do ZARC para alinhar safras históricas com precisão, baseando-se na janela de plantio oficial para cada cultura e região.

---

## Dados Disponíveis

### Endpoint: POST /consulta-zarc-anual-json

**Request:**
```json
{
  "geojson": { "type": "FeatureCollection", "features": [...] },
  "ano": 2025,
  "cultura": "SOJA"
}
```

**Response:**
```json
[
  { "periodo": "2025-01-01 - 2025-01-10", "zarc": 20 },
  { "periodo": "2025-01-11 - 2025-01-20", "zarc": 20 },
  ...
  { "periodo": "2025-09-21 - 2025-09-30", "zarc": 40 },
  { "periodo": "2025-10-01 - 2025-10-10", "zarc": 30 },
  ...
]
```

### Interpretação dos Valores

| ZARC | Significado |
|------|-------------|
| 0 | Fora da janela de plantio (não recomendado) |
| 20 | Janela ideal (risco baixo) |
| 30 | Janela com risco moderado |
| 40 | Janela com risco alto (bordas) |

### Exemplo Real: Sorriso/MT - Soja

| Período | ZARC | Status |
|---------|------|--------|
| Fev 11 - Set 20 | 0 | Fora da janela |
| **Set 21 - Set 30** | **40** | **Abertura da janela** |
| Out 1 - Out 10 | 30 | Janela abrindo |
| Out 11 - Fev 10 | 20 | Janela ideal |
| Fev 11+ | 0 | Fechamento |

---

## Arquitetura Proposta

### 1. Modelo de Dados

Adicionar campos ao `AgroData`:

```prisma
model AgroData {
  // ... campos existentes ...
  
  // Janela ZARC detectada
  zarcWindowStart    DateTime?  // Início da janela de plantio
  zarcWindowEnd      DateTime?  // Fim da janela de plantio
  zarcRiskLevel      Int?       // Nível de risco no plantio (20/30/40)
}
```

### 2. Serviço de Parsing ZARC

```typescript
// lib/services/zarc.service.ts

interface ZarcPeriod {
  startDate: Date
  endDate: Date
  riskLevel: number
}

interface ZarcWindow {
  windowStart: Date      // Primeiro dia ZARC > 0 após período 0
  windowEnd: Date        // Último dia ZARC > 0 antes de período 0
  optimalStart: Date     // Primeiro dia ZARC = 20
  optimalEnd: Date       // Último dia ZARC = 20
  plantingRisk: number   // Risco no momento do plantio (se informado)
}

/**
 * Extrai a janela de plantio dos dados ZARC
 */
export function parseZarcWindow(zarcData: any[]): ZarcWindow | null {
  if (!zarcData || zarcData.length === 0) return null
  
  // Converter para estrutura tipada
  const periods = zarcData.map(z => {
    const [start, end] = z.periodo.split(' - ')
    return {
      startDate: new Date(start),
      endDate: new Date(end),
      riskLevel: z.zarc
    }
  })
  
  // Encontrar transições 0 → >0 e >0 → 0
  let windowStart: Date | null = null
  let windowEnd: Date | null = null
  let optimalStart: Date | null = null
  let optimalEnd: Date | null = null
  
  for (let i = 0; i < periods.length; i++) {
    const curr = periods[i]
    const prev = periods[i - 1]
    
    // Transição 0 → >0: início da janela
    if (curr.riskLevel > 0 && (!prev || prev.riskLevel === 0)) {
      windowStart = curr.startDate
    }
    
    // Primeiro período com risco 20 (ideal)
    if (curr.riskLevel === 20 && !optimalStart) {
      optimalStart = curr.startDate
    }
    
    // Último período com risco 20
    if (curr.riskLevel === 20) {
      optimalEnd = curr.endDate
    }
    
    // Transição >0 → 0: fim da janela
    if (curr.riskLevel === 0 && prev && prev.riskLevel > 0) {
      windowEnd = prev.endDate
    }
  }
  
  if (!windowStart) return null
  
  return {
    windowStart,
    windowEnd: windowEnd || periods[periods.length - 1].endDate,
    optimalStart: optimalStart || windowStart,
    optimalEnd: optimalEnd || windowEnd || windowStart,
    plantingRisk: 0
  }
}

/**
 * Calcula risco do plantio baseado na data informada
 */
export function getPlantingRisk(zarcData: any[], plantingDate: Date): number {
  if (!zarcData) return 0
  
  for (const z of zarcData) {
    const [start, end] = z.periodo.split(' - ')
    const startDate = new Date(start)
    const endDate = new Date(end)
    
    if (plantingDate >= startDate && plantingDate <= endDate) {
      return z.zarc
    }
  }
  
  return 0 // Fora de todos os períodos
}
```

### 3. Integração no Alinhamento Histórico

```typescript
// lib/services/cycle-analysis.service.ts

// Modificar prepareHistoricalOverlayData para usar ZARC

function prepareHistoricalOverlayData(
  currentData: NdviPoint[],
  historicalData: NdviPoint[][],
  sosDate: string | null,
  crop: string,
  eosDate: string | null,
  plantingDate: string | null,
  harvestEndDate: string | null,
  zarcData?: any[]  // <-- NOVO PARÂMETRO
) {
  // Se temos dados ZARC, usar para determinar o início da safra
  let seasonStartDate: Date | null = null
  
  if (zarcData) {
    const zarcWindow = parseZarcWindow(zarcData)
    if (zarcWindow) {
      // A janela ZARC define quando a safra de verão começa
      seasonStartDate = zarcWindow.windowStart
    }
  }
  
  // Fallback: usar calendário genérico se não tiver ZARC
  if (!seasonStartDate) {
    const firstCurrentDate = new Date(currentData[0].date)
    const currentSeasonYear = firstCurrentDate.getMonth() >= 7 
      ? firstCurrentDate.getFullYear() 
      : firstCurrentDate.getFullYear() - 1
    seasonStartDate = new Date(currentSeasonYear, 8, 21) // 21/09 default
  }
  
  // Para cada safra histórica, buscar o ZARC correspondente
  // e alinhar pelo início da janela
  historicalData.forEach((hData, hIdx) => {
    // ... lógica de alinhamento usando seasonStartDate
  })
}
```

### 4. Busca de ZARC para Anos Históricos

Para cada safra histórica, precisamos buscar o ZARC daquele ano:

```typescript
// No processamento do talhão

async function getHistoricalZarc(
  geometryJson: string,
  years: number[],
  crop: string
): Promise<Map<number, any[]>> {
  const zarcByYear = new Map<number, any[]>()
  
  for (const year of years) {
    try {
      const zarc = await requestZarcAnual(geometryJson, year, crop)
      zarcByYear.set(year, zarc)
    } catch (e) {
      console.warn(`ZARC ${year} não disponível`)
    }
  }
  
  return zarcByYear
}
```

---

## Fluxo de Implementação

### Fase 1: Parsing e Armazenamento

1. Criar `lib/services/zarc.service.ts` com funções de parsing
2. Adicionar campos `zarcWindowStart`, `zarcWindowEnd` ao schema
3. Atualizar processamento para extrair e salvar janela ZARC
4. Migração do banco

### Fase 2: Alinhamento Inteligente

1. Modificar `prepareHistoricalOverlayData` para aceitar dados ZARC
2. Implementar lógica de alinhamento baseada na janela ZARC
3. Fallback para calendário genérico se ZARC não disponível

### Fase 3: ZARC Histórico (Opcional)

1. Buscar ZARC para cada ano histórico durante processamento
2. Cache local para evitar requisições repetidas
3. Alinhar cada safra histórica pela sua própria janela ZARC

### Fase 4: UI e Validação

1. Mostrar janela ZARC na UI (período ideal de plantio)
2. Alertar se plantio informado está fora da janela
3. Indicar nível de risco do plantio

---

## Benefícios

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Precisão | Calendário genérico (set-out) | Janela oficial por cultura/região |
| Safrinha | Pode confundir com safra de verão | Distingue claramente pelo ZARC |
| Riscos | Não considera | Indica risco do plantio |
| Alertas | Nenhum | Alerta plantio fora da janela |

---

## Exemplo Prático

### Talhão: Sorriso/MT - Soja

**ZARC indica:**
- Janela abre: 21/09/2025
- Janela ideal: 11/10 - 10/02
- Janela fecha: 10/02/2026

**Plantio informado:** 22/10/2025
- ✅ Dentro da janela ideal (ZARC = 20)

**Alinhamento histórico:**
- Safra 2024: alinhar pelo 21/09/2024 (início janela ZARC 2024)
- Safra 2023: alinhar pelo 21/09/2023 (início janela ZARC 2023)
- Safra 2022: alinhar pelo 21/09/2022 (início janela ZARC 2022)

Isso garante que:
1. Históricos são alinhados pela safra de verão (não safrinha)
2. A comparação é válida agronomicamente
3. O usuário vê dados consistentes

---

## Tarefas de Implementação

### Fase 1: Foundation
- [ ] Criar `lib/services/zarc.service.ts`
- [ ] Implementar `parseZarcWindow()`
- [ ] Implementar `getPlantingRisk()`
- [ ] Adicionar campos ao schema Prisma
- [ ] Migrar banco de dados

### Fase 2: Integração
- [ ] Atualizar `prepareHistoricalOverlayData` para usar ZARC
- [ ] Passar dados ZARC do processamento para o serviço
- [ ] Implementar fallback para calendário

### Fase 3: UI
- [ ] Mostrar janela ZARC no relatório
- [ ] Indicador de risco do plantio
- [ ] Alerta se plantio fora da janela

### Fase 4: Histórico (Opcional)
- [ ] Buscar ZARC para anos históricos
- [ ] Cache de dados ZARC
- [ ] Alinhamento por janela individual

---

## Estimativa

| Fase | Complexidade | Tempo Estimado |
|------|--------------|----------------|
| 1 - Foundation | Baixa | 1-2h |
| 2 - Integração | Média | 2-3h |
| 3 - UI | Baixa | 1h |
| 4 - Histórico | Alta | 2-3h |

**Total: 6-9 horas**

---

## Considerações

### Rate Limiting
- ZARC anual é uma chamada por ano/talhão
- Para 3 anos históricos = 3 chamadas adicionais
- Considerar cache ou processamento em background

### Disponibilidade
- ZARC pode não estar disponível para todos os municípios
- Sempre ter fallback para calendário genérico

### Culturas
- ZARC varia significativamente por cultura
- Milho safrinha tem janela completamente diferente de soja
- Implementar suporte para múltiplas culturas

---

## Referências

- [ZARC - MAPA](https://www.gov.br/agricultura/pt-br/assuntos/riscos-seguro/programa-nacional-de-zoneamento-agricola-de-risco-climatico)
- [Portaria ZARC 2024/2025](https://www.in.gov.br/en/web/dou/-/portaria-mapa-n-xxx)
- API Merx: `/consulta-zarc-anual-json`
