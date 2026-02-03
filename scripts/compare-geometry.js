/**
 * Script para comparar geometria de talhões
 */

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

async function main() {
  // Buscar um talhão importado
  const importedField = await prisma.field.findFirst({
    where: { 
      name: { startsWith: 'Talhão' }
    },
    select: { id: true, name: true, geometryJson: true }
  })

  console.log('='.repeat(60))
  console.log('TALHÃO IMPORTADO')
  console.log('='.repeat(60))
  
  if (importedField) {
    console.log(`Nome: ${importedField.name}`)
    console.log(`ID: ${importedField.id}`)
    
    try {
      const geom = JSON.parse(importedField.geometryJson)
      console.log(`\nTipo principal: ${geom.type}`)
      
      if (geom.features) {
        console.log(`Número de features: ${geom.features.length}`)
        const feat = geom.features[0]
        console.log(`  Feature type: ${feat.type}`)
        console.log(`  Geometry type: ${feat.geometry?.type}`)
        console.log(`  Num coordinates: ${feat.geometry?.coordinates?.[0]?.length || 'N/A'}`)
        
        // Verificar se o polígono está fechado
        const coords = feat.geometry?.coordinates?.[0]
        if (coords && coords.length > 0) {
          const first = coords[0]
          const last = coords[coords.length - 1]
          console.log(`  Primeiro ponto: [${first[0].toFixed(6)}, ${first[1].toFixed(6)}]`)
          console.log(`  Último ponto: [${last[0].toFixed(6)}, ${last[1].toFixed(6)}]`)
          console.log(`  Polígono fechado: ${first[0] === last[0] && first[1] === last[1] ? 'SIM' : 'NÃO'}`)
        }
      }
      
      // Salvar exemplo
      fs.writeFileSync(
        path.join(__dirname, 'imported-geometry.json'),
        JSON.stringify(geom, null, 2)
      )
      console.log('\nSalvo em: scripts/imported-geometry.json')
      
    } catch (e) {
      console.log('Erro ao parsear:', e.message)
      console.log('Conteúdo raw (primeiros 500 chars):')
      console.log(importedField.geometryJson.substring(0, 500))
    }
  } else {
    console.log('Nenhum talhão importado encontrado')
  }

  // Ler o GeoJSON original que usamos para importar
  console.log('\n' + '='.repeat(60))
  console.log('GEOJSON ORIGINAL (arquivo)')
  console.log('='.repeat(60))
  
  const geojsonPath = path.join(__dirname, '..', '..', '2025_2026_agraria_4326', '2025_2026_Agraria_4326.geojson')
  if (fs.existsSync(geojsonPath)) {
    const content = JSON.parse(fs.readFileSync(geojsonPath, 'utf-8'))
    const feat = content.features[0]
    
    console.log(`Tipo principal: ${content.type}`)
    console.log(`Número de features: ${content.features.length}`)
    console.log(`  Feature type: ${feat.type}`)
    console.log(`  Geometry type: ${feat.geometry?.type}`)
    console.log(`  Num coordinates: ${feat.geometry?.coordinates?.[0]?.length || 'N/A'}`)
    
    const coords = feat.geometry?.coordinates?.[0]
    if (coords && coords.length > 0) {
      const first = coords[0]
      const last = coords[coords.length - 1]
      console.log(`  Primeiro ponto: [${first[0].toFixed(6)}, ${first[1].toFixed(6)}]`)
      console.log(`  Último ponto: [${last[0].toFixed(6)}, ${last[1].toFixed(6)}]`)
      console.log(`  Polígono fechado: ${first[0] === last[0] && first[1] === last[1] ? 'SIM' : 'NÃO'}`)
    }
  }

  await prisma.$disconnect()
}

main()
