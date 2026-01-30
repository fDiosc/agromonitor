# Plano: Reprocessamento Automático de Análises

## Contexto

Quando um talhão é reprocessado, os dados de fenologia (SOS, EOS, pico, NDVI) são atualizados. Porém, as análises existentes (Logística, Financeira, Risco) permanecem com dados antigos, criando inconsistência.

## Objetivo

Garantir que as análises sempre reflitam os dados mais recentes do talhão.

---

## Arquitetura Proposta

### 1. Modelo de Dados

Adicionar campos ao modelo `FieldAnalysis`:

```prisma
model FieldAnalysis {
  // ... campos existentes ...
  
  // Controle de versão dos dados
  dataVersion      Int       @default(1)    // Versão dos dados quando gerada
  isStale          Boolean   @default(false) // Se está desatualizada
  staleReason      String?   // Motivo da desatualização
  
  // Reprocessamento
  reprocessStatus  String?   // "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"
  reprocessError   String?   // Erro se falhou
  reprocessedAt    DateTime? // Última tentativa
}
```

Adicionar campo ao modelo `Field`:

```prisma
model Field {
  // ... campos existentes ...
  
  dataVersion      Int       @default(1)    // Incrementa a cada processamento
}
```

### 2. Fluxo de Reprocessamento

```
┌─────────────────────────────────────────────────────────────────┐
│                    REPROCESSAMENTO DO TALHÃO                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. POST /api/fields/[id]/process                               │
│     - Processa dados Merx                                        │
│     - Atualiza fenologia                                         │
│     - Incrementa field.dataVersion                               │
│     - Marca análises existentes como isStale = true              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Adiciona análises à fila de reprocessamento                  │
│     - Para cada análise com isStale = true                       │
│     - Status: PENDING                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Worker processa fila (background)                            │
│     - Pega próxima análise PENDING                               │
│     - Marca como PROCESSING                                      │
│     - Chama /api/fields/[id]/analyze/[templateId]                │
│     - Se sucesso: COMPLETED, isStale = false                     │
│     - Se erro: FAILED, mantém isStale = true                     │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Implementação da Fila

**Opção A: Fila simples com setTimeout (MVP)**

```typescript
// lib/services/analysis-queue.service.ts

interface QueueItem {
  fieldId: string
  templateId: string
  attempts: number
}

const queue: QueueItem[] = []
let isProcessing = false
const MAX_ATTEMPTS = 3
const DELAY_BETWEEN_MS = 2000

export function enqueueAnalysis(fieldId: string, templateId: string) {
  queue.push({ fieldId, templateId, attempts: 0 })
  processQueue()
}

async function processQueue() {
  if (isProcessing || queue.length === 0) return
  
  isProcessing = true
  
  while (queue.length > 0) {
    const item = queue.shift()!
    
    try {
      await reprocessAnalysis(item.fieldId, item.templateId)
    } catch (error) {
      if (item.attempts < MAX_ATTEMPTS) {
        queue.push({ ...item, attempts: item.attempts + 1 })
      } else {
        await markAnalysisFailed(item.fieldId, item.templateId, error)
      }
    }
    
    // Aguardar entre processamentos
    await new Promise(r => setTimeout(r, DELAY_BETWEEN_MS))
  }
  
  isProcessing = false
}
```

**Opção B: Bull Queue com Redis (Produção)**

Para ambiente de produção com múltiplas instâncias, usar Bull/BullMQ com Redis.

### 4. Alterações no Processamento do Talhão

```typescript
// app/api/fields/[id]/process/route.ts

// Após processar com sucesso...

// Incrementar versão dos dados
await prisma.field.update({
  where: { id: params.id },
  data: { 
    dataVersion: { increment: 1 }
  }
})

// Marcar análises existentes como desatualizadas
const staleAnalyses = await prisma.fieldAnalysis.updateMany({
  where: { fieldId: params.id },
  data: { 
    isStale: true,
    staleReason: 'Talhão reprocessado',
    reprocessStatus: 'PENDING'
  }
})

// Enfileirar para reprocessamento
if (staleAnalyses.count > 0) {
  const analyses = await prisma.fieldAnalysis.findMany({
    where: { fieldId: params.id }
  })
  
  for (const analysis of analyses) {
    enqueueAnalysis(params.id, analysis.templateId)
  }
}
```

### 5. Interface do Usuário

#### 5.1 Indicador de Status na Lista de Análises

```tsx
// Componente de análise na página de relatório

function AnalysisCard({ analysis }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{analysis.templateName}</CardTitle>
        
        {/* Indicador de status */}
        {analysis.isStale && (
          <Badge variant="warning">
            {analysis.reprocessStatus === 'PENDING' && '⏳ Atualizando...'}
            {analysis.reprocessStatus === 'PROCESSING' && '🔄 Processando...'}
            {analysis.reprocessStatus === 'FAILED' && '❌ Falhou'}
          </Badge>
        )}
        
        {!analysis.isStale && (
          <Badge variant="success">✓ Atualizado</Badge>
        )}
      </CardHeader>
      
      {/* Botão de reprocessar manual */}
      {analysis.reprocessStatus === 'FAILED' && (
        <Button onClick={() => reprocessManually(analysis.id)}>
          Reprocessar
        </Button>
      )}
    </Card>
  )
}
```

#### 5.2 Informações de Versão

```tsx
// No header do relatório

<div className="text-sm text-muted-foreground">
  Dados atualizados em: {format(field.processedAt, 'dd/MM/yyyy HH:mm')}
  <span className="ml-2">v{field.dataVersion}</span>
</div>
```

### 6. API Endpoints

#### Novo: Reprocessar Análise Manualmente

```
POST /api/fields/[id]/analyze/[templateId]/reprocess

Response:
{
  "success": true,
  "message": "Análise adicionada à fila"
}
```

#### Atualizar: Status das Análises

```
GET /api/fields/[id]

Response inclui:
{
  "analyses": [
    {
      "templateId": "logistics",
      "isStale": false,
      "reprocessStatus": null,
      "updatedAt": "2026-01-30T10:00:00Z"
    }
  ]
}
```

---

## Tarefas de Implementação

### Fase 1: Banco de Dados
- [ ] Adicionar campos `dataVersion`, `isStale`, `staleReason`, `reprocessStatus`, `reprocessError`, `reprocessedAt` ao schema
- [ ] Criar migração
- [ ] Executar `prisma db push`

### Fase 2: Serviço de Fila
- [ ] Criar `lib/services/analysis-queue.service.ts`
- [ ] Implementar funções `enqueueAnalysis`, `processQueue`
- [ ] Implementar lógica de retry com backoff

### Fase 3: Processamento do Talhão
- [ ] Atualizar `app/api/fields/[id]/process/route.ts`
- [ ] Incrementar `dataVersion` após processamento
- [ ] Marcar análises como `isStale`
- [ ] Enfileirar reprocessamento

### Fase 4: Endpoint de Reprocessamento Manual
- [ ] Criar `app/api/fields/[id]/analyze/[templateId]/reprocess/route.ts`
- [ ] Implementar lógica de adicionar à fila

### Fase 5: Interface do Usuário
- [ ] Adicionar indicador de status nas análises
- [ ] Adicionar botão de reprocessar manual
- [ ] Mostrar data/versão dos dados

### Fase 6: Testes e Documentação
- [ ] Testar fluxo completo
- [ ] Atualizar documentação
- [ ] Atualizar changelog

---

## Considerações

### Limites e Rate Limiting
- Máximo de 3 tentativas por análise
- Delay de 2 segundos entre processamentos
- Timeout de 60 segundos por análise (API OpenAI)

### Monitoramento
- Log de cada processamento
- Alertas para falhas repetidas
- Dashboard de status da fila (futuro)

### Escalabilidade
- MVP: Fila em memória (suficiente para Alpha)
- Produção: Redis + Bull para filas persistentes

---

## Estimativa

| Fase | Complexidade | Arquivos |
|------|--------------|----------|
| 1 - Banco | Baixa | 1 |
| 2 - Fila | Média | 1 |
| 3 - Processamento | Baixa | 1 |
| 4 - Endpoint | Baixa | 1 |
| 5 - UI | Média | 2-3 |
| 6 - Testes | Baixa | - |

**Total: ~4-6 horas de implementação**

---

## Status de Implementação ✅

| Fase | Status | Data |
|------|--------|------|
| 1 - Banco | ✅ Concluído | 2026-01-30 |
| 2 - Fila | ✅ Concluído | 2026-01-30 |
| 3 - Processamento | ✅ Concluído | 2026-01-30 |
| 4 - Endpoint | ✅ Concluído | 2026-01-30 |
| 5 - UI | ✅ Concluído | 2026-01-30 |
| 6 - Testes | ✅ Testado manualmente | 2026-01-30 |

### Melhorias Adicionais (v0.0.14)

- **Polling automático**: UI faz polling a cada 2s durante reprocessamento
- **Bypass HTTP**: Fila chama `runAnalysis()` diretamente (sem problemas de auth)
- **Atualização automática**: Não precisa mais de F5 para ver resultado
- **Gemini 3 Flash**: Modelo de IA atualizado para versão mais recente
