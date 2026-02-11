/**
 * Serviço de Fila para Reprocessamento de Análises
 * 
 * Gerencia o reprocessamento automático de análises quando um talhão é reprocessado.
 * Usa uma fila em memória com retry e backoff.
 */

import { prisma } from '@/lib/prisma'
import { runAnalysis } from '@/lib/services/ai.service'
import { getTemplate } from '@/lib/templates'
import type { AnalysisContext } from '@/lib/templates/types'

// ==================== TIPOS ====================

interface QueueItem {
  fieldId: string
  templateId: string
  analysisId: string
  attempts: number
  addedAt: Date
}

interface QueueStats {
  pending: number
  processing: boolean
  totalProcessed: number
  totalFailed: number
}

// ==================== CONFIGURAÇÃO ====================

const MAX_ATTEMPTS = 3
const DELAY_BETWEEN_MS = 3000  // 3 segundos entre processamentos
const INITIAL_RETRY_DELAY_MS = 5000  // 5 segundos para retry
const MAX_RETRY_DELAY_MS = 30000  // Máximo 30 segundos

// ==================== ESTADO ====================

const queue: QueueItem[] = []
let isProcessing = false
let totalProcessed = 0
let totalFailed = 0

// ==================== FUNÇÕES PÚBLICAS ====================

/**
 * Adiciona uma análise à fila de reprocessamento
 */
export function enqueueAnalysis(fieldId: string, templateId: string, analysisId: string): void {
  // Evitar duplicatas
  const exists = queue.some(
    item => item.fieldId === fieldId && item.templateId === templateId
  )
  
  if (exists) {
    console.log(`[QUEUE] Análise já está na fila: ${fieldId}/${templateId}`)
    return
  }
  
  queue.push({
    fieldId,
    templateId,
    analysisId,
    attempts: 0,
    addedAt: new Date()
  })
  
  console.log(`[QUEUE] Análise adicionada à fila: ${fieldId}/${templateId}. Fila: ${queue.length} itens`)
  
  // Iniciar processamento se não estiver rodando
  processQueue()
}

/**
 * Enfileira todas as análises de um talhão para reprocessamento
 */
export async function enqueueFieldAnalyses(fieldId: string): Promise<number> {
  const analyses = await prisma.analysis.findMany({
    where: { fieldId },
    select: { id: true, templateId: true }
  })
  
  for (const analysis of analyses) {
    enqueueAnalysis(fieldId, analysis.templateId, analysis.id)
  }
  
  console.log(`[QUEUE] ${analyses.length} análises enfileiradas para talhão ${fieldId}`)
  return analyses.length
}

/**
 * Retorna estatísticas da fila
 */
export function getQueueStats(): QueueStats {
  return {
    pending: queue.length,
    processing: isProcessing,
    totalProcessed,
    totalFailed
  }
}

/**
 * Força reprocessamento manual de uma análise
 */
export async function forceReprocess(analysisId: string): Promise<void> {
  const analysis = await prisma.analysis.findUnique({
    where: { id: analysisId },
    select: { fieldId: true, templateId: true }
  })
  
  if (!analysis) {
    throw new Error('Análise não encontrada')
  }
  
  // Atualizar status para PENDING
  await prisma.analysis.update({
    where: { id: analysisId },
    data: {
      reprocessStatus: 'PENDING',
      reprocessError: null
    }
  })
  
  enqueueAnalysis(analysis.fieldId, analysis.templateId, analysisId)
}

// ==================== FUNÇÕES INTERNAS ====================

/**
 * Processa a fila de análises
 */
async function processQueue(): Promise<void> {
  if (isProcessing || queue.length === 0) return
  
  isProcessing = true
  console.log(`[QUEUE] Iniciando processamento. ${queue.length} itens na fila`)
  
  while (queue.length > 0) {
    const item = queue.shift()!
    
    try {
      await processAnalysis(item)
      totalProcessed++
    } catch (error) {
      console.error(`[QUEUE] Erro ao processar ${item.fieldId}/${item.templateId}:`, error)
      
      if (item.attempts < MAX_ATTEMPTS - 1) {
        // Retry com backoff exponencial
        const retryDelay = Math.min(
          INITIAL_RETRY_DELAY_MS * Math.pow(2, item.attempts),
          MAX_RETRY_DELAY_MS
        )
        
        console.log(`[QUEUE] Tentativa ${item.attempts + 1}/${MAX_ATTEMPTS}. Retry em ${retryDelay}ms`)
        
        // Adicionar de volta à fila com contador incrementado
        setTimeout(() => {
          queue.push({ ...item, attempts: item.attempts + 1 })
          processQueue()
        }, retryDelay)
      } else {
        // Falhou após todas as tentativas
        await markAnalysisFailed(item.analysisId, error)
        totalFailed++
      }
    }
    
    // Delay entre processamentos
    if (queue.length > 0) {
      await delay(DELAY_BETWEEN_MS)
    }
  }
  
  isProcessing = false
  console.log(`[QUEUE] Processamento concluído. Total: ${totalProcessed} sucesso, ${totalFailed} falhas`)
}

/**
 * Processa uma análise individual
 * Chama diretamente o serviço de IA (sem HTTP) para evitar problemas de autenticação
 */
async function processAnalysis(item: QueueItem): Promise<void> {
  console.log(`[QUEUE] Processando análise: ${item.fieldId}/${item.templateId}`)
  
  // Marcar como PROCESSING
  await prisma.analysis.update({
    where: { id: item.analysisId },
    data: { 
      reprocessStatus: 'PROCESSING',
      reprocessedAt: new Date()
    }
  })
  
  // Buscar dados do talhão
  const field = await prisma.field.findUnique({
    where: { id: item.fieldId },
    include: { agroData: true }
  })
  
  if (!field) {
    throw new Error('Talhão não encontrado')
  }
  
  if (!field.agroData) {
    throw new Error('Dados agronômicos não processados')
  }
  
  // Buscar template
  const template = getTemplate(item.templateId)
  if (!template) {
    throw new Error(`Template não encontrado: ${item.templateId}`)
  }
  
  // Extrair EOS fusionado (NDVI + GDD + balanço hídrico) se disponível
  let bestEosDate = field.agroData.eosDate?.toISOString().split('T')[0] || null
  if (field.agroData.rawAreaData) {
    try {
      const areaData = JSON.parse(field.agroData.rawAreaData)
      if (areaData.fusedEos?.date) {
        bestEosDate = areaData.fusedEos.date
      }
    } catch { /* ignore */ }
  }

  // Montar contexto para análise
  const context: AnalysisContext = {
    field: {
      id: field.id,
      name: field.name,
      city: field.city || 'Desconhecida',
      state: field.state || 'Desconhecido',
      cropType: field.cropType,
      areaHa: field.areaHa || 0,
      seasonStartDate: field.seasonStartDate.toISOString().split('T')[0]
    },
    agroData: {
      areaHa: field.agroData.areaHa,
      volumeEstimatedKg: field.agroData.volumeEstimatedKg,
      plantingDate: field.agroData.plantingDate?.toISOString().split('T')[0] || null,
      sosDate: field.agroData.sosDate?.toISOString().split('T')[0] || null,
      eosDate: bestEosDate,
      peakDate: field.agroData.peakDate?.toISOString().split('T')[0] || null,
      cycleDays: field.agroData.cycleDays,
      confidenceScore: field.agroData.confidenceScore,
      confidence: field.agroData.confidence,
      historicalCorrelation: field.agroData.historicalCorrelation,
      phenologyHealth: field.agroData.phenologyHealth,
      peakNdvi: field.agroData.peakNdvi,
      detectedReplanting: field.agroData.detectedReplanting
    },
    phenology: {
      plantingDate: field.agroData.plantingDate?.toISOString().split('T')[0] || null,
      sosDate: field.agroData.sosDate?.toISOString().split('T')[0] || null,
      eosDate: bestEosDate,
      peakDate: field.agroData.peakDate?.toISOString().split('T')[0] || null,
      cycleDays: field.agroData.cycleDays || 120,
      detectedReplanting: field.agroData.detectedReplanting,
      replantingDate: field.agroData.replantingDate?.toISOString().split('T')[0] || null,
      yieldEstimateKg: field.agroData.volumeEstimatedKg || 0,
      yieldEstimateKgHa: field.agroData.yieldEstimateKgHa || 0,
      phenologyHealth: (field.agroData.phenologyHealth as any) || 'FAIR',
      peakNdvi: field.agroData.peakNdvi || 0,
      confidence: (field.agroData.confidence as any) || 'MEDIUM',
      confidenceScore: field.agroData.confidenceScore || 50,
      method: (field.agroData.phenologyMethod as any) || 'PROJECTION',
      historicalCorrelation: field.agroData.historicalCorrelation || 50,
      diagnostics: field.agroData.diagnostics 
        ? JSON.parse(field.agroData.diagnostics) 
        : []
    },
    // AI Visual Validation (if available)
    aiValidation: field.agroData.aiValidationResult ? (() => {
      try {
        const agreement = field.agroData.aiValidationAgreement
          ? JSON.parse(field.agroData.aiValidationAgreement)
          : {}
        const alerts = field.agroData.aiVisualAlerts
          ? JSON.parse(field.agroData.aiVisualAlerts)
          : []
        return {
          agreement: field.agroData.aiValidationResult as 'CONFIRMED' | 'QUESTIONED' | 'REJECTED',
          confidence: field.agroData.aiValidationConfidence || 0,
          eosAdjustedDate: agreement.eosAdjustedDate || null,
          eosAdjustmentReason: agreement.eosAdjustmentReason || null,
          stageAgreement: agreement.stageAgreement ?? true,
          visualAlerts: alerts,
          harvestReadiness: agreement.harvestReadiness || { ready: false, estimatedDate: null, notes: '' },
          riskAssessment: agreement.riskAssessment || { overallRisk: 'MEDIUM', factors: [] },
          recommendations: agreement.recommendations || [],
        }
      } catch {
        return null
      }
    })() : null
  }
  
  // Executar análise diretamente (sem HTTP)
  const { result, fallbackUsed, processingTimeMs, modelUsed } = await runAnalysis(
    item.templateId,
    context
  )
  
  // Salvar resultado
  await prisma.analysis.update({
    where: { id: item.analysisId },
    data: {
      status: result.status,
      statusLabel: result.statusLabel,
      statusColor: result.statusColor,
      aiSummary: result.summary,
      aiMetrics: JSON.stringify(result.metrics),
      aiRisks: JSON.stringify(result.risks),
      aiRecommendations: JSON.stringify(result.recommendations),
      aiFullResponse: JSON.stringify(result),
      templateVersion: template.config.version,
      modelUsed,
      processingTimeMs,
      fallbackUsed,
      isStale: false,
      staleReason: null,
      reprocessStatus: 'COMPLETED',
      reprocessError: null,
      dataVersion: field.dataVersion,
      updatedAt: new Date()
    }
  })
  
  console.log(`[QUEUE] Análise reprocessada com sucesso: ${item.fieldId}/${item.templateId} (modelo: ${modelUsed})`)
}

/**
 * Marca uma análise como falha
 */
async function markAnalysisFailed(analysisId: string, error: unknown): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error)
  
  await prisma.analysis.update({
    where: { id: analysisId },
    data: {
      reprocessStatus: 'FAILED',
      reprocessError: errorMessage,
      reprocessedAt: new Date()
    }
  })
  
  console.error(`[QUEUE] Análise falhou após todas as tentativas: ${analysisId}. Erro: ${errorMessage}`)
}

/**
 * Helper para delay
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
