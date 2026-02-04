/**
 * Debug script para comparar EOS estimado vs calculado
 * Verifica consistência entre projeções NDVI, GDD e fusão
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface FieldComparison {
  fieldId: string
  name: string
  location: string
  
  // Dados do banco (agroData)
  dbEosDate: string | null
  dbPhenologyMethod: string | null
  dbConfidenceScore: number | null
  
  // Dados calculados
  calcEosNdvi: string | null
  calcEosGdd: string | null
  calcEosFusion: string | null
  calcMethod: string
  calcConfidence: number
  
  // Análise
  gddProgress: number
  currentNdvi: number
  peakNdvi: number
  ndviDeclineRate: number
  stressDays: number
  
  // Consistência
  isConsistent: boolean
  issues: string[]
}

async function debugEosComparison(fieldIds: string[]) {
  console.log('\n' + '='.repeat(80))
  console.log('DEBUG EOS COMPARISON - Estimado vs Calculado')
  console.log('='.repeat(80) + '\n')
  
  const results: FieldComparison[] = []
  
  for (const fieldId of fieldIds) {
    console.log(`\n${'─'.repeat(60)}`)
    console.log(`Analisando: ${fieldId}`)
    console.log('─'.repeat(60))
    
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
      console.log(`❌ Campo não encontrado: ${fieldId}`)
      continue
    }
    
    const agroData = field.agroData
    const comparison: FieldComparison = {
      fieldId: field.id,
      name: field.name,
      location: `${field.city}, ${field.state}`,
      
      dbEosDate: agroData?.eosDate?.toISOString().split('T')[0] || null,
      dbPhenologyMethod: agroData?.phenologyMethod || null,
      dbConfidenceScore: agroData?.confidenceScore || null,
      
      calcEosNdvi: null,
      calcEosGdd: null,
      calcEosFusion: null,
      calcMethod: 'UNKNOWN',
      calcConfidence: 0,
      
      gddProgress: 0,
      currentNdvi: 0,
      peakNdvi: 0,
      ndviDeclineRate: 0,
      stressDays: 0,
      
      isConsistent: true,
      issues: []
    }
    
    // 1. Extrair dados NDVI
    const currentSeasonNdvi = field.ndviData.filter(p => !p.isHistorical)
    if (currentSeasonNdvi.length > 0) {
      const lastPt = currentSeasonNdvi[currentSeasonNdvi.length - 1]
      comparison.currentNdvi = lastPt.ndviSmooth || lastPt.ndviRaw || 0
      
      for (const pt of currentSeasonNdvi) {
        const val = pt.ndviSmooth || pt.ndviRaw || 0
        if (val > comparison.peakNdvi) comparison.peakNdvi = val
      }
      
      // Taxa de declínio
      if (currentSeasonNdvi.length >= 5) {
        const recent = currentSeasonNdvi.slice(-5)
        const firstVal = recent[0].ndviSmooth || recent[0].ndviRaw || 0
        const lastVal = recent[recent.length - 1].ndviSmooth || recent[recent.length - 1].ndviRaw || 0
        comparison.ndviDeclineRate = firstVal > 0 ? ((firstVal - lastVal) / firstVal) * 100 / 5 : 0
      }
    }
    
    // 2. Extrair dados de rawAreaData (thermal/water balance)
    if (agroData?.rawAreaData) {
      try {
        const areaData = JSON.parse(agroData.rawAreaData as string)
        
        // GDD
        if (areaData.thermal) {
          const thermal = typeof areaData.thermal === 'string' 
            ? JSON.parse(areaData.thermal) 
            : areaData.thermal
          
          if (thermal.gddAnalysis) {
            const gdd = thermal.gddAnalysis
            comparison.gddProgress = gdd.requiredGdd > 0 
              ? (gdd.accumulatedGdd / gdd.requiredGdd) * 100 
              : 0
            
            if (gdd.projectedEos) {
              comparison.calcEosGdd = new Date(gdd.projectedEos).toISOString().split('T')[0]
            }
          }
        }
        
        // Water Balance
        if (areaData.waterBalance) {
          const wb = typeof areaData.waterBalance === 'string'
            ? JSON.parse(areaData.waterBalance)
            : areaData.waterBalance
          
          comparison.stressDays = wb.stressDays || 0
        }
      } catch (e) {
        console.log('  ⚠️ Erro ao parsear rawAreaData:', e)
      }
    }
    
    // 3. EOS do banco (NDVI original)
    comparison.calcEosNdvi = comparison.dbEosDate
    
    // 4. Calcular fusão EOS
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const eosNdviDate = comparison.calcEosNdvi ? new Date(comparison.calcEosNdvi) : null
    const eosGddDate = comparison.calcEosGdd ? new Date(comparison.calcEosGdd) : null
    
    // Lógica de fusão simplificada
    if (comparison.gddProgress >= 100 && comparison.currentNdvi < 0.65) {
      // Maturação atingida
      comparison.calcMethod = 'FUSION'
      comparison.calcEosFusion = eosNdviDate && eosNdviDate > today 
        ? comparison.calcEosNdvi 
        : today.toISOString().split('T')[0]
      comparison.calcConfidence = 85
    } else if (eosNdviDate && eosNdviDate < today && comparison.currentNdvi > 0.7) {
      // EOS NDVI passou mas planta ainda verde
      comparison.calcMethod = 'GDD'
      comparison.calcEosFusion = comparison.calcEosGdd
      comparison.calcConfidence = 70
      comparison.issues.push('EOS NDVI já passou, usando GDD')
    } else if (eosNdviDate && eosGddDate && Math.abs(eosNdviDate.getTime() - eosGddDate.getTime()) < 7 * 24 * 60 * 60 * 1000) {
      // Projeções convergem
      comparison.calcMethod = 'FUSION'
      const avgTime = (eosNdviDate.getTime() + eosGddDate.getTime()) / 2
      comparison.calcEosFusion = new Date(avgTime).toISOString().split('T')[0]
      comparison.calcConfidence = 80
    } else {
      // Fallback para NDVI
      comparison.calcMethod = 'NDVI'
      comparison.calcEosFusion = comparison.calcEosNdvi
      comparison.calcConfidence = comparison.dbConfidenceScore || 50
    }
    
    // 5. Verificar consistência
    if (comparison.gddProgress > 100 && comparison.currentNdvi > 0.7) {
      comparison.issues.push('GDD > 100% mas NDVI ainda alto - possível erro de cultura')
      comparison.isConsistent = false
    }
    
    if (eosNdviDate && eosNdviDate < today && comparison.currentNdvi > 0.65) {
      comparison.issues.push('EOS NDVI passou mas senescência não iniciada')
      comparison.isConsistent = false
    }
    
    if (eosNdviDate && eosGddDate) {
      const diffDays = Math.abs(eosNdviDate.getTime() - eosGddDate.getTime()) / (1000 * 60 * 60 * 24)
      if (diffDays > 14) {
        comparison.issues.push(`Grande divergência NDVI vs GDD: ${diffDays.toFixed(0)} dias`)
        comparison.isConsistent = false
      }
    }
    
    results.push(comparison)
    
    // Print results
    console.log(`\n📍 ${comparison.name} - ${comparison.location}`)
    console.log(`\n  📊 DADOS DO BANCO:`)
    console.log(`     EOS Date:       ${comparison.dbEosDate || 'N/A'}`)
    console.log(`     Method:         ${comparison.dbPhenologyMethod || 'N/A'}`)
    console.log(`     Confidence:     ${comparison.dbConfidenceScore || 'N/A'}%`)
    
    console.log(`\n  🔬 DADOS CALCULADOS:`)
    console.log(`     EOS NDVI:       ${comparison.calcEosNdvi || 'N/A'}`)
    console.log(`     EOS GDD:        ${comparison.calcEosGdd || 'N/A'}`)
    console.log(`     EOS Fusão:      ${comparison.calcEosFusion || 'N/A'}`)
    console.log(`     Método:         ${comparison.calcMethod}`)
    console.log(`     Confiança:      ${comparison.calcConfidence}%`)
    
    console.log(`\n  📈 INDICADORES:`)
    console.log(`     GDD Progress:   ${comparison.gddProgress.toFixed(1)}%`)
    console.log(`     NDVI Atual:     ${(comparison.currentNdvi * 100).toFixed(1)}%`)
    console.log(`     NDVI Pico:      ${(comparison.peakNdvi * 100).toFixed(1)}%`)
    console.log(`     Taxa Declínio:  ${comparison.ndviDeclineRate.toFixed(2)}%/pt`)
    console.log(`     Dias Estresse:  ${comparison.stressDays}`)
    
    console.log(`\n  ${comparison.isConsistent ? '✅' : '⚠️'} CONSISTÊNCIA: ${comparison.isConsistent ? 'OK' : 'PROBLEMAS DETECTADOS'}`)
    if (comparison.issues.length > 0) {
      for (const issue of comparison.issues) {
        console.log(`     • ${issue}`)
      }
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(80))
  console.log('RESUMO COMPARATIVO')
  console.log('='.repeat(80))
  console.log('\n| Campo | EOS Banco | EOS Fusão | Método | GDD% | NDVI | Consistente |')
  console.log('|-------|-----------|-----------|--------|------|------|-------------|')
  
  for (const r of results) {
    const shortName = r.name.substring(0, 15).padEnd(15)
    console.log(`| ${shortName} | ${(r.dbEosDate || 'N/A').padEnd(9)} | ${(r.calcEosFusion || 'N/A').padEnd(9)} | ${r.calcMethod.padEnd(6)} | ${r.gddProgress.toFixed(0).padStart(4)}% | ${(r.currentNdvi * 100).toFixed(0).padStart(4)}% | ${r.isConsistent ? '✅' : '❌'} |`)
  }
  
  await prisma.$disconnect()
}

// IDs dos campos para análise (Guarapuava e Nova Bandeirantes)
const FIELD_IDS = [
  'cml6z0qdr03ngreuk2w3lyo1t', // Guarapuava, PR
  'cml85rsom011rs2bt77zvhgxv'  // Verificar se é Nova Bandeirantes
]

// Buscar campos por nome se necessário
async function findFieldsByName() {
  const fields = await prisma.field.findMany({
    where: {
      OR: [
        { city: { contains: 'Guarapuava', mode: 'insensitive' } },
        { city: { contains: 'Nova Bandeirantes', mode: 'insensitive' } },
        { name: { contains: 'Desenho', mode: 'insensitive' } }
      ]
    },
    select: { id: true, name: true, city: true, state: true }
  })
  
  console.log('\nCampos encontrados:')
  for (const f of fields) {
    console.log(`  ${f.id}: ${f.name} - ${f.city}, ${f.state}`)
  }
  
  return fields.map(f => f.id)
}

// Executar
async function main() {
  // Primeiro encontrar os IDs corretos
  const fieldIds = await findFieldsByName()
  
  if (fieldIds.length > 0) {
    await debugEosComparison(fieldIds)
  } else {
    console.log('Nenhum campo encontrado. Usando IDs padrão...')
    await debugEosComparison(FIELD_IDS)
  }
}

main().catch(console.error)
