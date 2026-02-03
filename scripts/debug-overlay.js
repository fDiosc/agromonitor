// Script para debugar a função prepareHistoricalOverlayData
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// Copiar a função simplificada para testar a lógica
function debugOverlayLogic(currentData, eosDate) {
  const today = new Date()
  const todayTime = today.getTime()
  const dayMs = 24 * 60 * 60 * 1000
  
  // Ordenar e pegar último dado
  const sorted = [...currentData].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )
  
  const firstCurrentDate = sorted[0]?.date
  const lastCurrentDate = sorted[sorted.length - 1]?.date
  const lastCurrentTime = new Date(lastCurrentDate).getTime()
  
  console.log('\n--- DEBUG OVERLAY LOGIC ---')
  console.log('Primeiro dado atual:', firstCurrentDate)
  console.log('Último dado atual:', lastCurrentDate)
  console.log('Hoje:', today.toISOString().split('T')[0])
  console.log('EOS:', eosDate)
  
  if (eosDate) {
    const eosTime = new Date(eosDate).getTime()
    const eosPlus30 = eosTime + (30 * dayMs)
    
    const candidates = [
      { name: 'EOS + 30', value: eosPlus30 },
      { name: 'Último + 7', value: lastCurrentTime + (7 * dayMs) },
      { name: 'Hoje + 7', value: todayTime + (7 * dayMs) }
    ]
    
    console.log('\n--- CANDIDATOS PARA RANGE END ---')
    candidates.forEach(c => {
      console.log(`${c.name}: ${new Date(c.value).toISOString().split('T')[0]}`)
    })
    
    const rangeEnd = new Date(Math.max(...candidates.map(c => c.value)))
    console.log('\nRange End escolhido:', rangeEnd.toISOString().split('T')[0])
    
    // Calcular pontos de projeção
    const projectionStart = new Date(lastCurrentTime + dayMs)
    const projectionDays = Math.floor((rangeEnd.getTime() - lastCurrentTime) / dayMs)
    
    console.log('\n--- PROJEÇÃO ---')
    console.log('Início projeção:', projectionStart.toISOString().split('T')[0])
    console.log('Dias de projeção:', projectionDays)
    console.log('Fim projeção:', rangeEnd.toISOString().split('T')[0])
    
    // Mostrar primeiros e últimos pontos de projeção esperados
    console.log('\nPrimeiros 5 pontos de projeção:')
    for (let i = 0; i < Math.min(5, projectionDays); i++) {
      const d = new Date(lastCurrentTime + ((i + 1) * dayMs))
      console.log(`  ${d.toISOString().split('T')[0]}`)
    }
    
    console.log('\nÚltimos 5 pontos de projeção:')
    for (let i = Math.max(0, projectionDays - 5); i < projectionDays; i++) {
      const d = new Date(lastCurrentTime + ((i + 1) * dayMs))
      console.log(`  ${d.toISOString().split('T')[0]}`)
    }
    
    return { rangeEnd, projectionDays }
  }
  
  return null
}

async function main() {
  const fieldId = 'cmkzn8hbt0000ylnidmalbjyg'
  
  console.log('=== DEBUG CHART OVERLAY ===\n')
  
  // Buscar campo
  const field = await prisma.field.findUnique({
    where: { id: fieldId },
    include: { agroData: true }
  })
  
  if (!field) {
    console.log('Talhão não encontrado!')
    return
  }
  
  // Buscar dados NDVI atuais
  const ndviPoints = await prisma.ndviDataPoint.findMany({
    where: { fieldId, isHistorical: false },
    orderBy: { date: 'asc' }
  })
  
  // Converter para formato NdviPoint
  const currentData = ndviPoints.map(p => ({
    date: p.date.toISOString().split('T')[0],
    ndvi_smooth: p.ndviSmooth,
    ndvi_interp: p.ndviInterp,
    ndvi_raw: p.ndviRaw
  }))
  
  const eosDate = field.agroData?.eosDate?.toISOString().split('T')[0]
  
  // Testar a lógica
  const result = debugOverlayLogic(currentData, eosDate)
  
  if (result) {
    console.log('\n=== CONCLUSÃO ===')
    console.log(`A projeção DEVERIA mostrar ${result.projectionDays} dias`)
    console.log(`Do dia 2026-01-18 até ${result.rangeEnd.toISOString().split('T')[0]}`)
    console.log('\nSe o gráfico não mostra isso, o problema está em:')
    console.log('1. Os dados de chartOverlayData não estão sendo gerados corretamente')
    console.log('2. O frontend não está renderizando os pontos de projeção')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
