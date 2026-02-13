'use client'

import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  Loader2,
  AlertOctagon,
  AlertTriangle,
  Warehouse,
  Check,
  ChevronDown,
  Pencil,
  SquareSplitVertical,
  Leaf,
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
  cropType: string | null
  producerId: string | null
  producerName: string | null
  parentFieldId: string | null
  subFieldCount: number
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

interface FieldsCoverageRowProps {
  field: FieldWithIntersection
  logisticsUnits: LogisticsUnit[]
  isExpanded: boolean
  saving: string | null
  enableSubFields: boolean
  onToggleExpand: () => void
  onAssignUnit: (fieldId: string, unitId: string) => void
  onEdit: (field: FieldWithIntersection) => void
}

export function FieldsCoverageRow({
  field,
  logisticsUnits,
  isExpanded,
  saving,
  enableSubFields,
  onToggleExpand,
  onAssignUnit,
  onEdit,
}: FieldsCoverageRowProps) {
  const currentUnit = field.logisticsUnit || field.producerLogisticsUnit ||
    (field.coveringUnits.length > 0 ? { id: field.coveringUnits[0].id, name: field.coveringUnits[0].name } : null)

  return (
    <tr className={isExpanded ? 'bg-blue-50' : 'hover:bg-slate-50'}>
      <td className="px-6 py-4">
        <div className="font-medium text-slate-900">{field.name}</div>
        <div className="text-xs text-slate-500">{field.city}, {field.state}</div>
      </td>
      <td className="px-6 py-4 text-sm text-slate-600">
        {field.producerName || '—'}
      </td>
      <td className="px-6 py-4">
        {field.cropType ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
            <Leaf className="w-3 h-3 text-emerald-500" />
            {field.cropType}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
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
        <div className="relative flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(field)}
            className="text-slate-400 hover:text-blue-600"
            title="Editar talhão"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          {enableSubFields && !field.parentFieldId && (
            <Link href={`/fields/${field.id}/subfields`}>
              <Button
                variant="ghost"
                size="sm"
                className={`relative ${
                  field.subFieldCount > 0
                    ? 'text-blue-500 hover:text-blue-700 hover:bg-blue-50'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title={
                  field.subFieldCount > 0
                    ? `${field.subFieldCount} subtalhão${field.subFieldCount > 1 ? 'ões' : ''}`
                    : 'Criar subtalhões'
                }
              >
                <SquareSplitVertical className="w-4 h-4" />
                {field.subFieldCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 flex items-center justify-center bg-blue-500 text-white text-[7px] font-bold rounded-full">
                    {field.subFieldCount}
                  </span>
                )}
                {field.subFieldCount === 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 flex items-center justify-center bg-slate-400 text-white text-[7px] font-bold rounded-full leading-none">
                    +
                  </span>
                )}
              </Button>
            </Link>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleExpand}
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
                      onClick={() => onAssignUnit(field.id, unit.id)}
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
}
