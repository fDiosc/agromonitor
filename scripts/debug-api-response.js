// Fazer uma chamada HTTP real à API e verificar a resposta
const http = require('http')

const fieldId = 'cmkzn8hbt0000ylnidmalbjyg'

const options = {
  hostname: 'localhost',
  port: 3000,
  path: `/api/fields/${fieldId}`,
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
}

const req = http.request(options, (res) => {
  let data = ''
  
  res.on('data', (chunk) => {
    data += chunk
  })
  
  res.on('end', () => {
    try {
      const json = JSON.parse(data)
      
      console.log('=== API RESPONSE ANALYSIS ===\n')
      
      // Verificar chartOverlayData
      const chartData = json.chartOverlayData
      
      if (!chartData) {
        console.log('❌ chartOverlayData está NULL ou undefined!')
        return
      }
      
      console.log('Total pontos no chartOverlayData:', chartData.length)
      
      // Encontrar range de datas
      const dates = chartData.map(d => d.date).sort()
      console.log('\nPrimeira data:', dates[0])
      console.log('Última data:', dates[dates.length - 1])
      
      // Contar pontos com projeção
      const withProjection = chartData.filter(d => d.projection !== undefined)
      console.log('\nPontos com projeção:', withProjection.length)
      
      if (withProjection.length > 0) {
        const projDates = withProjection.map(d => d.date).sort()
        console.log('Primeira data projeção:', projDates[0])
        console.log('Última data projeção:', projDates[projDates.length - 1])
        
        console.log('\nPrimeiros 5 pontos de projeção:')
        withProjection.slice(0, 5).forEach(p => {
          console.log(`  ${p.date}: projection=${p.projection?.toFixed(3)}`)
        })
        
        console.log('\nÚltimos 5 pontos de projeção:')
        withProjection.slice(-5).forEach(p => {
          console.log(`  ${p.date}: projection=${p.projection?.toFixed(3)}`)
        })
      } else {
        console.log('❌ NENHUM ponto tem valor de projeção!')
        
        // Mostrar últimos pontos
        console.log('\nÚltimos 10 pontos do chartData:')
        chartData.slice(-10).forEach(p => {
          console.log(`  ${p.date}: current=${p.current?.toFixed(3) || 'N/A'}, projection=${p.projection || 'N/A'}`)
        })
      }
      
      // Verificar pontos com current
      const withCurrent = chartData.filter(d => d.current !== undefined)
      console.log('\nPontos com dados atuais:', withCurrent.length)
      if (withCurrent.length > 0) {
        const currDates = withCurrent.map(d => d.date).sort()
        console.log('Primeiro dado atual:', currDates[0])
        console.log('Último dado atual:', currDates[currDates.length - 1])
      }
      
    } catch (e) {
      console.error('Erro ao parsear JSON:', e.message)
      console.log('Resposta raw:', data.substring(0, 500))
    }
  })
})

req.on('error', (e) => {
  console.error('Erro na requisição:', e.message)
  console.log('Certifique-se que o servidor está rodando em localhost:3000')
})

req.end()
