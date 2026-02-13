'use client'

import { useState, useMemo, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { FieldTable } from '@/components/fields/field-table'
import type { Field } from '@/components/fields/field-table'
import { EditFieldModal } from '@/components/modals/EditFieldModal'
import { DashboardFilters } from '@/components/dashboard/DashboardFilters'
import { useDashboardFields } from '@/hooks/useDashboardFields'
import { Loader2, Plus } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

// Mapeamento de nomes de filtro -> chave curta na URL
const FILTER_KEYS = {
  status: 'status',
  unit: 'unit',
  assign: 'assign',
  crop: 'crop',
  ai: 'ai',
  agree: 'agree',
  conf: 'conf',
  harvest: 'harvest',
  q: 'q',
  sub: 'sub',
} as const

export default function DashboardPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [showEditModal, setShowEditModal] = useState(false)
  const [editingField, setEditingField] = useState<Field | null>(null)

  // Ler filtros da URL (fallback 'all' ou '' para busca)
  const statusFilter = searchParams.get(FILTER_KEYS.status) || 'all'
  const logisticsUnitFilter = searchParams.get(FILTER_KEYS.unit) || 'all'
  const assignmentTypeFilter = searchParams.get(FILTER_KEYS.assign) || 'all'
  const cropPatternFilter = searchParams.get(FILTER_KEYS.crop) || 'all'
  const aiFilter = searchParams.get(FILTER_KEYS.ai) || 'all'
  const aiAgreementFilter = searchParams.get(FILTER_KEYS.agree) || 'all'
  const confidenceFilter = searchParams.get(FILTER_KEYS.conf) || 'all'
  const harvestWindowFilter = searchParams.get(FILTER_KEYS.harvest) || 'all'
  const searchQuery = searchParams.get(FILTER_KEYS.q) || ''
  const subFieldFilter = searchParams.get(FILTER_KEYS.sub) || 'all'

  /** Atualiza um filtro na URL (remove param se valor == default) */
  const setFilter = useCallback((key: string, value: string, defaultVal = 'all') => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === defaultVal) {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    const qs = params.toString()
    router.replace(qs ? `/?${qs}` : '/', { scroll: false })
  }, [searchParams, router])

  // Setters individuais para cada filtro (interface compatível com DashboardFilters)
  const setStatusFilter = useCallback((v: string) => setFilter(FILTER_KEYS.status, v), [setFilter])
  const setLogisticsUnitFilter = useCallback((v: string) => setFilter(FILTER_KEYS.unit, v), [setFilter])
  const setAssignmentTypeFilter = useCallback((v: string) => setFilter(FILTER_KEYS.assign, v), [setFilter])
  const setCropPatternFilter = useCallback((v: string) => setFilter(FILTER_KEYS.crop, v), [setFilter])
  const setAiFilter = useCallback((v: string) => setFilter(FILTER_KEYS.ai, v), [setFilter])
  const setAiAgreementFilter = useCallback((v: string) => setFilter(FILTER_KEYS.agree, v), [setFilter])
  const setConfidenceFilter = useCallback((v: string) => setFilter(FILTER_KEYS.conf, v), [setFilter])
  const setHarvestWindowFilter = useCallback((v: string) => setFilter(FILTER_KEYS.harvest, v), [setFilter])
  const setSearchQuery = useCallback((v: string) => setFilter(FILTER_KEYS.q, v, ''), [setFilter])
  const setSubFieldFilter = useCallback((v: string) => setFilter(FILTER_KEYS.sub, v), [setFilter])

  const {
    fields,
    loading,
    deleting,
    reprocessing,
    producers,
    logisticsUnits,
    enableSubFields,
    fetchFields,
    handleDelete,
    handleReprocess,
  } = useDashboardFields()

  const handleEdit = (field: Field) => {
    setEditingField(field)
    setShowEditModal(true)
  }

  const handleEditSuccess = () => {
    fetchFields()
  }

  const filteredFields = useMemo(() => {
    const now = Date.now()
    const DAY = 86400000
    const query = searchQuery.trim().toLowerCase()

    return fields.filter(field => {
      if (query) {
        const nameMatch = field.name?.toLowerCase().includes(query)
        const producerMatch = field.producer?.name?.toLowerCase().includes(query)
        const cityMatch = field.city?.toLowerCase().includes(query)
        if (!nameMatch && !producerMatch && !cityMatch) return false
      }

      if (subFieldFilter !== 'all') {
        const hasSub = (field._count?.subFields ?? field.subFields?.length ?? 0) > 0
        if (subFieldFilter === 'yes' && !hasSub) return false
        if (subFieldFilter === 'no' && hasSub) return false
      }

      if (statusFilter !== 'all' && field.status !== statusFilter) return false

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

      if (cropPatternFilter !== 'all') {
        const cp = field.agroData?.cropPatternStatus
        if (cropPatternFilter === 'problem' && (cp === 'TYPICAL' || !cp)) return false
        if (cropPatternFilter === 'NO_CROP' && cp !== 'NO_CROP') return false
        if (cropPatternFilter === 'ANOMALOUS' && cp !== 'ANOMALOUS') return false
        if (cropPatternFilter === 'ATYPICAL' && cp !== 'ATYPICAL') return false
        if (cropPatternFilter === 'TYPICAL' && cp !== 'TYPICAL') return false
      }

      const hasAi = !!field.agroData?.aiValidationAgreement
      if (aiFilter === 'with_ai' && !hasAi) return false
      if (aiFilter === 'without_ai' && hasAi) return false

      if (aiAgreementFilter !== 'all') {
        if (field.agroData?.aiValidationAgreement !== aiAgreementFilter) return false
      }

      if (confidenceFilter !== 'all') {
        const cs = field.agroData?.confidenceScore
        if (confidenceFilter === 'high' && (cs == null || cs < 75)) return false
        if (confidenceFilter === 'medium' && (cs == null || cs < 40 || cs >= 75)) return false
        if (confidenceFilter === 'low' && (cs == null || cs >= 40)) return false
        if (confidenceFilter === 'none' && cs != null) return false
      }

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

  const clearFilters = useCallback(() => {
    router.replace('/', { scroll: false })
  }, [router])

  const hasActiveFilters = searchParams.toString() !== ''

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

      <DashboardFilters
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        subFieldFilter={subFieldFilter}
        onSubFieldFilterChange={setSubFieldFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        assignmentTypeFilter={assignmentTypeFilter}
        onAssignmentTypeFilterChange={setAssignmentTypeFilter}
        logisticsUnitFilter={logisticsUnitFilter}
        onLogisticsUnitFilterChange={setLogisticsUnitFilter}
        harvestWindowFilter={harvestWindowFilter}
        onHarvestWindowFilterChange={setHarvestWindowFilter}
        confidenceFilter={confidenceFilter}
        onConfidenceFilterChange={setConfidenceFilter}
        cropPatternFilter={cropPatternFilter}
        onCropPatternFilterChange={setCropPatternFilter}
        aiFilter={aiFilter}
        onAiFilterChange={setAiFilter}
        aiAgreementFilter={aiAgreementFilter}
        onAiAgreementFilterChange={setAiAgreementFilter}
        logisticsUnits={logisticsUnits}
        enableSubFields={enableSubFields}
        filteredCount={filteredFields.length}
        totalCount={fields.length}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
      />

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
        isSubField={!!editingField?.parentFieldId}
      />
    </div>
  )
}
