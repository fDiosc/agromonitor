'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Pencil, UserCheck, Warehouse } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Producer {
  id: string
  name: string
}

interface LogisticsUnit {
  id: string
  name: string
}

interface FieldToEdit {
  id: string
  name: string
  producerId: string | null
  logisticsUnitId: string | null
}

interface EditFieldModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  field: FieldToEdit | null
  producers: Producer[]
  logisticsUnits: LogisticsUnit[]
}

export function EditFieldModal({
  isOpen,
  onClose,
  onSuccess,
  field,
  producers,
  logisticsUnits
}: EditFieldModalProps) {
  const [name, setName] = useState('')
  const [producerId, setProducerId] = useState<string>('')
  const [logisticsUnitId, setLogisticsUnitId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Atualizar form quando field mudar
  useEffect(() => {
    if (field) {
      setName(field.name)
      setProducerId(field.producerId || '')
      setLogisticsUnitId(field.logisticsUnitId || '')
      setError(null)
    }
  }, [field])

  if (!isOpen || !field) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      setError('Nome é obrigatório')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/fields/${field.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          producerId: producerId || null,
          logisticsUnitId: logisticsUnitId || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Falha ao salvar')
      }

      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    if (!saving) {
      onClose()
    }
  }

  // Verificar se houve alterações
  const hasChanges = 
    name !== field.name || 
    (producerId || null) !== field.producerId ||
    (logisticsUnitId || null) !== field.logisticsUnitId

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Pencil size={20} className="text-slate-500" />
            <h2 className="text-lg font-bold text-slate-900">Editar Talhão</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={saving}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nome do Talhão *
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do talhão"
              required
              disabled={saving}
            />
          </div>

          {/* Produtor */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              <span className="flex items-center gap-1">
                <UserCheck size={14} />
                Produtor Vinculado
              </span>
            </label>
            <select
              value={producerId}
              onChange={(e) => setProducerId(e.target.value)}
              disabled={saving}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="">Nenhum produtor vinculado</option>
              {producers.map(producer => (
                <option key={producer.id} value={producer.id}>
                  {producer.name}
                </option>
              ))}
            </select>
            {producerId !== (field.producerId || '') && (
              <p className="text-xs text-amber-600 mt-1">
                O talhão será migrado para outro produtor
              </p>
            )}
          </div>

          {/* Caixa Logística */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              <span className="flex items-center gap-1">
                <Warehouse size={14} />
                Caixa Logística
              </span>
            </label>
            <select
              value={logisticsUnitId}
              onChange={(e) => setLogisticsUnitId(e.target.value)}
              disabled={saving}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="">Automático (por raio ou produtor)</option>
              {logisticsUnits.map(unit => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleClose}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="flex-1" 
              disabled={saving || !hasChanges}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
