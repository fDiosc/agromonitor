/**
 * Serviço de ZARC (Zoneamento Agrícola de Risco Climático)
 * 
 * Processa dados do ZARC para determinar janelas de plantio
 * e alinhar safras históricas corretamente.
 */

// ==================== TIPOS ====================

export interface ZarcPeriod {
  startDate: Date
  endDate: Date
  riskLevel: number
}

export interface ZarcWindow {
  windowStart: Date      // Primeiro dia ZARC > 0 após período 0
  windowEnd: Date        // Último dia ZARC > 0 antes de período 0
  optimalStart: Date     // Primeiro dia ZARC = 20
  optimalEnd: Date       // Último dia ZARC = 20
}

export interface ZarcAnalysis {
  window: ZarcWindow | null
  plantingRisk: number | null      // Risco no momento do plantio
  plantingStatus: 'IDEAL' | 'MODERATE' | 'HIGH_RISK' | 'OUT_OF_WINDOW' | 'UNKNOWN'
  isPlantingInWindow: boolean
  daysToWindowStart: number | null // Dias até abertura (se antes)
  daysToWindowEnd: number | null   // Dias até fechamento (se dentro)
}

// ==================== PARSING ====================

/**
 * Converte string de período para datas
 * Formato: "2025-01-01 - 2025-01-10"
 */
function parsePeriod(periodo: string): { start: Date; end: Date } | null {
  try {
    const [startStr, endStr] = periodo.split(' - ')
    return {
      start: new Date(startStr.trim()),
      end: new Date(endStr.trim())
    }
  } catch {
    return null
  }
}

/**
 * Extrai a janela de plantio dos dados ZARC
 * 
 * Para safra de verão (soja, milho):
 * - A janela ABRE no segundo semestre (set/out)
 * - A janela FECHA no primeiro semestre do ano seguinte (jan/fev)
 * 
 * O ZARC anual tem dados de jan-dez, onde:
 * - Jan-Fev: final da janela do ano anterior (ZARC > 0)
 * - Mar-Set: fora da janela (ZARC = 0)
 * - Set-Dez: início da nova janela (ZARC > 0)
 */
export function parseZarcWindow(zarcData: any[]): ZarcWindow | null {
  // Validação robusta - garantir que é um array
  if (!zarcData || !Array.isArray(zarcData) || zarcData.length === 0) {
    return null
  }
  
  // Converter para estrutura tipada
  const periods: ZarcPeriod[] = []
  for (const z of zarcData) {
    const parsed = parsePeriod(z.periodo)
    if (parsed) {
      periods.push({
        startDate: parsed.start,
        endDate: parsed.end,
        riskLevel: z.zarc || 0
      })
    }
  }
  
  if (periods.length === 0) return null
  
  // Ordenar por data
  periods.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
  
  // ESTRATÉGIA: Encontrar a transição 0 → >0 no SEGUNDO SEMESTRE (jul-dez)
  // Isso identifica a abertura da janela de plantio da safra de verão
  let windowStart: Date | null = null
  let windowEnd: Date | null = null
  let optimalStart: Date | null = null
  let optimalEnd: Date | null = null
  
  // Fase 1: Encontrar abertura da janela no segundo semestre
  for (let i = 0; i < periods.length; i++) {
    const curr = periods[i]
    const prev = i > 0 ? periods[i - 1] : null
    const month = curr.startDate.getMonth() // 0-11
    
    // Transição 0 → >0 no segundo semestre (julho=6 a dezembro=11)
    if (curr.riskLevel > 0 && prev && prev.riskLevel === 0 && month >= 6) {
      windowStart = curr.startDate
      break
    }
  }
  
  // Se não encontrou transição no segundo semestre, não há janela válida
  if (!windowStart) return null
  
  // Fase 2: Encontrar o fim da janela (transição >0 → 0 APÓS windowStart)
  // Isso geralmente é em fevereiro do ano seguinte
  for (let i = 0; i < periods.length; i++) {
    const curr = periods[i]
    const prev = i > 0 ? periods[i - 1] : null
    
    if (curr.riskLevel === 0 && prev && prev.riskLevel > 0) {
      // Verificar se é após o windowStart (pode ser no ano seguinte)
      if (prev.endDate > windowStart) {
        windowEnd = prev.endDate
        break
      }
    }
    
    // Rastrear períodos ideais (ZARC = 20)
    if (curr.riskLevel === 20 && curr.startDate >= windowStart) {
      if (!optimalStart) optimalStart = curr.startDate
      optimalEnd = curr.endDate
    }
  }
  
  // Se não encontrou fim no mesmo ano, verificar início do próximo ano
  // (os dados ZARC são anuais, então o fim da janela de set-dez estaria em jan-fev do ano seguinte)
  if (!windowEnd) {
    // A janela continua até o próximo ano - usar o último período com ZARC > 0
    // que está ANTES da próxima transição para 0
    for (let i = 0; i < periods.length; i++) {
      const curr = periods[i]
      if (curr.riskLevel > 0 && curr.startDate >= windowStart) {
        windowEnd = curr.endDate
        if (curr.riskLevel === 20) {
          optimalEnd = curr.endDate
        }
      }
    }
  }
  
  if (!windowEnd) windowEnd = windowStart // Fallback
  if (!windowEnd) {
    for (let i = periods.length - 1; i >= 0; i--) {
      if (periods[i].riskLevel > 0) {
        windowEnd = periods[i].endDate
        break
      }
    }
  }
  
  return {
    windowStart,
    windowEnd: windowEnd || periods[periods.length - 1].endDate,
    optimalStart: optimalStart || windowStart,
    optimalEnd: optimalEnd || windowEnd || windowStart
  }
}

// ==================== ANÁLISE DE RISCO ====================

/**
 * Retorna o nível de risco ZARC para uma data específica
 */
export function getPlantingRisk(zarcData: any[], plantingDate: Date): number {
  // Validação robusta - garantir que é um array
  if (!zarcData || !Array.isArray(zarcData) || zarcData.length === 0) {
    return -1 // -1 = desconhecido
  }
  
  for (const z of zarcData) {
    const parsed = parsePeriod(z.periodo)
    if (!parsed) continue
    
    if (plantingDate >= parsed.start && plantingDate <= parsed.end) {
      return z.zarc || 0
    }
  }
  
  return 0 // Fora de todos os períodos = sem recomendação
}

/**
 * Analisa o plantio em relação à janela ZARC
 */
export function analyzeZarc(
  zarcData: any[] | null,
  plantingDate: Date | null
): ZarcAnalysis {
  const result: ZarcAnalysis = {
    window: null,
    plantingRisk: null,
    plantingStatus: 'UNKNOWN',
    isPlantingInWindow: false,
    daysToWindowStart: null,
    daysToWindowEnd: null
  }
  
  // Validação robusta - garantir que é um array
  if (!zarcData || !Array.isArray(zarcData)) return result
  
  // Extrair janela
  const window = parseZarcWindow(zarcData)
  result.window = window
  
  if (!window || !plantingDate) return result
  
  // Calcular risco do plantio
  const risk = getPlantingRisk(zarcData, plantingDate)
  result.plantingRisk = risk
  
  // Determinar status
  if (risk === 0) {
    result.plantingStatus = 'OUT_OF_WINDOW'
    result.isPlantingInWindow = false
  } else if (risk === 20) {
    result.plantingStatus = 'IDEAL'
    result.isPlantingInWindow = true
  } else if (risk === 30) {
    result.plantingStatus = 'MODERATE'
    result.isPlantingInWindow = true
  } else if (risk >= 40) {
    result.plantingStatus = 'HIGH_RISK'
    result.isPlantingInWindow = true
  }
  
  // Calcular dias
  const dayMs = 24 * 60 * 60 * 1000
  
  if (plantingDate < window.windowStart) {
    result.daysToWindowStart = Math.ceil(
      (window.windowStart.getTime() - plantingDate.getTime()) / dayMs
    )
  }
  
  if (plantingDate >= window.windowStart && plantingDate <= window.windowEnd) {
    result.daysToWindowEnd = Math.ceil(
      (window.windowEnd.getTime() - plantingDate.getTime()) / dayMs
    )
  }
  
  return result
}

// ==================== ALINHAMENTO HISTÓRICO ====================

/**
 * Determina a data de início da safra de verão baseado no ZARC
 * Retorna a data de abertura da janela de plantio
 */
export function getSeasonStartFromZarc(zarcData: any[] | null): Date | null {
  if (!zarcData) return null
  
  const window = parseZarcWindow(zarcData)
  return window?.windowStart || null
}

/**
 * Calcula o offset de alinhamento entre duas safras baseado no ZARC
 * Retorna a diferença em dias entre os inícios das janelas
 */
export function calculateZarcAlignmentOffset(
  currentZarc: any[] | null,
  historicalZarc: any[] | null
): number | null {
  const currentStart = getSeasonStartFromZarc(currentZarc)
  const historicalStart = getSeasonStartFromZarc(historicalZarc)
  
  if (!currentStart || !historicalStart) return null
  
  const dayMs = 24 * 60 * 60 * 1000
  return Math.round((currentStart.getTime() - historicalStart.getTime()) / dayMs)
}

// ==================== FORMATAÇÃO ====================

/**
 * Formata a janela ZARC para exibição
 */
export function formatZarcWindow(window: ZarcWindow | null): string {
  if (!window) return 'Não disponível'
  
  const formatDate = (d: Date) => {
    const day = d.getDate().toString().padStart(2, '0')
    const month = (d.getMonth() + 1).toString().padStart(2, '0')
    return `${day}/${month}`
  }
  
  return `${formatDate(window.windowStart)} - ${formatDate(window.windowEnd)}`
}

/**
 * Retorna cor e label para o status de plantio
 */
export function getPlantingStatusStyle(status: ZarcAnalysis['plantingStatus']): {
  color: string
  bgColor: string
  label: string
} {
  switch (status) {
    case 'IDEAL':
      return { color: 'text-emerald-700', bgColor: 'bg-emerald-50', label: 'Janela Ideal' }
    case 'MODERATE':
      return { color: 'text-amber-700', bgColor: 'bg-amber-50', label: 'Risco Moderado' }
    case 'HIGH_RISK':
      return { color: 'text-red-700', bgColor: 'bg-red-50', label: 'Risco Alto' }
    case 'OUT_OF_WINDOW':
      return { color: 'text-red-700', bgColor: 'bg-red-100', label: 'Fora da Janela' }
    default:
      return { color: 'text-slate-500', bgColor: 'bg-slate-50', label: 'Não Avaliado' }
  }
}
