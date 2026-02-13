'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EditFieldModal } from '@/components/modals/EditFieldModal'
import { FieldsStatsCards } from '@/components/fields/FieldsStatsCards'
import { FieldsCoverageRow } from '@/components/fields/FieldsCoverageRow'
import { FieldsSearchFilters } from '@/components/fields/FieldsSearchFilters'
import { Loader2, Map as MapIcon, CheckCircle, RefreshCw } from 'lucide-react'

interface LogisticsUnit {
  id: string
  name: string
}

interface Producer {
  id: string
  name: string
}

interface FieldWithIntersection {
  id: string
  name: string
  city: string | null
  state: string | null
  areaHa: number | null
  cropType: string | null
  producerId: string | null
  producerName: string | null
  parentFieldId: string | null
  subFieldCount: number
  logisticsUnit: LogisticsUnit | null
  producerLogisticsUnit: LogisticsUnit | null
  coveringUnits: {
    id: string
    name: string
    distanceKm: number
  }[]
  assignmentType: 'direct' | 'inherited' | 'automatic' | 'none'
  hasIntersection: boolean
}

export default function ManageFieldsPage() {
  const [loading, setLoading] = useState(true)
  const [fields, setFields] = useState<FieldWithIntersection[]>([])
  const [logisticsUnits, setLogisticsUnits] = useState<LogisticsUnit[]>([])
  const [producers, setProducers] = useState<Producer[]>([])
  const [saving, setSaving] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<'all' | 'intersection' | 'noAssignment' | 'direct'>('intersection')
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null)

  // Search & filters
  const [searchQuery, setSearchQuery] = useState('')
  const [cropFilter, setCropFilter] = useState<string>('all')
  const [producerFilter, setProducerFilter] = useState<string>('all')

  // Feature flags
  const [enableSubFields, setEnableSubFields] = useState(false)

  // Edit Field Modal state
  const [showEditFieldModal, setShowEditFieldModal] = useState(false)
  const [editingField, setEditingField] = useState<FieldWithIntersection | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [coverageRes, unitsRes, producersRes, settingsRes] = await Promise.all([
        fetch('/api/logistics-units/coverage'),
        fetch('/api/logistics-units'),
        fetch('/api/producers'),
        fetch('/api/workspace/settings')
      ])

      // Feature flags
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json()
        setEnableSubFields(settingsData.featureFlags?.enableSubFields === true)
      }

      if (coverageRes.ok && unitsRes.ok) {
        const coverageData = await coverageRes.json()
        const unitsData = await unitsRes.json()

        // Mapear os dados de cobertura para o formato esperado
        const mappedFields: FieldWithIntersection[] = coverageData.fields.map((f: {
          fieldId: string
          fieldName: string
          city: string | null
          state: string | null
          areaHa: number | null
          cropType: string | null
          producerId: string | null
          producerName: string | null
          parentFieldId: string | null
          subFieldCount: number
          assignedUnitId: string | null
          assignedUnitName: string | null
          assignmentType: 'direct' | 'inherited' | 'automatic' | 'none'
          coveringUnits: { id: string; name: string; distance: number }[]
          hasIntersection: boolean
        }) => ({
          id: f.fieldId,
          name: f.fieldName,
          city: f.city,
          state: f.state,
          areaHa: f.areaHa,
          cropType: f.cropType || null,
          producerId: f.producerId || null,
          producerName: f.producerName,
          parentFieldId: f.parentFieldId || null,
          subFieldCount: f.subFieldCount || 0,
          logisticsUnit: f.assignmentType === 'direct' && f.assignedUnitId 
            ? { id: f.assignedUnitId, name: f.assignedUnitName || '' }
            : null,
          producerLogisticsUnit: f.assignmentType === 'inherited' && f.assignedUnitId 
            ? { id: f.assignedUnitId, name: f.assignedUnitName || '' }
            : null,
          coveringUnits: f.coveringUnits.map((u: { id: string; name: string; distance: number }) => ({
            id: u.id,
            name: u.name,
            distanceKm: u.distance
          })),
          assignmentType: f.assignmentType,
          hasIntersection: f.hasIntersection
        }))

        setFields(mappedFields)
        setLogisticsUnits(unitsData.logisticsUnits || [])
      }

      if (producersRes.ok) {
        const producersData = await producersRes.json()
        setProducers(producersData.producers?.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })) || [])
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const openEditFieldModal = (field: FieldWithIntersection) => {
    setEditingField(field)
    setShowEditFieldModal(true)
  }

  const handleEditFieldSuccess = () => {
    // Recarregar dados
    fetchData()
  }

  const handleAssignUnit = async (fieldId: string, unitId: string) => {
    setSaving(fieldId)
    try {
      const res = await fetch(`/api/fields/${fieldId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logisticsUnitId: unitId })
      })

      if (res.ok) {
        // Atualizar localmente
        setFields(prev => prev.map(f => {
          if (f.id === fieldId) {
            const unit = logisticsUnits.find(u => u.id === unitId)
            return {
              ...f,
              logisticsUnit: unit || null,
              assignmentType: 'direct' as const
            }
          }
          return f
        }))
        setExpandedFieldId(null)
      }
    } catch (error) {
      console.error('Erro ao atribuir caixa:', error)
    } finally {
      setSaving(null)
    }
  }

  // Unique crop types for filter dropdown
  const cropTypes = useMemo(() => {
    const types = new Set(fields.map(f => f.cropType).filter(Boolean))
    return Array.from(types) as string[]
  }, [fields])

  // Unique producers for filter dropdown
  const uniqueProducers = useMemo(() => {
    const prods = new Map<string, string>()
    fields.forEach(f => {
      if (f.producerId && f.producerName) prods.set(f.producerId, f.producerName)
    })
    return Array.from(prods.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [fields])

  // Filtrar campos baseado no filtro ativo + pesquisa + filtros extras
  const displayedFields = useMemo(() => {
    let result = fields

    // Status filter (cards)
    switch (activeFilter) {
      case 'intersection':
        result = result.filter(f => f.hasIntersection)
        break
      case 'noAssignment':
        result = result.filter(f => f.assignmentType === 'none')
        break
      case 'direct':
        result = result.filter(f => f.assignmentType === 'direct')
        break
      // 'all' shows everything
    }

    // Search filter (talhão name + producer name)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(f =>
        f.name.toLowerCase().includes(q) ||
        (f.producerName && f.producerName.toLowerCase().includes(q)) ||
        (f.city && f.city.toLowerCase().includes(q))
      )
    }

    // Crop type filter
    if (cropFilter !== 'all') {
      result = result.filter(f => f.cropType === cropFilter)
    }

    // Producer filter
    if (producerFilter !== 'all') {
      result = result.filter(f => f.producerId === producerFilter)
    }

    return result
  }, [fields, activeFilter, searchQuery, cropFilter, producerFilter])

  const hasActiveFilters = searchQuery.trim() !== '' || cropFilter !== 'all' || producerFilter !== 'all'

  const clearFilters = () => {
    setSearchQuery('')
    setCropFilter('all')
    setProducerFilter('all')
  }

  // Estatísticas
  const stats = {
    total: fields.length,
    withIntersection: fields.filter(f => f.hasIntersection).length,
    withoutAssignment: fields.filter(f => f.assignmentType === 'none').length,
    resolved: fields.filter(f => f.assignmentType === 'direct').length
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
          <MapIcon className="w-8 h-8 text-slate-600" />
          Gerenciar Talhões
        </h1>
        <p className="text-slate-500 mt-1">
          Atribua caixas logísticas aos talhões e resolva interseções
        </p>
      </div>

      <FieldsStatsCards stats={stats} activeFilter={activeFilter} onFilterChange={setActiveFilter} />

      <FieldsSearchFilters
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        cropFilter={cropFilter}
        onCropFilterChange={setCropFilter}
        producerFilter={producerFilter}
        onProducerFilterChange={setProducerFilter}
        cropTypes={cropTypes}
        uniqueProducers={uniqueProducers}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
      />

      {/* Controles */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-slate-600">
          Mostrando {displayedFields.length} de {fields.length} talhões
          {hasActiveFilters && <span className="text-blue-600 ml-1">(filtrado)</span>}
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Lista de Talhões */}
      {displayedFields.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              Tudo resolvido!
            </h3>
            <p className="text-slate-500">
              Não há talhões com interseções ou sem atribuição.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {activeFilter === 'all' ? 'Todos os Talhões' : 
               activeFilter === 'intersection' ? 'Talhões com Interseção' :
               activeFilter === 'noAssignment' ? 'Talhões sem Atribuição' :
               activeFilter === 'direct' ? 'Talhões com Atribuição Direta' :
               'Talhões'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Talhão</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Produtor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Cultura</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Área</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Caixa Atribuída</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedFields.map(field => (
                  <FieldsCoverageRow
                    key={field.id}
                    field={field}
                    logisticsUnits={logisticsUnits}
                    isExpanded={expandedFieldId === field.id}
                    saving={saving}
                    enableSubFields={enableSubFields}
                    onToggleExpand={() => setExpandedFieldId(expandedFieldId === field.id ? null : field.id)}
                    onAssignUnit={handleAssignUnit}
                    onEdit={openEditFieldModal}
                  />
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Edit Field Modal */}
      <EditFieldModal
        isOpen={showEditFieldModal}
        onClose={() => {
          setShowEditFieldModal(false)
          setEditingField(null)
        }}
        onSuccess={handleEditFieldSuccess}
        field={editingField ? {
          id: editingField.id,
          name: editingField.name,
          producerId: editingField.producerId,
          logisticsUnitId: editingField.logisticsUnit?.id || null
        } : null}
        producers={producers}
        logisticsUnits={logisticsUnits}
      />
    </div>
  )
}
