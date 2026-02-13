import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react'

export const AGREEMENT_CONFIG = {
  CONFIRMED: {
    label: 'Confirmado',
    description: 'As projeções algorítmicas foram confirmadas visualmente',
    icon: CheckCircle,
    bg: 'bg-emerald-500',
    text: 'text-emerald-700',
    lightBg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  QUESTIONED: {
    label: 'Questionado',
    description: 'Divergências parciais foram identificadas visualmente',
    icon: AlertTriangle,
    bg: 'bg-amber-500',
    text: 'text-amber-700',
    lightBg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  REJECTED: {
    label: 'Rejeitado',
    description: 'As projeções algorítmicas não correspondem às imagens',
    icon: XCircle,
    bg: 'bg-red-600',
    text: 'text-red-700',
    lightBg: 'bg-red-50',
    border: 'border-red-200',
  },
}

export const RISK_MAP: Record<string, string> = {
  'BAIXO': 'LOW', 'MODERADO': 'MEDIUM', 'ALTO': 'HIGH', 'CRITICO': 'CRITICAL',
  'LOW': 'LOW', 'MEDIUM': 'MEDIUM', 'HIGH': 'HIGH', 'CRITICAL': 'CRITICAL',
}

export const CATEGORY_LABELS: Record<string, string> = {
  'CLIMATIC': 'Climático',
  'PHYTOSANITARY': 'Fitossanitário',
  'OPERATIONAL': 'Operacional',
}
