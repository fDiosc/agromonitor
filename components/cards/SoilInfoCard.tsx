'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Layers, Droplets, Mountain, Info } from 'lucide-react'

interface SoilData {
  tipo_solo?: string
  textura?: string
  tipo?: string
  classificacao?: string
  capacidade_agua?: number
  profundidade?: number
}

interface SoilInfoCardProps {
  data: SoilData | null
  compact?: boolean
}

// Mapeamento de tipos de solo para descrições e cores
const SOIL_CONFIG: Record<string, {
  label: string
  description: string
  color: string
  bgColor: string
  waterRetention: 'BAIXA' | 'MEDIA' | 'ALTA'
}> = {
  'LATOSSOLO VERMELHO': {
    label: 'Latossolo Vermelho',
    description: 'Solo profundo, bem drenado, rico em óxidos de ferro',
    color: 'text-red-700',
    bgColor: 'bg-red-50 border-red-200',
    waterRetention: 'MEDIA'
  },
  'LATOSSOLO AMARELO': {
    label: 'Latossolo Amarelo',
    description: 'Solo profundo, bem drenado, coloração amarelada',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50 border-amber-200',
    waterRetention: 'MEDIA'
  },
  'ARGISSOLO': {
    label: 'Argissolo',
    description: 'Solo com horizonte B textural, boa fertilidade',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50 border-orange-200',
    waterRetention: 'ALTA'
  },
  'NEOSSOLO': {
    label: 'Neossolo',
    description: 'Solo jovem, pouco desenvolvido',
    color: 'text-slate-700',
    bgColor: 'bg-slate-50 border-slate-200',
    waterRetention: 'BAIXA'
  },
  'CAMBISSOLO': {
    label: 'Cambissolo',
    description: 'Solo em desenvolvimento, horizonte B incipiente',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50 border-emerald-200',
    waterRetention: 'MEDIA'
  },
  'NITOSSOLO': {
    label: 'Nitossolo',
    description: 'Solo argiloso, estruturado, alta fertilidade',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50 border-purple-200',
    waterRetention: 'ALTA'
  }
}

// Mapeamento de texturas
const TEXTURE_CONFIG: Record<string, {
  label: string
  icon: React.ReactNode
  waterRetention: 'BAIXA' | 'MEDIA' | 'ALTA'
}> = {
  'Argilosa': {
    label: 'Argilosa',
    icon: <Layers className="w-4 h-4" />,
    waterRetention: 'ALTA'
  },
  'Arenosa': {
    label: 'Arenosa',
    icon: <Mountain className="w-4 h-4" />,
    waterRetention: 'BAIXA'
  },
  'Média': {
    label: 'Média',
    icon: <Layers className="w-4 h-4" />,
    waterRetention: 'MEDIA'
  },
  'Siltosa': {
    label: 'Siltosa',
    icon: <Layers className="w-4 h-4" />,
    waterRetention: 'MEDIA'
  },
  'Argilosa-Arenosa': {
    label: 'Argilosa-Arenosa',
    icon: <Layers className="w-4 h-4" />,
    waterRetention: 'MEDIA'
  }
}

export function SoilInfoCard({ data, compact = false }: SoilInfoCardProps) {
  if (!data) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-600" />
            Informações do Solo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Dados de solo não disponíveis.</p>
        </CardContent>
      </Card>
    )
  }

  const soilType = data.tipo_solo || data.tipo || data.classificacao || 'Desconhecido'
  const texture = data.textura || 'N/A'
  
  // Encontrar configuração do solo
  const soilKey = Object.keys(SOIL_CONFIG).find(key => 
    soilType.toUpperCase().includes(key.toUpperCase())
  )
  const soilConfig = soilKey ? SOIL_CONFIG[soilKey] : null
  
  // Encontrar configuração da textura
  const textureKey = Object.keys(TEXTURE_CONFIG).find(key => 
    texture.toLowerCase().includes(key.toLowerCase())
  )
  const textureConfig = textureKey ? TEXTURE_CONFIG[textureKey] : null

  // Determinar retenção de água
  const waterRetention = textureConfig?.waterRetention || soilConfig?.waterRetention || 'MEDIA'
  const retentionColor = {
    BAIXA: 'bg-red-100 text-red-700 border-red-200',
    MEDIA: 'bg-amber-100 text-amber-700 border-amber-200',
    ALTA: 'bg-emerald-100 text-emerald-700 border-emerald-200'
  }[waterRetention]
  
  const retentionLabel = {
    BAIXA: 'Baixa',
    MEDIA: 'Média',
    ALTA: 'Alta'
  }[waterRetention]

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
        <Layers className="w-5 h-5 text-amber-600" />
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-700">{soilConfig?.label || soilType}</p>
          <p className="text-xs text-slate-500">{texture}</p>
        </div>
        <Badge variant="outline" className={retentionColor}>
          <Droplets className="w-3 h-3 mr-1" />
          {retentionLabel}
        </Badge>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-600" />
            Informações do Solo
          </CardTitle>
          <Badge variant="outline" className={retentionColor}>
            <Droplets className="w-3 h-3 mr-1" />
            Retenção {retentionLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {/* Tipo de Solo */}
          <div className={`p-4 rounded-lg border ${soilConfig?.bgColor || 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Mountain className={`w-5 h-5 ${soilConfig?.color || 'text-slate-600'}`} />
              <p className="text-xs font-medium text-slate-500">Tipo de Solo</p>
            </div>
            <p className={`text-lg font-bold ${soilConfig?.color || 'text-slate-700'}`}>
              {soilConfig?.label || soilType}
            </p>
            {soilConfig?.description && (
              <p className="text-xs text-slate-500 mt-1">{soilConfig.description}</p>
            )}
          </div>

          {/* Textura */}
          <div className="p-4 rounded-lg border bg-slate-50 border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-5 h-5 text-slate-600" />
              <p className="text-xs font-medium text-slate-500">Textura</p>
            </div>
            <p className="text-lg font-bold text-slate-700">{texture}</p>
            {textureConfig && (
              <p className="text-xs text-slate-500 mt-1">
                Retenção de água: {retentionLabel.toLowerCase()}
              </p>
            )}
          </div>
        </div>

        {/* Informação adicional */}
        <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700">
            As características do solo influenciam a capacidade de retenção de água, 
            afetando o balanço hídrico e o desenvolvimento da cultura.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
