'use client'

import { Shield, Truck, AlertTriangle, Loader2, Check } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Template {
  id: string
  name: string
  description: string
  icon: string
  color: string
}

interface TemplateSelectorProps {
  templates: Template[]
  selectedTemplate: string | null
  analyzedTemplates: string[]
  onSelect: (templateId: string) => void
  isAnalyzing: boolean
  analyzingTemplate: string | null
}

const iconMap: Record<string, React.ReactNode> = {
  Shield: <Shield size={24} />,
  Truck: <Truck size={24} />,
  AlertTriangle: <AlertTriangle size={24} />
}

const colorMap: Record<string, { bg: string; border: string; text: string; shadow: string }> = {
  emerald: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-600',
    shadow: 'shadow-emerald-100'
  },
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-600',
    shadow: 'shadow-blue-100'
  },
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-600',
    shadow: 'shadow-amber-100'
  }
}

export function TemplateSelector({
  templates,
  selectedTemplate,
  analyzedTemplates,
  onSelect,
  isAnalyzing,
  analyzingTemplate
}: TemplateSelectorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {templates.map(template => {
        const colors = colorMap[template.color] || colorMap.emerald
        const isSelected = selectedTemplate === template.id
        const isAnalyzed = analyzedTemplates.includes(template.id)
        const isCurrentlyAnalyzing = analyzingTemplate === template.id

        return (
          <Card
            key={template.id}
            onClick={() => !isAnalyzing && onSelect(template.id)}
            className={cn(
              'p-5 cursor-pointer transition-all relative overflow-hidden',
              isSelected && `${colors.border} ${colors.bg} shadow-lg ${colors.shadow}`,
              !isSelected && 'hover:border-slate-300 hover:shadow-md',
              isAnalyzing && !isCurrentlyAnalyzing && 'opacity-50 cursor-not-allowed'
            )}
          >
            {/* Badge de status */}
            {isAnalyzed && !isCurrentlyAnalyzing && (
              <div className="absolute top-3 right-3">
                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                  <Check size={12} className="text-white" />
                </div>
              </div>
            )}

            {isCurrentlyAnalyzing && (
              <div className="absolute top-3 right-3">
                <Loader2 size={18} className="animate-spin text-slate-400" />
              </div>
            )}

            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center mb-3',
              colors.bg,
              colors.text
            )}>
              {iconMap[template.icon] || <Shield size={24} />}
            </div>

            <h4 className="font-bold text-slate-800">{template.name}</h4>
            <p className="text-xs text-slate-500 mt-1">{template.description}</p>

            {isAnalyzed && !isCurrentlyAnalyzing && (
              <p className="text-[10px] font-bold text-emerald-600 mt-3 uppercase">
                Análise disponível
              </p>
            )}

            {!isAnalyzed && !isCurrentlyAnalyzing && (
              <p className="text-[10px] font-bold text-slate-400 mt-3 uppercase">
                Clique para analisar
              </p>
            )}
          </Card>
        )
      })}
    </div>
  )
}
