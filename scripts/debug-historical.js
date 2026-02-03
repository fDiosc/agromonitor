const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const fieldId = 'cmkzn8hbt0000ylnidmalbjyg'
  
  console.log('=== DEBUG HISTORICAL DATA ===\n')
  
  // Buscar dados históricos
  const historicalPoints = await prisma.ndviDataPoint.findMany({
    where: { fieldId, isHistorical: true },
    orderBy: { date: 'desc' },
    take: 100
  })
  
  // Agrupar por seasonYear
  const bySeason = {}
  historicalPoints.forEach(p => {
    const year = p.seasonYear || 0
    if (!bySeason[year]) {
      bySeason[year] = []
    }
    bySeason[year].push(p)
  })
  
  console.log('Safras históricas encontradas:', Object.keys(bySeason).length)
  
  Object.entries(bySeason).sort((a, b) => b[0] - a[0]).forEach(([year, points]) => {
    const dates = points.map(p => p.date).sort((a, b) => a - b)
    const first = dates[0].toISOString().split('T')[0]
    const last = dates[dates.length - 1].toISOString().split('T')[0]
    
    // Calcular year diff para alinhamento
    // Assumindo safra atual começando em set/2025
    const currentSeasonYear = 2025
    const yearDiff = currentSeasonYear - parseInt(year)
    
    // Mapear última data para ano atual
    const lastMapped = new Date(dates[dates.length - 1])
    lastMapped.setFullYear(lastMapped.getFullYear() + yearDiff)
    
    console.log(`\nSafra ${year}:`)
    console.log(`  Pontos: ${points.length}`)
    console.log(`  Range original: ${first} -> ${last}`)
    console.log(`  Year diff: ${yearDiff}`)
    console.log(`  Última data mapeada: ${lastMapped.toISOString().split('T')[0]}`)
  })
  
  // Verificar se há dados históricos que mapeiam para além do EOS
  const eosDate = new Date('2026-02-26')
  console.log('\n--- ANÁLISE ---')
  console.log('EOS:', eosDate.toISOString().split('T')[0])
  
  Object.entries(bySeason).forEach(([year, points]) => {
    const currentSeasonYear = 2025
    const yearDiff = currentSeasonYear - parseInt(year)
    
    const mappedDates = points.map(p => {
      const d = new Date(p.date)
      d.setFullYear(d.getFullYear() + yearDiff)
      return d
    })
    
    const afterEos = mappedDates.filter(d => d > eosDate).length
    console.log(`Safra ${year}: ${afterEos} pontos mapeiam para após EOS`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
