'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  Warehouse, 
  MapPin, 
  ArrowLeft,
  Pencil,
  Trash2,
  Loader2,
  Target,
  AlertTriangle,
  Check
} from 'lucide-react'
import Link from 'next/link'
import { LogisticsUnitModal } from './components/LogisticsUnitModal'
import { CoverageMap } from './components/CoverageMap'

interface LogisticsUnit {
  id: string
  name: string
  latitude: number | null
  longitude: number | null
  address: string | null
  city: string | null
  state: string | null
  coverageRadiusKm: number | null
  isActive: boolean
  _count: {
    producers: number
    fields: number
  }
}

interface CoverageData {
  fields: {
    fieldId: string
    fieldName: string
    latitude: number | null
    longitude: number | null
    city: string | null
    state: string | null
    areaHa: number | null
    producerName: string | null
    assignedUnitId: string | null
    assignedUnitName: string | null
    assignmentType: 'direct' | 'inherited' | 'automatic' | 'none'
    coveringUnits: { id: string; name: string; distance: number }[]
    hasIntersection: boolean
  }[]
  stats: {
    totalFields: number
    fieldsWithDirectAssignment: number
    fieldsWithInheritedAssignment: number
    fieldsWithAutomaticAssignment: number
    fieldsWithNoAssignment: number
    fieldsWithIntersection: number
    fieldsOutsideAllCoverage: number
  }
  logisticsUnits: {
    id: string
    name: string
    latitude: number | null
    longitude: number | null
    coverageRadiusKm: number | null
  }[]
}

export default function LogisticsUnitsPage() {
  const [units, setUnits] = useState<LogisticsUnit[]>([])
  const [coverage, setCoverage] = useState<CoverageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUnit, setEditingUnit] = useState<LogisticsUnit | null>(null)
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [unitsRes, coverageRes] = await Promise.all([
        fetch('/api/logistics-units?includeInactive=true'),
        fetch('/api/logistics-units/coverage')
      ])

      if (unitsRes.ok) {
        const data = await unitsRes.json()
        setUnits(data.logisticsUnits || [])
      }

      if (coverageRes.ok) {
        const data = await coverageRes.json()
        setCoverage(data)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCreate = () => {
    setEditingUnit(null)
    setModalOpen(true)
  }

  const handleEdit = (unit: LogisticsUnit) => {
    setEditingUnit(unit)
    setModalOpen(true)
  }

  const handleDelete = async (unit: LogisticsUnit) => {
    if (!confirm(`Deseja excluir/desativar "${unit.name}"?`)) return

    try {
      const res = await fetch(`/api/logistics-units/${unit.id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        fetchData()
      }
    } catch (error) {
      console.error('Error deleting unit:', error)
    }
  }

  const handleModalClose = (saved: boolean) => {
    setModalOpen(false)
    setEditingUnit(null)
    if (saved) {
      fetchData()
    }
  }

  const handleUnitClick = useCallback((unitId: string) => {
    setSelectedUnitId(prev => prev === unitId ? null : unitId)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/logistics">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Warehouse className="w-6 h-6 text-blue-500" />
                Caixas Logísticas
              </h1>
              <p className="text-slate-400 text-sm">
                Gerencie as unidades de recebimento e visualize a cobertura
              </p>
            </div>
          </div>
          <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Nova Caixa Logística
          </Button>
        </div>

        {/* Stats Cards */}
        {coverage && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-white">{units.filter(u => u.isActive).length}</div>
                <div className="text-slate-400 text-sm">Caixas Ativas</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-emerald-400">{coverage.stats.totalFields - coverage.stats.fieldsOutsideAllCoverage}</div>
                <div className="text-slate-400 text-sm">Talhões Cobertos</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-yellow-400">{coverage.stats.fieldsWithIntersection}</div>
                <div className="text-slate-400 text-sm">Com Interseção</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-red-400">{coverage.stats.fieldsOutsideAllCoverage}</div>
                <div className="text-slate-400 text-sm">Sem Cobertura</div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Mapa */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-400" />
                  Mapa de Cobertura
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CoverageMap 
                  units={coverage?.logisticsUnits || []}
                  fields={coverage?.fields || []}
                  selectedUnitId={selectedUnitId}
                  onUnitClick={handleUnitClick}
                />
                {/* Legenda */}
                <div className="flex flex-wrap gap-4 mt-4 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 flex items-center justify-center text-[9px] font-bold text-white bg-blue-500 rounded">M</span>
                    <span>Manual</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 flex items-center justify-center text-[9px] font-bold text-white bg-purple-500 rounded">P</span>
                    <span>Produtor</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 flex items-center justify-center text-[9px] font-bold text-white bg-green-500 rounded">A</span>
                    <span>Automático</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 flex items-center justify-center text-[9px] font-bold text-white bg-red-500 rounded">!</span>
                    <span>Sem Cobertura</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lista de Caixas */}
          <div className="space-y-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-lg">
                  Caixas Logísticas ({units.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {units.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Warehouse className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhuma caixa logística cadastrada</p>
                    <Button 
                      onClick={handleCreate} 
                      variant="outline" 
                      className="mt-4 border-slate-600"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Criar primeira caixa
                    </Button>
                  </div>
                ) : (
                  units.map(unit => (
                    <div
                      key={unit.id}
                      className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                        selectedUnitId === unit.id
                          ? 'bg-blue-500/20 border-blue-500'
                          : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'
                      } ${!unit.isActive ? 'opacity-50' : ''}`}
                      onClick={() => handleUnitClick(unit.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{unit.name}</span>
                            {!unit.isActive && (
                              <Badge variant="secondary" className="text-xs">Inativo</Badge>
                            )}
                          </div>
                          {(unit.city || unit.state) && (
                            <div className="flex items-center gap-1 text-sm text-slate-400 mt-1">
                              <MapPin className="w-3 h-3" />
                              {[unit.city, unit.state].filter(Boolean).join(', ')}
                            </div>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                            {unit.coverageRadiusKm && (
                              <span>Raio: {unit.coverageRadiusKm} km</span>
                            )}
                            <span>{unit._count.fields} talhões</span>
                            <span>{unit._count.producers} produtores</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEdit(unit)
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-slate-400 hover:text-red-400"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(unit)
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Talhões com problemas */}
            {coverage && coverage.stats.fieldsOutsideAllCoverage > 0 && (
              <Card className="bg-red-500/10 border-red-500/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-red-400 text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Talhões sem Cobertura
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {coverage.fields
                      .filter(f => f.coveringUnits.length === 0)
                      .slice(0, 10)
                      .map(field => (
                        <div key={field.fieldId} className="text-sm text-slate-300">
                          {field.fieldName}
                          {field.producerName && (
                            <span className="text-slate-500 ml-2">({field.producerName})</span>
                          )}
                        </div>
                      ))}
                    {coverage.stats.fieldsOutsideAllCoverage > 10 && (
                      <div className="text-xs text-slate-500">
                        +{coverage.stats.fieldsOutsideAllCoverage - 10} outros
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      <LogisticsUnitModal
        open={modalOpen}
        unit={editingUnit}
        onClose={handleModalClose}
      />
    </div>
  )
}
