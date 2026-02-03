'use client'

import Link from 'next/link'
import { Eye, Trash2, Loader2, CheckCircle, AlertCircle, Clock, RefreshCw, AlertTriangle, Warehouse, AlertOctagon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatNumber, formatTons } from '@/lib/utils'

interface Field {
  id: string
  name: string
  status: string
  errorMessage?: string | null
  city: string | null
  state: string | null
  areaHa: number | null
  agroData?: {
    areaHa: number | null
    volumeEstimatedKg: number | null
    confidence: string | null
    eosDate: string | null
  } | null
  analyses?: {
    templateId: string
    status: string
    statusColor: string | null
  }[]
  // Caixas logísticas
  logisticsUnit?: { id: string; name: string } | null
  producer?: { 
    id?: string
    name?: string
    defaultLogisticsUnit?: { id: string; name: string } | null 
  } | null
  logisticsDistances?: {
    logisticsUnitId: string
    distanceKm: number
    isWithinCoverage: boolean
    logisticsUnit: { id: string; name: string }
  }[]
}

interface FieldTableProps {
  fields: Field[]
  onDelete: (id: string) => void
  onReprocess?: (id: string) => void
  isDeleting?: string | null
  isReprocessing?: string | null
}

const statusConfig: Record<string, { icon: React.ReactNode; variant: 'success' | 'warning' | 'error' | 'secondary'; label: string }> = {
  SUCCESS: {
    icon: <CheckCircle size={14} />,
    variant: 'success',
    label: 'Processado'
  },
  PARTIAL: {
    icon: <AlertTriangle size={14} />,
    variant: 'warning',
    label: 'Parcial'
  },
  PROCESSING: {
    icon: <Loader2 size={14} className="animate-spin" />,
    variant: 'secondary',
    label: 'Processando'
  },
  PENDING: {
    icon: <Clock size={14} />,
    variant: 'secondary',
    label: 'Pendente'
  },
  ERROR: {
    icon: <AlertCircle size={14} />,
    variant: 'error',
    label: 'Erro'
  }
}

const templateColors: Record<string, string> = {
  CREDIT: 'bg-emerald-100 text-emerald-700',
  LOGISTICS: 'bg-blue-100 text-blue-700',
  RISK_MATRIX: 'bg-amber-100 text-amber-700'
}

const templateNames: Record<string, string> = {
  CREDIT: 'Crédito',
  LOGISTICS: 'Logística',
  RISK_MATRIX: 'Risco'
}

export function FieldTable({ fields, onDelete, onReprocess, isDeleting, isReprocessing }: FieldTableProps) {
  if (fields.length === 0) {
    return (
      <div className="bg-white rounded-[32px] border border-slate-200 p-20 text-center">
        <p className="text-slate-400 font-medium italic">
          Nenhum talhão cadastrado na sua carteira.
        </p>
        <p className="text-slate-300 text-sm mt-2">
          Clique em &quot;Novo Talhão&quot; para começar.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
      <table className="w-full text-left">
        <thead className="bg-slate-50 border-b">
          <tr>
            <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
              Status
            </th>
            <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
              Talhão
            </th>
            <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
              Área
            </th>
            <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
              Vol. Est.
            </th>
            <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
              Caixa Logística
            </th>
            <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
              Análises
            </th>
            <th className="px-6 py-5 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">
              Ações
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {fields.map(field => {
            const status = statusConfig[field.status] || statusConfig.PENDING
            const area = field.agroData?.areaHa || field.areaHa
            const volume = field.agroData?.volumeEstimatedKg

            return (
              <tr key={field.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <Badge variant={status.variant} className="gap-1 w-fit">
                      {status.icon}
                      {status.label}
                    </Badge>
                    {field.errorMessage && (field.status === 'ERROR' || field.status === 'PARTIAL') && (
                      <span 
                        className="text-[9px] text-amber-600 max-w-[150px] truncate cursor-help" 
                        title={field.errorMessage}
                      >
                        {field.errorMessage}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-700">{field.name}</div>
                  <div className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter">
                    {field.city || '---'}, {field.state || '--'}
                  </div>
                </td>
                <td className="px-6 py-4 font-bold text-slate-600">
                  {area ? `${formatNumber(area)} ha` : '---'}
                </td>
                <td className="px-6 py-4">
                  {volume ? (
                    <div className="font-bold text-emerald-600">
                      {formatTons(volume)}
                    </div>
                  ) : (
                    '---'
                  )}
                </td>
                <td className="px-6 py-4">
                  {(() => {
                    // Determinar caixa principal e interseções
                    const directUnit = field.logisticsUnit
                    const inheritedUnit = field.producer?.defaultLogisticsUnit
                    const coveringUnits = field.logisticsDistances || []
                    
                    // Obter nomes das unidades de cobertura
                    const coveringNames = coveringUnits.map(d => d.logisticsUnit)
                    
                    const primaryUnit = directUnit || inheritedUnit || (coveringNames.length > 0 ? coveringNames[0] : null)
                    const hasIntersection = coveringUnits.length > 1
                    
                    if (!primaryUnit && coveringUnits.length === 0) {
                      return <span className="text-slate-300 text-xs">—</span>
                    }
                    
                    // Determinar tipo de atribuição
                    const assignType = directUnit ? 'M' : (inheritedUnit ? 'P' : 'A')
                    const assignColor = directUnit ? 'bg-blue-500' : (inheritedUnit ? 'bg-purple-500' : 'bg-green-500')
                    const assignTitle = directUnit ? 'Manual' : (inheritedUnit ? 'Produtor' : 'Automático')
                    
                    return (
                      <div className="flex items-center gap-1.5">
                        <span 
                          className={`w-4 h-4 flex items-center justify-center text-[8px] font-bold text-white rounded ${assignColor}`}
                          title={assignTitle}
                        >
                          {assignType}
                        </span>
                        <span className="text-xs text-slate-700 truncate max-w-[90px]" title={primaryUnit?.name}>
                          {primaryUnit?.name}
                        </span>
                        {hasIntersection && (
                          <span 
                            className="flex items-center text-amber-500 cursor-help"
                            title={`Interseção: ${coveringNames.map(u => u.name).join(', ')}`}
                          >
                            <AlertOctagon size={12} />
                          </span>
                        )}
                      </div>
                    )
                  })()}
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-1 flex-wrap">
                    {field.analyses?.map(analysis => (
                      <span
                        key={analysis.templateId}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${templateColors[analysis.templateId] || 'bg-slate-100 text-slate-600'}`}
                      >
                        {templateNames[analysis.templateId] || analysis.templateId}
                      </span>
                    ))}
                    {(!field.analyses || field.analyses.length === 0) && (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex gap-1 justify-end">
                    {onReprocess && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onReprocess(field.id)}
                        disabled={isReprocessing === field.id || field.status === 'PROCESSING'}
                        className="text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                        title="Reprocessar dados"
                      >
                        {isReprocessing === field.id ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <RefreshCw size={18} />
                        )}
                      </Button>
                    )}
                    <Link href={`/reports/${field.id}`}>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={field.status !== 'SUCCESS' && field.status !== 'PARTIAL'}
                        className="text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                        title="Ver relatório"
                      >
                        <Eye size={18} />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(field.id)}
                      disabled={isDeleting === field.id}
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                      title="Excluir talhão"
                    >
                      {isDeleting === field.id ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Trash2 size={18} />
                      )}
                    </Button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
