export const APP_VERSION = '0.0.14'

// Fases do produto
export const VERSION_PHASES = {
  ALPHA: { prefix: '0.0.', label: 'ALPHA', color: 'orange' },
  BETA: { prefix: '0.1.', label: 'BETA', color: 'yellow' },
  V1: { prefix: '1.', label: 'V1', color: 'green' },
}

export function getCurrentPhase(): typeof VERSION_PHASES.ALPHA {
  if (APP_VERSION.startsWith('1.')) return VERSION_PHASES.V1
  if (APP_VERSION.startsWith('0.1.')) return VERSION_PHASES.BETA
  return VERSION_PHASES.ALPHA
}

export interface ChangelogEntry {
  version: string
  date: string
  title: string
  type: 'feature' | 'fix' | 'improvement'
  changes: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
  // ==================== ALPHA (0.0.x) ====================
  // Changelog consolidado - apenas features finais implementadas
  
  {
    version: '0.0.14',
    date: '2026-01-30',
    title: 'Análise Híbrida e IA Aprimorada',
    type: 'improvement',
    changes: [
      'Modelo IA: Gemini 3 Flash Preview',
      'Métricas algorítmicas (datas, volumes) + IA qualitativa (riscos)',
      'Tooltips explicando cálculo de cada métrica',
      'Reprocessamento com atualização automática (polling)',
      'Correção de timezone nas datas',
    ],
  },
  {
    version: '0.0.10',
    date: '2026-01-30',
    title: 'ZARC e Reprocessamento',
    type: 'feature',
    changes: [
      'Janela de plantio ZARC (dados oficiais MAPA)',
      'Reprocessamento automático de análises ao atualizar talhão',
      'Sistema de fila com retry e indicadores visuais',
      'Históricos alinhados por calendário agrícola',
    ],
  },
  {
    version: '0.0.8',
    date: '2026-01-30',
    title: 'Diagnóstico Logístico Avançado',
    type: 'feature',
    changes: [
      'Abas: Overview, Produtor, Unidade de Recebimento',
      'Filtro por produtor(es) com recálculo dinâmico',
      'Disclaimer obrigatório (termos Alpha)',
      'Deploy CapRover configurado',
    ],
  },
  {
    version: '0.0.7',
    date: '2026-01-29',
    title: 'Projeção Adaptativa',
    type: 'improvement',
    changes: [
      'Detecção de fase fenológica (vegetativo, reprodutivo, senescência)',
      'Projeção por decaimento exponencial na senescência',
      'EOS dinâmico baseado em tendência real',
      'Limites biológicos: NDVI 0.18-0.92',
    ],
  },
  {
    version: '0.0.5',
    date: '2026-01-29',
    title: 'Multi-tenancy Completo',
    type: 'feature',
    changes: [
      'Workspaces com isolamento de dados',
      'Autenticação com login/senha e sidebar',
      'Hierarquia SUPER_ADMIN > ADMIN > OPERATOR',
      'Produtores e culturas (Soja/Milho)',
    ],
  },
  {
    version: '0.0.3',
    date: '2026-01-29',
    title: 'Diagnóstico Logístico',
    type: 'feature',
    changes: [
      'Módulo de diagnóstico com curva de recebimento',
      'Mapa de propriedades monitoradas',
      'Timeline agregada de colheita',
    ],
  },
  {
    version: '0.0.1',
    date: '2026-01-27',
    title: 'MVP Inicial',
    type: 'feature',
    changes: [
      'Cadastro de talhões com desenho no mapa',
      'Integração com API Merx (NDVI, precipitação)',
      'Detecção automática de fenologia (SOS, EOS, Peak)',
      'Templates de análise com IA (Crédito, Logística, Risco)',
    ],
  },
]

export function getLatestVersion(): string {
  return CHANGELOG[0]?.version || APP_VERSION
}

export function getChangesSinceVersion(version: string): ChangelogEntry[] {
  const idx = CHANGELOG.findIndex(c => c.version === version)
  if (idx === -1) return CHANGELOG
  return CHANGELOG.slice(0, idx)
}
