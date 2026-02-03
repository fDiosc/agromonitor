'use client'

import { SummaryCards } from './SummaryCards'
import { HarvestTimeline } from './HarvestTimeline'
import { ReceiptCurve } from './ReceiptCurve'
import { FieldsSchedule } from './FieldsSchedule'
import { CriticalAlerts } from './CriticalAlerts'
import { PropertiesMap } from './PropertiesMap'

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

interface LogisticsUnit {
  id: string
  name: string
  latitude: number | null
  longitude: number | null
  coverageRadiusKm: number | null
  city?: string
  state?: string
}

interface OverviewTabProps {
  data: DiagnosticData
  logisticsUnits?: LogisticsUnit[]
}

export function OverviewTab({ data, logisticsUnits = [] }: OverviewTabProps) {
  return (
    <div className="space-y-6">
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
      <PropertiesMap fields={data.fields} logisticsUnits={logisticsUnits} />
    </div>
  )
}
