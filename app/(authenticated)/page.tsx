'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { FieldTable } from '@/components/fields/field-table'
import { Loader2, Plus, Filter, X, Warehouse, CheckCircle, Clock, AlertCircle, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface LogisticsUnit {
  id: string
  name: string
}

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
    id: string
    name: string
    defaultLogisticsUnit?: { id: string; name: string } | null 
  } | null
  logisticsDistances?: {
    logisticsUnitId: string
    distanceKm: number
    isWithinCoverage: boolean
    logisticsUnit: { id: string; name: string }
  }[]
}

export default function DashboardPage() {
  const [fields, setFields] = useState<Field[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [reprocessing, setReprocessing] = useState<string | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Filtros
  const [logisticsUnits, setLogisticsUnits] = useState<LogisticsUnit[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [logisticsUnitFilter, setLogisticsUnitFilter] = useState<string>('all')
  const [assignmentTypeFilter, setAssignmentTypeFilter] = useState<string>('all')

  const fetchFields = useCallback(async () => {
    try {
      const res = await fetch('/api/fields')
      const data = await res.json()
      setFields(data.fields || [])
      
      // Verificar se há campos processando
      const hasProcessing = data.fields?.some((f: Field) => f.status === 'PROCESSING')
      
      // Se há processando e não há polling, iniciar
      if (hasProcessing && !pollIntervalRef.current) {
        pollIntervalRef.current = setInterval(() => {
          fetchFields()
        }, 5000)
      }
      
      // Se não há processando e há polling, parar
      if (!hasProcessing && pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    } catch (error) {
      console.error('Error fetching fields:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchLogisticsUnits = useCallback(async () => {
    try {
      const res = await fetch('/api/logistics-units')
      if (res.ok) {
        const data = await res.json()
        setLogisticsUnits(data.logisticsUnits || [])
      }
    } catch (error) {
      console.error('Error fetching logistics units:', error)
    }
  }, [])

  useEffect(() => {
    fetchFields()
    fetchLogisticsUnits()
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [fetchFields, fetchLogisticsUnits])

  // Filtrar campos
  const filteredFields = useMemo(() => {
    return fields.filter(field => {
      // Filtro de status
      if (statusFilter !== 'all' && field.status !== statusFilter) {
        return false
      }

      const directUnit = field.logisticsUnit?.id
      const inheritedUnit = field.producer?.defaultLogisticsUnit?.id
      const coveringUnits = field.logisticsDistances?.map(d => d.logisticsUnit.id) || []

      // Filtro de tipo de atribuição
      if (assignmentTypeFilter !== 'all') {
        if (assignmentTypeFilter === 'manual' && !directUnit) {
          return false
        }
        if (assignmentTypeFilter === 'producer' && (directUnit || !inheritedUnit)) {
          return false
        }
        if (assignmentTypeFilter === 'auto' && (directUnit || inheritedUnit || coveringUnits.length === 0)) {
          return false
        }
        if (assignmentTypeFilter === 'none' && (directUnit || inheritedUnit || coveringUnits.length > 0)) {
          return false
        }
      }

      // Filtro de caixa logística
      if (logisticsUnitFilter !== 'all') {
        if (logisticsUnitFilter === 'none') {
          // Sem atribuição
          return !directUnit && !inheritedUnit && coveringUnits.length === 0
        } else {
          // Atribuído a uma caixa específica
          return directUnit === logisticsUnitFilter || 
                 inheritedUnit === logisticsUnitFilter ||
                 coveringUnits.includes(logisticsUnitFilter)
        }
      }

      return true
    })
  }, [fields, statusFilter, logisticsUnitFilter, assignmentTypeFilter])

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este talhão?')) return

    setDeleting(id)
    try {
      await fetch(`/api/fields/${id}`, { method: 'DELETE' })
      setFields(prev => prev.filter(f => f.id !== id))
    } catch (error) {
      console.error('Error deleting field:', error)
      alert('Erro ao excluir talhão')
    } finally {
      setDeleting(null)
    }
  }

  const handleReprocess = async (id: string) => {
    if (!confirm('Reprocessar irá buscar novos dados e recalcular análises. Continuar?')) return

    setReprocessing(id)
    
    // Atualizar status para PROCESSING
    setFields(prev => prev.map(f => 
      f.id === id ? { ...f, status: 'PROCESSING' } : f
    ))

    try {
      const res = await fetch(`/api/fields/${id}/process`, { method: 'POST' })
      
      if (res.ok) {
        // Atualizar lista
        await fetchFields()
      } else {
        const data = await res.json()
        alert(`Erro: ${data.error || 'Falha ao reprocessar'}`)
        await fetchFields()
      }
    } catch (error) {
      console.error('Error reprocessing field:', error)
      alert('Erro ao reprocessar talhão')
      await fetchFields()
    } finally {
      setReprocessing(null)
    }
  }

  const clearFilters = () => {
    setStatusFilter('all')
    setLogisticsUnitFilter('all')
    setAssignmentTypeFilter('all')
  }

  const hasActiveFilters = statusFilter !== 'all' || logisticsUnitFilter !== 'all' || assignmentTypeFilter !== 'all'

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-black text-slate-900">
          Carteira de Monitoramento
        </h2>
        <Link href="/fields/new">
          <Button>
            <Plus size={18} className="mr-2" />
            Novo Talhão
          </Button>
        </Link>
      </div>

      {/* Filtros */}
      <div className="mb-6 flex flex-wrap items-center gap-4 bg-slate-50 p-4 rounded-lg border">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Filter size={16} />
          <span className="font-medium">Filtros:</span>
        </div>

        {/* Filtro de Status */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Status:</span>
          <div className="flex gap-1">
            {[
              { value: 'all', label: 'Todos', icon: null },
              { value: 'SUCCESS', label: 'Processado', icon: <CheckCircle size={12} className="text-green-500" /> },
              { value: 'PROCESSING', label: 'Processando', icon: <Loader2 size={12} className="animate-spin text-blue-500" /> },
              { value: 'PENDING', label: 'Pendente', icon: <Clock size={12} className="text-slate-400" /> },
              { value: 'ERROR', label: 'Erro', icon: <AlertCircle size={12} className="text-red-500" /> },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                  statusFilter === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border text-slate-600 hover:bg-slate-100'
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filtro de Caixa Logística */}
        {logisticsUnits.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              <Warehouse size={12} className="inline mr-1" />
              Caixa:
            </span>
            <select
              value={logisticsUnitFilter}
              onChange={(e) => setLogisticsUnitFilter(e.target.value)}
              className="px-2 py-1 rounded border text-xs bg-white"
            >
              <option value="all">Todas</option>
              <option value="none">Sem atribuição</option>
              {logisticsUnits.map(unit => (
                <option key={unit.id} value={unit.id}>{unit.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Filtro de Tipo de Atribuição */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Tipo:</span>
          <div className="flex gap-1">
            {[
              { value: 'all', label: 'Todos', color: 'bg-white border text-slate-600' },
              { value: 'manual', label: 'Manual', color: 'bg-blue-100 text-blue-700' },
              { value: 'producer', label: 'Produtor', color: 'bg-purple-100 text-purple-700' },
              { value: 'auto', label: 'Auto', color: 'bg-green-100 text-green-700' },
              { value: 'none', label: 'Sem', color: 'bg-red-100 text-red-700' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setAssignmentTypeFilter(opt.value)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  assignmentTypeFilter === opt.value
                    ? 'ring-2 ring-offset-1 ring-slate-400 ' + opt.color
                    : opt.color + ' hover:opacity-80'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Limpar filtros */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-700"
          >
            <X size={12} />
            Limpar filtros
          </button>
        )}

        {/* Contador */}
        <div className="ml-auto text-xs text-slate-500">
          {filteredFields.length} de {fields.length} talhões
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-slate-400" />
        </div>
      ) : (
        <FieldTable
          fields={filteredFields}
          onDelete={handleDelete}
          onReprocess={handleReprocess}
          isDeleting={deleting}
          isReprocessing={reprocessing}
        />
      )}
    </div>
  )
}
