/**
 * Script para verificar dados NDVI de múltiplos talhões
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
  
  const response = await fetch(`${BASE_URL}/consulta-ndvi`, {
    method: 'POST',
    headers: { 'Accept': 'application/json' },
    body: formData
  })
  
  if (!response.ok) {
    throw new Error(`API Error ${response.status}`)
  }
  
  return await response.json()
}

function extractNdviData(response) {
  if (!response) return []
  if (Array.isArray(response)) return response
  
  const key = Object.keys(response).find(k => k.startsWith('talhao_') || k.startsWith('ponto_'))
  if (key) return response[key]
  if (response.data) return response.data
  return response
}

async function main() {
  const today = new Date().toISOString().split('T')[0]
  const startDate = '2025-09-01'
  
  console.log('=== VERIFICAÇÃO MULTI-TALHÕES ===')
  console.log('Data atual:', today)
  console.log('')
  
  // Buscar todos os talhões com geometria
  const fields = await prisma.field.findMany({
    where: {
      status: 'SUCCESS',
      geometryJson: { not: '' }
    },
    select: {
      id: true,
      name: true,
      city: true,
      state: true,
      geometryJson: true,
      latitude: true,
      longitude: true,
      producer: {
        select: { name: true }
      }
    },
    take: 10
  })
  
  console.log(`Encontrados ${fields.length} talhões para verificar\n`)
  
  const results = []
  
  for (const field of fields) {
    console.log(`--- ${field.name} (${field.city || 'N/A'}/${field.state || 'N/A'}) ---`)
    
    // Buscar último dado no banco
    const lastDbPoint = await prisma.ndviDataPoint.findFirst({
      where: { fieldId: field.id, isHistorical: false },
      orderBy: { date: 'desc' }
    })
    
    const lastDbDate = lastDbPoint?.date.toISOString().split('T')[0] || 'N/A'
    console.log(`  Último no banco: ${lastDbDate}`)
    
    // Chamar API Merx
    try {
      const response = await callMerxNdvi(field.geometryJson, startDate, today)
      const ndviData = extractNdviData(response)
      
      if (ndviData.length > 0) {
        const sorted = [...ndviData].sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        )
        
        const lastApiDate = sorted[0]?.date
        console.log(`  Último na API:   ${lastApiDate}`)
        
        const gapDays = Math.floor(
          (new Date(today).getTime() - new Date(lastApiDate).getTime()) / (1000 * 60 * 60 * 24)
        )
        console.log(`  Gap:             ${gapDays} dias`)
        
        results.push({
          name: field.name,
          city: field.city,
          state: field.state,
          lat: field.latitude,
          lng: field.longitude,
          lastDb: lastDbDate,
          lastApi: lastApiDate,
          gap: gapDays
        })
      } else {
        console.log(`  ❌ API não retornou dados`)
        results.push({
          name: field.name,
          city: field.city,
          state: field.state,
          lastDb: lastDbDate,
          lastApi: 'N/A',
          gap: 'N/A'
        })
      }
    } catch (error) {
      console.log(`  ❌ Erro: ${error.message}`)
      results.push({
        name: field.name,
        city: field.city,
        state: field.state,
        lastDb: lastDbDate,
        lastApi: 'ERROR',
        gap: 'ERROR'
      })
    }
    
    console.log('')
  }
  
  // Resumo
  console.log('\n=== RESUMO ===')
  console.log('Talhão | Cidade/UF | Último API | Gap (dias)')
  console.log('-------|-----------|------------|------------')
  
  results.forEach(r => {
    const location = `${r.city || '?'}/${r.state || '?'}`
    console.log(`${r.name.substring(0, 15).padEnd(15)} | ${location.padEnd(12)} | ${String(r.lastApi).padEnd(10)} | ${r.gap}`)
  })
  
  // Análise
  const validResults = results.filter(r => typeof r.gap === 'number')
  if (validResults.length > 0) {
    const avgGap = validResults.reduce((sum, r) => sum + r.gap, 0) / validResults.length
    const minGap = Math.min(...validResults.map(r => r.gap))
    const maxGap = Math.max(...validResults.map(r => r.gap))
    
    console.log('\n--- ESTATÍSTICAS ---')
    console.log(`Gap médio:  ${avgGap.toFixed(1)} dias`)
    console.log(`Gap mínimo: ${minGap} dias`)
    console.log(`Gap máximo: ${maxGap} dias`)
    
    if (minGap > 10) {
      console.log('\n⚠️  TODOS os talhões têm gap > 10 dias.')
      console.log('   Isso sugere problema generalizado na API Merx ou no satélite.')
    } else if (avgGap > 10) {
      console.log('\n⚠️  Gap médio alto. Pode haver problema na fonte de dados.')
    } else {
      console.log('\n✅ Gaps dentro do esperado para dados de satélite.')
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
