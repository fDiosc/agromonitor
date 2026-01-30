import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '---'
  
  // Se é string no formato ISO, extrair apenas a parte da data para evitar timezone issues
  if (typeof date === 'string') {
    // Formato: "2026-02-26" ou "2026-02-26T00:00:00.000Z"
    const datePart = date.split('T')[0]
    const [year, month, day] = datePart.split('-')
    return `${day}/${month}/${year}`
  }
  
  // Para objetos Date, usar UTC para evitar conversão de timezone
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC'
  })
}

export function formatNumber(num: number | null | undefined, decimals = 1): string {
  if (num === null || num === undefined) return '---'
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}

export function formatPercentage(num: number | null | undefined): string {
  if (num === null || num === undefined) return '---'
  return `${Math.round(num)}%`
}

export function formatTons(kg: number | null | undefined): string {
  if (kg === null || kg === undefined) return '---'
  return `${formatNumber(kg / 1000, 0)} ton`
}
