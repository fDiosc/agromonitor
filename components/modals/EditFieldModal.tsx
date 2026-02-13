'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Pencil, Leaf, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDateForInput, parseDateBRToISO, isValidDateBR } from '@/lib/utils/date-utils'
import { EditFieldGeneralTab } from './EditFieldGeneralTab'
import { EditFieldAgronomicTab } from './EditFieldAgronomicTab'

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
  // Campos agronômicos
  plantingDateInput?: string | null
  cropType?: string | null
  seasonStartDate?: string | null
  // Dados detectados (read-only, para referência)
  detectedPlantingDate?: string | null
  detectedCropType?: string | null
  detectedConfidence?: string | null
  editHistory?: string | null
}

interface EditFieldModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  field: FieldToEdit | null
  producers: Producer[]
  logisticsUnits: LogisticsUnit[]
  isSubField?: boolean
}

type TabId = 'general' | 'agronomic'

export function EditFieldModal({
  isOpen,
  onClose,
  onSuccess,
  field,
  producers,
  logisticsUnits,
  isSubField = false
}: EditFieldModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('general')
  const [name, setName] = useState('')
  const [producerId, setProducerId] = useState<string>('')
  const [logisticsUnitId, setLogisticsUnitId] = useState<string>('')
  // Campos agronômicos
  const [plantingDateInput, setPlantingDateInput] = useState<string>('')
  const [cropType, setCropType] = useState<string>('')
  const [seasonStartDate, setSeasonStartDate] = useState<string>('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Atualizar form quando field ID mudar (não na referência do objeto)
  const fieldId = field?.id
  useEffect(() => {
    if (field && isOpen) {
      setName(field.name)
      setProducerId(field.producerId || '')
      setLogisticsUnitId(field.logisticsUnitId || '')
      setPlantingDateInput(formatDateForInput(field.plantingDateInput))
      setCropType(field.cropType || 'SOJA')
      setSeasonStartDate(formatDateForInput(field.seasonStartDate))
      setError(null)
      setActiveTab('general')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldId, isOpen])

  if (!isOpen || !field) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('Nome é obrigatório')
      return
    }

    // Validar formatos de data
    if (plantingDateInput && !isValidDateBR(plantingDateInput)) {
      setError('Data de plantio inválida. Use o formato dd/mm/aaaa')
      return
    }
    if (seasonStartDate && !isValidDateBR(seasonStartDate)) {
      setError('Data de início da safra inválida. Use o formato dd/mm/aaaa')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        // Subtalhões herdam produtor e caixa logística do pai
        ...(!isSubField && {
          producerId: producerId || null,
          logisticsUnitId: logisticsUnitId || null,
        }),
      }

      // Incluir campos agronômicos se houve alteração
      const originalPlanting = formatDateForInput(field.plantingDateInput)
      if (plantingDateInput !== originalPlanting) {
        payload.plantingDateInput = plantingDateInput ? parseDateBRToISO(plantingDateInput) : null
      }

      if (cropType !== (field.cropType || 'SOJA')) {
        payload.cropType = cropType
      }

      const originalSeason = formatDateForInput(field.seasonStartDate)
      if (seasonStartDate !== originalSeason) {
        payload.seasonStartDate = seasonStartDate ? parseDateBRToISO(seasonStartDate) : null
      }

      const res = await fetch(`/api/fields/${field.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Falha ao salvar')
      }

      const data = await res.json()

      onSuccess()
      onClose()

      // Se reprocessamento foi disparado, mostrar feedback visual
      if (data.reprocessTriggered) {
        // O status PROCESSING será capturado pelo polling do dashboard
        console.log('[EditField] Reprocessamento disparado automaticamente')
      }
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
  const hasGeneralChanges = isSubField
    ? name !== field.name
    : name !== field.name ||
      (producerId || null) !== field.producerId ||
      (logisticsUnitId || null) !== field.logisticsUnitId

  const hasAgroChanges =
    plantingDateInput !== formatDateForInput(field.plantingDateInput) ||
    cropType !== (field.cropType || 'SOJA') ||
    seasonStartDate !== formatDateForInput(field.seasonStartDate)

  const hasChanges = hasGeneralChanges || hasAgroChanges

  // Parse edit history para mostrar contador
  const editCount = (() => {
    try {
      const history = field.editHistory ? JSON.parse(field.editHistory) : []
      return history.length
    } catch { return 0 }
  })()

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <Pencil size={20} className="text-slate-500" />
            <h2 className="text-lg font-bold text-slate-900">{isSubField ? 'Editar Subtalhão' : 'Editar Talhão'}</h2>
            {editCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                {editCount} edição{editCount > 1 ? 'ões' : ''}
              </span>
            )}
          </div>
          <button
            onClick={handleClose}
            disabled={saving}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-4">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'general'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Geral
          </button>
          <button
            onClick={() => setActiveTab('agronomic')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'agronomic'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Leaf size={14} />
            Agronômico
            {hasAgroChanges && (
              <span className="w-2 h-2 rounded-full bg-amber-500" />
            )}
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Tab: Geral */}
          {activeTab === 'general' && (
            <EditFieldGeneralTab
              name={name}
              producerId={producerId}
              logisticsUnitId={logisticsUnitId}
              producers={producers}
              logisticsUnits={logisticsUnits}
              originalProducerId={field.producerId}
              saving={saving}
              onNameChange={setName}
              onProducerIdChange={setProducerId}
              onLogisticsUnitIdChange={setLogisticsUnitId}
              isSubField={isSubField}
            />
          )}

          {/* Tab: Agronômico */}
          {activeTab === 'agronomic' && (
            <EditFieldAgronomicTab
              cropType={cropType}
              plantingDateInput={plantingDateInput}
              seasonStartDate={seasonStartDate}
              detectedCropType={field.detectedCropType}
              detectedPlantingDate={field.detectedPlantingDate}
              detectedConfidence={field.detectedConfidence}
              hasAgroChanges={hasAgroChanges}
              saving={saving}
              onCropTypeChange={setCropType}
              onPlantingDateInputChange={setPlantingDateInput}
              onSeasonStartDateChange={setSeasonStartDate}
            />
          )}

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
              className={`flex-1 ${hasAgroChanges ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
              disabled={saving || !hasChanges}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Salvando...
                </>
              ) : hasAgroChanges ? (
                <>
                  <RefreshCw size={16} className="mr-2" />
                  Salvar e Reprocessar
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
