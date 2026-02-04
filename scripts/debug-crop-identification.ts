/**
 * Debug Script - Identificação de Cultura baseado em dados fenológicos
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Referências de GDD por cultura (base 10°C)
const CROP_GDD_REQUIREMENTS: Record<string, { min: number, max: number, typicalCycleDays: { min: number, max: number } }> = {
  'SOJA': { min: 1100, max: 1500, typicalCycleDays: { min: 100, max: 150 } },
  'MILHO': { min: 800, max: 1200, typicalCycleDays: { min: 120, max: 180 } },
  'MILHO_SAFRINHA': { min: 750, max: 1000, typicalCycleDays: { min: 110, max: 150 } },
  'TRIGO': { min: 1500, max: 2000, typicalCycleDays: { min: 100, max: 140 } },
  'ALGODAO': { min: 1600, max: 2200, typicalCycleDays: { min: 150, max: 200 } },
  'FEIJAO': { min: 800, max: 1200, typicalCycleDays: { min: 70, max: 110 } },
  'CANA': { min: 2500, max: 4000, typicalCycleDays: { min: 300, max: 540 } }
}

// Características típicas de NDVI por cultura
const NDVI_CHARACTERISTICS: Record<string, { peakNdvi: { min: number, max: number }, daysToPleak: { min: number, max: number } }> = {
  'SOJA': { peakNdvi: { min: 0.8, max: 0.95 }, daysToPleak: { min: 50, max: 80 } },
  'MILHO': { peakNdvi: { min: 0.75, max: 0.9 }, daysToPleak: { min: 60, max: 90 } },
  'MILHO_SAFRINHA': { peakNdvi: { min: 0.7, max: 0.85 }, daysToPleak: { min: 50, max: 80 } },
  'TRIGO': { peakNdvi: { min: 0.7, max: 0.85 }, daysToPleak: { min: 45, max: 70 } },
  'ALGODAO': { peakNdvi: { min: 0.75, max: 0.9 }, daysToPleak: { min: 80, max: 120 } },
  'FEIJAO': { peakNdvi: { min: 0.7, max: 0.85 }, daysToPleak: { min: 35, max: 55 } }
}

async function debugCropIdentification(fieldId: string) {
  console.log('\n========================================')
  console.log('DEBUG: Identificação de Cultura')
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
    const ndviData = (field.ndviData || []).filter((p: any) => !p.isHistorical)
    
    console.log('📋 Dados do Campo')
    console.log('----------------------------------------')
    console.log(`   Nome: ${field.name}`)
    console.log(`   Cultura registrada: ${field.cropType}`)
    console.log(`   Localização: ${field.city}, ${field.state}`)
    console.log('')

    // Calcular métricas da safra atual
    const plantingDate = agroData?.plantingDate
    const sosDate = agroData?.sosDate
    
    if (!plantingDate || ndviData.length === 0) {
      console.log('❌ Dados insuficientes para análise')
      return
    }

    // Encontrar pico NDVI
    let peakNdvi = 0
    let peakDate: Date | null = null
    for (const pt of ndviData) {
      const ndvi = pt.ndviSmooth || pt.ndviRaw || 0
      if (ndvi > peakNdvi) {
        peakNdvi = ndvi
        peakDate = pt.date
      }
    }

    const lastPt = ndviData[ndviData.length - 1]
    const lastNdvi = lastPt.ndviSmooth || lastPt.ndviRaw || 0
    const lastDate = lastPt.date

    // Calcular dias desde plantio até pico
    const daysToPleak = peakDate 
      ? Math.round((peakDate.getTime() - plantingDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0

    // Calcular dias desde plantio até agora
    const today = new Date()
    const daysSincePlanting = Math.round((today.getTime() - plantingDate.getTime()) / (1000 * 60 * 60 * 24))

    // Calcular ciclo até último dado NDVI
    const daysToLastNdvi = Math.round((lastDate.getTime() - plantingDate.getTime()) / (1000 * 60 * 60 * 24))

    console.log('📊 Métricas da Safra Atual')
    console.log('----------------------------------------')
    console.log(`   Plantio: ${plantingDate.toISOString().split('T')[0]}`)
    console.log(`   Dias desde plantio: ${daysSincePlanting}`)
    console.log(`   Pico NDVI: ${peakNdvi.toFixed(3)} em ${peakDate?.toISOString().split('T')[0]}`)
    console.log(`   Dias até pico: ${daysToPleak}`)
    console.log(`   Último NDVI: ${lastNdvi.toFixed(3)} em ${lastDate.toISOString().split('T')[0]}`)
    console.log(`   Dias até último dado: ${daysToLastNdvi}`)
    console.log('')

    // Analisar GDD se disponível
    let gddAccumulated = 0
    let gddRequired = 0
    if (agroData?.rawAreaData) {
      const areaData = JSON.parse(agroData.rawAreaData as string)
      const thermal = areaData.thermal
      if (thermal) {
        const thermalParsed = typeof thermal === 'string' ? JSON.parse(thermal) : thermal
        if (thermalParsed.gddAnalysis) {
          gddAccumulated = thermalParsed.gddAnalysis.accumulatedGdd
          gddRequired = thermalParsed.gddAnalysis.requiredGdd
          console.log('🌡️  Dados GDD')
          console.log('----------------------------------------')
          console.log(`   GDD Acumulado: ${gddAccumulated.toFixed(0)}`)
          console.log(`   GDD Requerido (config): ${gddRequired}`)
          console.log('')
        }
      }
    }

    // Comparar com características de cada cultura
    console.log('🔍 Análise de Compatibilidade por Cultura')
    console.log('----------------------------------------')
    
    const scores: Array<{ crop: string, score: number, reasons: string[] }> = []

    for (const [crop, gddReq] of Object.entries(CROP_GDD_REQUIREMENTS)) {
      let score = 0
      const reasons: string[] = []
      const ndviChar = NDVI_CHARACTERISTICS[crop]

      // 1. Verificar GDD (se disponível)
      if (gddAccumulated > 0) {
        // Se GDD acumulado está próximo do requerido para a cultura
        if (gddAccumulated >= gddReq.min * 0.8 && gddAccumulated <= gddReq.max * 1.2) {
          score += 25
          reasons.push(`GDD compatível (${gddReq.min}-${gddReq.max})`)
        } else if (gddAccumulated < gddReq.min * 0.5) {
          reasons.push(`GDD muito baixo para ${crop}`)
        } else if (gddAccumulated > gddReq.max * 1.5) {
          reasons.push(`GDD muito alto para ${crop}`)
        }
      }

      // 2. Verificar ciclo (dias desde plantio)
      if (daysSincePlanting >= gddReq.typicalCycleDays.min * 0.8 && 
          daysSincePlanting <= gddReq.typicalCycleDays.max * 1.2) {
        score += 25
        reasons.push(`Ciclo compatível (${gddReq.typicalCycleDays.min}-${gddReq.typicalCycleDays.max}d)`)
      }

      // 3. Verificar pico NDVI
      if (ndviChar) {
        if (peakNdvi >= ndviChar.peakNdvi.min && peakNdvi <= ndviChar.peakNdvi.max) {
          score += 25
          reasons.push(`Pico NDVI compatível (${ndviChar.peakNdvi.min}-${ndviChar.peakNdvi.max})`)
        }

        // 4. Verificar dias até pico
        if (daysToPleak >= ndviChar.daysToPleak.min && daysToPleak <= ndviChar.daysToPleak.max) {
          score += 25
          reasons.push(`Dias até pico compatível (${ndviChar.daysToPleak.min}-${ndviChar.daysToPleak.max})`)
        }
      }

      scores.push({ crop, score, reasons })
    }

    // Ordenar por score
    scores.sort((a, b) => b.score - a.score)

    for (const { crop, score, reasons } of scores) {
      const match = score >= 75 ? '✅' : score >= 50 ? '🟡' : '❌'
      console.log(`\n   ${match} ${crop}: ${score}% compatível`)
      if (reasons.length > 0) {
        reasons.forEach(r => console.log(`      - ${r}`))
      }
    }

    console.log('')

    // Diagnóstico final
    console.log('💡 Diagnóstico')
    console.log('----------------------------------------')
    
    const registeredCrop = field.cropType
    const topMatch = scores[0]
    const registeredScore = scores.find(s => s.crop === registeredCrop)

    if (registeredScore && registeredScore.score >= 75) {
      console.log(`   ✅ Cultura registrada (${registeredCrop}) é COMPATÍVEL com os dados`)
      console.log(`      Score: ${registeredScore.score}%`)
    } else if (registeredScore && registeredScore.score >= 50) {
      console.log(`   🟡 Cultura registrada (${registeredCrop}) tem compatibilidade MÉDIA`)
      console.log(`      Score: ${registeredScore.score}%`)
      if (topMatch.crop !== registeredCrop) {
        console.log(`      ⚠️  Cultura mais provável: ${topMatch.crop} (${topMatch.score}%)`)
      }
    } else {
      console.log(`   🔴 Cultura registrada (${registeredCrop}) tem BAIXA compatibilidade`)
      console.log(`      Score: ${registeredScore?.score || 0}%`)
      console.log(`      ⚠️  Cultura mais provável: ${topMatch.crop} (${topMatch.score}%)`)
    }

    // Verificar especificamente para Guarapuava/PR
    console.log('')
    console.log('🌍 Contexto Regional (Guarapuava, PR)')
    console.log('----------------------------------------')
    console.log('   Plantio em setembro: Típico para SOJA ou MILHO verão')
    console.log('   Região: Clima subtropical, boa para soja')
    
    if (plantingDate.getMonth() >= 8 && plantingDate.getMonth() <= 11) {
      console.log('   Época de plantio (set-dez): ✅ Compatível com SOJA ou MILHO')
    }

    // Análise do problema específico
    console.log('')
    console.log('⚠️  Análise do Problema de EOS')
    console.log('----------------------------------------')
    console.log(`   EOS NDVI (18/01) sugere ciclo de ${Math.round((new Date('2026-01-18').getTime() - plantingDate.getTime()) / (1000 * 60 * 60 * 24))} dias`)
    console.log(`   EOS GDD (12/02) sugere ciclo de ${Math.round((new Date('2026-02-12').getTime() - plantingDate.getTime()) / (1000 * 60 * 60 * 24))} dias`)
    console.log('')
    console.log('   Ciclo NDVI: 120 dias → Dentro do esperado para SOJA')
    console.log('   Ciclo GDD: 145 dias → No limite superior para SOJA, ou MILHO')
    console.log('')
    console.log('   Possíveis explicações:')
    console.log('   1. Se é SOJA: variedade de ciclo longo ou condições climáticas atrasando maturação')
    console.log('   2. Se é MILHO: o GDD de 1300 está incorreto (milho precisa 800-1200 GDD)')
    console.log('   3. O histórico NDVI usado pode ser de outra cultura')

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
debugCropIdentification(fieldId)
