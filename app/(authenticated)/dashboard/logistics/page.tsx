'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  RefreshCw, 
  Truck, 
  Wheat, 
  AlertTriangle,
  ArrowLeft,
  LayoutGrid,
  Users,
  Warehouse,
  ChevronDown,
  X,
  Settings
} from 'lucide-react'
import Link from 'next/link'
import { OverviewTab } from './components/OverviewTab'
import { ProducerTab } from './components/ProducerTab'

type TabId = 'overview' | 'producer'

interface Tab {
  id: TabId
  label: string
  icon: React.ReactNode
  disabled?: boolean
}

const TABS: Tab[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutGrid className="w-4 h-4" /> },
  { id: 'producer', label: 'Produtor', icon: <Users className="w-4 h-4" /> },
]

interface LogisticsUnit {
  id: string
  name: string
  latitude: number | null
  longitude: number | null
  coverageRadiusKm: number | null
  city?: string
  state?: string
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

export default function LogisticsDiagnosticPage() {
  const [data, setData] = useState<DiagnosticData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  
  // Filtro de caixas logísticas
  const [logisticsUnits, setLogisticsUnits] = useState<LogisticsUnit[]>([])
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([])
  const [showUnitDropdown, setShowUnitDropdown] = useState(false)

  const fetchLogisticsUnits = useCallback(async () => {
    try {
      const response = await fetch('/api/logistics-units')
      if (response.ok) {
        const result = await response.json()
        setLogisticsUnits(result.logisticsUnits || [])
      }
    } catch (err) {
      console.error('Error fetching logistics units:', err)
    }
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Construir URL com filtro de caixas logísticas
      let url = '/api/logistics/diagnostic'
      if (selectedUnitIds.length > 0) {
        url += `?logisticsUnitIds=${selectedUnitIds.join(',')}`
      }
      
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to fetch diagnostic data')
      }
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [selectedUnitIds])

  useEffect(() => {
    fetchLogisticsUnits()
  }, [fetchLogisticsUnits])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const toggleUnit = (unitId: string) => {
    setSelectedUnitIds(prev => 
      prev.includes(unitId) 
        ? prev.filter(id => id !== unitId)
        : [...prev, unitId]
    )
  }

  const clearUnitFilter = () => {
    setSelectedUnitIds([])
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center">
              <RefreshCw className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
              <p className="text-slate-400">Carregando diagnóstico logístico...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-[60vh]">
            <Card className="bg-red-900/20 border-red-500/50">
              <CardContent className="p-6 text-center">
                <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <p className="text-red-400 mb-4">{error}</p>
                <Button onClick={fetchData} variant="outline">
                  Tentar novamente
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  if (!data || data.fields.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-[60vh]">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-8 text-center">
                <Wheat className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-white mb-2">
                  Nenhum talhão processado
                </h2>
                <p className="text-slate-400 mb-6">
                  Adicione e processe talhões para ver o diagnóstico logístico
                </p>
                <Link href="/">
                  <Button>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar ao Dashboard
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  const renderTabContent = () => {
    if (!data) return null

    // Filtrar caixas selecionadas ou todas se nenhuma selecionada
    const unitsToShow = selectedUnitIds.length > 0 
      ? logisticsUnits.filter(u => selectedUnitIds.includes(u.id))
      : logisticsUnits

    switch (activeTab) {
      case 'overview':
        return <OverviewTab data={data} logisticsUnits={unitsToShow} />
      case 'producer':
        return <ProducerTab data={data} />
      default:
        return <OverviewTab data={data} logisticsUnits={unitsToShow} />
    }
  }

  const getSelectedUnitsLabel = () => {
    if (selectedUnitIds.length === 0) return 'Todas as caixas'
    if (selectedUnitIds.length === 1) {
      const unit = logisticsUnits.find(u => u.id === selectedUnitIds[0])
      return unit?.name || 'Caixa selecionada'
    }
    return `${selectedUnitIds.length} caixas selecionadas`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <Truck className="w-7 h-7 text-blue-400" />
                Diagnóstico Logístico
              </h1>
              <p className="text-slate-400 text-sm">
                Visão consolidada para planejamento de recebimento
              </p>
            </div>
          </div>
          <Button onClick={fetchData} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </Button>
        </div>

        {/* Tabs + Filtro de Caixas Logísticas */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-lg border border-slate-700 w-fit">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => !tab.disabled && setActiveTab(tab.id)}
                disabled={tab.disabled}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-lg'
                    : tab.disabled
                    ? 'text-slate-500 cursor-not-allowed'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.disabled && (
                  <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">
                    Em breve
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Seletor de Caixas Logísticas */}
          <div className="flex items-center gap-3">
            {logisticsUnits.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowUnitDropdown(!showUnitDropdown)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 border border-slate-600 rounded-lg text-sm text-slate-200 hover:border-slate-500 transition-colors"
                >
                  <Warehouse className="w-4 h-4 text-amber-400" />
                  {getSelectedUnitsLabel()}
                  {selectedUnitIds.length > 0 && (
                    <span className="bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded text-xs font-medium">
                      {selectedUnitIds.length}
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 transition-transform ${showUnitDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showUnitDropdown && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50">
                    <div className="p-2 border-b border-slate-700 flex items-center justify-between">
                      <span className="text-sm text-slate-400">Filtrar por Caixa Logística</span>
                      {selectedUnitIds.length > 0 && (
                        <button
                          onClick={clearUnitFilter}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          Limpar filtro
                        </button>
                      )}
                    </div>
                    <div className="max-h-64 overflow-y-auto p-1">
                      {logisticsUnits.map(unit => (
                        <button
                          key={unit.id}
                          onClick={() => toggleUnit(unit.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left text-sm transition-colors ${
                            selectedUnitIds.includes(unit.id)
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                            selectedUnitIds.includes(unit.id)
                              ? 'bg-amber-500 border-amber-500'
                              : 'border-slate-500'
                          }`}>
                            {selectedUnitIds.includes(unit.id) && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{unit.name}</div>
                            {unit.coverageRadiusKm && (
                              <div className="text-xs text-slate-500">Raio: {unit.coverageRadiusKm} km</div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <Link href="/dashboard/logistics-units">
              <Button variant="outline" size="sm" className="gap-2 text-slate-300 border-slate-600 hover:bg-slate-700">
                <Settings className="w-4 h-4" />
                Gerenciar
              </Button>
            </Link>
          </div>
        </div>

        {/* Indicador de filtro ativo */}
        {selectedUnitIds.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">Filtrando por:</span>
            <div className="flex flex-wrap gap-2">
              {selectedUnitIds.map(unitId => {
                const unit = logisticsUnits.find(u => u.id === unitId)
                return (
                  <span
                    key={unitId}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-300 rounded-md"
                  >
                    <Warehouse className="w-3 h-3" />
                    {unit?.name}
                    <button
                      onClick={() => toggleUnit(unitId)}
                      className="ml-1 hover:text-amber-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Tab Content */}
        {renderTabContent()}
      </div>
    </div>
  )
}
