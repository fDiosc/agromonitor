'use client'

import { Input } from '@/components/ui/input'
import { UserCheck, Wheat, Warehouse } from 'lucide-react'

interface Producer {
  id: string
  name: string
  cpf: string | null
}

interface LogisticsUnit {
  id: string
  name: string
}

type CropType = 'SOJA' | 'MILHO'

interface NewFieldFormFieldsProps {
  name: string
  onNameChange: (v: string) => void
  producerId: string
  onProducerIdChange: (v: string) => void
  cropType: CropType
  onCropTypeChange: (v: CropType) => void
  date: string
  onDateChange: (v: string) => void
  logisticsUnitId: string
  onLogisticsUnitIdChange: (v: string) => void
  plantingDateInput: string
  onPlantingDateInputChange: (v: string) => void
  producers: Producer[]
  logisticsUnits: LogisticsUnit[]
  loadingProducers: boolean
}

export function NewFieldFormFields({
  name,
  onNameChange,
  producerId,
  onProducerIdChange,
  cropType,
  onCropTypeChange,
  date,
  onDateChange,
  logisticsUnitId,
  onLogisticsUnitIdChange,
  plantingDateInput,
  onPlantingDateInputChange,
  producers,
  logisticsUnits,
  loadingProducers,
}: NewFieldFormFieldsProps) {
  return (
    <div className="grid md:grid-cols-2 gap-6 mb-8">
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
          Nome do Talhão *
        </label>
        <Input
          type="text"
          value={name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="Ex: Fazenda Boa Vista - Talhão 01"
          className="text-base"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 flex items-center gap-1">
          <UserCheck size={12} />
          Produtor Vinculado
          <span className="text-slate-300 normal-case font-normal">(opcional)</span>
        </label>
        <select
          value={producerId}
          onChange={e => onProducerIdChange(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          disabled={loadingProducers}
        >
          <option value="">Sem produtor vinculado</option>
          {producers.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} {p.cpf ? `(${p.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 flex items-center gap-1">
          <Wheat size={12} />
          Cultura
        </label>
        <select
          value={cropType}
          onChange={e => onCropTypeChange(e.target.value as CropType)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="SOJA">Soja</option>
          <option value="MILHO">Milho</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
          Início da Safra
        </label>
        <Input
          type="date"
          value={date}
          onChange={e => onDateChange(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 flex items-center gap-1">
          <Warehouse size={12} />
          Caixa Logística
          <span className="text-slate-300 normal-case font-normal">(opcional)</span>
        </label>
        <select
          value={logisticsUnitId}
          onChange={e => onLogisticsUnitIdChange(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="">Automático (por raio ou produtor)</option>
          {logisticsUnits.map(u => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2 md:col-span-2">
        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
          Data de Plantio Informada pelo Produtor
          <span className="text-slate-300 normal-case font-normal ml-1">(opcional - se informada, será usada como base para cálculos)</span>
        </label>
        <Input
          type="date"
          value={plantingDateInput}
          onChange={e => onPlantingDateInputChange(e.target.value)}
          className="max-w-xs"
        />
        {plantingDateInput && (
          <p className="text-xs text-emerald-600 mt-1">
            ✓ Data informada pelo produtor será usada como referência confiável para cálculos
          </p>
        )}
      </div>
    </div>
  )
}
