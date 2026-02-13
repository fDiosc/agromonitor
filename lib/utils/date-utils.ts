/** Format date for input field (dd/mm/yyyy) */
export function formatDateForInput(dateStr: string | null | undefined): string {
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
export function parseDateBRToISO(dateStr: string): string {
  if (!dateStr) return ''
  const parts = dateStr.split('/')
  if (parts.length !== 3) return ''
  const [dd, mm, yyyy] = parts
  if (!dd || !mm || !yyyy || yyyy.length !== 4) return ''
  return `${yyyy}-${mm}-${dd}`
}

/** Validate dd/mm/yyyy format */
export function isValidDateBR(dateStr: string): boolean {
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

export function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR')
  } catch {
    return '—'
  }
}

/** Apply dd/mm/yyyy mask as user types */
export function applyDateMask(value: string): string {
  // Remove non-digits
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`
}
