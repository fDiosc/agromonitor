/**
 * AI Service
 * Integração com Google Gemini para análises baseadas em templates
 */

import { GoogleGenAI } from '@google/genai'
import { getTemplate } from '@/lib/templates'
import type { AnalysisContext, AnalysisResult } from '@/lib/templates/types'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
// Gemini 3 Flash Preview - modelo mais recente (Dec 2025)
const MODEL_NAME = 'gemini-3-flash-preview'

interface AIServiceConfig {
  maxRetries: number
  timeoutMs: number
  temperature: number
}

const DEFAULT_CONFIG: AIServiceConfig = {
  maxRetries: 2,
  timeoutMs: 30000,
  temperature: 0.3
}

/**
 * Executa análise de IA para um template específico
 */
export async function runAnalysis(
  templateId: string,
  context: AnalysisContext,
  config: Partial<AIServiceConfig> = {}
): Promise<{
  result: AnalysisResult
  fallbackUsed: boolean
  processingTimeMs: number
  modelUsed: string
}> {
  const startTime = Date.now()
  const { maxRetries } = { ...DEFAULT_CONFIG, ...config }

  // Buscar template
  const template = getTemplate(templateId)
  if (!template) {
    throw new Error(`Template not found: ${templateId}`)
  }

  // Verificar API key
  if (!GEMINI_API_KEY) {
    console.warn('Gemini API key not configured, using fallback')
    return {
      result: template.getFallbackResult(context),
      fallbackUsed: true,
      processingTimeMs: Date.now() - startTime,
      modelUsed: 'fallback'
    }
  }

  // Tentar análise com IA
  console.log(`[AI] Iniciando análise com Gemini para template: ${templateId}`)
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })
      
      const systemPrompt = template.buildSystemPrompt()
      const userPrompt = template.buildUserPrompt(context)
      
      console.log(`[AI] Tentativa ${attempt + 1}/${maxRetries + 1} - Chamando ${MODEL_NAME}`)
      
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
        }
      })

      const text = response.text || ''
      console.log(`[AI] Resposta recebida: ${text.substring(0, 200)}...`)

      // Parsear resposta (passando contexto para métricas algorítmicas)
      const parsed = template.parseResponse(text, context)
      
      console.log(`[AI] Análise concluída com sucesso via ${MODEL_NAME}`)

      return {
        result: parsed,
        fallbackUsed: false,
        processingTimeMs: Date.now() - startTime,
        modelUsed: MODEL_NAME
      }
    } catch (error) {
      console.error(`[AI] Tentativa ${attempt + 1} falhou:`, error)

      if (attempt < maxRetries) {
        // Exponential backoff
        await delay(Math.pow(2, attempt) * 1000)
        continue
      }
    }
  }

  // Fallback se todas as tentativas falharem
  console.warn('All AI attempts failed, using fallback')
  return {
    result: template.getFallbackResult(context),
    fallbackUsed: true,
    processingTimeMs: Date.now() - startTime,
    modelUsed: 'fallback'
  }
}

/**
 * Verifica se o serviço de IA está disponível
 */
export async function checkAIAvailability(): Promise<boolean> {
  if (!GEMINI_API_KEY) return false

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })
    await ai.models.generateContent({
      model: MODEL_NAME,
      contents: 'test'
    })
    return true
  } catch {
    return false
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
