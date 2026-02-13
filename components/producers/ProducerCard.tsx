'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import {
  Map,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  MapPin,
  Loader2,
  Eye,
} from 'lucide-react'

interface LogisticsUnit {
  id: string
  name: string
}

interface Field {
  id: string
  name: string
  city: string | null
  state: string | null
  areaHa: number | null
  status: string
  producer?: { id: string; name: string } | null
  logisticsUnit?: { id: string; name: string } | null
  agroData?: {
    volumeEstimatedKg: number | null
    eosDate: string | null
  } | null
}

interface Producer {
  id: string
  name: string
  cpf: string | null
  createdAt: string
  defaultLogisticsUnitId: string | null
  defaultLogisticsUnit: LogisticsUnit | null
  _count: {
    fields: number
  }
}

function formatCPF(cpf: string | null): string {
  if (!cpf) return '-'
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

interface ProducerCardProps {
  producer: Producer
  isExpanded: boolean
  producerFields: Field[]
  loadingFields: boolean
  onToggleExpand: () => void
  onEdit: (producer: Producer) => void
  onDelete: (producer: Producer) => void
  onEditField: (field: Field) => void
}

export function ProducerCard({
  producer,
  isExpanded,
  producerFields,
  loadingFields,
  onToggleExpand,
  onEdit,
  onDelete,
  onEditField,
}: ProducerCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow overflow-hidden">
      <CardContent className="p-0">
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50"
          onClick={onToggleExpand}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
              <span className="text-xl font-bold text-emerald-600">
                {producer.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">{producer.name}</h3>
              <p className="text-sm text-slate-500">
                CPF: {formatCPF(producer.cpf)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Badge variant="outline" className="flex items-center gap-1">
              <Map size={14} />
              {producer._count.fields} talhão(ões)
            </Badge>

            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(producer)}
              >
                <Pencil size={16} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(producer)}
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 size={16} />
              </Button>
            </div>

            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="border-t bg-slate-50 p-4">
            {loadingFields ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : producerFields.length === 0 ? (
              <p className="text-center text-slate-500 py-4">
                Nenhum talhão vinculado a este produtor
              </p>
            ) : (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                  Talhões de {producer.name}
                </h4>
                {producerFields.map(field => (
                  <div
                    key={field.id}
                    className="flex items-center justify-between bg-white p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="font-medium text-slate-900">{field.name}</div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <MapPin className="w-3 h-3" />
                          {field.city || '—'}, {field.state || '—'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-right">
                        <div className="text-xs text-slate-400">Área</div>
                        <div className="font-medium">{field.areaHa?.toLocaleString('pt-BR') || '—'} ha</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-400">Volume</div>
                        <div className="font-medium text-emerald-600">
                          {field.agroData?.volumeEstimatedKg
                            ? `${(field.agroData.volumeEstimatedKg / 1000).toFixed(0)} ton`
                            : '—'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-400">Status</div>
                        <Badge variant={
                          field.status === 'SUCCESS' ? 'success' :
                          field.status === 'PROCESSING' ? 'secondary' :
                          field.status === 'ERROR' ? 'error' : 'secondary'
                        } className="text-xs">
                          {field.status === 'SUCCESS' ? 'OK' :
                           field.status === 'PROCESSING' ? 'Proc.' :
                           field.status === 'ERROR' ? 'Erro' : 'Pend.'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditField({
                            ...field,
                            producer: { id: producer.id, name: producer.name }
                          })}
                          className="text-slate-400 hover:text-blue-600"
                          title="Editar talhão"
                        >
                          <Pencil size={16} />
                        </Button>
                        <Link href={`/reports/${field.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={field.status !== 'SUCCESS'}
                            className="text-slate-400 hover:text-emerald-600"
                            title="Ver relatório"
                          >
                            <Eye size={16} />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
