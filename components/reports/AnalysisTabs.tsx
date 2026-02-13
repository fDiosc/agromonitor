'use client'

import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { CloudRain, Droplets, Satellite } from 'lucide-react'
import { PrecipitationChart } from '@/components/charts/PrecipitationChart'
import { ClimateEnvelopeChart } from '@/components/charts/ClimateEnvelopeChart'
import { WaterBalanceChart } from '@/components/charts/WaterBalanceChart'
import { GddChart } from '@/components/charts/GddChart'
import { SoilInfoCard } from '@/components/cards/SoilInfoCard'
import { SatelliteScheduleCard } from '@/components/satellite/SatelliteScheduleCard'
import { formatEnvelopeForChart, getRiskLevel } from '@/lib/utils/report-chart-utils'

export interface AnalysisTabsProps {
  featureFlags: any
  precipitationData: any
  harvestWindow: any
  harvestAdjustment: any
  waterBalanceData: any
  eosAdjustment: any
  thermalData: any
  climateEnvelopeData: any
  soilData: any
  satelliteSchedule: any
  fieldId: string
  cropType: string
  plantingDate?: string | null
  sosDate?: string | null
}

export function AnalysisTabs({
  featureFlags,
  precipitationData,
  harvestWindow,
  harvestAdjustment,
  waterBalanceData,
  eosAdjustment,
  thermalData,
  climateEnvelopeData,
  soilData,
  satelliteSchedule,
  fieldId,
  cropType,
  plantingDate,
  sosDate
}: AnalysisTabsProps) {
  const showClima = (
    (precipitationData?.points?.length > 0 && featureFlags?.showPrecipitationChart !== false) ||
    (thermalData?.temperature?.points?.length > 0 && featureFlags?.showGddChart === true) ||
    (climateEnvelopeData?.precipitation && featureFlags?.showClimateEnvelope === true) ||
    (climateEnvelopeData?.temperature && featureFlags?.showClimateEnvelope === true)
  )

  const showBalancoHidrico = (
    waterBalanceData?.points?.length > 0 && featureFlags?.showWaterBalanceChart === true
  )

  const showSatelite = (
    (satelliteSchedule && featureFlags?.showSatelliteSchedule !== false) ||
    (soilData && featureFlags?.showSoilInfo !== false)
  )

  if (!showClima && !showBalancoHidrico && !showSatelite) {
    return null
  }

  return (
    <Card className="p-6 rounded-[32px]">
      <Tabs defaultValue="clima" className="w-full">
        <TabsList className="w-full flex justify-start gap-2 bg-slate-100/50 p-2 rounded-2xl mb-6">
          {showClima && (
            <TabsTrigger
              value="clima"
              className="flex items-center gap-2 px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-xl"
            >
              <CloudRain size={16} />
              <span>Clima</span>
            </TabsTrigger>
          )}

          {showBalancoHidrico && (
            <TabsTrigger
              value="balanco"
              className="flex items-center gap-2 px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-xl"
            >
              <Droplets size={16} />
              <span>Balanço Hídrico</span>
            </TabsTrigger>
          )}

          {showSatelite && (
            <TabsTrigger
              value="satelite"
              className="flex items-center gap-2 px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-xl"
            >
              <Satellite size={16} />
              <span>Satélite & Solo</span>
            </TabsTrigger>
          )}
        </TabsList>

        {showClima && (
          <TabsContent value="clima" className="space-y-6 mt-0">
            {precipitationData?.points?.length > 0 && featureFlags?.showPrecipitationChart !== false && (
              <PrecipitationChart
                data={precipitationData.points}
                totalMm={precipitationData.totalMm || 0}
                avgDailyMm={precipitationData.avgDailyMm || 0}
                rainyDays={precipitationData.rainyDays || 0}
                harvestStart={harvestWindow?.startDate}
                harvestEnd={harvestWindow?.endDate}
                plantingDate={plantingDate ? new Date(plantingDate).toISOString().split('T')[0] : undefined}
                sosDate={sosDate ? new Date(sosDate).toISOString().split('T')[0] : undefined}
                grainQualityRisk={harvestAdjustment?.grainQualityRisk}
                recentPrecipMm={harvestAdjustment?.recentPrecipMm}
                delayDays={harvestAdjustment?.delayDays}
              />
            )}

            {thermalData?.temperature?.points?.length > 0 && featureFlags?.showGddChart === true && (
              <GddChart
                data={thermalData.temperature.points}
                accumulatedGdd={thermalData.gddAnalysis?.accumulatedGdd || 0}
                requiredGdd={thermalData.gddAnalysis?.requiredGdd || 1300}
                progressPercent={thermalData.gddAnalysis?.progressPercent || 0}
                daysToMaturity={thermalData.gddAnalysis?.daysToMaturity}
                projectedEos={thermalData.gddAnalysis?.projectedEos}
                confidence={thermalData.gddAnalysis?.confidence || 'LOW'}
                crop={cropType}
              />
            )}

            {climateEnvelopeData?.precipitation?.envelope?.points?.length > 0 && featureFlags?.showClimateEnvelope === true && (
              <ClimateEnvelopeChart
                type="PRECIPITATION"
                data={formatEnvelopeForChart(climateEnvelopeData.precipitation)}
                summary={climateEnvelopeData.precipitation.summary}
                historicalYears={climateEnvelopeData.precipitation.envelope?.historicalYears || 5}
                riskLevel={getRiskLevel(climateEnvelopeData.precipitation.summary)}
              />
            )}

            {climateEnvelopeData?.temperature?.envelope?.points?.length > 0 && featureFlags?.showClimateEnvelope === true && (
              <ClimateEnvelopeChart
                type="TEMPERATURE"
                data={formatEnvelopeForChart(climateEnvelopeData.temperature)}
                summary={climateEnvelopeData.temperature.summary}
                historicalYears={climateEnvelopeData.temperature.envelope?.historicalYears || 3}
                riskLevel={getRiskLevel(climateEnvelopeData.temperature.summary)}
              />
            )}

            {(!climateEnvelopeData?.precipitation?.envelope?.points?.length &&
              !climateEnvelopeData?.temperature?.envelope?.points?.length &&
              featureFlags?.showClimateEnvelope === true) && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
                <div className="font-medium">Envelope Climático Indisponível</div>
                <p className="text-xs mt-1">
                  Dados históricos insuficientes para gerar o envelope climático.
                  É necessário ao menos 2 anos de dados históricos.
                </p>
              </div>
            )}
          </TabsContent>
        )}

        {showBalancoHidrico && (
          <TabsContent value="balanco" className="space-y-6 mt-0">
            <WaterBalanceChart
              data={waterBalanceData.points}
              totalDeficit={waterBalanceData.totalDeficit || 0}
              totalExcess={waterBalanceData.totalExcess || 0}
              stressDays={waterBalanceData.stressDays || 0}
              excessDays={waterBalanceData.excessDays || 0}
              stressLevel={eosAdjustment?.stressLevel}
              yieldImpact={eosAdjustment?.yieldImpact}
              adjustmentReason={eosAdjustment?.reason}
            />
          </TabsContent>
        )}

        {showSatelite && (
          <TabsContent value="satelite" className="space-y-6 mt-0">
            {satelliteSchedule && featureFlags?.showSatelliteSchedule !== false && (
              <SatelliteScheduleCard
                fieldId={fieldId}
                lastS2Date={satelliteSchedule.lastS2Date}
                nextS2Date={satelliteSchedule.nextS2Date}
                lastS1Date={satelliteSchedule.lastS1Date}
                nextS1Date={satelliteSchedule.nextS1Date}
                daysUntilNextData={satelliteSchedule.daysUntilNextData}
                upcomingPasses={satelliteSchedule.upcomingPasses}
              />
            )}

            {soilData && featureFlags?.showSoilInfo !== false && (
              <SoilInfoCard data={soilData} />
            )}
          </TabsContent>
        )}
      </Tabs>
    </Card>
  )
}
