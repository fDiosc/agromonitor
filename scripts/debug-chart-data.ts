/**
 * Debug script para verificar dados do gráfico
 * Uso: npx tsx scripts/debug-chart-data.ts [fieldId]
 */

import prisma from '../lib/prisma'
import { prepareHistoricalOverlayData } from '../lib/services/cycle-analysis.service'
import type { NdviPoint } from '../lib/services/merx.service'

async function debugChartData(fieldId: string) {
  console.log('\n=== DEBUG CHART DATA ===\n')
  
  // Buscar campo
  const field = await prisma.field.findUnique({
    where: { id: fieldId },
    include: {
      agroData: true,
      ndviData: {
        orderBy: { date: 'asc' },
        where: { isHistorical: false }
      }
    }
  })
  
  if (!field) {
    console.log('❌ Campo não encontrado:', fieldId)
    return
  }
  
  console.log('📍 Campo:', field.name)
  console.log('🌱 Cultura:', field.cropType)
  console.log('')
  
  // Dados agro
  if (field.agroData) {
    console.log('📊 Dados Agro:')
    console.log('  - Plantio:', field.agroData.plantingDate?.toISOString().split('T')[0] || 'N/A')
    console.log('  - SOS:', field.agroData.sosDate?.toISOString().split('T')[0] || 'N/A')
    console.log('  - EOS:', field.agroData.eosDate?.toISOString().split('T')[0] || 'N/A')
    console.log('')
  }
  
  // Dados NDVI atuais
  console.log('📈 NDVI Atual:')
  console.log('  - Total pontos:', field.ndviData.length)
  if (field.ndviData.length > 0) {
    console.log('  - Primeiro:', field.ndviData[0].date.toISOString().split('T')[0])
    console.log('  - Último:', field.ndviData[field.ndviData.length - 1].date.toISOString().split('T')[0])
    
    // Verificar valores
    const withSmooth = field.ndviData.filter(d => d.ndviSmooth !== null).length
    const withInterp = field.ndviData.filter(d => d.ndviInterp !== null).length
    const withRaw = field.ndviData.filter(d => d.ndviRaw !== null).length
    console.log('  - Com ndviSmooth:', withSmooth)
    console.log('  - Com ndviInterp:', withInterp)
    console.log('  - Com ndviRaw:', withRaw)
  }
  console.log('')
  
  // Dados históricos
  const historicalNdvi = await prisma.ndviDataPoint.findMany({
    where: { 
      fieldId: fieldId,
      isHistorical: true 
    },
    orderBy: { date: 'asc' }
  })
  
  console.log('📜 NDVI Histórico:')
  console.log('  - Total pontos:', historicalNdvi.length)
  
  // Agrupar por safra
  const bySeason: Record<number, typeof historicalNdvi> = {}
  historicalNdvi.forEach(point => {
    const year = point.seasonYear || 0
    if (!bySeason[year]) bySeason[year] = []
    bySeason[year].push(point)
  })
  
  Object.entries(bySeason).forEach(([year, points]) => {
    const withSmooth = points.filter(d => d.ndviSmooth !== null).length
    const withInterp = points.filter(d => d.ndviInterp !== null).length
    console.log(`  - Safra ${year}: ${points.length} pontos (smooth: ${withSmooth}, interp: ${withInterp})`)
    if (points.length > 0) {
      console.log(`    Range: ${points[0].date.toISOString().split('T')[0]} → ${points[points.length-1].date.toISOString().split('T')[0]}`)
    }
  })
  console.log('')
  
  // Testar prepareHistoricalOverlayData
  const currentNdviPoints: NdviPoint[] = field.ndviData.map(d => ({
    date: d.date.toISOString().split('T')[0],
    ndvi_raw: d.ndviRaw ?? undefined,
    ndvi_interp: d.ndviInterp ?? undefined,
    ndvi_smooth: d.ndviSmooth ?? undefined
  }))
  
  const historicalNdviPoints: NdviPoint[][] = Object.values(bySeason).map(season =>
    season.map(d => ({
      date: d.date.toISOString().split('T')[0],
      ndvi_raw: d.ndviRaw ?? undefined,
      ndvi_interp: d.ndviInterp ?? undefined,
      ndvi_smooth: d.ndviSmooth ?? undefined
    }))
  )
  
  console.log('🔄 Processando overlay...')
  const chartData = prepareHistoricalOverlayData(
    currentNdviPoints,
    historicalNdviPoints,
    field.agroData?.sosDate?.toISOString().split('T')[0] || null,
    field.cropType || 'SOJA',
    field.agroData?.eosDate?.toISOString().split('T')[0] || null,
    field.agroData?.plantingDate?.toISOString().split('T')[0] || null
  )
  
  console.log('')
  console.log('📊 Chart Data Resultado:')
  console.log('  - Total pontos:', chartData.length)
  
  const withCurrent = chartData.filter(d => d.current !== undefined).length
  const withH1 = chartData.filter(d => d.h1 !== undefined).length
  const withH2 = chartData.filter(d => d.h2 !== undefined).length
  const withH3 = chartData.filter(d => d.h3 !== undefined).length
  const withProjection = chartData.filter(d => d.projection !== undefined).length
  const withReference = chartData.filter(d => d.isReference).length
  
  console.log('  - Com current:', withCurrent)
  console.log('  - Com h1:', withH1)
  console.log('  - Com h2:', withH2)
  console.log('  - Com h3:', withH3)
  console.log('  - Com projection:', withProjection)
  console.log('  - Pontos de referência:', withReference)
  console.log('')
  
  // Verificar datas de referência
  const referenceDates = [
    { name: 'Plantio', date: field.agroData?.plantingDate?.toISOString().split('T')[0] },
    { name: 'SOS', date: field.agroData?.sosDate?.toISOString().split('T')[0] },
    { name: 'EOS', date: field.agroData?.eosDate?.toISOString().split('T')[0] }
  ]
  
  console.log('📍 Verificação de Datas de Referência:')
  referenceDates.forEach(ref => {
    if (ref.date) {
      const exists = chartData.some(d => d.date === ref.date)
      console.log(`  - ${ref.name} (${ref.date}): ${exists ? '✅ Presente' : '❌ Ausente'}`)
    }
  })
  console.log('')
  
  // Mostrar amostra dos dados
  console.log('📋 Amostra (primeiros 5 e últimos 5 pontos):')
  const sample = [...chartData.slice(0, 5), '...', ...chartData.slice(-5)]
  sample.forEach((d, i) => {
    if (d === '...') {
      console.log('  ...')
    } else {
      const vals = []
      if (d.current !== undefined) vals.push(`curr=${d.current.toFixed(2)}`)
      if (d.h1 !== undefined) vals.push(`h1=${d.h1.toFixed(2)}`)
      if (d.h2 !== undefined) vals.push(`h2=${d.h2.toFixed(2)}`)
      if (d.h3 !== undefined) vals.push(`h3=${d.h3.toFixed(2)}`)
      if (d.projection !== undefined) vals.push(`proj=${d.projection.toFixed(2)}`)
      if (d.isReference) vals.push('REF')
      console.log(`  ${d.date}: ${vals.join(', ') || '(vazio)'}`)
    }
  })
  
  // Mostrar zona de transição (ao redor do último dado atual)
  const lastCurrentIdx = chartData.findIndex(d => d.current !== undefined && 
    !chartData.slice(chartData.indexOf(d) + 1).some(x => x.current !== undefined))
  
  if (lastCurrentIdx >= 0) {
    console.log('')
    console.log(`📍 Zona de transição (ao redor do último dado atual - idx ${lastCurrentIdx}):`)
    const transitionStart = Math.max(0, lastCurrentIdx - 3)
    const transitionEnd = Math.min(chartData.length - 1, lastCurrentIdx + 10)
    
    for (let i = transitionStart; i <= transitionEnd; i++) {
      const d = chartData[i]
      const vals = []
      if (d.current !== undefined) vals.push(`curr=${d.current.toFixed(2)}`)
      if (d.h1 !== undefined) vals.push(`h1=${d.h1.toFixed(2)}`)
      if (d.h2 !== undefined) vals.push(`h2=${d.h2.toFixed(2)}`)
      if (d.h3 !== undefined) vals.push(`h3=${d.h3.toFixed(2)}`)
      if (d.projection !== undefined) vals.push(`proj=${d.projection.toFixed(2)}`)
      const marker = i === lastCurrentIdx ? ' <-- ÚLTIMO CURRENT' : ''
      console.log(`  [${i}] ${d.date}: ${vals.join(', ') || '(vazio)'}${marker}`)
    }
  }
  
  console.log('\n=== FIM DEBUG ===\n')
}

// Executar
const fieldId = process.argv[2]
if (!fieldId) {
  // Listar campos disponíveis
  prisma.field.findMany({ select: { id: true, name: true } })
    .then(fields => {
      console.log('Campos disponíveis:')
      fields.forEach(f => console.log(`  - ${f.id}: ${f.name}`))
      console.log('\nUso: npx tsx scripts/debug-chart-data.ts <fieldId>')
      process.exit(0)
    })
} else {
  debugChartData(fieldId)
    .then(() => process.exit(0))
    .catch(e => {
      console.error(e)
      process.exit(1)
    })
}
