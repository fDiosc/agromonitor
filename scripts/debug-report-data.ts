/**
 * Debug Script - Verificar estrutura de dados do relatório
 * 
 * Uso: npx ts-node scripts/debug-report-data.ts <fieldId>
 * Exemplo: npx ts-node scripts/debug-report-data.ts cml6z0qdr03ngreuk2w3lyo1t
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function debugReportData(fieldId: string) {
  console.log('\n========================================')
  console.log('DEBUG: Estrutura de Dados do Relatório')
  console.log('========================================\n')
  console.log(`Field ID: ${fieldId}`)
  console.log(`Data atual: ${new Date().toISOString()}\n`)

  try {
    // 1. Buscar Field com AgroData
    const field = await prisma.field.findUnique({
      where: { id: fieldId },
      include: {
        agroData: true,
        ndviData: {
          orderBy: { date: 'desc' },
          take: 5
        }
      }
    })

    if (!field) {
      console.error('❌ Field não encontrado!')
      return
    }

    console.log('✅ Field encontrado:', field.name)
    console.log('   Cidade:', field.city, '| Estado:', field.state)
    console.log('   Cultura:', field.cropType)
    console.log('')

    // 2. Verificar NDVI Data (para cálculo de satélite)
    console.log('----------------------------------------')
    console.log('📡 NDVI Data (últimos 5 pontos)')
    console.log('----------------------------------------')
    if (field.ndviData && field.ndviData.length > 0) {
      field.ndviData.forEach((pt: any) => {
        console.log(`   ${pt.date.toISOString().split('T')[0]} | NDVI: ${pt.ndviSmooth?.toFixed(3) || pt.ndviRaw?.toFixed(3)}`)
      })
      
      const lastDate = field.ndviData[0].date
      const today = new Date()
      const daysSinceLastData = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
      console.log(`\n   Último dado: ${lastDate.toISOString().split('T')[0]} (${daysSinceLastData} dias atrás)`)
      
      // Calcular próximas passagens CORRETAMENTE
      const s2RevisitDays = 5
      const s1RevisitDays = 6
      
      // Próxima passagem S2: a partir de lastDate, encontrar a próxima que seja >= hoje
      let nextS2 = new Date(lastDate)
      while (nextS2 <= today) {
        nextS2.setDate(nextS2.getDate() + s2RevisitDays)
      }
      
      // Próxima passagem S1
      let nextS1 = new Date(lastDate)
      while (nextS1 <= today) {
        nextS1.setDate(nextS1.getDate() + s1RevisitDays)
      }
      
      console.log(`\n   ⚠️  Cálculo ATUAL (incorreto): ${new Date(lastDate.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`)
      console.log(`   ✅ Cálculo CORRETO S2: ${nextS2.toISOString().split('T')[0]}`)
      console.log(`   ✅ Cálculo CORRETO S1: ${nextS1.toISOString().split('T')[0]}`)
    } else {
      console.log('   ❌ Sem dados NDVI')
    }

    // 3. Verificar AgroData
    console.log('\n----------------------------------------')
    console.log('🌱 AgroData')
    console.log('----------------------------------------')
    const agroData = field.agroData
    if (agroData) {
      console.log('   Área:', agroData.areaHa, 'ha')
      console.log('   Plantio:', agroData.plantingDate?.toISOString().split('T')[0])
      console.log('   SOS:', agroData.sosDate?.toISOString().split('T')[0])
      console.log('   EOS:', agroData.eosDate?.toISOString().split('T')[0])
      console.log('   Método Fenologia:', agroData.phenologyMethod)
      console.log('   Confiança:', agroData.confidenceScore)
    } else {
      console.log('   ❌ Sem AgroData')
    }

    // 4. Verificar rawPrecipData
    console.log('\n----------------------------------------')
    console.log('🌧️  Precipitação (rawPrecipData)')
    console.log('----------------------------------------')
    if (agroData?.rawPrecipData) {
      try {
        const precip = JSON.parse(agroData.rawPrecipData as string)
        console.log('   Estrutura:', Object.keys(precip))
        console.log('   Points:', precip.points?.length || 'N/A')
        console.log('   Total mm:', precip.totalMm)
        console.log('   Dias chuvosos:', precip.rainyDays)
        if (precip.points && precip.points.length > 0) {
          console.log('   Primeiro ponto:', JSON.stringify(precip.points[0]))
          console.log('   Último ponto:', JSON.stringify(precip.points[precip.points.length - 1]))
        }
      } catch (e) {
        console.log('   ❌ Erro ao parsear:', e)
      }
    } else {
      console.log('   ❌ Sem dados de precipitação')
    }

    // 5. Verificar rawAreaData (contém waterBalance, thermal, climateEnvelope)
    console.log('\n----------------------------------------')
    console.log('📊 Dados Adicionais (rawAreaData)')
    console.log('----------------------------------------')
    if (agroData?.rawAreaData) {
      try {
        const areaData = JSON.parse(agroData.rawAreaData as string)
        console.log('   Estrutura principal:', Object.keys(areaData))
        
        // Harvest Adjustment
        console.log('\n   📌 harvestAdjustment:')
        if (areaData.harvestAdjustment) {
          console.log('      ', JSON.stringify(areaData.harvestAdjustment, null, 2).split('\n').join('\n      '))
        } else {
          console.log('      ❌ Não existe')
        }
        
        // Water Balance
        console.log('\n   💧 waterBalance:')
        if (areaData.waterBalance) {
          const wb = typeof areaData.waterBalance === 'string' 
            ? JSON.parse(areaData.waterBalance) 
            : areaData.waterBalance
          console.log('      Estrutura:', Object.keys(wb))
          console.log('      Points:', wb.points?.length || 'N/A')
          console.log('      Total Deficit:', wb.totalDeficit)
          console.log('      Stress Days:', wb.stressDays)
          if (wb.points && wb.points.length > 0) {
            console.log('      Primeiro ponto:', JSON.stringify(wb.points[0]))
          }
        } else {
          console.log('      ❌ Não existe')
        }
        
        // EOS Adjustment
        console.log('\n   📅 eosAdjustment:')
        if (areaData.eosAdjustment) {
          console.log('      ', JSON.stringify(areaData.eosAdjustment, null, 2).split('\n').join('\n      '))
        } else {
          console.log('      ❌ Não existe')
        }
        
        // Thermal (GDD)
        console.log('\n   🌡️  thermal (GDD):')
        if (areaData.thermal) {
          const thermal = typeof areaData.thermal === 'string' 
            ? JSON.parse(areaData.thermal) 
            : areaData.thermal
          console.log('      Estrutura:', Object.keys(thermal))
          
          if (thermal.temperature) {
            const temp = typeof thermal.temperature === 'string'
              ? JSON.parse(thermal.temperature)
              : thermal.temperature
            console.log('      temperature.points:', temp.points?.length || 'N/A')
            if (temp.points && temp.points.length > 0) {
              console.log('      Primeiro ponto temp:', JSON.stringify(temp.points[0]))
            }
          }
          
          if (thermal.gddAnalysis) {
            console.log('      gddAnalysis:', JSON.stringify(thermal.gddAnalysis))
          }
        } else {
          console.log('      ❌ Não existe')
        }
        
        // Climate Envelope
        console.log('\n   📈 climateEnvelope:')
        if (areaData.climateEnvelope) {
          const envelope = areaData.climateEnvelope
          console.log('      Estrutura:', Object.keys(envelope))
          
          if (envelope.precipitation) {
            const precip = typeof envelope.precipitation === 'string'
              ? JSON.parse(envelope.precipitation)
              : envelope.precipitation
            console.log('      precipitation estrutura:', Object.keys(precip))
            console.log('      precipitation.envelope:', precip.envelope ? 'exists' : 'N/A')
            console.log('      precipitation.envelope?.points:', precip.envelope?.points?.length || 'N/A')
            console.log('      precipitation.currentSeason:', precip.currentSeason?.length || 'N/A')
            console.log('      precipitation.summary:', JSON.stringify(precip.summary || {}))
            if (precip.envelope?.points?.length > 0) {
              console.log('      Primeiro ponto envelope:', JSON.stringify(precip.envelope.points[0]))
            }
          } else {
            console.log('      precipitation: N/A')
          }
          
          if (envelope.temperature) {
            const temp = typeof envelope.temperature === 'string'
              ? JSON.parse(envelope.temperature)
              : envelope.temperature
            console.log('      temperature estrutura:', Object.keys(temp))
            console.log('      temperature.envelope:', temp.envelope ? 'exists' : 'N/A')
            console.log('      temperature.envelope?.points:', temp.envelope?.points?.length || 'N/A')
            console.log('      temperature.currentSeason:', temp.currentSeason?.length || 'N/A')
            console.log('      temperature.summary:', JSON.stringify(temp.summary || {}))
            if (temp.envelope?.points?.length > 0) {
              console.log('      Primeiro ponto envelope:', JSON.stringify(temp.envelope.points[0]))
            }
          } else {
            console.log('      temperature: N/A')
          }
        } else {
          console.log('      ❌ Não existe')
        }
        
      } catch (e) {
        console.log('   ❌ Erro ao parsear rawAreaData:', e)
      }
    } else {
      console.log('   ❌ Sem rawAreaData')
    }

    // 6. Verificar rawSoilData
    console.log('\n----------------------------------------')
    console.log('🏔️  Solo (rawSoilData)')
    console.log('----------------------------------------')
    if (agroData?.rawSoilData) {
      try {
        const soil = JSON.parse(agroData.rawSoilData as string)
        console.log('   Estrutura:', typeof soil === 'object' ? Object.keys(soil) : typeof soil)
        const soilInfo = Array.isArray(soil) ? soil[0] : (soil['talhao_0']?.[0] || soil)
        console.log('   SoilInfo:', JSON.stringify(soilInfo, null, 2).split('\n').join('\n   '))
      } catch (e) {
        console.log('   ❌ Erro ao parsear:', e)
      }
    } else {
      console.log('   ❌ Sem dados de solo')
    }

    // 7. Verificar Feature Flags
    console.log('\n----------------------------------------')
    console.log('⚙️  Feature Flags (workspace settings)')
    console.log('----------------------------------------')
    const settings = await prisma.workspaceSettings.findFirst({
      where: { workspaceId: field.workspaceId || 'default-workspace' }
    })
    if (settings) {
      console.log('   showPrecipitationChart:', settings.showPrecipitationChart)
      console.log('   showWaterBalanceChart:', settings.showWaterBalanceChart)
      console.log('   showGddChart:', settings.showGddChart)
      console.log('   showSoilInfo:', settings.showSoilInfo)
      console.log('   showClimateEnvelope:', settings.showClimateEnvelope)
      console.log('   showSatelliteSchedule:', settings.showSatelliteSchedule)
      console.log('   ---')
      console.log('   enablePrecipitation:', settings.enablePrecipitation)
      console.log('   enableWaterBalance:', settings.enableWaterBalance)
      console.log('   enableThermalSum:', settings.enableThermalSum)
      console.log('   enableSoilData:', settings.enableSoilData)
      console.log('   enableClimateEnvelope:', settings.enableClimateEnvelope)
    } else {
      console.log('   ❌ Sem configurações')
    }

    console.log('\n========================================')
    console.log('FIM DO DEBUG')
    console.log('========================================\n')

  } catch (error) {
    console.error('Erro:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Executar
const fieldId = process.argv[2] || 'cml6z0qdr03ngreuk2w3lyo1t'
debugReportData(fieldId)
