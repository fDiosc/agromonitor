# Plano: Análise Híbrida (Algorítmica + IA)

## Objetivo

Separar claramente o que é **calculado algoritmicamente** (determinístico, replicável) do que é **gerado por IA** (interpretativo, contextual).

---

## Situação Atual

Hoje, todo o resultado da análise é gerado pela IA via prompt, incluindo métricas que poderiam ser calculadas de forma determinística.

```
┌─────────────────────────────────────────────────────────────┐
│                    ANÁLISE LOGÍSTICA                        │
│                    (100% via IA)                            │
├─────────────────────────────────────────────────────────────┤
│ harvestStart, harvestEnd, peakStart, peakEnd,               │
│ dailyVolume, trucksNeeded, weatherRisk, qualityRisk,        │
│ risks[], recommendations[]                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Situação Desejada

Separar em duas camadas:

```
┌─────────────────────────────────────────────────────────────┐
│              MÉTRICAS ALGORÍTMICAS                          │
│              (Calculado pelo sistema)                       │
├─────────────────────────────────────────────────────────────┤
│ • Início Colheita = EOS - 5 dias                            │
│ • Fim Colheita = Início + ceil(área/80)*2                   │
│ • Início Pico = Início + 2 dias                             │
│ • Fim Pico = Fim - 2 dias                                   │
│ • Volume Diário = (volumeTotal / área) * 80                 │
│ • Carretas = ceil(volumeTotal / 35)                         │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│              ANÁLISE QUALITATIVA (IA)                       │
│              [Badge: Gerado por IA]                         │
├─────────────────────────────────────────────────────────────┤
│ • Risco Clima (BAIXO/MÉDIO/ALTO)                            │
│ • Risco Qualidade (BAIXO/MÉDIO/ALTO)                        │
│ • Riscos Identificados (lista)                              │
│ • Recomendações (lista)                                     │
│ • Summary (texto contextual)                                │
└─────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

### 1. `lib/templates/logistics/index.ts`

**Atual**: `getFallbackResult()` calcula tudo, mas é usado só quando IA falha.

**Novo**: 
- Criar `calculateMetrics()` - sempre executa, retorna métricas algorítmicas
- Modificar `buildUserPrompt()` - incluir métricas pré-calculadas no prompt
- Modificar `parseResult()` - mesclar métricas algorítmicas com análise IA

```typescript
// NOVA FUNÇÃO: Cálculo algorítmico puro
export function calculateLogisticsMetrics(context: AnalysisContext): AlgorithmicMetrics {
  const { agroData } = context
  const areaHa = agroData.areaHa || 100
  const volumeKg = agroData.volumeEstimatedKg || 0
  const volumeTon = volumeKg / 1000
  const eosDate = agroData.eosDate

  if (!eosDate) {
    return null // Sem EOS, não há como calcular
  }

  const eos = new Date(eosDate)
  
  // Início da colheita = EOS - 5 dias
  const harvestStart = new Date(eos)
  harvestStart.setDate(eos.getDate() - 5)

  // Duração baseada na área (2 dias a cada 80 ha, mínimo 5)
  const daysToHarvest = Math.max(5, Math.ceil(areaHa / 80) * 2)
  
  const harvestEnd = new Date(harvestStart)
  harvestEnd.setDate(harvestStart.getDate() + daysToHarvest)

  // Pico: começa 2 dias após início, termina 2 dias antes do fim
  const peakStart = new Date(harvestStart)
  peakStart.setDate(harvestStart.getDate() + 2)
  
  const peakEnd = new Date(harvestEnd)
  peakEnd.setDate(harvestEnd.getDate() - 2)

  // Volume diário (80 ha/dia de colheita)
  const dailyVolume = Math.round((volumeTon / areaHa) * 80)

  // Carretas (35 ton por viagem)
  const trucksNeeded = Math.ceil(volumeTon / 35)

  return {
    harvestStart: format(harvestStart, 'yyyy-MM-dd'),
    harvestEnd: format(harvestEnd, 'yyyy-MM-dd'),
    peakStart: format(peakStart, 'yyyy-MM-dd'),
    peakEnd: format(peakEnd, 'yyyy-MM-dd'),
    dailyVolume,
    trucksNeeded,
    daysToHarvest,
    // Metadados
    source: 'ALGORITHM',
    formula: {
      harvestStart: 'EOS - 5 dias',
      harvestEnd: 'harvestStart + max(5, ceil(área/80)*2)',
      dailyVolume: '(volumeTon / área) * 80 ha/dia',
      trucksNeeded: 'ceil(volumeTon / 35)'
    }
  }
}
```

### 2. `lib/templates/types.ts`

**Adicionar interfaces**:

```typescript
// Métricas calculadas algoritmicamente
export interface AlgorithmicMetrics {
  harvestStart: string
  harvestEnd: string
  peakStart: string
  peakEnd: string
  dailyVolume: number
  trucksNeeded: number
  daysToHarvest: number
  source: 'ALGORITHM'
  formula: Record<string, string>
}

// Análise qualitativa (IA)
export interface AIQualitativeAnalysis {
  weatherRisk: 'BAIXO' | 'MEDIO' | 'ALTO'
  qualityRisk: 'BAIXO' | 'MEDIO' | 'ALTO'
  risks: string[]
  recommendations: string[]
  summary: string
  source: 'AI'
}

// Resultado híbrido
export interface HybridLogisticsResult {
  status: 'OTIMO' | 'ATENCAO' | 'CRITICO'
  statusLabel: string
  metrics: AlgorithmicMetrics
  analysis: AIQualitativeAnalysis
}
```

### 3. `components/templates/analysis-panel.tsx`

**Modificar UI para separar seções**:

```tsx
{/* SEÇÃO 1: Métricas Algorítmicas (sem badge IA) */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  {/* Início Colheita, Fim Colheita, etc */}
</div>

{/* SEÇÃO 2: Análise Qualitativa (com badge IA) */}
<div className="mt-6 pt-6 border-t">
  <div className="flex items-center gap-2 mb-4">
    <Badge className="bg-purple-50 text-purple-700">
      <Sparkles size={12} /> Gerado por IA
    </Badge>
  </div>
  
  {/* Risco Clima, Risco Qualidade, Riscos, Recomendações */}
</div>
```

### 4. Atualização do Prompt da IA

**Remover do prompt**:
- Cálculo de datas (harvestStart, harvestEnd, etc)
- Cálculo de volumes e carretas

**Manter no prompt** (IA deve analisar):
```
Você receberá métricas já calculadas pelo sistema:
- Início Colheita: ${metrics.harvestStart}
- Fim Colheita: ${metrics.harvestEnd}
- Volume Diário: ${metrics.dailyVolume} ton

Com base nesses dados e no contexto regional, analise:
1. Risco Climático (colheita em período chuvoso?)
2. Risco de Qualidade do Grão
3. Riscos específicos identificados
4. Recomendações operacionais

Retorne APENAS:
{
  "weatherRisk": "BAIXO" | "MEDIO" | "ALTO",
  "qualityRisk": "BAIXO" | "MEDIO" | "ALTO",
  "risks": ["..."],
  "recommendations": ["..."],
  "summary": "..."
}
```

---

## Fluxo de Execução

```
1. Usuario clica "Analisar"
           ↓
2. calculateLogisticsMetrics(context)
   → Retorna métricas algorítmicas
           ↓
3. buildUserPrompt(context, metrics)
   → Prompt inclui métricas pré-calculadas
           ↓
4. Chamada OpenAI
   → IA analisa e retorna riscos/recomendações
           ↓
5. mergeResults(algorithmicMetrics, aiAnalysis)
   → Combina em HybridLogisticsResult
           ↓
6. Salvar no banco
   → aiMetrics: JSON com source marcado
           ↓
7. UI renderiza separadamente
   → Métricas sem badge
   → Análise com badge IA
```

---

## Funcionalidades Preservadas

| Funcionalidade | Status |
|----------------|--------|
| Cálculo de datas de colheita | ✅ Mantida (agora algorítmica) |
| Volume diário e carretas | ✅ Mantida (agora algorítmica) |
| Análise de risco climático | ✅ Mantida (IA contextual) |
| Análise de qualidade | ✅ Mantida (IA contextual) |
| Riscos identificados | ✅ Mantida (IA interpretativa) |
| Recomendações | ✅ Mantida (IA interpretativa) |
| Fallback quando IA falha | ✅ Mantida (usa algorítmico) |
| Reprocessamento automático | ✅ Mantida |
| Badge "Gerado por IA" | ✅ Mantida (apenas na seção IA) |

---

## Badge de IA - Posicionamento

**Antes**: Badge no header do painel inteiro

**Depois**: Badge apenas na seção de análise qualitativa

```
┌─────────────────────────────────────────────────────────────┐
│ 🚚 ANÁLISE LOGÍSTICA      [Atualizado]                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  INÍCIO COLHEITA    FIM COLHEITA    VOLUME DIÁRIO    ...    │
│      21/02             01/03           280 ton              │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [✨ Gerado por IA]                                         │
│                                                             │
│  RISCO CLIMA: Alto    RISCO QUALIDADE: Médio                │
│                                                             │
│  ⚠ Riscos: Colheita em período chuvoso...                   │
│  ✓ Recomendações: Preparar secagem...                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Estimativa de Esforço

| Tarefa | Arquivos | Complexidade |
|--------|----------|--------------|
| Criar `calculateLogisticsMetrics()` | 1 | Baixa |
| Atualizar interfaces de tipos | 1 | Baixa |
| Modificar prompt da IA | 1 | Baixa |
| Ajustar `parseResult()` para merge | 1 | Média |
| Atualizar `analysis-panel.tsx` UI | 1 | Média |
| Mover badge para seção correta | 1 | Baixa |
| Testes e validação | - | Baixa |

**Total**: ~5 arquivos, complexidade média

---

## Status de Implementação

1. [x] Aprovar plano
2. [x] Implementar `calculateLogisticsMetrics()` - `lib/templates/logistics/index.ts`
3. [x] Atualizar tipos em `types.ts` - `LogisticsAlgorithmicMetrics`, `LogisticsAIAnalysis`
4. [x] Modificar template de logística - v2.0 híbrida
5. [x] Atualizar UI do painel - `components/templates/analysis-panel.tsx`
6. [x] Testar fluxo completo - Compilação OK
7. [x] Atualizar documentação - `CHANGELOG.md`, `METHODOLOGY.md`, `lib/version.ts`

---

*Plano criado em: 2026-01-30*
*Implementação concluída em: 2026-01-30*
*Versão: 0.0.13*
