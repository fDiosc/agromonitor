'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  Plus,
  Loader2,
  Search,
  Pencil,
  Trash2,
  X,
  Map,
  AlertCircle
} from 'lucide-react'

interface Producer {
  id: string
  name: string
  cpf: string | null
  createdAt: string
  _count: {
    fields: number
  }
}

function formatCPF(cpf: string | null): string {
  if (!cpf) return '-'
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

export default function ProducersPage() {
  const [producers, setProducers] = useState<Producer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingProducer, setEditingProducer] = useState<Producer | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formCpf, setFormCpf] = useState('')

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

  useEffect(() => {
    fetchProducers()
  }, [])

  const openCreateModal = () => {
    setEditingProducer(null)
    setFormName('')
    setFormCpf('')
    setShowModal(true)
  }

  const openEditModal = (producer: Producer) => {
    setEditingProducer(producer)
    setFormName(producer.name)
    setFormCpf(producer.cpf || '')
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

  // Filtrar produtores
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

      {/* Search */}
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

      {/* Producers List */}
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
            <Card key={producer.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                      <span className="text-xl font-bold text-emerald-600">
                        {producer.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{producer.name}</h3>
                      <p className="text-sm text-slate-500">
                        CPF: {formatCPF(producer.cpf)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Map size={14} />
                      {producer._count.fields} talhão(ões)
                    </Badge>

                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(producer)}
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(producer)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary */}
      {producers.length > 0 && (
        <div className="mt-6 text-sm text-slate-500">
          Total: {producers.length} produtor(es) • 
          {producers.reduce((sum, p) => sum + p._count.fields, 0)} talhão(ões) vinculado(s)
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold text-slate-900">
                {editingProducer ? 'Editar Produtor' : 'Novo Produtor'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nome *
                </label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Nome completo do produtor"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  CPF <span className="text-slate-400">(opcional)</span>
                </label>
                <Input
                  value={formCpf}
                  onChange={(e) => {
                    // Formatar enquanto digita
                    const value = e.target.value.replace(/\D/g, '').slice(0, 11)
                    if (value.length <= 3) {
                      setFormCpf(value)
                    } else if (value.length <= 6) {
                      setFormCpf(`${value.slice(0, 3)}.${value.slice(3)}`)
                    } else if (value.length <= 9) {
                      setFormCpf(`${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`)
                    } else {
                      setFormCpf(`${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`)
                    }
                  }}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 size={16} className="mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : editingProducer ? (
                    'Salvar'
                  ) : (
                    'Cadastrar'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
