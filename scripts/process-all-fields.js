/**
 * Script para processar todos os talhões em sequência
 * 
 * - Processa um talhão de cada vez
 * - Atualiza município via reverse geocoding (OpenStreetMap Nominatim)
 * - Chama os serviços diretamente (sem HTTP)
 * 
 * Execução: node scripts/process-all-fields.js
 */

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

// Carregar variáveis de ambiente manualmente
function loadEnv() {
  const envPaths = ['.env.local', '.env']
  for (const envPath of envPaths) {
    const fullPath = path.join(__dirname, '..', envPath)
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8')
      content.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/)
        if (match && !process.env[match[1]]) {
          process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
        }
      })
    }
  }
}
loadEnv()
const prisma = new PrismaClient()

// Configuração
const WORKSPACE_ID = 'default-workspace'
const DELAY_GEOCODING = 1100 // 1.1 segundos entre chamadas Nominatim (rate limit: 1/sec)
const DELAY_BETWEEN_PROCESS = 3000 // 3 segundos entre processamentos para evitar rate limit API Merx

// API Merx
const MERX_API_KEY = process.env.MERX_API_KEY || 'merx-api-jy8pKL2nXq5RmH7vWdG3bFtZxC4sN6aE'
const MERX_BASE_URL = 'https://api.merx.agr.br'

/**
 * Busca município via Nominatim (OpenStreetMap)
 */
async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AgroMonitor/1.0 (agricultural-field-processor)'
      }
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    
    if (data.address) {
      const city = data.address.city || data.address.town || data.address.municipality || data.address.county
      const state = data.address.state
      const stateCode = getStateCode(state)
      
      return {
        city: city || null,
        state: stateCode || state || null
      }
    }
    
    return null
  } catch {
    return null
  }
}

/**
 * Converte nome do estado para sigla
 */
function getStateCode(stateName) {
  if (!stateName) return null
  
  const states = {
    'Acre': 'AC', 'Alagoas': 'AL', 'Amapá': 'AP', 'Amazonas': 'AM',
    'Bahia': 'BA', 'Ceará': 'CE', 'Distrito Federal': 'DF', 'Espírito Santo': 'ES',
    'Goiás': 'GO', 'Maranhão': 'MA', 'Mato Grosso': 'MT', 'Mato Grosso do Sul': 'MS',
    'Minas Gerais': 'MG', 'Pará': 'PA', 'Paraíba': 'PB', 'Paraná': 'PR',
    'Pernambuco': 'PE', 'Piauí': 'PI', 'Rio de Janeiro': 'RJ', 'Rio Grande do Norte': 'RN',
    'Rio Grande do Sul': 'RS', 'Rondônia': 'RO', 'Roraima': 'RR', 'Santa Catarina': 'SC',
    'São Paulo': 'SP', 'Sergipe': 'SE', 'Tocantins': 'TO'
  }
  
  return states[stateName] || null
}

/**
 * Busca relatório completo da API Merx
 */
async function getMerxReport(geometryJson, startDate, cropType) {
  const formData = new FormData()
  const blob = new Blob([geometryJson], { type: 'application/geo+json' })
  formData.append('arquivo', blob, 'geometry.geojson')
  formData.append('ano', startDate.split('-')[0])
  formData.append('data_inicio', startDate)
  formData.append('cultura', cropType)

  const response = await fetch(`${MERX_BASE_URL}/relatorio-completo`, {
    method: 'POST',
    headers: { 'x-api-key': MERX_API_KEY },
    body: formData
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Merx API error: ${response.status} - ${text}`)
  }

  return await response.json()
}

/**
 * Busca dados complementares (ZARC)
 */
async function getComplementaryData(geometryJson, startDate, cropType) {
  const formData = new FormData()
  const blob = new Blob([geometryJson], { type: 'application/geo+json' })
  formData.append('arquivo', blob, 'geometry.geojson')
  formData.append('ano', startDate.split('-')[0])
  formData.append('data_inicio', startDate)
  formData.append('cultura', cropType)

  try {
    const response = await fetch(`${MERX_BASE_URL}/dados-complementares`, {
      method: 'POST',
      headers: { 'x-api-key': MERX_API_KEY },
      body: formData
    })

    if (!response.ok) {
      console.log(`      [ZARC] API retornou ${response.status}`)
      return { zarc_anual: null }
    }

    return await response.json()
  } catch (err) {
    console.log(`      [ZARC] Erro: ${err.message}`)
    return { zarc_anual: null }
  }
}

/**
 * Calcula área usando fórmula esférica
 */
function calculateSphericalArea(coordinates) {
  if (!coordinates || coordinates.length < 3) return 0
  
  const R = 6371000 // Raio da Terra em metros
  let area = 0
  
  for (let i = 0; i < coordinates.length - 1; i++) {
    const [lon1, lat1] = coordinates[i]
    const [lon2, lat2] = coordinates[(i + 1) % coordinates.length]
    
    const phi1 = lat1 * Math.PI / 180
    const phi2 = lat2 * Math.PI / 180
    const lambda1 = lon1 * Math.PI / 180
    const lambda2 = lon2 * Math.PI / 180
    
    area += (lambda2 - lambda1) * (2 + Math.sin(phi1) + Math.sin(phi2))
  }
  
  area = Math.abs(area * R * R / 2)
  return area / 10000 // Converter m² para hectares
}

/**
 * Aguarda X milissegundos
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Processa um talhão
 */
async function processField(field) {
  const startTime = Date.now()
  
  // Atualizar status para PROCESSING
  await prisma.field.update({
    where: { id: field.id },
    data: { status: 'PROCESSING' }
  })

  try {
    // Buscar relatório Merx
    const merxReport = await getMerxReport(
      field.geometryJson,
      field.seasonStartDate.toISOString().split('T')[0],
      field.cropType
    )

    // Calcular área
    let areaHa = merxReport.area_ha
    if (!areaHa || areaHa <= 0) {
      const geojson = JSON.parse(field.geometryJson)
      const coords = geojson.features?.[0]?.geometry?.coordinates?.[0] || []
      areaHa = calculateSphericalArea(coords)
    }

    // Buscar dados complementares (ZARC)
    const complementary = await getComplementaryData(
      field.geometryJson,
      field.seasonStartDate.toISOString().split('T')[0],
      field.cropType
    )

    // Calcular dados básicos
    const ndviCurrent = merxReport.ndvi_current || []
    const ndviHistorical = merxReport.historical_ndvi || []
    const ndviProjection = merxReport.ndvi_projection || []

    // Verificar correlação histórica
    let correlation = 0
    if (ndviHistorical.length > 0 && ndviCurrent.length > 0) {
      correlation = 85 // Valor base - pode ser calculado com lógica mais complexa
    }

    // Salvar ou atualizar AgroData
    await prisma.agroData.upsert({
      where: { fieldId: field.id },
      update: {
        areaHa,
        correlation,
        rawNdviData: JSON.stringify(ndviCurrent),
        rawProjectionData: JSON.stringify(ndviProjection),
        rawHistoricalData: JSON.stringify(ndviHistorical),
        rawAreaData: JSON.stringify({ area_ha: areaHa }),
        rawZarcData: JSON.stringify(complementary.zarc_anual),
        updatedAt: new Date()
      },
      create: {
        fieldId: field.id,
        areaHa,
        correlation,
        rawNdviData: JSON.stringify(ndviCurrent),
        rawProjectionData: JSON.stringify(ndviProjection),
        rawHistoricalData: JSON.stringify(ndviHistorical),
        rawAreaData: JSON.stringify({ area_ha: areaHa }),
        rawZarcData: JSON.stringify(complementary.zarc_anual)
      }
    })

    // Salvar pontos NDVI atuais
    if (ndviCurrent.length > 0) {
      await prisma.ndviPoint.deleteMany({ where: { fieldId: field.id } })
      await prisma.ndviPoint.createMany({
        data: ndviCurrent.map(point => ({
          fieldId: field.id,
          date: new Date(point.data || point.date),
          value: point.ndvi || point.value,
          source: 'MERX'
        }))
      })
    }

    // Atualizar field com sucesso
    const elapsed = Date.now() - startTime
    await prisma.field.update({
      where: { id: field.id },
      data: {
        status: 'SUCCESS',
        areaHa,
        processedAt: new Date()
      }
    })

    return { 
      success: true, 
      areaHa, 
      correlation, 
      ndviPoints: ndviCurrent.length,
      elapsed 
    }

  } catch (error) {
    // Marcar como erro
    await prisma.field.update({
      where: { id: field.id },
      data: { 
        status: 'ERROR',
        errorMessage: error.message?.substring(0, 500) || 'Unknown error'
      }
    })

    return { success: false, error: error.message }
  }
}

async function main() {
  console.log('='.repeat(70))
  console.log('PROCESSAMENTO EM LOTE DE TALHÕES')
  console.log('='.repeat(70))
  console.log(`Workspace: ${WORKSPACE_ID}`)
  console.log(`API Key: ${MERX_API_KEY.substring(0, 15)}...`)
  console.log('')

  try {
    // 1. Buscar todos os talhões (exceto os já processados com sucesso)
    console.log('1. Buscando talhões...')
    const fields = await prisma.field.findMany({
      where: { 
        workspaceId: WORKSPACE_ID,
        status: { not: 'SUCCESS' } // Apenas pendentes ou com erro
      },
      orderBy: { name: 'asc' }
    })

    console.log(`   ${fields.length} talhões para processar\n`)

    if (fields.length === 0) {
      console.log('Nenhum talhão para processar.')
      return
    }

    // 2. Estatísticas
    let processed = 0
    let errors = 0
    let geocoded = 0
    const startTime = Date.now()

    // 3. Processar cada talhão
    console.log('2. Iniciando processamento...\n')
    
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i]
      const progress = `[${(i + 1).toString().padStart(2)}/${fields.length}]`
      
      console.log(`${progress} ${field.name}`)
      console.log(`      ID: ${field.id}`)
      console.log(`      Status: ${field.status}`)
      
      // 3.1 Atualizar município se tiver coordenadas
      if (field.latitude && field.longitude) {
        console.log(`      Coords: ${field.latitude.toFixed(4)}, ${field.longitude.toFixed(4)}`)
        
        const location = await reverseGeocode(field.latitude, field.longitude)
        
        if (location && location.city) {
          console.log(`      Município: ${location.city}, ${location.state}`)
          
          // Atualizar no banco
          await prisma.field.update({
            where: { id: field.id },
            data: {
              city: location.city,
              state: location.state
            }
          })
          geocoded++
        }
        
        // Respeitar rate limit do Nominatim
        await sleep(DELAY_GEOCODING)
      }

      // 3.2 Processar talhão
      console.log(`      Processando via Merx API...`)
      const result = await processField(field)
      
      if (result.success) {
        processed++
        console.log(`      ✓ Sucesso (${result.elapsed}ms)`)
        console.log(`        Área: ${result.areaHa?.toFixed(2)} ha | Pontos NDVI: ${result.ndviPoints}`)
      } else {
        errors++
        console.log(`      ✗ Erro: ${result.error}`)
      }

      console.log('')

      // Delay entre processamentos
      if (i < fields.length - 1) {
        await sleep(DELAY_BETWEEN_PROCESS)
      }
    }

    // 4. Resumo final
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
    
    console.log('='.repeat(70))
    console.log('RESUMO DO PROCESSAMENTO')
    console.log('='.repeat(70))
    console.log(`Total processados: ${fields.length}`)
    console.log(`Sucesso: ${processed}`)
    console.log(`Erros: ${errors}`)
    console.log(`Municípios atualizados: ${geocoded}`)
    console.log(`Tempo total: ${elapsed} minutos`)
    console.log('')

    // 5. Verificar status final
    const statusCount = await prisma.field.groupBy({
      by: ['status'],
      where: { workspaceId: WORKSPACE_ID },
      _count: { id: true }
    })
    
    console.log('Status dos talhões:')
    statusCount.forEach(s => {
      console.log(`  - ${s.status}: ${s._count.id}`)
    })

    // 6. Listar municípios únicos
    console.log('\nMunicípios:')
    const cities = await prisma.field.findMany({
      where: { workspaceId: WORKSPACE_ID },
      select: { city: true, state: true },
      distinct: ['city', 'state']
    })
    
    cities.forEach(c => {
      if (c.city) {
        console.log(`  - ${c.city}, ${c.state}`)
      }
    })

  } catch (error) {
    console.error('\nERRO FATAL:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
