'use client'

import { Card, CardContent } from '@/components/ui/card'
import { AlertOctagon, AlertTriangle, CheckCircle } from 'lucide-react'

interface FieldsStatsCardsProps {
  stats: {
    total: number
    withIntersection: number
    withoutAssignment: number
    resolved: number
  }
  activeFilter: 'all' | 'intersection' | 'noAssignment' | 'direct'
  onFilterChange: (filter: 'all' | 'intersection' | 'noAssignment' | 'direct') => void
}

export function FieldsStatsCards({ stats, activeFilter, onFilterChange }: FieldsStatsCardsProps) {
  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <Card
        className={`cursor-pointer transition-all hover:shadow-md ${activeFilter === 'all' ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
        onClick={() => onFilterChange('all')}
      >
        <CardContent className="pt-6">
          <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
          <div className="text-sm text-slate-500">Total de Talhões</div>
          {activeFilter === 'all' && (
            <div className="mt-2 text-xs text-blue-600 font-medium">● Filtro ativo</div>
          )}
        </CardContent>
      </Card>
      <Card
        className={`cursor-pointer transition-all hover:shadow-md ${
          activeFilter === 'intersection'
            ? 'ring-2 ring-amber-500 border-amber-500'
            : stats.withIntersection > 0 ? 'border-amber-300' : ''
        }`}
        onClick={() => onFilterChange('intersection')}
      >
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <AlertOctagon className={`w-5 h-5 ${stats.withIntersection > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
            <div className="text-2xl font-bold text-amber-600">{stats.withIntersection}</div>
          </div>
          <div className="text-sm text-slate-500">Com Interseção</div>
          {activeFilter === 'intersection' && (
            <div className="mt-2 text-xs text-amber-600 font-medium">● Filtro ativo</div>
          )}
        </CardContent>
      </Card>
      <Card
        className={`cursor-pointer transition-all hover:shadow-md ${
          activeFilter === 'noAssignment'
            ? 'ring-2 ring-red-500 border-red-500'
            : stats.withoutAssignment > 0 ? 'border-red-300' : ''
        }`}
        onClick={() => onFilterChange('noAssignment')}
      >
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-5 h-5 ${stats.withoutAssignment > 0 ? 'text-red-500' : 'text-slate-400'}`} />
            <div className="text-2xl font-bold text-red-600">{stats.withoutAssignment}</div>
          </div>
          <div className="text-sm text-slate-500">Sem Atribuição</div>
          {activeFilter === 'noAssignment' && (
            <div className="mt-2 text-xs text-red-600 font-medium">● Filtro ativo</div>
          )}
        </CardContent>
      </Card>
      <Card
        className={`cursor-pointer transition-all hover:shadow-md ${
          activeFilter === 'direct'
            ? 'ring-2 ring-green-500 border-green-500'
            : stats.resolved > 0 ? 'border-green-300' : ''
        }`}
        onClick={() => onFilterChange('direct')}
      >
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <CheckCircle className={`w-5 h-5 ${stats.resolved > 0 ? 'text-green-500' : 'text-slate-400'}`} />
            <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
          </div>
          <div className="text-sm text-slate-500">Atribuição Direta</div>
          {activeFilter === 'direct' && (
            <div className="mt-2 text-xs text-green-600 font-medium">● Filtro ativo</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
