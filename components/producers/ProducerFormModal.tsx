'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Warehouse, X } from 'lucide-react'
import { Loader2 } from 'lucide-react'

interface LogisticsUnit {
  id: string
  name: string
}

interface Producer {
  id: string
  name: string
  cpf: string | null
  defaultLogisticsUnitId: string | null
}

interface ProducerFormModalProps {
  isOpen: boolean
  editingProducer: Producer | null
  formName: string
  formCpf: string
  formLogisticsUnitId: string
  logisticsUnits: LogisticsUnit[]
  saving: boolean
  onClose: () => void
  onNameChange: (v: string) => void
  onCpfChange: (v: string) => void
  onLogisticsUnitIdChange: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
}

export function ProducerFormModal({
  isOpen,
  editingProducer,
  formName,
  formCpf,
  formLogisticsUnitId,
  logisticsUnits,
  saving,
  onClose,
  onNameChange,
  onCpfChange,
  onLogisticsUnitIdChange,
  onSubmit,
}: ProducerFormModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold text-slate-900">
            {editingProducer ? 'Editar Produtor' : 'Novo Produtor'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nome *
            </label>
            <Input
              value={formName}
              onChange={(e) => onNameChange(e.target.value)}
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
                const value = e.target.value.replace(/\D/g, '').slice(0, 11)
                if (value.length <= 3) {
                  onCpfChange(value)
                } else if (value.length <= 6) {
                  onCpfChange(`${value.slice(0, 3)}.${value.slice(3)}`)
                } else if (value.length <= 9) {
                  onCpfChange(`${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`)
                } else {
                  onCpfChange(`${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`)
                }
              }}
              placeholder="000.000.000-00"
              maxLength={14}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              <span className="flex items-center gap-1">
                <Warehouse size={14} />
                Caixa Logística Padrão <span className="text-slate-400">(opcional)</span>
              </span>
            </label>
            <select
              value={formLogisticsUnitId}
              onChange={(e) => onLogisticsUnitIdChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Nenhuma (automático por raio)</option>
              {logisticsUnits.map(unit => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Todos os talhões deste produtor serão atribuídos a esta caixa, a menos que definido individualmente.
            </p>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
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
  )
}
