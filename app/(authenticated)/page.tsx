'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { FieldTable } from '@/components/fields/field-table'
import type { Field } from '@/components/fields/field-table'
import { EditFieldModal } from '@/components/modals/EditFieldModal'
import { Loader2, Plus, Filter, X, Warehouse, CheckCircle, Clock, AlertCircle, BrainCircuit, Target, CalendarCheck, Search, SquareSplitVertical } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface LogisticsUnit {
  id: string
  name: string
}

interface Producer {
  id: string
  name: string
}

export default function DashboardPage() {
  const [fields, setFields] = useState<Field[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [reprocessing, setReprocessing] = useState<string | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingField, setEditingField] = useState<Field | null>(null)
  const [producers, setProducers] = useState<Producer[]>([])
  
  // Feature flags
  const [enableSubFields, setEnableSubFields] = useState(false)

  // Filtros
  const [logisticsUnits, setLogisticsUnits] = useState<LogisticsUnit[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [logisticsUnitFilter, setLogisticsUnitFilter] = useState<string>('all')
  const [assignmentTypeFilter, setAssignmentTypeFilter] = useState<string>('all')
  const [cropPatternFilter, setCropPatternFilter] = useState<string>('all')
  const [aiFilter, setAiFilter] = useState<string>('all')
  const [aiAgreementFilter, setAiAgreementFilter] = useState<string>('all')
  const [confidenceFilter, setConfidenceFilter] = useState<string>('all')
  const [harvestWindowFilter, setHarvestWindowFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [subFieldFilter, setSubFieldFilter] = useState<string>('all')

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

  const fetchProducers = useCallback(async () => {
    try {
      const res = await fetch('/api/producers')
      if (res.ok) {
        const data = await res.json()
        setProducers(data.producers?.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })) || [])
      }
    } catch (error) {
      console.error('Error fetching producers:', error)
    }
  }, [])

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/workspace/settings')
      if (res.ok) {
        const data = await res.json()
        setEnableSubFields(data.featureFlags?.enableSubFields === true)
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    }
  }, [])

  useEffect(() => {
    fetchFields()
    fetchLogisticsUnits()
    fetchProducers()
    fetchSettings()
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Executar apenas uma vez na montagem

  const handleEdit = (field: Field) => {
    setEditingField(field)
    setShowEditModal(true)
  }

  const handleEditSuccess = () => {
    fetchFields()
  }

  // Filtrar campos
  const filteredFields = useMemo(() => {
    const now = Date.now()
    const DAY = 86400000

    const query = searchQuery.trim().toLowerCase()

    return fields.filter(field => {
      // Filtro de pesquisa por nome do talhão, produtor ou cidade
      if (query) {
        const nameMatch = field.name?.toLowerCase().includes(query)
        const producerMatch = field.producer?.name?.toLowerCase().includes(query)
        const cityMatch = field.city?.toLowerCase().includes(query)
        if (!nameMatch && !producerMatch && !cityMatch) return false
      }

      // Filtro de subtalhões
      if (subFieldFilter !== 'all') {
        const hasSub = (field._count?.subFields ?? field.subFields?.length ?? 0) > 0
        if (subFieldFilter === 'yes' && !hasSub) return false
        if (subFieldFilter === 'no' && hasSub) return false
      }

      // Filtro de status
      if (statusFilter !== 'all' && field.status !== statusFilter) return false

      // ── Logistics filters ──
      const directUnit = field.logisticsUnit?.id
      const inheritedUnit = field.producer?.defaultLogisticsUnit?.id
      const coveringUnits = field.logisticsDistances?.map(d => d.logisticsUnit.id) || []

      if (assignmentTypeFilter !== 'all') {
        if (assignmentTypeFilter === 'manual' && !directUnit) return false
        if (assignmentTypeFilter === 'producer' && (directUnit || !inheritedUnit)) return false
        if (assignmentTypeFilter === 'auto' && (directUnit || inheritedUnit || coveringUnits.length === 0)) return false
        if (assignmentTypeFilter === 'none' && (directUnit || inheritedUnit || coveringUnits.length > 0)) return false
      }

      if (logisticsUnitFilter !== 'all') {
        if (logisticsUnitFilter === 'none') {
          if (directUnit || inheritedUnit || coveringUnits.length > 0) return false
        } else {
          if (directUnit !== logisticsUnitFilter && inheritedUnit !== logisticsUnitFilter && !coveringUnits.includes(logisticsUnitFilter)) return false
        }
      }

      // ── Crop pattern filter ──
      if (cropPatternFilter !== 'all') {
        const cp = field.agroData?.cropPatternStatus
        if (cropPatternFilter === 'problem' && (cp === 'TYPICAL' || !cp)) return false
        if (cropPatternFilter === 'NO_CROP' && cp !== 'NO_CROP') return false
        if (cropPatternFilter === 'ANOMALOUS' && cp !== 'ANOMALOUS') return false
        if (cropPatternFilter === 'ATYPICAL' && cp !== 'ATYPICAL') return false
        if (cropPatternFilter === 'TYPICAL' && cp !== 'TYPICAL') return false
      }

      // ── AI filters ──
      const hasAi = !!field.agroData?.aiValidationAgreement
      if (aiFilter === 'with_ai' && !hasAi) return false
      if (aiFilter === 'without_ai' && hasAi) return false

      if (aiAgreementFilter !== 'all') {
        if (field.agroData?.aiValidationAgreement !== aiAgreementFilter) return false
      }

      // ── Confidence filter ──
      if (confidenceFilter !== 'all') {
        const cs = field.agroData?.confidenceScore
        if (confidenceFilter === 'high' && (cs == null || cs < 75)) return false
        if (confidenceFilter === 'medium' && (cs == null || cs < 40 || cs >= 75)) return false
        if (confidenceFilter === 'low' && (cs == null || cs >= 40)) return false
        if (confidenceFilter === 'none' && cs != null) return false
      }

      // ── Harvest window filter ──
      if (harvestWindowFilter !== 'all') {
        const eosStr = field.agroData?.fusedEosDate || field.agroData?.eosDate
        if (!eosStr) {
          if (harvestWindowFilter !== 'no_data') return false
        } else {
          const eosMs = new Date(eosStr).getTime()
          const diff = eosMs - now
          if (harvestWindowFilter === 'past' && diff >= 0) return false
          if (harvestWindowFilter === 'next30' && (diff < 0 || diff > 30 * DAY)) return false
          if (harvestWindowFilter === 'next60' && (diff < 0 || diff > 60 * DAY)) return false
          if (harvestWindowFilter === 'next90' && (diff < 0 || diff > 90 * DAY)) return false
          if (harvestWindowFilter === 'no_data') return false
        }
      }

      return true
    })
  }, [fields, searchQuery, subFieldFilter, statusFilter, logisticsUnitFilter, assignmentTypeFilter, cropPatternFilter, aiFilter, aiAgreementFilter, confidenceFilter, harvestWindowFilter])

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este talhão?')) return

    setDeleting(id)
    try {
      await fetch(`/api/fields/${id}`, { method: 'DELETE' })
      // Remove from top-level or from subFields inside parents
      setFields(prev => prev
        .filter(f => f.id !== id)
        .map(f => f.subFields ? {
          ...f,
          subFields: f.subFields.filter(sf => sf.id !== id),
          _count: f._count ? { subFields: Math.max(0, (f._count.subFields || 0) - (f.subFields.some(sf => sf.id === id) ? 1 : 0)) } : f._count
        } : f)
      )
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
    
    // Atualizar status para PROCESSING localmente (parent or sub-field)
    setFields(prev => prev.map(f => {
      if (f.id === id) return { ...f, status: 'PROCESSING' }
      if (f.subFields?.some(sf => sf.id === id)) {
        return { ...f, subFields: f.subFields.map(sf => sf.id === id ? { ...sf, status: 'PROCESSING' } : sf) }
      }
      return f
    }))

    // Iniciar processamento (fire and forget)
    fetch(`/api/fields/${id}/process`, { method: 'POST' })
      .catch(err => console.log('Process request sent:', err.message))

    // O polling automático em fetchFields vai atualizar o status
    // Limpar reprocessing state após um tempo para desbloquear botão
    setTimeout(() => {
      setReprocessing(null)
    }, 3000)
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSubFieldFilter('all')
    setStatusFilter('all')
    setLogisticsUnitFilter('all')
    setAssignmentTypeFilter('all')
    setCropPatternFilter('all')
    setAiFilter('all')
    setAiAgreementFilter('all')
    setConfidenceFilter('all')
    setHarvestWindowFilter('all')
  }

  const hasActiveFilters = searchQuery.trim() !== '' || subFieldFilter !== 'all'
    || statusFilter !== 'all' || logisticsUnitFilter !== 'all' || assignmentTypeFilter !== 'all'
    || cropPatternFilter !== 'all' || aiFilter !== 'all' || aiAgreementFilter !== 'all' || confidenceFilter !== 'all' || harvestWindowFilter !== 'all'

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
      <div className="mb-6 bg-slate-50 rounded-xl border divide-y divide-slate-200">
        {/* Row 0: Search + Sub-fields */}
        <div className="flex flex-wrap items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Filter size={16} />
            <span className="font-semibold">Filtros</span>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-[320px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquisar talhão, produtor ou cidade..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Sub-fields filter */}
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
                  <button key={opt.value} onClick={() => setSubFieldFilter(opt.value)}
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

          {/* Status */}
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
                <button key={opt.value} onClick={() => setStatusFilter(opt.value)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    statusFilter === opt.value ? 'bg-blue-600 text-white' : 'bg-white border text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {opt.icon}{opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tipo atribuição */}
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
                <button key={opt.value} onClick={() => setAssignmentTypeFilter(opt.value)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    assignmentTypeFilter === opt.value ? 'ring-2 ring-offset-1 ring-slate-400 ' + opt.color : opt.color + ' hover:opacity-80'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Caixa logística */}
          {logisticsUnits.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <Warehouse size={10} className="inline mr-0.5" />Caixa:
              </span>
              <select value={logisticsUnitFilter} onChange={e => setLogisticsUnitFilter(e.target.value)}
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
          {/* Janela de colheita */}
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
                <button key={opt.value} onClick={() => setHarvestWindowFilter(opt.value)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    harvestWindowFilter === opt.value ? 'bg-blue-600 text-white' : 'bg-white border text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Confiança modelo */}
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
                <button key={opt.value} onClick={() => setConfidenceFilter(opt.value)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    confidenceFilter === opt.value ? 'bg-blue-600 text-white' : 'bg-white border text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cultura */}
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
                <button key={opt.value} onClick={() => setCropPatternFilter(opt.value)}
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

          {/* Validação IA */}
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
                <button key={opt.value} onClick={() => setAiFilter(opt.value)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    aiFilter === opt.value ? 'bg-violet-600 text-white' : 'bg-white border text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* IA Agreement */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Resultado IA:</span>
            <div className="flex gap-1">
              {[
                { value: 'all', label: 'Todos', cls: 'bg-white border text-slate-600' },
                { value: 'CONFIRMED', label: 'Confirmado', cls: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                { value: 'QUESTIONED', label: 'Questionado', cls: 'bg-amber-50 border-amber-200 text-amber-700' },
                { value: 'REJECTED', label: 'Rejeitado', cls: 'bg-red-50 border-red-200 text-red-700' },
              ].map(opt => (
                <button key={opt.value} onClick={() => setAiAgreementFilter(opt.value)}
                  className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                    aiAgreementFilter === opt.value ? 'ring-2 ring-offset-1 ring-slate-400 ' + opt.cls : opt.cls + ' hover:opacity-80'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Limpar + Contador */}
          <div className="ml-auto flex items-center gap-3">
            {hasActiveFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 px-2 py-1 text-[11px] text-slate-500 hover:text-slate-700 font-medium">
                <X size={12} />Limpar
              </button>
            )}
            <span className="text-[11px] text-slate-500 font-medium">
              {filteredFields.length} de {fields.length} talhões
            </span>
          </div>
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
          onEdit={handleEdit}
          enableSubFields={enableSubFields}
          isDeleting={deleting}
          isReprocessing={reprocessing}
        />
      )}

      {/* Edit Field Modal */}
      <EditFieldModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setEditingField(null)
        }}
        onSuccess={handleEditSuccess}
        field={editingField ? {
          id: editingField.id,
          name: editingField.name,
          producerId: editingField.producer?.id || null,
          logisticsUnitId: editingField.logisticsUnit?.id || null,
          plantingDateInput: editingField.plantingDateInput,
          cropType: editingField.cropType,
          seasonStartDate: editingField.seasonStartDate,
          detectedPlantingDate: editingField.agroData?.detectedPlantingDate,
          detectedCropType: editingField.agroData?.detectedCropType,
          detectedConfidence: editingField.agroData?.detectedConfidence,
          editHistory: editingField.editHistory,
        } : null}
        producers={producers}
        logisticsUnits={logisticsUnits}
      />
    </div>
  )
}
