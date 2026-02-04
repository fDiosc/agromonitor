'use client'

import { Shield, Truck, AlertTriangle, Loader2, Check, Lock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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

// Templates disponíveis - apenas LOGISTICS está liberado
const AVAILABLE_TEMPLATES = ['LOGISTICS']

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
        const isLocked = !AVAILABLE_TEMPLATES.includes(template.id)

        return (
          <Card
            key={template.id}
            onClick={() => !isAnalyzing && !isLocked && onSelect(template.id)}
            className={cn(
              'p-5 transition-all relative overflow-hidden',
              isLocked && 'opacity-60 cursor-not-allowed',
              !isLocked && 'cursor-pointer',
              isSelected && !isLocked && `${colors.border} ${colors.bg} shadow-lg ${colors.shadow}`,
              !isSelected && !isLocked && 'hover:border-slate-300 hover:shadow-md',
              isAnalyzing && !isCurrentlyAnalyzing && 'opacity-50 cursor-not-allowed'
            )}
          >
            {/* Badge "Em Breve" para templates bloqueados */}
            {isLocked && (
              <div className="absolute top-3 right-3">
                <Badge className="bg-slate-200 text-slate-600 text-[10px] font-bold">
                  <Lock size={10} className="mr-1" />
                  Em Breve
                </Badge>
              </div>
            )}

            {/* Badge de status para templates disponíveis */}
            {!isLocked && isAnalyzed && !isCurrentlyAnalyzing && (
              <div className="absolute top-3 right-3">
                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                  <Check size={12} className="text-white" />
                </div>
              </div>
            )}

            {!isLocked && isCurrentlyAnalyzing && (
              <div className="absolute top-3 right-3">
                <Loader2 size={18} className="animate-spin text-slate-400" />
              </div>
            )}

            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center mb-3',
              isLocked ? 'bg-slate-100 text-slate-400' : colors.bg,
              !isLocked && colors.text
            )}>
              {iconMap[template.icon] || <Shield size={24} />}
            </div>

            <h4 className={cn(
              'font-bold',
              isLocked ? 'text-slate-500' : 'text-slate-800'
            )}>
              {template.name}
            </h4>
            <p className="text-xs text-slate-500 mt-1">{template.description}</p>

            {!isLocked && isAnalyzed && !isCurrentlyAnalyzing && (
              <p className="text-[10px] font-bold text-emerald-600 mt-3 uppercase">
                Análise disponível
              </p>
            )}

            {!isLocked && !isAnalyzed && !isCurrentlyAnalyzing && (
              <p className="text-[10px] font-bold text-slate-400 mt-3 uppercase">
                Clique para analisar
              </p>
            )}

            {isLocked && (
              <p className="text-[10px] font-bold text-slate-400 mt-3 uppercase">
                Disponível em breve
              </p>
            )}
          </Card>
        )
      })}
    </div>
  )
}
