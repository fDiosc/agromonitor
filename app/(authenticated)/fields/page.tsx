'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Loader2, 
  AlertOctagon, 
  Warehouse, 
  Map,
  Check,
  ChevronDown,
  RefreshCw,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'

interface LogisticsUnit {
  id: string
  name: string
}

interface FieldWithIntersection {
  id: string
  name: string
  city: string | null
  state: string | null
  areaHa: number | null
  producerName: string | null
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
  const [saving, setSaving] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<'all' | 'intersection' | 'noAssignment' | 'direct'>('intersection')
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [coverageRes, unitsRes] = await Promise.all([
        fetch('/api/logistics-units/coverage'),
        fetch('/api/logistics-units')
      ])

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
          producerName: string | null
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
          producerName: f.producerName,
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
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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

  // Filtrar campos baseado no filtro ativo
  const displayedFields = (() => {
    switch (activeFilter) {
      case 'all':
        return fields
      case 'intersection':
        return fields.filter(f => f.hasIntersection)
      case 'noAssignment':
        return fields.filter(f => f.assignmentType === 'none')
      case 'direct':
        return fields.filter(f => f.assignmentType === 'direct')
      default:
        return fields.filter(f => f.hasIntersection || f.assignmentType === 'none')
    }
  })()

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
          <Map className="w-8 h-8 text-slate-600" />
          Gerenciar Talhões
        </h1>
        <p className="text-slate-500 mt-1">
          Atribua caixas logísticas aos talhões e resolva interseções
        </p>
      </div>

      {/* Estatísticas - Cards clicáveis como filtros */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${activeFilter === 'all' ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
          onClick={() => setActiveFilter('all')}
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
          onClick={() => setActiveFilter('intersection')}
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
          onClick={() => setActiveFilter('noAssignment')}
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
          onClick={() => setActiveFilter('direct')}
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

      {/* Controles */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-slate-600">
          Mostrando {displayedFields.length} de {fields.length} talhões
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Área</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Caixa Atribuída</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedFields.map(field => {
                  const isExpanded = expandedFieldId === field.id
                  const currentUnit = field.logisticsUnit || field.producerLogisticsUnit || 
                    (field.coveringUnits.length > 0 ? { id: field.coveringUnits[0].id, name: field.coveringUnits[0].name } : null)

                  return (
                    <tr key={field.id} className={isExpanded ? 'bg-blue-50' : 'hover:bg-slate-50'}>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{field.name}</div>
                        <div className="text-xs text-slate-500">{field.city}, {field.state}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {field.producerName || '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {field.areaHa?.toLocaleString('pt-BR')} ha
                      </td>
                      <td className="px-6 py-4">
                        {field.hasIntersection ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-700">
                            <AlertOctagon className="w-3 h-3" />
                            {field.coveringUnits.length} caixas
                          </span>
                        ) : field.assignmentType === 'none' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
                            <AlertTriangle className="w-3 h-3" />
                            Sem cobertura
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                            <Check className="w-3 h-3" />
                            OK
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {currentUnit ? (
                          <div className="flex items-center gap-2">
                            <Warehouse className="w-4 h-4 text-amber-500" />
                            <span className="text-sm text-slate-700">{currentUnit.name}</span>
                            {field.assignmentType === 'direct' && (
                              <span className="text-[10px] px-1 rounded bg-blue-100 text-blue-600">Direto</span>
                            )}
                            {field.assignmentType === 'inherited' && (
                              <span className="text-[10px] px-1 rounded bg-purple-100 text-purple-600">Produtor</span>
                            )}
                            {field.assignmentType === 'automatic' && (
                              <span className="text-[10px] px-1 rounded bg-green-100 text-green-600">Auto</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="relative">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setExpandedFieldId(isExpanded ? null : field.id)}
                            disabled={saving === field.id}
                          >
                            {saving === field.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                Atribuir
                                <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </>
                            )}
                          </Button>
                          
                          {isExpanded && (
                            <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                              <div className="p-2 border-b border-slate-100">
                                <span className="text-xs text-slate-500">Selecione a caixa de destino</span>
                              </div>
                              <div className="max-h-48 overflow-y-auto">
                                {logisticsUnits.map(unit => {
                                  const covering = field.coveringUnits.find(u => u.id === unit.id)
                                  const isCurrentUnit = currentUnit?.id === unit.id
                                  return (
                                    <button
                                      key={unit.id}
                                      onClick={() => handleAssignUnit(field.id, unit.id)}
                                      className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-50 ${
                                        isCurrentUnit ? 'bg-blue-50' : ''
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <Warehouse className="w-4 h-4 text-amber-500" />
                                        <span className="text-sm">{unit.name}</span>
                                      </div>
                                      {covering && (
                                        <span className="text-xs text-slate-400">{covering.distanceKm} km</span>
                                      )}
                                      {isCurrentUnit && (
                                        <Check className="w-4 h-4 text-blue-500" />
                                      )}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
