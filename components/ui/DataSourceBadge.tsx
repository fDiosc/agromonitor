'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { 
  Satellite, 
  Radar, 
  Cloud, 
  Thermometer, 
  Droplets, 
  Layers,
  Sparkles,
  AlertTriangle,
  HelpCircle,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react'

// ==================== Types ====================

export type DataSourceType = 
  | 'SATELLITE'    // Sentinel-2 (NDVI óptico)
  | 'RADAR'        // Sentinel-1
  | 'PRECIPITATION'
  | 'TEMPERATURE'
  | 'WATER_BALANCE'
  | 'SOIL'
  | 'AI'           // Dados gerados por IA
  | 'ALGORITHM'    // Dados calculados algoritmicamente
  | 'USER_INPUT'   // Dados informados pelo usuário

export type DataStatus = 
  | 'AVAILABLE'    // Dados disponíveis e atualizados
  | 'PARTIAL'      // Dados parciais ou incompletos
  | 'STALE'        // Dados desatualizados
  | 'UNAVAILABLE'  // Dados não disponíveis
  | 'ERROR'        // Erro ao buscar dados
  | 'FALLBACK'     // Usando dados de fallback

interface DataSourceBadgeProps {
  source: DataSourceType
  status?: DataStatus
  lastUpdate?: Date | string
  tooltip?: string
  compact?: boolean
  className?: string
}

// ==================== Config ====================

const SOURCE_CONFIG: Record<DataSourceType, {
  label: string
  shortLabel: string
  icon: React.ElementType
  color: string
  bgColor: string
  description: string
}> = {
  SATELLITE: {
    label: 'Satélite Sentinel-2',
    shortLabel: 'S2',
    icon: Satellite,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50 border-emerald-200',
    description: 'Dados de NDVI óptico capturados pelo satélite Sentinel-2'
  },
  RADAR: {
    label: 'Radar Sentinel-1',
    shortLabel: 'S1',
    icon: Radar,
    color: 'text-purple-700',
    bgColor: 'bg-purple-50 border-purple-200',
    description: 'Dados de radar que funcionam mesmo com nuvens'
  },
  PRECIPITATION: {
    label: 'Precipitação',
    shortLabel: 'P',
    icon: Cloud,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 border-blue-200',
    description: 'Dados de precipitação diária em mm'
  },
  TEMPERATURE: {
    label: 'Temperatura',
    shortLabel: 'T',
    icon: Thermometer,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50 border-amber-200',
    description: 'Dados de temperatura mínima e máxima diária'
  },
  WATER_BALANCE: {
    label: 'Balanço Hídrico',
    shortLabel: 'BH',
    icon: Droplets,
    color: 'text-cyan-700',
    bgColor: 'bg-cyan-50 border-cyan-200',
    description: 'Cálculo de déficit/excedente hídrico do solo'
  },
  SOIL: {
    label: 'Solo',
    shortLabel: 'So',
    icon: Layers,
    color: 'text-amber-800',
    bgColor: 'bg-amber-100/50 border-amber-300',
    description: 'Tipo e textura do solo da região'
  },
  AI: {
    label: 'Gerado por IA',
    shortLabel: 'IA',
    icon: Sparkles,
    color: 'text-violet-700',
    bgColor: 'bg-violet-50 border-violet-200',
    description: 'Este dado foi gerado por Inteligência Artificial usando o modelo Gemini'
  },
  ALGORITHM: {
    label: 'Calculado',
    shortLabel: 'Calc',
    icon: CheckCircle,
    color: 'text-slate-700',
    bgColor: 'bg-slate-50 border-slate-200',
    description: 'Dado calculado algoritmicamente a partir de dados de satélite e fenologia'
  },
  USER_INPUT: {
    label: 'Informado',
    shortLabel: 'Usr',
    icon: HelpCircle,
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50 border-indigo-200',
    description: 'Dado informado manualmente pelo usuário'
  }
}

const STATUS_CONFIG: Record<DataStatus, {
  icon: React.ElementType
  color: string
  label: string
}> = {
  AVAILABLE: {
    icon: CheckCircle,
    color: 'text-emerald-500',
    label: 'Atualizado'
  },
  PARTIAL: {
    icon: AlertTriangle,
    color: 'text-amber-500',
    label: 'Parcial'
  },
  STALE: {
    icon: Clock,
    color: 'text-slate-400',
    label: 'Desatualizado'
  },
  UNAVAILABLE: {
    icon: XCircle,
    color: 'text-slate-300',
    label: 'Indisponível'
  },
  ERROR: {
    icon: XCircle,
    color: 'text-red-500',
    label: 'Erro'
  },
  FALLBACK: {
    icon: AlertTriangle,
    color: 'text-amber-500',
    label: 'Fallback'
  }
}

// ==================== Component ====================

export function DataSourceBadge({
  source,
  status = 'AVAILABLE',
  lastUpdate,
  tooltip,
  compact = false,
  className = ''
}: DataSourceBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  
  const config = SOURCE_CONFIG[source]
  const statusConfig = STATUS_CONFIG[status]
  const Icon = config.icon
  const StatusIcon = statusConfig.icon
  
  const formattedDate = lastUpdate 
    ? new Date(lastUpdate).toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    : null

  return (
    <div className="relative inline-block">
      <Badge
        variant="outline"
        className={`${config.bgColor} ${config.color} cursor-help ${className}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <Icon className="w-3 h-3 mr-1" />
        {compact ? config.shortLabel : config.label}
        {status !== 'AVAILABLE' && (
          <StatusIcon className={`w-3 h-3 ml-1 ${statusConfig.color}`} />
        )}
      </Badge>
      
      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-slate-900 text-white text-xs rounded-lg shadow-xl">
          <div className="flex items-start gap-2">
            <Icon className="w-4 h-4 mt-0.5 text-slate-300" />
            <div>
              <p className="font-bold mb-1">{config.label}</p>
              <p className="text-slate-300 leading-relaxed">
                {tooltip || config.description}
              </p>
              
              {/* Status info */}
              <div className="mt-2 pt-2 border-t border-slate-700 flex items-center justify-between">
                <span className={`flex items-center gap-1 ${statusConfig.color}`}>
                  <StatusIcon className="w-3 h-3" />
                  {statusConfig.label}
                </span>
                {formattedDate && (
                  <span className="text-slate-400">
                    {formattedDate}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
            <div className="w-2 h-2 bg-slate-900 rotate-45"></div>
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== Helpers ====================

/**
 * Componente para mostrar múltiplas badges em linha
 */
export function DataSourceBadgeGroup({
  sources,
  compact = true,
  className = ''
}: {
  sources: Array<{ source: DataSourceType; status?: DataStatus; lastUpdate?: Date | string }>
  compact?: boolean
  className?: string
}) {
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {sources.map((s, i) => (
        <DataSourceBadge
          key={i}
          source={s.source}
          status={s.status}
          lastUpdate={s.lastUpdate}
          compact={compact}
        />
      ))}
    </div>
  )
}

/**
 * Badge simples para indicar dado gerado por IA
 */
export function AIBadge({ 
  tooltip,
  className = '' 
}: { 
  tooltip?: string
  className?: string 
}) {
  return (
    <DataSourceBadge
      source="AI"
      tooltip={tooltip || 'Este conteúdo foi gerado por Inteligência Artificial e deve ser validado por um especialista.'}
      compact={true}
      className={className}
    />
  )
}

/**
 * Badge simples para dado calculado algoritmicamente
 */
export function AlgorithmBadge({ 
  tooltip,
  className = '' 
}: { 
  tooltip?: string
  className?: string 
}) {
  return (
    <DataSourceBadge
      source="ALGORITHM"
      tooltip={tooltip || 'Valor calculado a partir de dados de satélite e algoritmos de fenologia.'}
      compact={true}
      className={className}
    />
  )
}
