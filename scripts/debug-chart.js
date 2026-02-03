const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const fieldId = 'cmkzn8hbt0000ylnidmalbjyg'
  
  console.log('=== DEBUG CHART DATA ===\n')
  
  // Simular a chamada à API
  const field = await prisma.field.findUnique({
    where: { id: fieldId },
    include: {
      agroData: true,
      producer: true,
      workspace: true,
      analyses: true
    }
  })
  
  if (!field) {
    console.log('Talhão não encontrado!')
    return
  }
  
  // Buscar dados NDVI
  const ndviPoints = await prisma.ndviDataPoint.findMany({
    where: { fieldId, isHistorical: false },
    orderBy: { date: 'asc' }
  })
  
  console.log('Total pontos NDVI atuais:', ndviPoints.length)
  console.log('Primeiro:', ndviPoints[0]?.date.toISOString().split('T')[0])
  console.log('Último:', ndviPoints[ndviPoints.length - 1]?.date.toISOString().split('T')[0])
  
  // Ver range de datas EOS
  console.log('\n--- DATAS FENOLÓGICAS ---')
  console.log('EOS (agroData):', field.agroData?.eosDate?.toISOString().split('T')[0])
  
  // Calcular rangeEnd esperado
  const lastCurrentDate = ndviPoints[ndviPoints.length - 1]?.date
  const eosDate = field.agroData?.eosDate
  const today = new Date()
  
  if (eosDate && lastCurrentDate) {
    const lastCurrentTime = lastCurrentDate.getTime()
    const todayTime = today.getTime()
    const eosTime = eosDate.getTime()
    const dayMs = 24 * 60 * 60 * 1000
    
    const eosPlus30 = new Date(eosTime + (30 * dayMs))
    const todayPlus7 = new Date(todayTime + (7 * dayMs))
    const lastPlus7 = new Date(lastCurrentTime + (7 * dayMs))
    
    console.log('\n--- CÁLCULO DE RANGE END ---')
    console.log('EOS + 30 dias:', eosPlus30.toISOString().split('T')[0])
    console.log('Hoje + 7 dias:', todayPlus7.toISOString().split('T')[0])
    console.log('Último dado + 7:', lastPlus7.toISOString().split('T')[0])
    
    const candidates = [eosPlus30.getTime(), todayPlus7.getTime(), lastPlus7.getTime()]
    const rangeEnd = new Date(Math.max(...candidates))
    console.log('Range End escolhido:', rangeEnd.toISOString().split('T')[0])
    
    // Quantos dias de projeção deveriam ser gerados
    const projectionDays = Math.floor((rangeEnd.getTime() - lastCurrentTime) / dayMs)
    console.log('\nDias de projeção esperados:', projectionDays)
  }
  
  console.log('\n--- ANÁLISE DA SITUAÇÃO ---')
  console.log('Hoje:', today.toISOString().split('T')[0])
  console.log('Último dado:', lastCurrentDate?.toISOString().split('T')[0])
  console.log('EOS projetado:', eosDate?.toISOString().split('T')[0])
  
  const diffLastToToday = Math.floor((today.getTime() - (lastCurrentDate?.getTime() || 0)) / (24*60*60*1000))
  const diffLastToEOS = Math.floor(((eosDate?.getTime() || 0) - (lastCurrentDate?.getTime() || 0)) / (24*60*60*1000))
  
  console.log('\nDiferença último dado → hoje:', diffLastToToday, 'dias')
  console.log('Diferença último dado → EOS:', diffLastToEOS, 'dias')
  console.log('\n✅ A projeção deveria mostrar', Math.max(diffLastToToday, diffLastToEOS), 'dias de dados projetados')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
