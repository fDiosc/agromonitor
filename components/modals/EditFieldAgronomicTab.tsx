'use client'

import { Leaf, Calendar, AlertTriangle, Info } from 'lucide-react'
import { formatDateBR, isValidDateBR, applyDateMask } from '@/lib/utils/date-utils'

interface EditFieldAgronomicTabProps {
  cropType: string
  plantingDateInput: string
  seasonStartDate: string
  detectedCropType?: string | null
  detectedPlantingDate?: string | null
  detectedConfidence?: string | null
  hasAgroChanges: boolean
  saving: boolean
  onCropTypeChange: (value: string) => void
  onPlantingDateInputChange: (value: string) => void
  onSeasonStartDateChange: (value: string) => void
}

export function EditFieldAgronomicTab({
  cropType,
  plantingDateInput,
  seasonStartDate,
  detectedCropType,
  detectedPlantingDate,
  detectedConfidence,
  hasAgroChanges,
  saving,
  onCropTypeChange,
  onPlantingDateInputChange,
  onSeasonStartDateChange,
}: EditFieldAgronomicTabProps) {
  return (
    <>
      {/* Aviso de reprocessamento */}
      {hasAgroChanges && (
      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
        <div className="text-sm text-amber-800">
          <p className="font-medium">Reprocessamento automático</p>
          <p className="text-xs mt-0.5">
            Ao salvar alterações agronômicas, o talhão será reprocessado automaticamente.
            Os dados detectados pelo algoritmo serão preservados para referência.
          </p>
        </div>
      </div>
      )}

      {/* Tipo de Cultura */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          <span className="flex items-center gap-1">
            <Leaf size={14} />
            Cultura
          </span>
        </label>
        <select
          value={cropType}
          onChange={(e) => onCropTypeChange(e.target.value)}
          disabled={saving}
          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
        >
          <option value="SOJA">Soja</option>
          <option value="MILHO">Milho</option>
        </select>
        {detectedCropType && detectedCropType !== cropType && (
          <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
            <Info size={12} />
            Algoritmo detectou: {detectedCropType}
          </p>
        )}
      </div>

      {/* Data de Plantio */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          <span className="flex items-center gap-1">
            <Calendar size={14} />
            Data de Plantio (informada)
          </span>
        </label>
        <input
          type="text"
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          value={plantingDateInput}
          onChange={(e) => onPlantingDateInputChange(applyDateMask(e.target.value))}
          maxLength={10}
          disabled={saving}
          className={`w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
            plantingDateInput && !isValidDateBR(plantingDateInput)
              ? 'border-red-300 bg-red-50'
              : 'border-slate-200'
          }`}
        />
        {plantingDateInput && !isValidDateBR(plantingDateInput) && (
          <p className="text-xs text-red-500 mt-1">Formato inválido. Use dd/mm/aaaa</p>
        )}
        {plantingDateInput && isValidDateBR(plantingDateInput) && (
          <button
            type="button"
            onClick={() => onPlantingDateInputChange('')}
            className="text-xs text-red-500 hover:text-red-700 mt-1"
          >
            Limpar (usar detecção automática)
          </button>
        )}
        {detectedPlantingDate && (
          <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
            <Info size={12} />
            Detectado pelo algoritmo: {formatDateBR(detectedPlantingDate)}
            {detectedConfidence && (
              <span className="text-slate-400">
                ({detectedConfidence})
              </span>
            )}
          </p>
        )}
      </div>

      {/* Data de Início da Safra */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          <span className="flex items-center gap-1">
            <Calendar size={14} />
            Início da Safra
          </span>
        </label>
        <input
          type="text"
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          value={seasonStartDate}
          onChange={(e) => onSeasonStartDateChange(applyDateMask(e.target.value))}
          maxLength={10}
          disabled={saving}
          className={`w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
            seasonStartDate && !isValidDateBR(seasonStartDate)
              ? 'border-red-300 bg-red-50'
              : 'border-slate-200'
          }`}
        />
        {seasonStartDate && !isValidDateBR(seasonStartDate) && (
          <p className="text-xs text-red-500 mt-1">Formato inválido. Use dd/mm/aaaa</p>
        )}
        <p className="text-xs text-slate-400 mt-1">
          Data base para busca de dados NDVI e meteorológicos
        </p>
      </div>
    </>
  )
}
