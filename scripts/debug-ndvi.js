const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const fieldId = 'cmkzn8hbt0000ylnidmalbjyg'
  
  console.log('=== DEBUG NDVI DATA ===\n')
  
  // 1. Buscar campo básico
  const field = await prisma.field.findUnique({
    where: { id: fieldId },
    select: {
      id: true,
      name: true,
      areaHa: true,
      updatedAt: true,
      dataVersion: true,
      agroData: {
        select: {
          sosDate: true,
          eosDate: true,
          peakDate: true,
          phenologyMethod: true
        }
      }
    }
  })
  
  if (!field) {
    console.log('Talhão não encontrado!')
    return
  }
  
  console.log('Campo:', field.name)
  console.log('Área:', field.areaHa, 'ha')
  console.log('Última atualização:', field.updatedAt)
  console.log('Data version:', field.dataVersion)
  
  // 2. Dados do agroData
  if (field.agroData) {
    console.log('\n--- AGRO DATA ---')
    console.log('SOS:', field.agroData.sosDate?.toISOString().split('T')[0])
    console.log('EOS:', field.agroData.eosDate?.toISOString().split('T')[0])
    console.log('Peak:', field.agroData.peakDate?.toISOString().split('T')[0])
    console.log('Método:', field.agroData.phenologyMethod)
  }
  
  // 3. Últimos pontos NDVI (atuais)
  const currentPoints = await prisma.ndviDataPoint.findMany({
    where: { fieldId, isHistorical: false },
    orderBy: { date: 'desc' },
    take: 15
  })
  
  console.log('\n--- ÚLTIMOS 15 PONTOS NDVI (atual) ---')
  console.log('Total encontrados:', currentPoints.length)
  
  currentPoints.forEach(p => {
    const ndvi = p.ndviSmooth || p.ndviInterp || p.ndviRaw || 0
    console.log(`  ${p.date.toISOString().split('T')[0]}: ${ndvi.toFixed(3)}`)
  })
  
  // 4. Contar todos os pontos
  const allCurrent = await prisma.ndviDataPoint.count({
    where: { fieldId, isHistorical: false }
  })
  const allHistorical = await prisma.ndviDataPoint.count({
    where: { fieldId, isHistorical: true }
  })
  
  console.log('\n--- CONTAGEM TOTAL ---')
  console.log('Pontos atuais:', allCurrent)
  console.log('Pontos históricos:', allHistorical)
  
  // 5. Range de datas dos dados atuais
  const firstCurrent = await prisma.ndviDataPoint.findFirst({
    where: { fieldId, isHistorical: false },
    orderBy: { date: 'asc' }
  })
  const lastCurrent = await prisma.ndviDataPoint.findFirst({
    where: { fieldId, isHistorical: false },
    orderBy: { date: 'desc' }
  })
  
  console.log('\n--- RANGE DADOS ATUAIS ---')
  console.log('Primeiro:', firstCurrent?.date.toISOString().split('T')[0])
  console.log('Último:', lastCurrent?.date.toISOString().split('T')[0])
  
  // 6. Verificar data de hoje vs último dado
  const today = new Date()
  const lastDate = lastCurrent?.date
  if (lastDate) {
    const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
    console.log('\n--- ANÁLISE ---')
    console.log('Hoje:', today.toISOString().split('T')[0])
    console.log('Último dado:', lastDate.toISOString().split('T')[0])
    console.log('Diferença:', diffDays, 'dias')
    
    if (diffDays > 10) {
      console.log('⚠️  ALERTA: Último dado tem mais de 10 dias!')
      console.log('   Isso pode indicar falta de dados na API Merx ou problema no processamento.')
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
