/**
 * Script para testar chamada ZARC diretamente na API Merx
 */

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

const MERX_API_KEY = process.env.MERX_API_KEY || 'merx-api-jy8pKL2nXq5RmH7vWdG3bFtZxC4sN6aE'
const BASE_URL = 'https://api.merx.agr.br'

async function testZarc() {
  console.log('='.repeat(60))
  console.log('TESTE DE CHAMADA ZARC NA API MERX')
  console.log('='.repeat(60))

  // Buscar um talhão importado
  const field = await prisma.field.findFirst({
    where: { name: 'Talhão 01' },
    select: { id: true, name: true, geometryJson: true, cropType: true }
  })

  if (!field) {
    console.log('Talhão não encontrado')
    return
  }

  console.log(`\nTalhão: ${field.name}`)
  console.log(`Cultura: ${field.cropType}`)
  
  // Preparar FormData
  const formData = new FormData()
  const blob = new Blob([field.geometryJson], { type: 'application/geo+json' })
  formData.append('arquivo', blob, 'geometry.geojson')
  formData.append('ano', '2025')
  formData.append('cultura', field.cropType)

  console.log('\nEnviando para API Merx...')
  console.log(`URL: ${BASE_URL}/consulta-zarc-anual`)
  
  try {
    const response = await fetch(`${BASE_URL}/consulta-zarc-anual`, {
      method: 'POST',
      headers: {
        'x-api-key': MERX_API_KEY
      },
      body: formData
    })

    console.log(`Status: ${response.status}`)
    
    const data = await response.json()
    console.log('\nResposta:')
    console.log(JSON.stringify(data, null, 2))

    // Salvar resposta
    fs.writeFileSync(
      path.join(__dirname, 'zarc-response.json'),
      JSON.stringify(data, null, 2)
    )
    console.log('\nSalvo em: scripts/zarc-response.json')

  } catch (error) {
    console.error('Erro:', error.message)
  }

  await prisma.$disconnect()
}

testZarc()
