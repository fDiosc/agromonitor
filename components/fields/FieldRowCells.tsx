'use client'

import Link from 'next/link'
import {
  Eye, Trash2, Loader2, RefreshCw, Pencil, FolderOpen,
  ChevronUp, ChevronDown, SquareSplitVertical, BrainCircuit, AlertOctagon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatNumber, formatTons } from '@/lib/utils'
import type { Field } from './field-table-types'
import { statusConfig, templateColors, templateNames, agreementConfig, fmtDate, confColor, bestEos } from './field-table-config'

export interface FieldRowCellsProps {
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

export function FieldRowCells({
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
              {onEdit && (
                <Button variant="ghost" size="icon" onClick={() => onEdit(field)}
                  className="text-slate-400 hover:text-amber-600 hover:bg-amber-50 h-8 w-8" title="Editar subtalhão">
                  <Pencil size={16} />
                </Button>
              )}
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
              {onReprocess && !hasChildren && (
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
