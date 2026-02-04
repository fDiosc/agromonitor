/**
 * Debug Script - Análise de Fenologia e Consistência de Datas
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function debugPhenology(fieldId: string) {
  console.log('\n========================================')
  console.log('DEBUG: Análise de Fenologia e Consistência')
  console.log('========================================\n')

  try {
    const field = await prisma.field.findUnique({
      where: { id: fieldId },
      include: {
        agroData: true,
        ndviData: {
          orderBy: { date: 'asc' }
        }
      }
    })

    if (!field) {
      console.error('❌ Field não encontrado!')
      return
    }

    const agroData = field.agroData
    const ndviData = field.ndviData || []
    const today = new Date()

    console.log('📋 Informações Básicas')
    console.log('----------------------------------------')
    console.log(`   Nome: ${field.name}`)
    console.log(`   Cultura: ${field.cropType}`)
    console.log(`   Data Atual: ${today.toISOString().split('T')[0]}`)
    console.log('')

    console.log('📅 Datas de Fenologia (AgroData)')
    console.log('----------------------------------------')
    console.log(`   Plantio: ${agroData?.plantingDate?.toISOString().split('T')[0] || 'N/A'}`)
    console.log(`   SOS: ${agroData?.sosDate?.toISOString().split('T')[0] || 'N/A'}`)
    console.log(`   EOS (NDVI): ${agroData?.eosDate?.toISOString().split('T')[0] || 'N/A'}`)
    console.log(`   Método: ${agroData?.phenologyMethod || 'N/A'}`)
    console.log(`   Confiança: ${agroData?.confidenceScore || 'N/A'}%`)
    console.log('')

    // Verificar rawAreaData para GDD
    if (agroData?.rawAreaData) {
      const areaData = JSON.parse(agroData.rawAreaData as string)
      console.log('🌡️  Dados GDD (Soma Térmica)')
      console.log('----------------------------------------')
      
      // Verificar estrutura
      const thermal = areaData.thermal
      console.log(`   thermal existe: ${!!thermal}`)
      
      if (thermal) {
        // thermal pode ser string ou objeto
        const thermalParsed = typeof thermal === 'string' ? JSON.parse(thermal) : thermal
        console.log(`   thermal keys: ${Object.keys(thermalParsed)}`)
        
        if (thermalParsed.gddAnalysis) {
          const gdd = thermalParsed.gddAnalysis
          console.log(`   GDD Acumulado: ${gdd.accumulatedGdd?.toFixed?.(0) || gdd.accumulatedGdd}`)
          console.log(`   GDD Necessário: ${gdd.requiredGdd}`)
          console.log(`   Progresso: ${gdd.progressPercent?.toFixed?.(1) || gdd.progressPercent}%`)
          console.log(`   Dias para Maturação: ${gdd.daysToMaturity}`)
          console.log(`   EOS Projetado (GDD): ${gdd.projectedEos}`)
          console.log(`   Confiança: ${gdd.confidence}`)
        } else {
          console.log('   ❌ gddAnalysis não encontrado')
        }
      } else {
        console.log('   ❌ thermal não encontrado')
      }
      console.log('')
    }

    // Analisar curva NDVI
    console.log('📈 Análise da Curva NDVI')
    console.log('----------------------------------------')
    
    const currentSeasonNdvi = ndviData.filter((p: any) => !p.isHistorical)
    console.log(`   Total pontos: ${currentSeasonNdvi.length}`)
    
    if (currentSeasonNdvi.length > 0) {
      // Encontrar pico
      let peakNdvi = 0
      let peakDate = ''
      for (const pt of currentSeasonNdvi) {
        const ndvi = pt.ndviSmooth || pt.ndviRaw || 0
        if (ndvi > peakNdvi) {
          peakNdvi = ndvi
          peakDate = pt.date.toISOString().split('T')[0]
        }
      }
      
      const lastPt = currentSeasonNdvi[currentSeasonNdvi.length - 1]
      const lastNdvi = lastPt.ndviSmooth || lastPt.ndviRaw || 0
      const lastDate = lastPt.date.toISOString().split('T')[0]
      
      console.log(`   Pico NDVI: ${peakNdvi.toFixed(3)} em ${peakDate}`)
      console.log(`   Último NDVI: ${lastNdvi.toFixed(3)} em ${lastDate}`)
      
      // Calcular se está em declínio
      const peakIdx = currentSeasonNdvi.findIndex((p: any) => 
        (p.ndviSmooth || p.ndviRaw) === peakNdvi
      )
      const lastIdx = currentSeasonNdvi.length - 1
      
      if (peakIdx === lastIdx) {
        console.log(`   Status: 🟢 Ainda subindo ou no pico`)
      } else {
        const declineRate = (peakNdvi - lastNdvi) / (lastIdx - peakIdx)
        console.log(`   Status: 🟡 Em declínio`)
        console.log(`   Taxa declínio: ${(declineRate * 100).toFixed(2)}% por ponto`)
        
        // Estimar quando NDVI chegará a 0.5 (indicativo de senescência)
        const targetNdvi = 0.5
        if (lastNdvi > targetNdvi) {
          const pointsToTarget = (lastNdvi - targetNdvi) / declineRate
          console.log(`   Pontos até NDVI 0.5: ${pointsToTarget.toFixed(0)}`)
        }
      }
    }
    console.log('')

    // Comparar EOS
    console.log('⚠️  Análise de Consistência')
    console.log('----------------------------------------')
    
    const eosNdvi = agroData?.eosDate
    let eosGdd: Date | null = null
    let gddAnalysis: any = null
    
    if (agroData?.rawAreaData) {
      const areaData = JSON.parse(agroData.rawAreaData as string)
      const thermal = areaData.thermal
      if (thermal) {
        const thermalParsed = typeof thermal === 'string' ? JSON.parse(thermal) : thermal
        if (thermalParsed.gddAnalysis?.projectedEos) {
          eosGdd = new Date(thermalParsed.gddAnalysis.projectedEos)
          gddAnalysis = thermalParsed.gddAnalysis
        }
      }
    }
    
    console.log(`   EOS NDVI: ${eosNdvi?.toISOString().split('T')[0] || 'N/A'}`)
    console.log(`   EOS GDD: ${eosGdd?.toISOString().split('T')[0] || 'N/A'}`)
    
    if (eosNdvi && eosGdd) {
      const diffDays = Math.round((eosGdd.getTime() - eosNdvi.getTime()) / (1000 * 60 * 60 * 24))
      console.log(`   EOS NDVI: ${eosNdvi.toISOString().split('T')[0]}`)
      console.log(`   EOS GDD: ${eosGdd.toISOString().split('T')[0]}`)
      console.log(`   Diferença: ${diffDays} dias`)
      
      // Verificar qual faz mais sentido
      if (eosNdvi < today) {
        console.log(`   ⚠️  EOS NDVI já passou! (${Math.round((today.getTime() - eosNdvi.getTime()) / (1000 * 60 * 60 * 24))} dias atrás)`)
      }
      if (eosGdd < today) {
        console.log(`   ⚠️  EOS GDD já passou! (${Math.round((today.getTime() - eosGdd.getTime()) / (1000 * 60 * 60 * 24))} dias atrás)`)
      }
      
      // Verificar NDVI atual
      if (currentSeasonNdvi.length > 0) {
        const lastPt = currentSeasonNdvi[currentSeasonNdvi.length - 1]
        const lastNdvi = lastPt.ndviSmooth || lastPt.ndviRaw || 0
        
        if (lastNdvi > 0.7 && eosNdvi < today) {
          console.log(`   🔴 INCONSISTÊNCIA: NDVI ainda alto (${lastNdvi.toFixed(2)}) mas EOS NDVI já passou`)
          console.log(`      → O EOS do GDD (${eosGdd.toISOString().split('T')[0]}) parece mais realista`)
        }
      }
    }
    
    console.log('')
    
    // Recomendação
    console.log('💡 Recomendação')
    console.log('----------------------------------------')
    
    const currentNdvi = currentSeasonNdvi.length > 0 
      ? (currentSeasonNdvi[currentSeasonNdvi.length - 1].ndviSmooth || currentSeasonNdvi[currentSeasonNdvi.length - 1].ndviRaw || 0)
      : 0
    
    if (eosGdd && eosNdvi) {
      if (currentNdvi > 0.7 && eosNdvi < today) {
        console.log('   O NDVI atual ainda está alto, indicando que a planta não entrou')
        console.log('   em senescência. O EOS baseado em GDD parece mais preciso.')
        console.log('')
        console.log('   SUGESTÃO: Usar GDD como método primário quando:')
        console.log('   1. NDVI ainda > 0.7 e EOS NDVI já passou')
        console.log('   2. Confiança GDD > Confiança NDVI')
        console.log('')
        console.log('   OU mostrar ambas as projeções com explicação:')
        console.log('   "Projeção NDVI: 18/01 | Projeção GDD: 11/02"')
        console.log('   "Baseado no NDVI atual (0.88), a projeção GDD é mais provável"')
      } else {
        console.log('   As projeções estão relativamente alinhadas ou o NDVI já caiu.')
      }
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

const fieldId = process.argv[2] || 'cml6z0qdr03ngreuk2w3lyo1t'
debugPhenology(fieldId)
