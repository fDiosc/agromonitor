'use client'

import { Badge } from '@/components/ui/badge'

export interface FeatureToggleProps {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  icon?: React.ElementType
  badge?: string
}

export function FeatureToggle({
  label,
  description,
  checked,
  onChange,
  icon: Icon,
  badge
}: FeatureToggleProps) {
  return (
    <label className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
      checked ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
    }`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1"
      />
      <div className="flex-1">
        <div className="flex items-center gap-2 font-medium text-slate-900">
          {Icon && <Icon className="w-4 h-4 text-blue-600" />}
          {label}
          {badge && (
            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
              {badge}
            </Badge>
          )}
        </div>
        <p className="text-sm text-slate-500 mt-1">{description}</p>
      </div>
    </label>
  )
}
