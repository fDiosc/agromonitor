'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Table, 
  Calendar, 
  MapPin, 
  ChevronUp, 
  ChevronDown,
  Eye
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'

interface Field {
  id: string
  name: string
  city: string
  state: string
  areaHa: number
  volumeKg: number
  harvestStart: string
  harvestEnd: string
  peakDate: string
  status: 'harvesting' | 'upcoming' | 'attention' | 'waiting'
  riskLevel: 'low' | 'medium' | 'high'
  daysToHarvest: number
}

interface FieldsScheduleProps {
  fields: Field[]
}

type SortKey = 'name' | 'harvestStart' | 'volumeKg' | 'status'
type SortOrder = 'asc' | 'desc'

const statusConfig = {
  harvesting: { label: 'Colhendo', color: 'bg-green-500', textColor: 'text-green-400' },
  upcoming: { label: 'Próximo', color: 'bg-amber-500', textColor: 'text-amber-400' },
  attention: { label: 'Atenção', color: 'bg-red-500', textColor: 'text-red-400' },
  waiting: { label: 'Aguardando', color: 'bg-slate-500', textColor: 'text-slate-400' }
}

const riskConfig = {
  low: { label: 'Baixo', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  medium: { label: 'Médio', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  high: { label: 'Alto', color: 'bg-red-500/20 text-red-400 border-red-500/30' }
}

export function FieldsSchedule({ fields }: FieldsScheduleProps) {
  const [sortKey, setSortKey] = useState<SortKey>('harvestStart')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  const sortedFields = [...fields].sort((a, b) => {
    let comparison = 0
    
    switch (sortKey) {
      case 'name':
        comparison = a.name.localeCompare(b.name)
        break
      case 'harvestStart':
        comparison = a.harvestStart.localeCompare(b.harvestStart)
        break
      case 'volumeKg':
        comparison = a.volumeKg - b.volumeKg
        break
      case 'status':
        const statusOrder = { harvesting: 0, upcoming: 1, attention: 2, waiting: 3 }
        comparison = statusOrder[a.status] - statusOrder[b.status]
        break
    }
    
    return sortOrder === 'asc' ? comparison : -comparison
  })

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortOrder('asc')
    }
  }

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return null
    return sortOrder === 'asc' ? 
      <ChevronUp className="w-4 h-4" /> : 
      <ChevronDown className="w-4 h-4" />
  }

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'dd/MM/yy', { locale: ptBR })
    } catch {
      return dateStr
    }
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
          <Table className="w-5 h-5 text-blue-400" />
          Cronograma por Talhão
          <Badge variant="secondary" className="ml-2">
            {fields.length} talhões
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-4">
                  <button 
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-1 text-slate-400 hover:text-white font-medium text-sm"
                  >
                    Talhão <SortIcon column="name" />
                  </button>
                </th>
                <th className="text-left py-3 px-4">
                  <button 
                    onClick={() => handleSort('harvestStart')}
                    className="flex items-center gap-1 text-slate-400 hover:text-white font-medium text-sm"
                  >
                    Início <SortIcon column="harvestStart" />
                  </button>
                </th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">
                  Pico
                </th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">
                  Fim
                </th>
                <th className="text-left py-3 px-4">
                  <button 
                    onClick={() => handleSort('volumeKg')}
                    className="flex items-center gap-1 text-slate-400 hover:text-white font-medium text-sm"
                  >
                    Volume <SortIcon column="volumeKg" />
                  </button>
                </th>
                <th className="text-left py-3 px-4">
                  <button 
                    onClick={() => handleSort('status')}
                    className="flex items-center gap-1 text-slate-400 hover:text-white font-medium text-sm"
                  >
                    Status <SortIcon column="status" />
                  </button>
                </th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">
                  Risco
                </th>
                <th className="text-right py-3 px-4 text-slate-400 font-medium text-sm">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedFields.map((field) => (
                <tr 
                  key={field.id} 
                  className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div>
                      <p className="text-white font-medium">{field.name}</p>
                      <p className="text-slate-500 text-xs flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {field.city}, {field.state}
                      </p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-500" />
                      <span className="text-white">{formatDate(field.harvestStart)}</span>
                    </div>
                    {field.daysToHarvest > 0 && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        em {field.daysToHarvest} dias
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    {formatDate(field.peakDate)}
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    {formatDate(field.harvestEnd)}
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-white font-medium">
                      {Math.round(field.volumeKg / 1000).toLocaleString('pt-BR')} ton
                    </p>
                    <p className="text-xs text-slate-500">
                      {field.areaHa.toLocaleString('pt-BR')} ha
                    </p>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${statusConfig[field.status].color}`} />
                      <span className={statusConfig[field.status].textColor}>
                        {statusConfig[field.status].label}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge 
                      variant="outline" 
                      className={riskConfig[field.riskLevel].color}
                    >
                      {riskConfig[field.riskLevel].label}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link href={`/reports/${field.id}`}>
                      <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                        <Eye className="w-4 h-4 mr-1" />
                        Ver
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {fields.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            Nenhum talhão com dados de colheita
          </div>
        )}
      </CardContent>
    </Card>
  )
}
