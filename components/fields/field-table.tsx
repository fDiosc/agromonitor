'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Eye, Trash2, Loader2, CheckCircle, AlertCircle, Clock, RefreshCw,
  AlertTriangle, AlertOctagon, BrainCircuit, Pencil, FolderOpen,
  ChevronUp, ChevronDown, ArrowUpDown, SquareSplitVertical,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatNumber, formatTons } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────
export interface Field {
  id: string
  name: string
  status: string
  errorMessage?: string | null
  city: string | null
  state: string | null
  areaHa: number | null
  cropType?: string | null
  // Campos agronômicos editáveis
  plantingDateInput?: string | null
  seasonStartDate?: string | null
  editHistory?: string | null
  // Subtalhões
  parentFieldId?: string | null
  subFields?: Field[]
  _count?: { subFields: number }
  agroData?: {
    areaHa: number | null
    volumeEstimatedKg: number | null
    confidence: string | null
    confidenceScore: number | null
    eosDate: string | null
    sosDate: string | null
    fusedEosDate: string | null
    // Crop pattern (algorithmic)
    cropPatternStatus: string | null  // NO_CROP | ANOMALOUS | ATYPICAL | TYPICAL
    // Crop verification (AI Verifier)
    aiCropVerificationStatus: string | null  // CONFIRMED | SUSPICIOUS | MISMATCH | NO_CROP | CROP_FAILURE
    // AI Validation (pre-processed server-side)
    aiValidationAgreement: string | null
    aiValidationConfidence: number | null
    aiEosAdjustedDate: string | null
    aiValidationDate: string | null
    harvestReady: boolean | null
    // Detected values (read-only, for reference)
    detectedPlantingDate: string | null
    detectedCropType: string | null
    detectedConfidence: string | null
  } | null
  analyses?: {
    templateId: string
    status: string
    statusColor: string | null
  }[]
  logisticsUnit?: { id: string; name: string } | null
  producer?: {
    id?: string
    name?: string
    defaultLogisticsUnit?: { id: string; name: string } | null
  } | null
  logisticsDistances?: {
    logisticsUnitId: string
    distanceKm: number
    isWithinCoverage: boolean
    logisticsUnit: { id: string; name: string }
  }[]
}

interface FieldTableProps {
  fields: Field[]
  onDelete: (id: string) => void
  onReprocess?: (id: string) => void
  onEdit?: (field: Field) => void
  enableSubFields?: boolean
  isDeleting?: string | null
  isReprocessing?: string | null
}

// ─── Sort ─────────────────────────────────────────────────────
type SortKey =
  | 'name' | 'status' | 'area' | 'volume'
  | 'emergence' | 'harvest' | 'confidence'
  | 'cropType' | 'cropPattern'
  | 'aiAgreement' | 'aiEos' | 'aiReady' | 'aiConfidence'

type SortDir = 'asc' | 'desc'

const AGREEMENT_ORDER: Record<string, number> = { REJECTED: 0, QUESTIONED: 1, CONFIRMED: 2 }
const CROP_PATTERN_ORDER: Record<string, number> = { NO_CROP: 0, ANOMALOUS: 1, ATYPICAL: 2, TYPICAL: 3 }

function getSortValue(field: Field, key: SortKey): number | string | null {
  switch (key) {
    case 'name':       return field.name?.toLowerCase() ?? null
    case 'status':     return field.status
    case 'area':       return field.agroData?.areaHa ?? field.areaHa ?? null
    case 'volume':     return field.agroData?.volumeEstimatedKg ?? null
    case 'emergence': {
      const d = field.agroData?.sosDate
      return d ? new Date(d).getTime() : null
    }
    case 'harvest': {
      const eos = field.agroData?.fusedEosDate || field.agroData?.eosDate
      return eos ? new Date(eos).getTime() : null
    }
    case 'confidence':   return field.agroData?.confidenceScore ?? null
    case 'cropType':     return field.cropType?.toLowerCase() ?? null
    case 'cropPattern':  return CROP_PATTERN_ORDER[field.agroData?.cropPatternStatus ?? ''] ?? null
    case 'aiAgreement':  return AGREEMENT_ORDER[field.agroData?.aiValidationAgreement ?? ''] ?? null
    case 'aiEos': {
      const d = field.agroData?.aiEosAdjustedDate
      return d ? new Date(d).getTime() : null
    }
    case 'aiReady': {
      const r = field.agroData?.harvestReady
      return r == null ? null : (r ? 1 : 0)
    }
    case 'aiConfidence': return field.agroData?.aiValidationConfidence ?? null
  }
}

function compare(a: number | string | null, b: number | string | null, dir: SortDir): number {
  if (a === null && b === null) return 0
  if (a === null) return 1   // nulls always last
  if (b === null) return -1
  if (typeof a === 'string' && typeof b === 'string') {
    return dir === 'asc' ? a.localeCompare(b) : b.localeCompare(a)
  }
  return dir === 'asc' ? Number(a) - Number(b) : Number(b) - Number(a)
}

// ─── Configs ──────────────────────────────────────────────────
const statusConfig: Record<string, { icon: React.ReactNode; variant: 'success' | 'warning' | 'error' | 'secondary'; label: string }> = {
  SUCCESS:    { icon: <CheckCircle size={12} />,                       variant: 'success',   label: 'Processado' },
  PARTIAL:    { icon: <AlertTriangle size={12} />,                     variant: 'warning',   label: 'Parcial' },
  PROCESSING: { icon: <Loader2 size={12} className="animate-spin" />, variant: 'secondary', label: 'Processando' },
  PENDING:    { icon: <Clock size={12} />,                             variant: 'secondary', label: 'Pendente' },
  ERROR:      { icon: <AlertCircle size={12} />,                       variant: 'error',     label: 'Erro' },
}

const templateColors: Record<string, string> = {
  CREDIT: 'bg-emerald-100 text-emerald-700',
  LOGISTICS: 'bg-blue-100 text-blue-700',
  RISK_MATRIX: 'bg-amber-100 text-amber-700',
}
const templateNames: Record<string, string> = {
  CREDIT: 'Crédito',
  LOGISTICS: 'Logística',
  RISK_MATRIX: 'Risco',
}

const agreementConfig: Record<string, { label: string; color: string; bg: string }> = {
  CONFIRMED:  { label: 'Confirmado',  color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  QUESTIONED: { label: 'Questionado', color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200' },
  REJECTED:   { label: 'Rejeitado',   color: 'text-red-700',     bg: 'bg-red-50 border-red-200' },
}

// ─── Helpers ──────────────────────────────────────────────────
function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
  } catch { return '—' }
}

function confColor(score: number | null | undefined): string {
  if (score == null) return 'text-slate-400'
  if (score >= 75) return 'text-emerald-600'
  if (score >= 40) return 'text-amber-600'
  return 'text-red-500'
}

function bestEos(agroData: Field['agroData']): string | null {
  if (!agroData) return null
  return agroData.fusedEosDate || agroData.eosDate || null
}

// ─── Component ────────────────────────────────────────────────
export function FieldTable({ fields, onDelete, onReprocess, onEdit, enableSubFields, isDeleting, isReprocessing }: FieldTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('harvest')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set())

  const toggleExpand = (fieldId: string) => {
    setExpandedParents(prev => {
      const next = new Set(prev)
      if (next.has(fieldId)) next.delete(fieldId)
      else next.add(fieldId)
      return next
    })
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      // dates default asc (nearest first), numbers default desc (biggest first)
      setSortDir(['harvest', 'emergence', 'aiEos', 'name'].includes(key) ? 'asc' : 'desc')
    }
  }

  const sorted = useMemo(() => {
    return [...fields].sort((a, b) => compare(getSortValue(a, sortKey), getSortValue(b, sortKey), sortDir))
  }, [fields, sortKey, sortDir])

  if (fields.length === 0) {
    return (
      <div className="bg-white rounded-[32px] border border-slate-200 p-20 text-center">
        <p className="text-slate-400 font-medium italic">Nenhum talhão cadastrado na sua carteira.</p>
        <p className="text-slate-300 text-sm mt-2">Clique em &quot;Novo Talhão&quot; para começar.</p>
      </div>
    )
  }

  // Sort header helper
  const TH = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th
      className={`px-3 py-3.5 text-[9px] font-black uppercase tracking-widest text-slate-400 cursor-pointer hover:text-slate-600 select-none transition-colors whitespace-nowrap ${className ?? ''}`}
      onClick={() => handleSort(k)}
    >
      <div className="flex items-center gap-0.5">
        {children}
        {sortKey === k
          ? (sortDir === 'asc' ? <ChevronUp size={11} className="text-blue-500" /> : <ChevronDown size={11} className="text-blue-500" />)
          : <ArrowUpDown size={9} className="opacity-25" />
        }
      </div>
    </th>
  )

  return (
    <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[1300px]">
          <thead className="bg-slate-50 border-b">
            <tr>
              <TH k="status">Status</TH>
              <TH k="name">Talhão</TH>
              <TH k="area">Área</TH>
              <TH k="volume">Volume</TH>
              <TH k="emergence">Emerg.</TH>
              <TH k="harvest" className="text-blue-500">Colheita</TH>
              <TH k="confidence">Conf.</TH>
              <TH k="cropType">Cultura</TH>
              <TH k="cropPattern">Status</TH>
              <TH k="aiAgreement">IA</TH>
              <TH k="aiEos">EOS IA</TH>
              <TH k="aiReady">Pronta</TH>
              <TH k="aiConfidence">Conf. IA</TH>
              <th className="px-3 py-3.5 text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
                Caixa Log.
              </th>
              <th className="px-3 py-3.5 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map(field => {
              const subCount = field._count?.subFields ?? field.subFields?.length ?? 0
              const hasChildren = subCount > 0
              const isExpanded = expandedParents.has(field.id)

              return (
                <FieldRows
                  key={field.id}
                  field={field}
                  hasChildren={hasChildren}
                  isExpanded={isExpanded}
                  onToggleExpand={() => toggleExpand(field.id)}
                  onDelete={onDelete}
                  onReprocess={onReprocess}
                  onEdit={onEdit}
                  enableSubFields={enableSubFields}
                  isDeleting={isDeleting}
                  isReprocessing={isReprocessing}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Sub-component: renders parent row + optional child rows ──
interface FieldRowsProps {
  field: Field
  hasChildren: boolean
  isExpanded: boolean
  onToggleExpand: () => void
  onDelete: (id: string) => void
  onReprocess?: (id: string) => void
  onEdit?: (field: Field) => void
  enableSubFields?: boolean
  isDeleting?: string | null
  isReprocessing?: string | null
}

function FieldRows({
  field,
  hasChildren,
  isExpanded,
  onToggleExpand,
  onDelete,
  onReprocess,
  onEdit,
  enableSubFields,
  isDeleting,
  isReprocessing,
}: FieldRowsProps) {
  return (
    <>
      {/* ── Parent row ── */}
      <FieldRowCells
        field={field}
        isChild={false}
        hasChildren={hasChildren}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
        onDelete={onDelete}
        onReprocess={onReprocess}
        onEdit={onEdit}
        enableSubFields={enableSubFields}
        isDeleting={isDeleting}
        isReprocessing={isReprocessing}
      />

      {/* ── Child rows (expanded) ── */}
      {isExpanded && field.subFields?.map(sub => (
        <FieldRowCells
          key={sub.id}
          field={sub}
          isChild={true}
          parentName={field.name}
          hasChildren={false}
          isExpanded={false}
          onToggleExpand={() => {}}
          onDelete={onDelete}
          onReprocess={onReprocess}
          onEdit={onEdit}
          enableSubFields={false}
          isDeleting={isDeleting}
          isReprocessing={isReprocessing}
        />
      ))}
    </>
  )
}

// ─── Sub-component: renders a single row (parent or child) ──
interface FieldRowCellsProps {
  field: Field
  isChild: boolean
  parentName?: string
  hasChildren: boolean
  isExpanded: boolean
  onToggleExpand: () => void
  onDelete: (id: string) => void
  onReprocess?: (id: string) => void
  onEdit?: (field: Field) => void
  enableSubFields?: boolean
  isDeleting?: string | null
  isReprocessing?: string | null
}

function FieldRowCells({
  field,
  isChild,
  parentName,
  hasChildren,
  isExpanded,
  onToggleExpand,
  onDelete,
  onReprocess,
  onEdit,
  enableSubFields,
  isDeleting,
  isReprocessing,
}: FieldRowCellsProps) {
  const st = statusConfig[field.status] || statusConfig.PENDING
  const area = field.agroData?.areaHa ?? field.areaHa
  const volume = field.agroData?.volumeEstimatedKg
  const eos = bestEos(field.agroData)
  const sos = field.agroData?.sosDate
  const confScore = field.agroData?.confidenceScore
  const cropPattern = field.agroData?.cropPatternStatus
  const cropVerif = field.agroData?.aiCropVerificationStatus
  const hasCropIssue = cropPattern === 'NO_CROP' || cropPattern === 'ANOMALOUS' || cropPattern === 'ATYPICAL'
    || (cropVerif && cropVerif !== 'CONFIRMED')
  const aiAgreement = hasCropIssue ? null : field.agroData?.aiValidationAgreement
  const aiConf = hasCropIssue ? null : field.agroData?.aiValidationConfidence
  const aiEos = hasCropIssue ? null : field.agroData?.aiEosAdjustedDate
  const ready = hasCropIssue ? null : field.agroData?.harvestReady
  const agCfg = aiAgreement ? agreementConfig[aiAgreement] : null

  return (
    <tr
      key={field.id}
      className={`hover:bg-slate-50/50 transition-colors text-sm ${
        isChild ? 'bg-blue-50/40' : ''
      }`}
    >
      {/* STATUS */}
      <td className="px-3 py-3">
        {isChild && <span className="inline-block w-3" />}
        <Badge variant={st.variant} className="gap-1 w-fit text-[10px]">
          {st.icon}{st.label}
        </Badge>
        {field.errorMessage && (field.status === 'ERROR' || field.status === 'PARTIAL') && (
          <span className="block text-[8px] text-amber-600 max-w-[100px] truncate mt-0.5" title={field.errorMessage}>
            {field.errorMessage}
          </span>
        )}
      </td>

      {/* TALHÃO */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-1">
          {isChild ? (
            <>
              <span className="text-blue-300 text-xs select-none ml-3">└</span>
              <SquareSplitVertical size={11} className="text-blue-400 shrink-0" />
            </>
          ) : hasChildren ? (
            <button
              onClick={onToggleExpand}
              className="flex items-center gap-0.5 text-blue-400 hover:text-blue-600 transition-colors"
              title={isExpanded ? 'Recolher subtalhões' : 'Expandir subtalhões'}
            >
              <FolderOpen size={13} className="shrink-0" />
              {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          ) : null}
          <div className={`font-bold text-[13px] leading-tight ${isChild ? 'text-blue-700' : 'text-slate-700'}`}>
            {field.name}
          </div>
          {field.editHistory && (() => {
            try {
              const count = JSON.parse(field.editHistory).length
              return count > 0 ? (
                <span className="text-[8px] px-1 py-0.5 rounded bg-amber-100 text-amber-600 font-semibold" title={`${count} edição(ões) agronômica(s)`}>
                  editado
                </span>
              ) : null
            } catch { return null }
          })()}
        </div>
        {isChild && parentName ? (
          <div className="text-[9px] font-medium text-blue-400 ml-7">
            {parentName}
          </div>
        ) : (
          <div className="text-[9px] font-medium text-slate-400 uppercase tracking-tight">
            {field.city || '—'}, {field.state || '—'}
          </div>
        )}
        {!isChild && (
          <div className="flex gap-1 flex-wrap mt-1">
            {field.analyses && field.analyses.map(a => (
              <span key={a.templateId} className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${templateColors[a.templateId] || 'bg-slate-100 text-slate-600'}`}>
                {templateNames[a.templateId] || a.templateId}
              </span>
            ))}
          </div>
        )}
      </td>

      {/* AREA */}
      <td className="px-3 py-3">
        <span className="font-bold text-slate-600 text-[13px]">
          {area ? `${formatNumber(area)}` : '—'}
        </span>
        {area ? <span className="text-[9px] text-slate-400 ml-0.5">ha</span> : null}
      </td>

      {/* VOLUME */}
      <td className="px-3 py-3">
        {volume ? (
          <span className="font-bold text-emerald-600 text-[13px]">{formatTons(volume)}</span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>

      {/* EMERGÊNCIA */}
      <td className="px-3 py-3">
        <span className="font-semibold text-slate-600 text-[12px]">{fmtDate(sos)}</span>
      </td>

      {/* COLHEITA (prev.) — suppress when crop issue */}
      <td className="px-3 py-3">
        <span className="font-bold text-blue-700 text-[12px]">{hasCropIssue ? '—' : fmtDate(eos)}</span>
      </td>

      {/* CONFIANÇA MODELO — suppress when crop issue */}
      <td className="px-3 py-3">
        {hasCropIssue ? (
          <span className="text-slate-300">—</span>
        ) : (
          <span className={`font-bold text-[12px] ${confColor(confScore)}`}>
            {confScore != null ? `${confScore}%` : '—'}
          </span>
        )}
      </td>

      {/* CULTURA (crop type) */}
      <td className="px-3 py-3">
        <span className="font-bold text-slate-600 text-[11px] uppercase">
          {field.cropType || '—'}
        </span>
      </td>

      {/* STATUS (crop pattern + verifier) */}
      <td className="px-3 py-3">
        {cropPattern === 'NO_CROP' ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border bg-red-50 text-red-700 border-red-300" title="Sem cultivo detectado">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />Sem Cultivo
          </span>
        ) : cropPattern === 'ANOMALOUS' ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border bg-orange-50 text-orange-700 border-orange-300" title="Curva não se assemelha à cultura declarada">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />Anômalo
          </span>
        ) : cropPattern === 'ATYPICAL' ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border bg-amber-50 text-amber-700 border-amber-300" title="Cultura com desvios">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Atípico
          </span>
        ) : cropPattern === 'TYPICAL' ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-300" title="Cultura detectada e compatível">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Detectada
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border bg-slate-50 text-slate-500 border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Pendente
          </span>
        )}
        {cropVerif && cropVerif !== 'CONFIRMED' && (
          <span className="block text-[8px] font-semibold mt-0.5" title={`Verificação IA: ${cropVerif}`}>
            {cropVerif === 'NO_CROP' && <span className="text-red-600">IA: Sem cultivo</span>}
            {cropVerif === 'MISMATCH' && <span className="text-red-600">IA: Divergente</span>}
            {cropVerif === 'CROP_FAILURE' && <span className="text-orange-600">IA: Quebra</span>}
            {cropVerif === 'SUSPICIOUS' && <span className="text-amber-600">IA: Suspeito</span>}
          </span>
        )}
      </td>

      {/* IA AGREEMENT */}
      <td className="px-3 py-3">
        {agCfg ? (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${agCfg.bg}`}>
            <BrainCircuit size={9} />
            <span className={agCfg.color}>{agCfg.label}</span>
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>

      {/* EOS IA */}
      <td className="px-3 py-3">
        <span className="font-semibold text-slate-600 text-[12px]">
          {aiEos ? fmtDate(aiEos) : '—'}
        </span>
      </td>

      {/* PRONTA */}
      <td className="px-3 py-3">
        {ready != null ? (
          <span className={`font-bold text-[11px] ${ready ? 'text-emerald-600' : 'text-amber-600'}`}>
            {ready ? 'Sim' : 'Não'}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>

      {/* CONF. IA */}
      <td className="px-3 py-3">
        <span className={`font-bold text-[12px] ${confColor(aiConf)}`}>
          {aiConf != null ? `${aiConf}%` : '—'}
        </span>
      </td>

      {/* CAIXA LOG */}
      <td className="px-3 py-3">
        {isChild ? (
          <span className="text-slate-300">—</span>
        ) : (() => {
          const direct = field.logisticsUnit
          const inherited = field.producer?.defaultLogisticsUnit
          const covering = field.logisticsDistances || []
          const names = covering.map(d => d.logisticsUnit)
          const primary = direct || inherited || (names.length > 0 ? names[0] : null)
          if (!primary && covering.length === 0) return <span className="text-slate-300">—</span>
          const type = direct ? 'M' : inherited ? 'P' : 'A'
          const color = direct ? 'bg-blue-500' : inherited ? 'bg-purple-500' : 'bg-green-500'
          const title = direct ? 'Manual' : inherited ? 'Produtor' : 'Automático'
          return (
            <div className="flex items-center gap-1">
              <span className={`w-4 h-4 flex items-center justify-center text-[7px] font-bold text-white rounded ${color}`} title={title}>{type}</span>
              <span className="text-[11px] text-slate-700 truncate max-w-[80px]" title={primary?.name}>{primary?.name}</span>
              {covering.length > 1 && (
                <span title={`Interseção: ${names.map(u => u.name).join(', ')}`}>
                  <AlertOctagon size={11} className="text-amber-500 shrink-0" />
                </span>
              )}
            </div>
          )
        })()}
      </td>

      {/* AÇÕES */}
      <td className="px-3 py-3 text-right">
        <div className="flex gap-0.5 justify-end">
          {/* Sub-fields: show reprocess + view report for children */}
          {isChild ? (
            <>
              {onReprocess && (
                <Button variant="ghost" size="icon" onClick={() => onReprocess(field.id)}
                  disabled={isReprocessing === field.id || field.status === 'PROCESSING'}
                  className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 h-8 w-8" title="Reprocessar subtalhão">
                  {isReprocessing === field.id ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                </Button>
              )}
              <Link href={`/reports/${field.id}`}>
                <Button variant="ghost" size="icon"
                  disabled={field.status !== 'SUCCESS' && field.status !== 'PARTIAL'}
                  className="text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 h-8 w-8" title="Ver relatório">
                  <Eye size={16} />
                </Button>
              </Link>
              <Button variant="ghost" size="icon" onClick={() => onDelete(field.id)}
                disabled={isDeleting === field.id}
                className="text-slate-400 hover:text-red-600 hover:bg-red-50 h-8 w-8" title="Excluir subtalhão">
                {isDeleting === field.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              </Button>
            </>
          ) : (
            <>
              {onEdit && (
                <Button variant="ghost" size="icon" onClick={() => onEdit(field)}
                  className="text-slate-400 hover:text-amber-600 hover:bg-amber-50 h-8 w-8" title="Editar talhão">
                  <Pencil size={16} />
                </Button>
              )}
              {enableSubFields && !field.parentFieldId && (
                <Link href={`/fields/${field.id}/subfields`} onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="icon"
                    className={`h-8 w-8 relative ${
                      (field._count?.subFields ?? 0) > 0
                        ? 'text-blue-500 hover:text-blue-700 hover:bg-blue-50'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                    }`}
                    title={
                      (field._count?.subFields ?? 0) > 0
                        ? `${field._count!.subFields} subtalhão${field._count!.subFields > 1 ? 'ões' : ''}`
                        : 'Criar subtalhões'
                    }
                  >
                    <SquareSplitVertical size={16} />
                    {(field._count?.subFields ?? 0) > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 flex items-center justify-center bg-blue-500 text-white text-[8px] font-bold rounded-full">
                        {field._count!.subFields}
                      </span>
                    )}
                    {(field._count?.subFields ?? 0) === 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 flex items-center justify-center bg-slate-400 text-white text-[8px] font-bold rounded-full leading-none">
                        +
                      </span>
                    )}
                  </Button>
                </Link>
              )}
              {onReprocess && (
                <Button variant="ghost" size="icon" onClick={() => onReprocess(field.id)}
                  disabled={isReprocessing === field.id || field.status === 'PROCESSING'}
                  className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 h-8 w-8" title="Reprocessar">
                  {isReprocessing === field.id ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                </Button>
              )}
              <Link href={`/reports/${field.id}`}>
                <Button variant="ghost" size="icon"
                  disabled={field.status !== 'SUCCESS' && field.status !== 'PARTIAL'}
                  className="text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 h-8 w-8" title="Ver relatório">
                  <Eye size={16} />
                </Button>
              </Link>
              <Button variant="ghost" size="icon" onClick={() => onDelete(field.id)}
                disabled={isDeleting === field.id}
                className="text-slate-400 hover:text-red-600 hover:bg-red-50 h-8 w-8" title="Excluir">
                {isDeleting === field.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}
