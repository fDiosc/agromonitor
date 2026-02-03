/**
 * Script de importação de talhões do Shapefile
 * 
 * Execução: node scripts/import-shapefile.js
 */

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

// Configurações
const WORKSPACE_ID = 'default-workspace' // MERX Demo
const PRODUCER_NAME = 'Produtor Agrária'
const CROP_TYPE = 'SOJA'
const GEOJSON_PATH = path.join(__dirname, '..', '..', '2025_2026_agraria_4326', '2025_2026_Agraria_4326.geojson')

async function main() {
  console.log('='.repeat(60))
  console.log('IMPORTAÇÃO DE TALHÕES - SHAPEFILE AGRÁRIA')
  console.log('='.repeat(60))

  try {
    // 1. Verificar workspace
    console.log('\n1. Verificando workspace...')
    const workspace = await prisma.workspace.findUnique({
      where: { id: WORKSPACE_ID }
    })
    
    if (!workspace) {
      throw new Error(`Workspace não encontrado: ${WORKSPACE_ID}`)
    }
    console.log(`   Workspace: ${workspace.name}`)

    // 2. Deletar talhões existentes (cascade deleta análises e distâncias)
    console.log('\n2. Deletando talhões existentes...')
    
    // Contar antes
    const countBefore = await prisma.field.count({
      where: { workspaceId: WORKSPACE_ID }
    })
    console.log(`   Talhões encontrados: ${countBefore}`)
    
    // Deletar um por um para respeitar o cascade
    const fieldsToDelete = await prisma.field.findMany({
      where: { workspaceId: WORKSPACE_ID },
      select: { id: true, name: true }
    })
    
    for (const field of fieldsToDelete) {
      await prisma.field.delete({ where: { id: field.id } })
      process.stdout.write(`\r   Deletando: ${field.name}                    `)
    }
    console.log(`\n   ${fieldsToDelete.length} talhões deletados`)

    // 3. Criar ou buscar produtor
    console.log('\n3. Criando/buscando produtor...')
    let producer = await prisma.producer.findFirst({
      where: { 
        workspaceId: WORKSPACE_ID,
        name: PRODUCER_NAME
      }
    })

    if (!producer) {
      producer = await prisma.producer.create({
        data: {
          name: PRODUCER_NAME,
          workspaceId: WORKSPACE_ID
        }
      })
      console.log(`   Produtor criado: ${producer.name} (${producer.id})`)
    } else {
      console.log(`   Produtor existente: ${producer.name} (${producer.id})`)
    }

    // 4. Ler GeoJSON
    console.log('\n4. Lendo GeoJSON...')
    console.log(`   Caminho: ${GEOJSON_PATH}`)
    
    if (!fs.existsSync(GEOJSON_PATH)) {
      throw new Error(`Arquivo não encontrado: ${GEOJSON_PATH}`)
    }
    
    const geojsonContent = fs.readFileSync(GEOJSON_PATH, 'utf-8')
    const geojson = JSON.parse(geojsonContent)
    console.log(`   ${geojson.features.length} features encontradas`)

    // 5. Importar talhões
    console.log('\n5. Importando talhões...')
    let imported = 0
    let errors = 0

    for (const feature of geojson.features) {
      try {
        const fid = feature.properties.id
        const name = `Talhão ${fid.toString().padStart(2, '0')}`
        
        // Extrair coordenadas do centroide
        const lat = feature.properties.centroid_lat
        const lon = feature.properties.centroid_lon
        const areaHa = feature.properties.areaHa

        // Data de início da safra 2025/2026 (outubro 2025)
        const seasonStartDate = new Date('2025-10-01')
        
        // Converter geometria para FeatureCollection (formato esperado pela API Merx)
        const featureCollection = {
          type: "FeatureCollection",
          features: [{
            type: "Feature",
            properties: {
              id: fid,
              name: name
            },
            geometry: feature.geometry
          }]
        }
        const geometryJson = JSON.stringify(featureCollection)

        // Criar talhão
        await prisma.field.create({
          data: {
            name,
            workspaceId: WORKSPACE_ID,
            producerId: producer.id,
            cropType: CROP_TYPE,
            latitude: lat,
            longitude: lon,
            areaHa: areaHa,
            geometryJson: geometryJson,
            status: 'PENDING',
            city: 'Guarapuava',
            state: 'PR',
            seasonStartDate: seasonStartDate
          }
        })

        imported++
        process.stdout.write(`\r   [${imported}/${geojson.features.length}] ${name} - ${areaHa.toFixed(2)} ha        `)
      } catch (err) {
        errors++
        console.error(`\n   ERRO no talhão ${feature.properties.id}:`, err.message)
      }
    }

    console.log('\n')

    // 6. Resumo
    console.log('='.repeat(60))
    console.log('RESUMO DA IMPORTAÇÃO')
    console.log('='.repeat(60))
    console.log(`Talhões importados: ${imported}`)
    console.log(`Erros: ${errors}`)
    console.log(`Produtor: ${producer.name}`)
    console.log(`Cultura: ${CROP_TYPE}`)
    console.log(`Workspace: ${workspace.name}`)

    // 7. Verificar contagem final
    const finalCount = await prisma.field.count({
      where: { workspaceId: WORKSPACE_ID }
    })
    console.log(`\nTotal de talhões no banco: ${finalCount}`)

    // 8. Listar alguns talhões criados
    console.log('\nPrimeiros 5 talhões criados:')
    const sampleFields = await prisma.field.findMany({
      where: { workspaceId: WORKSPACE_ID },
      take: 5,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, areaHa: true, latitude: true, longitude: true }
    })
    sampleFields.forEach(f => {
      console.log(`  - ${f.name}: ${f.areaHa?.toFixed(2)} ha (${f.latitude?.toFixed(4)}, ${f.longitude?.toFixed(4)})`)
    })

  } catch (error) {
    console.error('\nERRO:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
