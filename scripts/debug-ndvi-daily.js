/**
 * Script para verificar se a API Merx retorna dados NDVI diários
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
  const fieldId = 'cmkzn8hbt0000ylnidmalbjyg'
  const today = new Date().toISOString().split('T')[0]
  
  console.log('=== ANÁLISE DE DADOS DIÁRIOS NDVI ===')
  console.log('Data atual:', today)
  console.log('')
  
  // Buscar campo
  const field = await prisma.field.findUnique({
    where: { id: fieldId },
    select: {
      id: true,
      name: true,
      geometryJson: true
    }
  })
  
  if (!field) {
    console.log('Talhão não encontrado!')
    return
  }
  
  console.log('Campo:', field.name)
  
  // Chamar API para janeiro 2026
  const startDate = '2026-01-01'
  const endDate = today
  
  console.log(`\nBuscando NDVI de ${startDate} a ${endDate}...\n`)
  
  try {
    const response = await callMerxNdvi(field.geometryJson, startDate, endDate)
    const ndviData = extractNdviData(response)
    
    console.log('Total de pontos retornados:', ndviData.length)
    
    // Ordenar por data
    const sorted = [...ndviData].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    
    // Verificar se é diário
    console.log('\n--- VERIFICAÇÃO DE CONTINUIDADE ---')
    
    let gaps = []
    let lastDate = null
    
    sorted.forEach((point, idx) => {
      const currentDate = new Date(point.date)
      
      if (lastDate) {
        const diffDays = Math.floor(
          (currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
        )
        
        if (diffDays > 1) {
          gaps.push({
            from: lastDate.toISOString().split('T')[0],
            to: point.date,
            days: diffDays
          })
        }
      }
      
      lastDate = currentDate
    })
    
    if (gaps.length === 0) {
      console.log('✅ Dados são DIÁRIOS - sem gaps encontrados')
    } else {
      console.log(`⚠️  Encontrados ${gaps.length} gaps nos dados:`)
      gaps.forEach(g => {
        console.log(`   ${g.from} -> ${g.to} (${g.days} dias)`)
      })
    }
    
    // Mostrar primeiros e últimos pontos
    console.log('\n--- PRIMEIROS 10 PONTOS ---')
    sorted.slice(0, 10).forEach(p => {
      const ndvi = p.ndvi_smooth || p.ndvi_interp || p.ndvi_raw || p.ndvi || 0
      console.log(`  ${p.date}: ${ndvi.toFixed(3)}`)
    })
    
    console.log('\n--- ÚLTIMOS 10 PONTOS ---')
    sorted.slice(-10).forEach(p => {
      const ndvi = p.ndvi_smooth || p.ndvi_interp || p.ndvi_raw || p.ndvi || 0
      console.log(`  ${p.date}: ${ndvi.toFixed(3)}`)
    })
    
    // Verificar último dia
    const lastPoint = sorted[sorted.length - 1]
    const expectedDays = Math.floor(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
    ) + 1
    
    console.log('\n--- ANÁLISE ---')
    console.log(`Período solicitado: ${startDate} a ${endDate}`)
    console.log(`Dias esperados: ${expectedDays}`)
    console.log(`Dias retornados: ${sorted.length}`)
    console.log(`Último dado: ${lastPoint?.date}`)
    
    if (sorted.length < expectedDays) {
      const missing = expectedDays - sorted.length
      console.log(`\n⚠️  Faltam ${missing} dias de dados!`)
      console.log(`   A API deveria retornar dados interpolados até ${endDate}`)
      console.log(`   mas está retornando apenas até ${lastPoint?.date}`)
    }
    
    // Verificar campos de interpolação
    console.log('\n--- CAMPOS DISPONÍVEIS ---')
    if (sorted[0]) {
      console.log('Campos no primeiro ponto:', Object.keys(sorted[0]).join(', '))
    }
    
    // Contar pontos com cada tipo de valor
    let withSmooth = 0, withInterp = 0, withRaw = 0
    sorted.forEach(p => {
      if (p.ndvi_smooth !== undefined && p.ndvi_smooth !== null) withSmooth++
      if (p.ndvi_interp !== undefined && p.ndvi_interp !== null) withInterp++
      if (p.ndvi_raw !== undefined && p.ndvi_raw !== null) withRaw++
    })
    
    console.log(`\nDistribuição de valores:`)
    console.log(`  ndvi_smooth: ${withSmooth} pontos (${(100*withSmooth/sorted.length).toFixed(1)}%)`)
    console.log(`  ndvi_interp: ${withInterp} pontos (${(100*withInterp/sorted.length).toFixed(1)}%)`)
    console.log(`  ndvi_raw:    ${withRaw} pontos (${(100*withRaw/sorted.length).toFixed(1)}%)`)
    
  } catch (error) {
    console.error('Erro:', error.message)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
