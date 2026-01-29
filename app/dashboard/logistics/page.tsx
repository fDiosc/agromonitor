'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  RefreshCw, 
  MapPin, 
  Truck, 
  Wheat, 
  Calendar,
  AlertTriangle,
  TrendingUp,
  ArrowLeft,
  Warehouse
} from 'lucide-react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { SummaryCards } from './components/SummaryCards'
import { HarvestTimeline } from './components/HarvestTimeline'
import { ReceiptCurve } from './components/ReceiptCurve'
import { FieldsSchedule } from './components/FieldsSchedule'
import { CriticalAlerts } from './components/CriticalAlerts'
import { PropertiesMap } from './components/PropertiesMap'

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

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/logistics/diagnostic')
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
  }

  useEffect(() => {
    fetchData()
  }, [])

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

        {/* Summary Cards */}
        <SummaryCards summary={data.summary} />

        {/* Harvest Timeline */}
        <HarvestTimeline summary={data.summary} />

        {/* Receipt Curve Chart */}
        <ReceiptCurve dailyForecast={data.dailyForecast} />

        {/* Fields Schedule Table */}
        <FieldsSchedule fields={data.fields} />

        {/* Critical Alerts */}
        <CriticalAlerts alerts={data.alerts} />

        {/* Properties Map */}
        <PropertiesMap fields={data.fields} />
      </div>
    </div>
  )
}
