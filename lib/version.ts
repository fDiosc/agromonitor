export const APP_VERSION = '0.0.33'

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
    version: '0.0.33',
    date: '2026-02-12',
    title: 'Sanidade EOS + ATYPICAL + Supressão IA',
    type: 'fix',
    changes: [
      'EOS Fusion: NDVI prevalece sobre GDD em contradições (planta verde com GDD 100% não declara maturação)',
      'EOS Fusion: GDD passado + NDVI ativo → projeção futura com confiança reduzida',
      'Classificação ATYPICAL refinada: ciclo indefinido (sem SOS/EOS) e baixa amplitude para culturas anuais',
      'Relatório: Alerta de Cultura no TOPO; cards de Volume, EOS, GDD suprimidos quando crop issue',
      'Relatório: crop issues mostram apenas card algorítmico, painel Judge é suprimido',
      'Dashboard: colunas IA, EOS IA, Pronta e Conf. IA mostram "—" quando crop issue detectado',
      'Status: crop issue (NO_CROP, ATYPICAL, ANOMALOUS) gera "Processado" em vez de "Parcial"',
      'Correção TypeError: Array.isArray guard em hypotheses/evidence do Verificador',
    ],
  },
  {
    version: '0.0.32',
    date: '2026-02-11',
    title: 'Pipeline de Criticidade de Cultura',
    type: 'feature',
    changes: [
      'Verificação algorítmica de padrão de cultura (8 tipos: soja, milho, gergelim, cevada, algodão, arroz, café, cana)',
      'Classificação automática: TYPICAL, ATYPICAL, ANOMALOUS, NO_CROP',
      'Short-circuit em NO_CROP: nenhum cálculo de EOS, GDD ou IA é executado',
      'Agente Verificador IA: confirma visualmente quando padrão algorítmico é suspeito',
      'Pipeline Curator → Verifier → Judge com corte automático em NO_CROP/MISMATCH',
      'Suporte a 3 categorias: Anuais, Semi-perenes (cana), Perenes (café)',
      'Dashboard: coluna Cultura com status visual e filtro dedicado',
      'Alerta crítico no relatório para campos sem cultivo identificável',
    ],
  },
  {
    version: '0.0.31',
    date: '2026-02-11',
    title: 'Dashboard Avançado: Ordenação e Filtros',
    type: 'improvement',
    changes: [
      'Tabela com 13 colunas individuais ordenáveis (clique no cabeçalho)',
      'Ordenação padrão por colheita prevista mais próxima',
      'Filtro de janela de colheita: Passada, 30d, 60d, 90d',
      'Filtro de confiança do modelo: Alta, Média, Baixa',
      'Filtro de validação IA: Com/Sem IA, Confirmado/Questionado/Rejeitado',
      'Correção: dados de IA não apareciam (campo invertido na API)',
      'Otimização: processamento server-side de JSON pesados',
      'Card IA: adicionados Landsat 8/9 e Sentinel-3 OLCI nos sensores',
    ],
  },
  {
    version: '0.0.30',
    date: '2026-02-11',
    title: 'Correção Pipeline EOS (Single Source of Truth)',
    type: 'fix',
    changes: [
      'Fusão EOS: corrigido fallback para "hoje" quando colheita já passou',
      'GDD: backtracking para encontrar data exata de maturação (100% GDD)',
      'Mapeamento de stress hídrico PT→EN corrigido na integração',
      'API de talhão agora usa EOS fusionado (não bruto) para janela de colheita',
      'Relatório prioriza EOS do servidor, eliminando divergência client/server',
      'Schema do Juiz IA alinhado: ready, overallRisk, factors[]',
      'Critérios de decisão quantitativos para CONFIRMED/QUESTIONED/REJECTED',
      'Normalização bidirecional de dados antigos/novos no painel IA',
    ],
  },
  {
    version: '0.0.29',
    date: '2026-02-11',
    title: 'Validação Visual por IA Multimodal',
    type: 'feature',
    changes: [
      'Agentes Curador + Juiz analisam imagens de satélite com Gemini',
      'Pipeline completo: busca de imagens, curadoria, validação visual',
      'Três modos de trigger: Manual, Automático, Baixa Confiança',
      'Painel de resultados no relatório com concordância, alertas e recomendações',
      'Configurável por workspace via Settings > Módulos e Visualizações',
      'Suporte multi-sensor: Sentinel-2, Sentinel-1, Landsat, Sentinel-3',
    ],
  },
  {
    version: '0.0.28',
    date: '2026-02-06',
    title: 'Gestão Avançada de Talhões',
    type: 'feature',
    changes: [
      'Renomear talhões diretamente pela interface',
      'Migrar talhões entre produtores com aviso visual',
      'Atribuição manual de caixa logística por talhão',
      'Acessível nas abas Produtores e Gerenciar Talhões',
    ],
  },
  {
    version: '0.0.27',
    date: '2026-02-06',
    title: 'Redesign do Modal de Processamento',
    type: 'improvement',
    changes: [
      'Header com gradiente emerald/teal (cores MERX) e padrões decorativos',
      'Badge de tempo decorrido destacado',
      'Cards de etapas com ícones numerados e status coloridos',
      'Animação de bounce para etapa em execução',
      'Botão "Voltar para Dashboard" escuro e destacado',
      'Backdrop clicável para navegação rápida',
    ],
  },
  {
    version: '0.0.26',
    date: '2026-02-04',
    title: 'UX de Processamento e Performance',
    type: 'improvement',
    changes: [
      'Modal de processamento contextual: overlay apenas na página do talhão',
      'Dashboard mostra status "Processando" no card sem modal global',
      'Botão de acesso ao talhão bloqueado durante processamento',
      'Novo endpoint leve /api/fields/[id]/status para polling eficiente',
      'Correção de loops de re-renderização no polling',
      'Navegação livre durante processamento em background',
    ],
  },
  {
    version: '0.0.25',
    date: '2026-02-04',
    title: '[BETA] Fusão Adaptativa SAR-NDVI',
    type: 'feature',
    changes: [
      'Fusão de dados Sentinel-1 (SAR) com NDVI óptico usando Machine Learning',
      'Seleção automática de features (VH, VV ou VV+VH) por talhão',
      'Modelos GPR e KNN para estimar NDVI em períodos nublados',
      'Ajuste de confiança de colheita baseado em fonte de dados',
      'Toggle BETA nas configurações com explicação detalhada',
    ],
  },
  {
    version: '0.0.18',
    date: '2026-02-03',
    title: 'Gestão de Usuários e Estabilidade',
    type: 'improvement',
    changes: [
      'SUPER_ADMIN pode criar usuários em qualquer workspace',
      'Seletor de workspace no formulário de criação de usuário',
      'Reprocessamento com polling assíncrono (suporta até 6 minutos)',
      'Correção de timeout em processamentos longos',
    ],
  },
  {
    version: '0.0.17',
    date: '2026-02-03',
    title: 'Filtros e Gestão de Talhões',
    type: 'improvement',
    changes: [
      'Expandir produtor para ver talhões vinculados (área, volume, status)',
      'Cards clicáveis como filtros na tela Gerenciar Talhões',
      'Filtros no Dashboard: status, caixa logística e tipo de atribuição',
      'Badges de atribuição compactas: M (Manual), P (Produtor), A (Auto)',
      'Filtro de caixas logísticas respeita atribuições manuais',
      'Correção de glitch visual na sidebar (seleção duplicada)',
      'Tabela de cobertura com layout otimizado e tooltips',
    ],
  },
  {
    version: '0.0.16',
    date: '2026-02-03',
    title: 'Distâncias Persistentes e UX Simplificada',
    type: 'improvement',
    changes: [
      'Distâncias talhão-caixa logística calculadas e persistidas no banco',
      'Processamento automático ao criar caixa logística ou talhão',
      'Botão de reprocessamento manual nas configurações',
      'Seletor de caixas logísticas integrado no Overview do diagnóstico',
      'Removida aba "Unidade de Recebimento" redundante',
      'Performance melhorada (leitura do banco vs cálculo on-demand)',
    ],
  },
  {
    version: '0.0.15',
    date: '2026-02-03',
    title: 'Caixas Logísticas',
    type: 'feature',
    changes: [
      'Cadastro de caixas logísticas (armazéns) com lat/lng e raio de cobertura',
      'Aba "Unidade de Recebimento" no diagnóstico logístico',
      'Atribuição automática de talhões por raio de cobertura',
      'Atribuição manual em nível de produtor ou talhão',
      'Configurações de workspace (método de cálculo de distância)',
    ],
  },
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
