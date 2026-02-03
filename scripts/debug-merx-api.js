/**
 * Script para debugar a API Merx e verificar dados NDVI disponíveis
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const BASE_URL = process.env.MERX_API_URL || 'https://homolog.api.merx.tech/api/monitoramento'

async function callMerxNdvi(geometryJson, startDate, endDate) {
  const formData = new FormData()
  
  const blob = new Blob([geometryJson], { type: 'application/geo+json' })
  formData.append('arquivo', blob, 'geometry.geojson')
  formData.append('start_date', startDate)
  formData.append('end_date', endDate)
  
  console.log(`\nChamando API Merx: ${BASE_URL}/consulta-ndvi`)
  console.log(`  start_date: ${startDate}`)
  console.log(`  end_date: ${endDate}`)
  
  const response = await fetch(`${BASE_URL}/consulta-ndvi`, {
    method: 'POST',
    headers: { 'Accept': 'application/json' },
    body: formData
  })
  
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`API Error ${response.status}: ${text.substring(0, 200)}`)
  }
  
  return await response.json()
}

function extractNdviData(response) {
  if (!response) return []
  if (Array.isArray(response)) return response
  
  // Procurar por talhao_0, talhao_1, etc
  const key = Object.keys(response).find(k => k.startsWith('talhao_') || k.startsWith('ponto_'))
  if (key) return response[key]
  if (response.data) return response.data
  return response
}

async function main() {
  const fieldId = 'cmkzn8hbt0000ylnidmalbjyg'
  
  console.log('=== DEBUG MERX API - NDVI ===')
  console.log('Data atual:', new Date().toISOString().split('T')[0])
  console.log('')
  
  // 1. Buscar campo do banco
  const field = await prisma.field.findUnique({
    where: { id: fieldId },
    select: {
      id: true,
      name: true,
      geometryJson: true,
      updatedAt: true,
      dataVersion: true
    }
  })
  
  if (!field) {
    console.log('Talhão não encontrado!')
    return
  }
  
  console.log('Campo:', field.name)
  console.log('Última atualização DB:', field.updatedAt.toISOString())
  console.log('Data version:', field.dataVersion)
  
  // 2. Verificar dados no banco
  const dbPoints = await prisma.ndviDataPoint.findMany({
    where: { fieldId, isHistorical: false },
    orderBy: { date: 'desc' },
    take: 5
  })
  
  console.log('\n--- DADOS NO BANCO ---')
  console.log('Últimos 5 pontos NDVI:')
  dbPoints.forEach(p => {
    const ndvi = p.ndviSmooth || p.ndviInterp || p.ndviRaw || 0
    console.log(`  ${p.date.toISOString().split('T')[0]}: ${ndvi.toFixed(3)}`)
  })
  
  const lastDbDate = dbPoints[0]?.date.toISOString().split('T')[0]
  console.log('\nÚltima data no banco:', lastDbDate)
  
  // 3. Chamar API Merx para verificar dados disponíveis
  if (field.geometryJson) {
    console.log('\n--- CHAMANDO API MERX ---')
    
    const today = new Date().toISOString().split('T')[0]
    const startDate = '2025-01-01' // Começar do início do ano
    
    try {
      const response = await callMerxNdvi(field.geometryJson, startDate, today)
      const ndviData = extractNdviData(response)
      
      console.log('\nResposta da API Merx:')
      console.log('  Total de pontos retornados:', ndviData.length)
      
      if (ndviData.length > 0) {
        // Ordenar por data
        const sorted = [...ndviData].sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        )
        
        console.log('\n  Últimos 10 pontos da API:')
        sorted.slice(0, 10).forEach(p => {
          const ndvi = p.ndvi_smooth || p.ndvi_interp || p.ndvi_raw || p.ndvi || 0
          console.log(`    ${p.date}: ${ndvi.toFixed(3)}`)
        })
        
        const firstDate = sorted[sorted.length - 1]?.date
        const lastApiDate = sorted[0]?.date
        
        console.log('\n  Range da API:')
        console.log(`    Primeiro: ${firstDate}`)
        console.log(`    Último:   ${lastApiDate}`)
        
        // Comparar com banco
        console.log('\n--- COMPARAÇÃO ---')
        console.log(`Última data no BANCO:    ${lastDbDate}`)
        console.log(`Última data na API Merx: ${lastApiDate}`)
        
        if (lastApiDate > lastDbDate) {
          const diffDays = Math.floor(
            (new Date(lastApiDate).getTime() - new Date(lastDbDate).getTime()) / (1000 * 60 * 60 * 24)
          )
          console.log(`\n⚠️  A API tem ${diffDays} dias de dados mais recentes que o banco!`)
          console.log('   O processamento não está atualizando os dados corretamente.')
        } else if (lastApiDate === lastDbDate) {
          console.log('\n✅ Banco está atualizado com a API Merx.')
          console.log('   A API Merx não tem dados mais recentes disponíveis.')
        } else {
          console.log('\n❓ Situação inesperada: banco tem dados mais recentes que a API.')
        }
        
        // Verificar gap de dados
        const todayDate = new Date(today)
        const lastApiDateObj = new Date(lastApiDate)
        const gapDays = Math.floor(
          (todayDate.getTime() - lastApiDateObj.getTime()) / (1000 * 60 * 60 * 24)
        )
        
        console.log(`\n--- ANÁLISE DE GAP ---`)
        console.log(`Hoje:              ${today}`)
        console.log(`Último dado API:   ${lastApiDate}`)
        console.log(`Gap:               ${gapDays} dias`)
        
        if (gapDays > 10) {
          console.log('\n⚠️  Gap maior que 10 dias pode indicar:')
          console.log('   - Cobertura de nuvens impedindo captura')
          console.log('   - Delay no processamento de satélite')
          console.log('   - Problema na API Merx')
        } else if (gapDays <= 5) {
          console.log('\n✅ Gap dentro do esperado para satélite (até 5 dias)')
        }
      } else {
        console.log('\n❌ API Merx não retornou dados NDVI!')
      }
    } catch (error) {
      console.error('\n❌ Erro ao chamar API Merx:', error.message)
    }
  } else {
    console.log('\n❌ Campo não tem geometria definida!')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
