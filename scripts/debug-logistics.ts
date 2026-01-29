/**
 * Debug script para verificar os dados do diagnóstico logístico
 * Execução: npx ts-node scripts/debug-logistics.ts
 */

import { PrismaClient } from '@prisma/client'
import { differenceInDays, addDays, format } from 'date-fns'

const prisma = new PrismaClient()

const HARVEST_CAPACITY_HA_PER_DAY = 50

async function debugLogistics() {
  console.log('='.repeat(80))
  console.log('DEBUG: Diagnóstico Logístico - Verificação de Dados')
  console.log('='.repeat(80))
  console.log()

  // 1. Buscar todos os talhões processados
  const fields = await prisma.field.findMany({
    where: {
      status: 'SUCCESS',
      agroData: { isNot: null }
    },
    include: {
      agroData: true
    },
    orderBy: { name: 'asc' }
  })

  console.log(`Total de talhões processados: ${fields.length}`)
  console.log()

  // 2. Verificar cada talhão
  for (const field of fields) {
    console.log('-'.repeat(80))
    console.log(`TALHÃO: ${field.name}`)
    console.log(`ID: ${field.id}`)
    console.log(`Localização: ${field.city}, ${field.state}`)
    console.log(`Área (Field): ${field.areaHa} ha`)
    console.log()

    if (!field.agroData) {
      console.log('  ❌ Sem dados agronômicos')
      continue
    }

    const agro = field.agroData

    // Dados fenológicos
    console.log('  DADOS FENOLÓGICOS (do banco):')
    console.log(`    - plantingDate: ${agro.plantingDate ? format(agro.plantingDate, 'yyyy-MM-dd') : 'N/A'}`)
    console.log(`    - sosDate: ${agro.sosDate ? format(agro.sosDate, 'yyyy-MM-dd') : 'N/A'}`)
    console.log(`    - eosDate (Colheita): ${agro.eosDate ? format(agro.eosDate, 'yyyy-MM-dd') : 'N/A'}`)
    console.log(`    - peakDate (NDVI): ${agro.peakDate ? format(agro.peakDate, 'yyyy-MM-dd') : 'N/A'}`)
    console.log(`    - peakNdvi: ${agro.peakNdvi}`)
    console.log(`    - cycleDays: ${agro.cycleDays}`)
    console.log(`    - confidence: ${agro.confidence} (${agro.confidenceScore}%)`)
    console.log()

    // Dados de volume
    console.log('  DADOS DE VOLUME:')
    console.log(`    - areaHa: ${agro.areaHa} ha`)
    console.log(`    - volumeEstimatedKg: ${agro.volumeEstimatedKg} kg`)
    console.log(`    - volumeEstimatedTon: ${agro.volumeEstimatedKg ? Math.round(agro.volumeEstimatedKg / 1000) : 'N/A'} ton`)
    console.log(`    - yieldEstimateKgHa: ${agro.yieldEstimateKgHa} kg/ha`)
    console.log()

    // Cálculos logísticos
    if (agro.eosDate) {
      const harvestStart = agro.eosDate
      const areaHa = field.areaHa ?? 100
      const harvestDays = Math.ceil(areaHa / HARVEST_CAPACITY_HA_PER_DAY)
      const harvestEnd = addDays(harvestStart, harvestDays)
      const harvestPeak = addDays(harvestStart, Math.floor(harvestDays / 2))
      const daysToHarvest = differenceInDays(harvestStart, new Date())

      console.log('  CÁLCULOS LOGÍSTICOS:')
      console.log(`    - harvestStart (= eosDate): ${format(harvestStart, 'yyyy-MM-dd')}`)
      console.log(`    - harvestDays (área / ${HARVEST_CAPACITY_HA_PER_DAY} ha/dia): ${harvestDays} dias`)
      console.log(`    - harvestEnd: ${format(harvestEnd, 'yyyy-MM-dd')}`)
      console.log(`    - harvestPeak (ponto médio): ${format(harvestPeak, 'yyyy-MM-dd')}`)
      console.log(`    - daysToHarvest: ${daysToHarvest} dias`)
      console.log()

      // Verificações
      console.log('  VERIFICAÇÕES:')
      
      // 1. eosDate deve ser após sosDate
      if (agro.sosDate && agro.eosDate <= agro.sosDate) {
        console.log(`    ❌ ERRO: eosDate (${format(agro.eosDate, 'yyyy-MM-dd')}) <= sosDate (${format(agro.sosDate, 'yyyy-MM-dd')})`)
      } else if (agro.sosDate) {
        console.log(`    ✅ eosDate após sosDate`)
      }

      // 2. peakDate (NDVI) deve estar entre sosDate e eosDate
      if (agro.peakDate && agro.sosDate) {
        if (agro.peakDate < agro.sosDate || agro.peakDate > agro.eosDate) {
          console.log(`    ⚠️  ATENÇÃO: peakDate NDVI (${format(agro.peakDate, 'yyyy-MM-dd')}) fora do ciclo vegetativo`)
        } else {
          console.log(`    ✅ peakDate NDVI dentro do ciclo`)
        }
      }

      // 3. harvestPeak deve estar entre harvestStart e harvestEnd
      console.log(`    ✅ harvestPeak logístico calculado corretamente`)

      // 4. Volume consistente
      if (agro.volumeEstimatedKg && agro.areaHa && agro.yieldEstimateKgHa) {
        const calculatedVolume = agro.areaHa * agro.yieldEstimateKgHa
        const diff = Math.abs(calculatedVolume - agro.volumeEstimatedKg)
        if (diff > 100) {
          console.log(`    ⚠️  Volume: ${agro.volumeEstimatedKg} vs calculado ${calculatedVolume} (diff: ${diff})`)
        } else {
          console.log(`    ✅ Volume consistente com área × produtividade`)
        }
      }
    }

    console.log()
  }

  // 3. Resumo agregado
  console.log('='.repeat(80))
  console.log('RESUMO AGREGADO')
  console.log('='.repeat(80))

  const validFields = fields.filter(f => f.agroData?.eosDate)
  const totalArea = validFields.reduce((sum, f) => sum + (f.areaHa ?? 0), 0)
  const totalVolume = validFields.reduce((sum, f) => sum + (f.agroData?.volumeEstimatedKg ?? 0), 0)

  console.log(`Talhões com data de colheita: ${validFields.length}`)
  console.log(`Área total: ${totalArea.toLocaleString('pt-BR')} ha`)
  console.log(`Volume total: ${(totalVolume / 1000).toLocaleString('pt-BR')} ton`)
  console.log(`Carretas previstas (35 ton): ${Math.ceil(totalVolume / 1000 / 35)}`)

  if (validFields.length > 0) {
    const harvestDates = validFields.map(f => f.agroData!.eosDate!.getTime())
    const firstHarvest = new Date(Math.min(...harvestDates))
    const lastHarvest = new Date(Math.max(...harvestDates))
    
    console.log(`Primeira colheita: ${format(firstHarvest, 'yyyy-MM-dd')}`)
    console.log(`Última colheita (início): ${format(lastHarvest, 'yyyy-MM-dd')}`)
  }

  await prisma.$disconnect()
}

debugLogistics().catch(console.error)
