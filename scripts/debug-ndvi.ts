import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const fieldId = 'cmkzn8hbt0000ylnidmalbjyg'
  
  console.log('=== DEBUG NDVI DATA ===\n')
  
  // 1. Buscar campo e dados
  const field = await prisma.field.findUnique({
    where: { id: fieldId },
    include: {
      agroData: true,
      ndviData: {
        orderBy: { date: 'desc' },
        take: 20  // últimos 20 pontos
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
    console.log('Confiança:', field.agroData.phenologyConfidence)
  }
  
  // 3. Últimos pontos NDVI
  console.log('\n--- ÚLTIMOS 20 PONTOS NDVI (atual) ---')
  const currentPoints = field.ndviData.filter(d => !d.isHistorical)
  console.log('Total pontos atuais:', currentPoints.length)
  
  currentPoints.slice(0, 10).forEach(p => {
    const ndvi = p.ndviSmooth || p.ndviInterp || p.ndviRaw || 0
    console.log(`  ${p.date.toISOString().split('T')[0]}: ${ndvi.toFixed(3)}`)
  })
  
  // 4. Contar todos os pontos
  const allCurrent = await prisma.ndviData.count({
    where: { fieldId, isHistorical: false }
  })
  const allHistorical = await prisma.ndviData.count({
    where: { fieldId, isHistorical: true }
  })
  
  console.log('\n--- CONTAGEM TOTAL ---')
  console.log('Pontos atuais:', allCurrent)
  console.log('Pontos históricos:', allHistorical)
  
  // 5. Range de datas dos dados atuais
  const firstCurrent = await prisma.ndviData.findFirst({
    where: { fieldId, isHistorical: false },
    orderBy: { date: 'asc' }
  })
  const lastCurrent = await prisma.ndviData.findFirst({
    where: { fieldId, isHistorical: false },
    orderBy: { date: 'desc' }
  })
  
  console.log('\n--- RANGE DADOS ATUAIS ---')
  console.log('Primeiro:', firstCurrent?.date.toISOString().split('T')[0])
  console.log('Último:', lastCurrent?.date.toISOString().split('T')[0])
  
  // 6. Buscar polígono
  console.log('\n--- POLÍGONO ---')
  console.log('Tipo:', field.geometryType)
  console.log('Área calculada:', field.areaHa, 'ha')
  
  // Mostrar primeiros caracteres do GeoJSON para confirmar
  if (field.geometry) {
    const geo = JSON.parse(field.geometry as string)
    console.log('Coordenadas (primeiras 3):', JSON.stringify(geo.coordinates?.[0]?.slice(0, 3)))
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
