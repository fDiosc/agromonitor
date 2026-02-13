'use client'

import {
  Filter,
  X,
  Warehouse,
  CheckCircle,
  Clock,
  AlertCircle,
  BrainCircuit,
  Target,
  CalendarCheck,
  Search,
  SquareSplitVertical,
} from 'lucide-react'
import { Loader2 } from 'lucide-react'

interface LogisticsUnit {
  id: string
  name: string
}

interface DashboardFiltersProps {
  searchQuery: string
  onSearchQueryChange: (v: string) => void
  subFieldFilter: string
  onSubFieldFilterChange: (v: string) => void
  statusFilter: string
  onStatusFilterChange: (v: string) => void
  assignmentTypeFilter: string
  onAssignmentTypeFilterChange: (v: string) => void
  logisticsUnitFilter: string
  onLogisticsUnitFilterChange: (v: string) => void
  harvestWindowFilter: string
  onHarvestWindowFilterChange: (v: string) => void
  confidenceFilter: string
  onConfidenceFilterChange: (v: string) => void
  cropPatternFilter: string
  onCropPatternFilterChange: (v: string) => void
  aiFilter: string
  onAiFilterChange: (v: string) => void
  aiAgreementFilter: string
  onAiAgreementFilterChange: (v: string) => void
  logisticsUnits: LogisticsUnit[]
  enableSubFields: boolean
  filteredCount: number
  totalCount: number
  hasActiveFilters: boolean
  onClearFilters: () => void
}

export function DashboardFilters({
  searchQuery,
  onSearchQueryChange,
  subFieldFilter,
  onSubFieldFilterChange,
  statusFilter,
  onStatusFilterChange,
  assignmentTypeFilter,
  onAssignmentTypeFilterChange,
  logisticsUnitFilter,
  onLogisticsUnitFilterChange,
  harvestWindowFilter,
  onHarvestWindowFilterChange,
  confidenceFilter,
  onConfidenceFilterChange,
  cropPatternFilter,
  onCropPatternFilterChange,
  aiFilter,
  onAiFilterChange,
  aiAgreementFilter,
  onAiAgreementFilterChange,
  logisticsUnits,
  enableSubFields,
  filteredCount,
  totalCount,
  hasActiveFilters,
  onClearFilters,
}: DashboardFiltersProps) {
  return (
    <div className="mb-6 bg-slate-50 rounded-xl border divide-y divide-slate-200">
      {/* Row 0: Search + Sub-fields */}
      <div className="flex flex-wrap items-center gap-4 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Filter size={16} />
          <span className="font-semibold">Filtros</span>
        </div>

        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar talhão, produtor ou cidade..."
            value={searchQuery}
            onChange={e => onSearchQueryChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300"
          />
          {searchQuery && (
            <button onClick={() => onSearchQueryChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={12} />
            </button>
          )}
        </div>

        {enableSubFields && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <SquareSplitVertical size={10} className="inline mr-0.5" />Subtalhões:
            </span>
            <div className="flex gap-1">
              {[
                { value: 'all', label: 'Todos' },
                { value: 'yes', label: 'Sim' },
                { value: 'no', label: 'Não' },
              ].map(opt => (
                <button key={opt.value} onClick={() => onSubFieldFilterChange(opt.value)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    subFieldFilter === opt.value ? 'bg-blue-600 text-white' : 'bg-white border text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Row 1: Status + Logística */}
      <div className="flex flex-wrap items-center gap-4 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status:</span>
          <div className="flex gap-1">
            {[
              { value: 'all', label: 'Todos', icon: null },
              { value: 'SUCCESS', label: 'Processado', icon: <CheckCircle size={11} className="text-green-500" /> },
              { value: 'PROCESSING', label: 'Em proc.', icon: <Loader2 size={11} className="animate-spin text-blue-500" /> },
              { value: 'PENDING', label: 'Pendente', icon: <Clock size={11} className="text-slate-400" /> },
              { value: 'ERROR', label: 'Erro', icon: <AlertCircle size={11} className="text-red-500" /> },
            ].map(opt => (
              <button key={opt.value} onClick={() => onStatusFilterChange(opt.value)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  statusFilter === opt.value ? 'bg-blue-600 text-white' : 'bg-white border text-slate-600 hover:bg-slate-100'
                }`}
              >
                {opt.icon}{opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tipo:</span>
          <div className="flex gap-1">
            {[
              { value: 'all', label: 'Todos', color: 'bg-white border text-slate-600' },
              { value: 'manual', label: 'Manual', color: 'bg-blue-100 text-blue-700' },
              { value: 'producer', label: 'Produtor', color: 'bg-purple-100 text-purple-700' },
              { value: 'auto', label: 'Auto', color: 'bg-green-100 text-green-700' },
              { value: 'none', label: 'Sem', color: 'bg-red-100 text-red-700' },
            ].map(opt => (
              <button key={opt.value} onClick={() => onAssignmentTypeFilterChange(opt.value)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  assignmentTypeFilter === opt.value ? 'ring-2 ring-offset-1 ring-slate-400 ' + opt.color : opt.color + ' hover:opacity-80'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {logisticsUnits.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <Warehouse size={10} className="inline mr-0.5" />Caixa:
            </span>
            <select value={logisticsUnitFilter} onChange={e => onLogisticsUnitFilterChange(e.target.value)}
              className="px-2 py-1 rounded border text-[11px] bg-white">
              <option value="all">Todas</option>
              <option value="none">Sem atribuição</option>
              {logisticsUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Row 2: Fenologia + IA */}
      <div className="flex flex-wrap items-center gap-4 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <CalendarCheck size={10} className="inline mr-0.5" />Colheita:
          </span>
          <div className="flex gap-1">
            {[
              { value: 'all', label: 'Todas' },
              { value: 'past', label: 'Passada' },
              { value: 'next30', label: '30 dias' },
              { value: 'next60', label: '60 dias' },
              { value: 'next90', label: '90 dias' },
              { value: 'no_data', label: 'Sem data' },
            ].map(opt => (
              <button key={opt.value} onClick={() => onHarvestWindowFilterChange(opt.value)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  harvestWindowFilter === opt.value ? 'bg-blue-600 text-white' : 'bg-white border text-slate-600 hover:bg-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <Target size={10} className="inline mr-0.5" />Conf.:
          </span>
          <div className="flex gap-1">
            {[
              { value: 'all', label: 'Todas' },
              { value: 'high', label: 'Alta (>75%)' },
              { value: 'medium', label: 'Média' },
              { value: 'low', label: 'Baixa (<40%)' },
              { value: 'none', label: 'Sem' },
            ].map(opt => (
              <button key={opt.value} onClick={() => onConfidenceFilterChange(opt.value)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  confidenceFilter === opt.value ? 'bg-blue-600 text-white' : 'bg-white border text-slate-600 hover:bg-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Cultura:
          </span>
          <div className="flex gap-1">
            {[
              { value: 'all', label: 'Todas' },
              { value: 'problem', label: 'Com Problema' },
              { value: 'NO_CROP', label: 'Sem Cultivo' },
              { value: 'ANOMALOUS', label: 'Anômalo' },
              { value: 'ATYPICAL', label: 'Atípico' },
              { value: 'TYPICAL', label: 'OK' },
            ].map(opt => (
              <button key={opt.value} onClick={() => onCropPatternFilterChange(opt.value)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  cropPatternFilter === opt.value
                    ? opt.value === 'NO_CROP' || opt.value === 'problem' ? 'bg-red-600 text-white'
                      : opt.value === 'ANOMALOUS' ? 'bg-orange-600 text-white'
                      : opt.value === 'ATYPICAL' ? 'bg-amber-600 text-white'
                      : opt.value === 'TYPICAL' ? 'bg-emerald-600 text-white'
                      : 'bg-slate-600 text-white'
                    : 'bg-white border text-slate-600 hover:bg-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <BrainCircuit size={10} className="inline mr-0.5" />IA:
          </span>
          <div className="flex gap-1">
            {[
              { value: 'all', label: 'Todos' },
              { value: 'with_ai', label: 'Com IA' },
              { value: 'without_ai', label: 'Sem IA' },
            ].map(opt => (
              <button key={opt.value} onClick={() => onAiFilterChange(opt.value)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  aiFilter === opt.value ? 'bg-violet-600 text-white' : 'bg-white border text-slate-600 hover:bg-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Resultado IA:</span>
          <div className="flex gap-1">
            {[
              { value: 'all', label: 'Todos', cls: 'bg-white border text-slate-600' },
              { value: 'CONFIRMED', label: 'Confirmado', cls: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
              { value: 'QUESTIONED', label: 'Questionado', cls: 'bg-amber-50 border-amber-200 text-amber-700' },
              { value: 'REJECTED', label: 'Rejeitado', cls: 'bg-red-50 border-red-200 text-red-700' },
            ].map(opt => (
              <button key={opt.value} onClick={() => onAiAgreementFilterChange(opt.value)}
                className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                  aiAgreementFilter === opt.value ? 'ring-2 ring-offset-1 ring-slate-400 ' + opt.cls : opt.cls + ' hover:opacity-80'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {hasActiveFilters && (
            <button onClick={onClearFilters} className="flex items-center gap-1 px-2 py-1 text-[11px] text-slate-500 hover:text-slate-700 font-medium">
              <X size={12} />Limpar
            </button>
          )}
          <span className="text-[11px] text-slate-500 font-medium">
            {filteredCount} de {totalCount} talhões
          </span>
        </div>
      </div>
    </div>
  )
}
