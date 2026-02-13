'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { EditFieldModal } from '@/components/modals/EditFieldModal'
import { ProducerCard } from '@/components/producers/ProducerCard'
import { ProducerFormModal } from '@/components/producers/ProducerFormModal'
import Link from 'next/link'
import {
  Users,
  Plus,
  Loader2,
  Search,
  AlertCircle,
  X,
} from 'lucide-react'

interface LogisticsUnit {
  id: string
  name: string
}

interface Field {
  id: string
  name: string
  city: string | null
  state: string | null
  areaHa: number | null
  status: string
  producer?: { id: string; name: string } | null
  logisticsUnit?: { id: string; name: string } | null
  agroData?: {
    volumeEstimatedKg: number | null
    eosDate: string | null
  } | null
}

interface Producer {
  id: string
  name: string
  cpf: string | null
  createdAt: string
  defaultLogisticsUnitId: string | null
  defaultLogisticsUnit: LogisticsUnit | null
  _count: {
    fields: number
  }
}

export default function ProducersPage() {
  const [producers, setProducers] = useState<Producer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editingProducer, setEditingProducer] = useState<Producer | null>(null)
  const [saving, setSaving] = useState(false)

  const [formName, setFormName] = useState('')
  const [formCpf, setFormCpf] = useState('')
  const [formLogisticsUnitId, setFormLogisticsUnitId] = useState('')

  const [logisticsUnits, setLogisticsUnits] = useState<LogisticsUnit[]>([])

  const [expandedProducerId, setExpandedProducerId] = useState<string | null>(null)
  const [producerFields, setProducerFields] = useState<Field[]>([])
  const [loadingFields, setLoadingFields] = useState(false)

  const [showEditFieldModal, setShowEditFieldModal] = useState(false)
  const [editingField, setEditingField] = useState<Field | null>(null)

  const fetchProducers = async () => {
    try {
      const res = await fetch('/api/producers')
      if (!res.ok) throw new Error('Falha ao buscar produtores')
      const data = await res.json()
      setProducers(data.producers || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  const fetchLogisticsUnits = async () => {
    try {
      const res = await fetch('/api/logistics-units')
      if (res.ok) {
        const data = await res.json()
        setLogisticsUnits(data.logisticsUnits || [])
      }
    } catch (err) {
      console.error('Error fetching logistics units:', err)
    }
  }

  useEffect(() => {
    fetchProducers()
    fetchLogisticsUnits()
  }, [])

  const fetchProducerFields = useCallback(async (producerId: string) => {
    setLoadingFields(true)
    try {
      const res = await fetch(`/api/fields?producerId=${producerId}`)
      if (res.ok) {
        const data = await res.json()
        setProducerFields(data.fields || [])
      }
    } catch (err) {
      console.error('Error fetching producer fields:', err)
    } finally {
      setLoadingFields(false)
    }
  }, [])

  const toggleExpand = (producerId: string) => {
    if (expandedProducerId === producerId) {
      setExpandedProducerId(null)
      setProducerFields([])
    } else {
      setExpandedProducerId(producerId)
      fetchProducerFields(producerId)
    }
  }

  const openEditFieldModal = (field: Field) => {
    setEditingField(field)
    setShowEditFieldModal(true)
  }

  const handleEditFieldSuccess = () => {
    if (expandedProducerId) {
      fetchProducerFields(expandedProducerId)
    }
    fetchProducers()
  }

  const openCreateModal = () => {
    setEditingProducer(null)
    setFormName('')
    setFormCpf('')
    setFormLogisticsUnitId('')
    setShowModal(true)
  }

  const openEditModal = (producer: Producer) => {
    setEditingProducer(producer)
    setFormName(producer.name)
    setFormCpf(producer.cpf || '')
    setFormLogisticsUnitId(producer.defaultLogisticsUnitId || '')
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const url = editingProducer
        ? `/api/producers/${editingProducer.id}`
        : '/api/producers'

      const method = editingProducer ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          cpf: formCpf || null,
          defaultLogisticsUnitId: formLogisticsUnitId || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Falha ao salvar')
      }

      setShowModal(false)
      await fetchProducers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (producer: Producer) => {
    if (!confirm(`Tem certeza que deseja excluir o produtor "${producer.name}"?`)) {
      return
    }

    try {
      const res = await fetch(`/api/producers/${producer.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Falha ao excluir')
      }

      await fetchProducers()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir')
    }
  }

  const filteredProducers = producers.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.cpf && p.cpf.includes(search.replace(/\D/g, '')))
  )

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Users className="w-8 h-8 text-emerald-600" />
            Produtores
          </h1>
          <p className="text-slate-500 mt-1">
            Gerencie os produtores vinculados aos talhões
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus size={18} className="mr-2" />
          Novo Produtor
        </Button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle size={18} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou CPF..."
            className="pl-10"
          />
        </div>
      </div>

      {filteredProducers.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-700 mb-2">
              {search ? 'Nenhum produtor encontrado' : 'Nenhum produtor cadastrado'}
            </h3>
            <p className="text-slate-500 mb-4">
              {search
                ? 'Tente buscar por outro termo'
                : 'Cadastre produtores para vincular aos talhões'
              }
            </p>
            {!search && (
              <Button onClick={openCreateModal}>
                <Plus size={18} className="mr-2" />
                Cadastrar Primeiro Produtor
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredProducers.map((producer) => (
            <ProducerCard
              key={producer.id}
              producer={producer}
              isExpanded={expandedProducerId === producer.id}
              producerFields={producerFields}
              loadingFields={loadingFields}
              onToggleExpand={() => toggleExpand(producer.id)}
              onEdit={openEditModal}
              onDelete={handleDelete}
              onEditField={openEditFieldModal}
            />
          ))}
        </div>
      )}

      {producers.length > 0 && (
        <div className="mt-6 text-sm text-slate-500">
          Total: {producers.length} produtor(es) •
          {producers.reduce((sum, p) => sum + p._count.fields, 0)} talhão(ões) vinculado(s)
        </div>
      )}

      <ProducerFormModal
        isOpen={showModal}
        editingProducer={editingProducer}
        formName={formName}
        formCpf={formCpf}
        formLogisticsUnitId={formLogisticsUnitId}
        logisticsUnits={logisticsUnits}
        saving={saving}
        onClose={() => setShowModal(false)}
        onNameChange={setFormName}
        onCpfChange={setFormCpf}
        onLogisticsUnitIdChange={setFormLogisticsUnitId}
        onSubmit={handleSubmit}
      />

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
          producerId: editingField.producer?.id || null,
          logisticsUnitId: editingField.logisticsUnit?.id || null
        } : null}
        producers={producers.map(p => ({ id: p.id, name: p.name }))}
        logisticsUnits={logisticsUnits}
      />
    </div>
  )
}
