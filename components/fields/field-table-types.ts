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

export interface FieldTableProps {
  fields: Field[]
  onDelete: (id: string) => void
  onReprocess?: (id: string) => void
  onEdit?: (field: Field) => void
  enableSubFields?: boolean
  isDeleting?: string | null
  isReprocessing?: string | null
}

// ─── Sort ─────────────────────────────────────────────────────
export type SortKey =
  | 'name' | 'status' | 'area' | 'volume'
  | 'emergence' | 'harvest' | 'confidence'
  | 'cropType' | 'cropPattern'
  | 'aiAgreement' | 'aiEos' | 'aiReady' | 'aiConfidence'

export type SortDir = 'asc' | 'desc'

export const AGREEMENT_ORDER: Record<string, number> = { REJECTED: 0, QUESTIONED: 1, CONFIRMED: 2 }
export const CROP_PATTERN_ORDER: Record<string, number> = { NO_CROP: 0, ANOMALOUS: 1, ATYPICAL: 2, TYPICAL: 3 }

export function getSortValue(field: Field, key: SortKey): number | string | null {
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

export function compare(a: number | string | null, b: number | string | null, dir: SortDir): number {
  if (a === null && b === null) return 0
  if (a === null) return 1   // nulls always last
  if (b === null) return -1
  if (typeof a === 'string' && typeof b === 'string') {
    return dir === 'asc' ? a.localeCompare(b) : b.localeCompare(a)
  }
  return dir === 'asc' ? Number(a) - Number(b) : Number(b) - Number(a)
}
