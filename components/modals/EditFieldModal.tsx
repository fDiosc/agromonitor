'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Pencil, UserCheck, Warehouse, Leaf, Calendar, AlertTriangle, RefreshCw, Info } from 'lucide-react'
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
}

type TabId = 'general' | 'agronomic'

function formatDateForInput(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    const dd = String(d.getUTCDate()).padStart(2, '0')
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const yyyy = d.getUTCFullYear()
    return `${dd}/${mm}/${yyyy}`
  } catch {
    return ''
  }
}

/** Convert dd/mm/yyyy to yyyy-mm-dd for API */
function parseDateBRToISO(dateStr: string): string {
  if (!dateStr) return ''
  const parts = dateStr.split('/')
  if (parts.length !== 3) return ''
  const [dd, mm, yyyy] = parts
  if (!dd || !mm || !yyyy || yyyy.length !== 4) return ''
  return `${yyyy}-${mm}-${dd}`
}

/** Validate dd/mm/yyyy format */
function isValidDateBR(dateStr: string): boolean {
  if (!dateStr) return true // empty is valid (optional)
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return false
  const [, dd, mm, yyyy] = match
  const day = parseInt(dd, 10)
  const month = parseInt(mm, 10)
  const year = parseInt(yyyy, 10)
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) return false
  const d = new Date(year, month - 1, day)
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day
}

function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR')
  } catch {
    return '—'
  }
}

/** Apply dd/mm/yyyy mask as user types */
function applyDateMask(value: string): string {
  // Remove non-digits
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`
}

export function EditFieldModal({
  isOpen,
  onClose,
  onSuccess,
  field,
  producers,
  logisticsUnits
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
      const payload: Record<string, any> = {
        name: name.trim(),
        producerId: producerId || null,
        logisticsUnitId: logisticsUnitId || null,
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
  const hasGeneralChanges = 
    name !== field.name || 
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
            <h2 className="text-lg font-bold text-slate-900">Editar Talhão</h2>
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
            <>
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
            </>
          )}

          {/* Tab: Agronômico */}
          {activeTab === 'agronomic' && (
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
                  onChange={(e) => setCropType(e.target.value)}
                  disabled={saving}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                >
                  <option value="SOJA">Soja</option>
                  <option value="MILHO">Milho</option>
                </select>
                {field.detectedCropType && field.detectedCropType !== cropType && (
                  <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                    <Info size={12} />
                    Algoritmo detectou: {field.detectedCropType}
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
                  onChange={(e) => setPlantingDateInput(applyDateMask(e.target.value))}
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
                    onClick={() => setPlantingDateInput('')}
                    className="text-xs text-red-500 hover:text-red-700 mt-1"
                  >
                    Limpar (usar detecção automática)
                  </button>
                )}
                {field.detectedPlantingDate && (
                  <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                    <Info size={12} />
                    Detectado pelo algoritmo: {formatDateBR(field.detectedPlantingDate)}
                    {field.detectedConfidence && (
                      <span className="text-slate-400">
                        ({field.detectedConfidence})
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
                  onChange={(e) => setSeasonStartDate(applyDateMask(e.target.value))}
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
