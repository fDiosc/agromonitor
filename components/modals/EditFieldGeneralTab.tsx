'use client'

import { UserCheck, Warehouse } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface Producer {
  id: string
  name: string
}

interface LogisticsUnit {
  id: string
  name: string
}

interface EditFieldGeneralTabProps {
  name: string
  producerId: string
  logisticsUnitId: string
  producers: Producer[]
  logisticsUnits: LogisticsUnit[]
  originalProducerId: string | null
  saving: boolean
  onNameChange: (value: string) => void
  onProducerIdChange: (value: string) => void
  onLogisticsUnitIdChange: (value: string) => void
  isSubField?: boolean
}

export function EditFieldGeneralTab({
  name,
  producerId,
  logisticsUnitId,
  producers,
  logisticsUnits,
  originalProducerId,
  saving,
  onNameChange,
  onProducerIdChange,
  onLogisticsUnitIdChange,
  isSubField = false,
}: EditFieldGeneralTabProps) {
  return (
    <>
      {/* Nome */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Nome do Talhão *
        </label>
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
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
          onChange={(e) => onProducerIdChange(e.target.value)}
          disabled={saving || isSubField}
          className={`w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${isSubField ? 'bg-slate-50 cursor-not-allowed' : ''}`}
        >
          <option value="">Nenhum produtor vinculado</option>
          {producers.map(producer => (
            <option key={producer.id} value={producer.id}>
              {producer.name}
            </option>
          ))}
        </select>
        {isSubField ? (
          <p className="text-xs text-blue-500 mt-1">Herdado do talhão pai</p>
        ) : producerId !== (originalProducerId || '') ? (
          <p className="text-xs text-amber-600 mt-1">
            O talhão será migrado para outro produtor
          </p>
        ) : null}
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
          onChange={(e) => onLogisticsUnitIdChange(e.target.value)}
          disabled={saving || isSubField}
          className={`w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${isSubField ? 'bg-slate-50 cursor-not-allowed' : ''}`}
        >
          <option value="">Automático (por raio ou produtor)</option>
          {logisticsUnits.map(unit => (
            <option key={unit.id} value={unit.id}>
              {unit.name}
            </option>
          ))}
        </select>
        {isSubField && (
          <p className="text-xs text-blue-500 mt-1">Herdado do talhão pai</p>
        )}
      </div>
    </>
  )
}
