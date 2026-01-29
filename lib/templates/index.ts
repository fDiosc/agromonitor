/**
 * Templates Registry
 * Registro central de todos os templates de análise
 */

import type { TemplateDefinition, TemplateId } from './types'
import { creditTemplate, creditConfig } from './credit'
import { logisticsTemplate, logisticsConfig } from './logistics'
import { riskMatrixTemplate, riskMatrixConfig } from './risk-matrix'

// Registry de templates
const templates: Record<TemplateId, TemplateDefinition> = {
  CREDIT: creditTemplate,
  LOGISTICS: logisticsTemplate,
  RISK_MATRIX: riskMatrixTemplate
}

/**
 * Retorna um template pelo ID
 */
export function getTemplate(id: string): TemplateDefinition | null {
  return templates[id as TemplateId] || null
}

/**
 * Retorna todos os templates disponíveis
 */
export function getAllTemplates(): TemplateDefinition[] {
  return Object.values(templates)
}

/**
 * Retorna apenas as configurações dos templates (para listagem)
 */
export function getTemplateConfigs() {
  return [
    creditConfig,
    logisticsConfig,
    riskMatrixConfig
  ].sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Verifica se um template existe
 */
export function templateExists(id: string): boolean {
  return id in templates
}

// Re-exports
export { creditTemplate, creditConfig } from './credit'
export { logisticsTemplate, logisticsConfig } from './logistics'
export { riskMatrixTemplate, riskMatrixConfig } from './risk-matrix'
export * from './types'
