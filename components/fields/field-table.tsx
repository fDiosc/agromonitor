'use client'

import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react'
import type { Field, FieldTableProps, SortKey, SortDir } from './field-table-types'
import { getSortValue, compare } from './field-table-types'
import { FieldRowCells } from './FieldRowCells'

// ─── Component ────────────────────────────────────────────────
export { type Field } from './field-table-types'

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
