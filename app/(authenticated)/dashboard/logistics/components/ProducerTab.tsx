'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check, Users, Filter, Wheat, ChevronDown, ChevronUp, MapPin, Calendar, Truck, TrendingUp } from 'lucide-react'
import { SummaryCards } from './SummaryCards'
import { HarvestTimeline } from './HarvestTimeline'
import { ReceiptCurve } from './ReceiptCurve'
import { FieldsSchedule } from './FieldsSchedule'
import { PropertiesMap } from './PropertiesMap'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Producer {
  id: string
  name: string
  cpf?: string
  fieldCount: number
  totalAreaHa: number
}

interface DiagnosticData {
  summary: {
    totalFields: number
    totalAreaHa: number
    totalVolumeKg: number
    totalVolumeTon: number
    totalTrucks: number
    firstHarvestDate: string
    lastHarvestDate: string
    peakStartDate: string
    peakEndDate: string
  }
  dailyForecast: {
    date: string
    volumeKg: number
    cumulativeKg: number
    fieldsHarvesting: number
  }[]
  fields: {
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
    latitude: number
    longitude: number
    daysToHarvest: number
    producerId?: string
    producerName?: string
  }[]
  alerts: {
    daysToFirstHarvest: number
    peakDailyVolume: number
    peakDailyVolumeTon: number
    climateRisk: 'low' | 'medium' | 'high'
    storageUtilization: number
  }
}

interface ProducerTabProps {
  data: DiagnosticData
}

export function ProducerTab({ data }: ProducerTabProps) {
  const [producers, setProducers] = useState<Producer[]>([])
  const [selectedProducerIds, setSelectedProducerIds] = useState<Set<string>>(new Set())
  const [loadingProducers, setLoadingProducers] = useState(true)
  const [expandedProducerId, setExpandedProducerId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchProducers() {
      try {
        const res = await fetch('/api/producers')
        if (res.ok) {
          const result = await res.json()
          // API retorna { producers: [...] }
          setProducers(result.producers || [])
        }
      } catch (error) {
        console.error('Erro ao buscar produtores:', error)
      } finally {
        setLoadingProducers(false)
      }
    }
    fetchProducers()
  }, [])

  // Filtrar dados por produtores selecionados
  const filteredData = useMemo(() => {
    if (selectedProducerIds.size === 0) {
      return null // Nenhum produtor selecionado
    }

    const filteredFields = data.fields.filter(
      field => field.producerId && selectedProducerIds.has(field.producerId)
    )

    if (filteredFields.length === 0) {
      return null
    }

    // Recalcular summary
    const totalAreaHa = filteredFields.reduce((sum, f) => sum + (f.areaHa || 0), 0)
    const totalVolumeKg = filteredFields.reduce((sum, f) => sum + (f.volumeKg || 0), 0)
    const harvestDates = filteredFields
      .map(f => f.harvestStart)
      .filter(Boolean)
      .sort()
    const peakDates = filteredFields
      .map(f => f.peakDate)
      .filter(Boolean)
      .sort()

    const summary = {
      totalFields: filteredFields.length,
      totalAreaHa,
      totalVolumeKg,
      totalVolumeTon: totalVolumeKg / 1000,
      totalTrucks: Math.ceil(totalVolumeKg / 37000),
      firstHarvestDate: harvestDates[0] || '',
      lastHarvestDate: filteredFields
        .map(f => f.harvestEnd)
        .filter(Boolean)
        .sort()
        .pop() || '',
      peakStartDate: peakDates[0] || '',
      peakEndDate: peakDates[peakDates.length - 1] || '',
    }

    // Recalcular dailyForecast (simplificado)
    const dailyForecast = data.dailyForecast.map(day => {
      const fieldsOnDay = filteredFields.filter(f => {
        const start = new Date(f.harvestStart)
        const end = new Date(f.harvestEnd)
        const current = new Date(day.date)
        return current >= start && current <= end
      })
      const volumeKg = fieldsOnDay.reduce((sum, f) => {
        const days = Math.max(1, Math.ceil((new Date(f.harvestEnd).getTime() - new Date(f.harvestStart).getTime()) / (1000 * 60 * 60 * 24)))
        return sum + (f.volumeKg / days)
      }, 0)
      return {
        ...day,
        volumeKg,
        fieldsHarvesting: fieldsOnDay.length,
      }
    }).filter(d => d.volumeKg > 0 || d.fieldsHarvesting > 0)

    // Recalcular cumulativo
    let cumulative = 0
    dailyForecast.forEach(d => {
      cumulative += d.volumeKg
      d.cumulativeKg = cumulative
    })

    return {
      ...data,
      summary,
      dailyForecast,
      fields: filteredFields,
    }
  }, [data, selectedProducerIds])

  const toggleProducer = (id: string) => {
    const newSet = new Set(selectedProducerIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedProducerIds(newSet)
  }

  const selectAll = () => {
    setSelectedProducerIds(new Set(producers.map(p => p.id)))
  }

  const clearAll = () => {
    setSelectedProducerIds(new Set())
  }

  // Produtores com talhões no diagnóstico
  const producersWithFields = useMemo(() => {
    const producerFieldCounts = new Map<string, { count: number; area: number; volumeKg: number }>()
    
    data.fields.forEach(field => {
      if (field.producerId) {
        const current = producerFieldCounts.get(field.producerId) || { count: 0, area: 0, volumeKg: 0 }
        producerFieldCounts.set(field.producerId, {
          count: current.count + 1,
          area: current.area + (field.areaHa || 0),
          volumeKg: current.volumeKg + (field.volumeKg || 0),
        })
      }
    })

    return producers
      .filter(p => producerFieldCounts.has(p.id))
      .map(p => ({
        ...p,
        fieldCount: producerFieldCounts.get(p.id)?.count || 0,
        totalAreaHa: producerFieldCounts.get(p.id)?.area || 0,
        totalVolumeKg: producerFieldCounts.get(p.id)?.volumeKg || 0,
      }))
  }, [producers, data.fields])

  // Talhões do produtor expandido
  const expandedProducerFields = useMemo(() => {
    if (!expandedProducerId) return []
    return data.fields.filter(f => f.producerId === expandedProducerId)
  }, [data.fields, expandedProducerId])

  const toggleExpand = (id: string) => {
    setExpandedProducerId(prev => prev === id ? null : id)
  }

  return (
    <div className="space-y-6">
      {/* Seletor de Produtores */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              Selecionar Produtores
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
                className="text-xs"
              >
                Selecionar Todos
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearAll}
                className="text-xs"
              >
                Limpar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingProducers ? (
            <p className="text-slate-400 text-sm">Carregando produtores...</p>
          ) : producersWithFields.length === 0 ? (
            <div className="text-center py-6">
              <Users className="w-10 h-10 text-slate-500 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">
                Nenhum produtor vinculado aos talhões
              </p>
              <p className="text-slate-500 text-xs mt-1">
                Vincule produtores aos talhões para usar este filtro
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {producersWithFields.map(producer => {
                const isSelected = selectedProducerIds.has(producer.id)
                const isExpanded = expandedProducerId === producer.id
                return (
                  <div key={producer.id} className="rounded-lg border border-slate-600 overflow-hidden">
                    <div className="flex items-center">
                      {/* Checkbox para filtro */}
                      <button
                        onClick={() => toggleProducer(producer.id)}
                        className={`flex items-center justify-center w-10 h-full py-3 ${
                          isSelected ? 'bg-blue-600' : 'bg-slate-700/50 hover:bg-slate-600'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center ${
                          isSelected ? 'bg-white/20' : 'bg-slate-600'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </button>
                      
                      {/* Info do produtor (clicável para expandir) */}
                      <button
                        onClick={() => toggleExpand(producer.id)}
                        className={`flex-1 flex items-center justify-between px-4 py-3 transition-colors ${
                          isExpanded ? 'bg-slate-700' : 'bg-slate-700/50 hover:bg-slate-700/80'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-white">{producer.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-600 text-slate-300">
                            {producer.fieldCount} talhões
                          </span>
                          <span className="text-xs text-slate-400">
                            {producer.totalAreaHa.toFixed(0)} ha
                          </span>
                          <span className="text-xs text-emerald-400">
                            {(producer.totalVolumeKg / 1000).toFixed(0)} ton
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                    </div>
                    
                    {/* Lista de talhões expandida */}
                    {isExpanded && (
                      <div className="bg-slate-800/50 border-t border-slate-600 p-4">
                        <div className="text-xs text-slate-400 uppercase tracking-wider mb-3">
                          Talhões de {producer.name}
                        </div>
                        <div className="grid gap-2">
                          {expandedProducerFields.map(field => (
                            <div 
                              key={field.id}
                              className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                            >
                              <div className="flex items-center gap-4">
                                <div>
                                  <div className="font-medium text-white">{field.name}</div>
                                  <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <MapPin className="w-3 h-3" />
                                    {field.city}, {field.state}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-6 text-sm">
                                <div className="text-right">
                                  <div className="text-slate-400 text-xs">Área</div>
                                  <div className="text-white font-medium">{field.areaHa.toLocaleString('pt-BR')} ha</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-slate-400 text-xs">Volume</div>
                                  <div className="text-emerald-400 font-medium">{(field.volumeKg / 1000).toFixed(0)} ton</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-slate-400 text-xs">Colheita</div>
                                  <div className="flex items-center gap-1 text-blue-400 font-medium">
                                    <Calendar className="w-3 h-3" />
                                    {field.harvestStart ? format(parseISO(field.harvestStart), 'dd/MM', { locale: ptBR }) : '—'}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-slate-400 text-xs">Status</div>
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    field.status === 'harvesting' ? 'bg-green-500/20 text-green-400' :
                                    field.status === 'upcoming' ? 'bg-amber-500/20 text-amber-400' :
                                    field.status === 'attention' ? 'bg-red-500/20 text-red-400' :
                                    'bg-slate-600 text-slate-300'
                                  }`}>
                                    {field.status === 'harvesting' ? 'Colhendo' :
                                     field.status === 'upcoming' ? 'Próximo' :
                                     field.status === 'attention' ? 'Atenção' : 'Aguardando'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {selectedProducerIds.size > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-700 flex items-center gap-2 text-sm text-slate-400">
              <Filter className="w-4 h-4" />
              <span>
                {selectedProducerIds.size} produtor{selectedProducerIds.size > 1 ? 'es' : ''} selecionado{selectedProducerIds.size > 1 ? 's' : ''}
              </span>
              {filteredData && (
                <span className="text-blue-400">
                  • {filteredData.fields.length} talhões • {filteredData.summary.totalAreaHa.toFixed(0)} ha
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conteúdo Filtrado */}
      {selectedProducerIds.size === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-12 text-center">
            <Filter className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              Selecione um ou mais produtores
            </h3>
            <p className="text-slate-400 text-sm">
              O diagnóstico será filtrado para mostrar apenas os talhões dos produtores selecionados
            </p>
          </CardContent>
        </Card>
      ) : !filteredData ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-12 text-center">
            <Wheat className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              Nenhum talhão encontrado
            </h3>
            <p className="text-slate-400 text-sm">
              Os produtores selecionados não possuem talhões com dados processados
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <SummaryCards summary={filteredData.summary} />

          {/* Harvest Timeline */}
          <HarvestTimeline summary={filteredData.summary} />

          {/* Receipt Curve Chart */}
          <ReceiptCurve dailyForecast={filteredData.dailyForecast} />

          {/* Fields Schedule Table */}
          <FieldsSchedule fields={filteredData.fields} />

          {/* Properties Map */}
          <PropertiesMap fields={filteredData.fields} />
        </>
      )}
    </div>
  )
}
