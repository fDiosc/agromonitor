'use client'

import { Input } from '@/components/ui/input'
import { Search, X, Filter } from 'lucide-react'

interface FieldsSearchFiltersProps {
  searchQuery: string
  onSearchQueryChange: (v: string) => void
  cropFilter: string
  onCropFilterChange: (v: string) => void
  producerFilter: string
  onProducerFilterChange: (v: string) => void
  cropTypes: string[]
  uniqueProducers: { id: string; name: string }[]
  hasActiveFilters: boolean
  onClearFilters: () => void
}

export function FieldsSearchFilters({
  searchQuery,
  onSearchQueryChange,
  cropFilter,
  onCropFilterChange,
  producerFilter,
  onProducerFilterChange,
  cropTypes,
  uniqueProducers,
  hasActiveFilters,
  onClearFilters,
}: FieldsSearchFiltersProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="Pesquisar por talhão, produtor ou cidade..."
          className="pl-9 pr-9"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchQueryChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Filter className="w-3.5 h-3.5" />
          Filtros:
        </div>

        {cropTypes.length > 1 && (
          <select
            value={cropFilter}
            onChange={(e) => onCropFilterChange(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todas as culturas</option>
            {cropTypes.map(ct => (
              <option key={ct} value={ct}>{ct}</option>
            ))}
          </select>
        )}

        {uniqueProducers.length > 1 && (
          <select
            value={producerFilter}
            onChange={(e) => onProducerFilterChange(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px]"
          >
            <option value="all">Todos os produtores</option>
            {uniqueProducers.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}

        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  )
}
