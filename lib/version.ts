export const APP_VERSION = '0.0.8'

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
  {
    version: '0.0.8',
    date: '2026-01-30',
    title: 'Disclaimer Alpha e Abas Logísticas',
    type: 'feature',
    changes: [
      'Disclaimer obrigatório no primeiro login (termos Alpha)',
      'Diagnóstico Logístico com 3 abas: Overview, Produtor, Unidade de Recebimento',
      'Filtro por produtor(es) no diagnóstico logístico',
      'Versionamento ajustado para Alpha (0.0.x)',
    ],
  },
  {
    version: '0.0.7',
    date: '2026-01-29',
    title: 'Projeção Adaptativa e EOS Dinâmico',
    type: 'improvement',
    changes: [
      'Detecção automática de fase: vegetativo, reprodutivo, senescência',
      'Senescência: decaimento exponencial (curva suave)',
      'Vegetativo próximo ao platô: min(tendência, histórico)',
      'EOS dinâmico: colheita calculada por tendência real',
      'Limites biológicos: NDVI máx 0.92, mín 0.18',
    ],
  },
  {
    version: '0.0.6',
    date: '2026-01-29',
    title: 'Produtores e Culturas',
    type: 'feature',
    changes: [
      'Cadastro de produtores (nome e CPF opcional)',
      'Vinculação de produtor ao talhão',
      'Seleção de cultura: Soja ou Milho',
      'Data de plantio informada pelo produtor (opcional)',
      'Cálculos adaptados por tipo de cultura',
      'Confiança aumentada quando plantio é informado',
    ],
  },
  {
    version: '0.0.5',
    date: '2026-01-29',
    title: 'Gestão de Workspaces',
    type: 'feature',
    changes: [
      'Interface para criação de empresas/workspaces',
      'Criação de admin inicial ao criar workspace',
      'Limites configuráveis (usuários e talhões)',
      'Ativação/desativação de workspaces',
      'Hierarquia de permissões SUPER_ADMIN > ADMIN',
    ],
  },
  {
    version: '0.0.4',
    date: '2026-01-29',
    title: 'Multi-tenancy e Autenticação',
    type: 'feature',
    changes: [
      'Sistema de workspaces para isolamento de dados',
      'Autenticação com login e controle de acesso',
      'Nova interface com sidebar',
      'Gestão de usuários por workspace',
      'Changelog integrado ao rodapé',
    ],
  },
  {
    version: '0.0.3',
    date: '2026-01-29',
    title: 'Diagnóstico Logístico',
    type: 'feature',
    changes: [
      'Novo módulo de diagnóstico logístico',
      'Curva de recebimento (bell curve)',
      'Status PARTIAL para dados incompletos',
      'Mapa de propriedades monitoradas',
      'Timeline agregada de colheita',
    ],
  },
  {
    version: '0.0.2',
    date: '2026-01-28',
    title: 'Visualizações NDVI Avançadas',
    type: 'feature',
    changes: [
      'Linhas de referência no gráfico (plantio, SOS, EOS)',
      'Curvas históricas alinhadas por fenologia',
      'Projeção de colheita baseada em correlação',
      'Métricas de confiança detalhadas',
    ],
  },
  {
    version: '0.0.1',
    date: '2026-01-27',
    title: 'MVP Inicial',
    type: 'feature',
    changes: [
      'Cadastro de talhões com desenho no mapa',
      'Integração com API Merx',
      'Detecção automática de fenologia',
      'Templates de análise (Crédito, Logística, Risco)',
      'Relatórios com IA',
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
