'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Plus, Loader2, RefreshCw, Trash2, MapPin, Leaf,
  CheckCircle, AlertCircle, Pencil
} from 'lucide-react'
import dynamic from 'next/dynamic'

// Lazy load map to avoid SSR issues
const SubFieldMap = dynamic(() => import('@/components/maps/SubFieldMap'), { 
  ssr: false,
  loading: () => <div className="h-[500px] bg-slate-100 rounded-xl animate-pulse flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
})

interface SubField {
  id: string
  name: string
  status: string
  cropType: string
  areaHa: number | null
  geometryJson: string
  agroData?: {
    areaHa: number | null
    confidenceScore: number | null
    eosDate: string | null
    sosDate: string | null
    cropPatternStatus: string | null
    phenologyHealth: string | null
    peakNdvi: number | null
  } | null
}

interface ParentField {
  id: string
  name: string
  geometryJson: string
  cropType: string
  seasonStartDate: string
}

export default function SubFieldsPage() {
  const params = useParams()
  const router = useRouter()
  const fieldId = params.id as string
  
  const [loading, setLoading] = useState(true)
  const [parentField, setParentField] = useState<ParentField | null>(null)
  const [subFields, setSubFields] = useState<SubField[]>([])
  const [selectedSubFieldId, setSelectedSubFieldId] = useState<string | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [reprocessing, setReprocessing] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editNameValue, setEditNameValue] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/fields/${fieldId}/subfields`)
      if (!res.ok) {
        if (res.status === 404) {
          setError('Talhão não encontrado')
          return
        }
        throw new Error('Falha ao carregar dados')
      }
      const data = await res.json()
      setParentField(data.parentField)
      setSubFields(data.subFields)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [fieldId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCreateSubField = async (geometryJson: string) => {
    try {
      setError(null)
      const res = await fetch(`/api/fields/${fieldId}/subfields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geometryJson })
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Erro ao criar subtalhão')
        return
      }

      const data = await res.json()
      setSubFields(prev => [...prev, data.subField])
      setIsDrawing(false)
      setSelectedSubFieldId(data.subField.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar subtalhão')
    }
  }

  const handleReprocess = async (subFieldId: string) => {
    if (!confirm('Reprocessar este subtalhão?')) return
    setReprocessing(subFieldId)

    try {
      await fetch(`/api/fields/${subFieldId}/process`, { method: 'POST' })
      // Atualizar status localmente
      setSubFields(prev => prev.map(sf => 
        sf.id === subFieldId ? { ...sf, status: 'PROCESSING' } : sf
      ))
    } catch (err) {
      console.error('Erro ao reprocessar:', err)
    } finally {
      setTimeout(() => setReprocessing(null), 3000)
    }
  }

  const handleDelete = async (subFieldId: string) => {
    if (!confirm('Excluir este subtalhão? Todos os dados serão perdidos.')) return
    setDeleting(subFieldId)

    try {
      await fetch(`/api/fields/${subFieldId}`, { method: 'DELETE' })
      setSubFields(prev => prev.filter(sf => sf.id !== subFieldId))
      if (selectedSubFieldId === subFieldId) setSelectedSubFieldId(null)
    } catch (err) {
      console.error('Erro ao excluir:', err)
    } finally {
      setDeleting(null)
    }
  }

  const handleRenameSave = async (subFieldId: string) => {
    if (!editNameValue.trim()) return
    try {
      await fetch(`/api/fields/${subFieldId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editNameValue.trim() })
      })
      setSubFields(prev => prev.map(sf => 
        sf.id === subFieldId ? { ...sf, name: editNameValue.trim() } : sf
      ))
    } catch (err) {
      console.error('Erro ao renomear:', err)
    } finally {
      setEditingName(null)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (error && !parentField) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-red-800">{error}</h3>
          <Button variant="outline" className="mt-4" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button 
            onClick={() => router.back()} 
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2"
          >
            <ArrowLeft size={14} />
            Voltar ao Dashboard
          </button>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <MapPin className="w-6 h-6 text-emerald-500" />
            Subtalhões de {parentField?.name}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Desenhe polígonos dentro do talhão pai para criar subtalhões individuais
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={isDrawing ? 'destructive' : 'default'}
            onClick={() => setIsDrawing(!isDrawing)}
          >
            {isDrawing ? (
              <>Cancelar Desenho</>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Novo Subtalhão
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Fechar</button>
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Map */}
        <div className="col-span-8">
          <Card>
            <CardContent className="p-0 overflow-hidden rounded-xl">
              {parentField && (
                <SubFieldMap
                  parentGeometry={parentField.geometryJson}
                  subFields={subFields.map(sf => ({
                    id: sf.id,
                    name: sf.name,
                    geometryJson: sf.geometryJson,
                  }))}
                  selectedId={selectedSubFieldId}
                  onSelect={setSelectedSubFieldId}
                  isDrawing={isDrawing}
                  onDrawComplete={handleCreateSubField}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Lista de subtalhões */}
        <div className="col-span-4 space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Subtalhões ({subFields.length})</span>
                <Badge variant="outline" className="text-xs">
                  {parentField?.cropType}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {subFields.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-400">
                  <MapPin className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  Nenhum subtalhão criado. Clique em &quot;Novo Subtalhão&quot; e desenhe no mapa.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                  {subFields.map(sf => {
                    const isSelected = selectedSubFieldId === sf.id
                    const statusColor = sf.status === 'SUCCESS' ? 'text-emerald-600' 
                      : sf.status === 'PROCESSING' ? 'text-blue-600' 
                      : sf.status === 'ERROR' ? 'text-red-600' 
                      : 'text-slate-400'

                    return (
                      <div
                        key={sf.id}
                        className={`px-4 py-3 cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50 border-l-2 border-blue-500' : 'hover:bg-slate-50'
                        }`}
                        onClick={() => setSelectedSubFieldId(sf.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            {editingName === sf.id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  value={editNameValue}
                                  onChange={e => setEditNameValue(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleRenameSave(sf.id)
                                    if (e.key === 'Escape') setEditingName(null)
                                  }}
                                  className="text-sm font-medium border rounded px-1 py-0.5 w-full"
                                  autoFocus
                                />
                                <button onClick={() => handleRenameSave(sf.id)} className="text-emerald-600">
                                  <CheckCircle size={14} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <span className="text-sm font-medium text-slate-800 truncate">{sf.name}</span>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setEditingName(sf.id); setEditNameValue(sf.name) }}
                                  className="text-slate-300 hover:text-slate-500"
                                >
                                  <Pencil size={10} />
                                </button>
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[10px] font-semibold ${statusColor}`}>
                                {sf.status === 'SUCCESS' ? 'Processado' : sf.status === 'PROCESSING' ? 'Processando' : sf.status === 'ERROR' ? 'Erro' : 'Pendente'}
                              </span>
                              {sf.areaHa && <span className="text-[10px] text-slate-400">{sf.areaHa.toFixed(1)} ha</span>}
                              <span className="text-[10px] text-slate-400 uppercase">{sf.cropType}</span>
                            </div>
                            {sf.agroData?.confidenceScore != null && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                Confiança: {sf.agroData.confidenceScore}% | 
                                EOS: {sf.agroData.eosDate ? new Date(sf.agroData.eosDate).toLocaleDateString('pt-BR') : '—'}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5 ml-2">
                            <Button variant="ghost" size="icon" className="h-7 w-7" 
                              onClick={(e) => { e.stopPropagation(); handleReprocess(sf.id) }}
                              disabled={reprocessing === sf.id || sf.status === 'PROCESSING'}
                              title="Reprocessar">
                              {reprocessing === sf.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" 
                              onClick={(e) => { e.stopPropagation(); handleDelete(sf.id) }}
                              disabled={deleting === sf.id}
                              title="Excluir">
                              {deleting === sf.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
