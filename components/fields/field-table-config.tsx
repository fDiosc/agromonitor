import React from 'react'
import { CheckCircle, AlertTriangle, Clock, Loader2, AlertCircle } from 'lucide-react'
import type { Field } from './field-table-types'

// ─── Configs ──────────────────────────────────────────────────
export const statusConfig: Record<string, { icon: React.ReactNode; variant: 'success' | 'warning' | 'error' | 'secondary'; label: string }> = {
  SUCCESS:    { icon: <CheckCircle size={12} />,                       variant: 'success',   label: 'Processado' },
  PARTIAL:    { icon: <AlertTriangle size={12} />,                     variant: 'warning',   label: 'Parcial' },
  PROCESSING: { icon: <Loader2 size={12} className="animate-spin" />, variant: 'secondary', label: 'Processando' },
  PENDING:    { icon: <Clock size={12} />,                             variant: 'secondary', label: 'Pendente' },
  ERROR:      { icon: <AlertCircle size={12} />,                       variant: 'error',     label: 'Erro' },
}

export const templateColors: Record<string, string> = {
  CREDIT: 'bg-emerald-100 text-emerald-700',
  LOGISTICS: 'bg-blue-100 text-blue-700',
  RISK_MATRIX: 'bg-amber-100 text-amber-700',
}
export const templateNames: Record<string, string> = {
  CREDIT: 'Crédito',
  LOGISTICS: 'Logística',
  RISK_MATRIX: 'Risco',
}

export const agreementConfig: Record<string, { label: string; color: string; bg: string }> = {
  CONFIRMED:  { label: 'Confirmado',  color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  QUESTIONED: { label: 'Questionado', color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200' },
  REJECTED:   { label: 'Rejeitado',   color: 'text-red-700',     bg: 'bg-red-50 border-red-200' },
}

// ─── Helpers ──────────────────────────────────────────────────
export function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
  } catch { return '—' }
}

export function confColor(score: number | null | undefined): string {
  if (score == null) return 'text-slate-400'
  if (score >= 75) return 'text-emerald-600'
  if (score >= 40) return 'text-amber-600'
  return 'text-red-500'
}

export function bestEos(agroData: Field['agroData']): string | null {
  if (!agroData) return null
  return agroData.fusedEosDate || agroData.eosDate || null
}
