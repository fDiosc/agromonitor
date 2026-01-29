/**
 * Script de Debug - Teste da API Merx
 * 
 * Uso: npx tsx scripts/test-merx-api.ts
 */

const BASE_URL = 'https://homolog.api.merx.tech/api/monitoramento'
const PROXY_URL = 'https://corsproxy.io/?'

// Geometria de teste (pequeno polígono em Goiás)
const TEST_GEOJSON = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-49.25, -16.68],
        [-49.24, -16.68],
        [-49.24, -16.67],
        [-49.25, -16.67],
        [-49.25, -16.68]
      ]]
    }
  }]
}

interface TestResult {
  endpoint: string
  success: boolean
  status?: number
  timeMs: number
  error?: string
  dataPreview?: any
}

async function testEndpoint(
  endpoint: string,
  params: Record<string, any> = {},
  timeoutMs: number = 30000,
  useJson: boolean = false
): Promise<TestResult> {
  const startTime = Date.now()
  const targetUrl = `${BASE_URL}${endpoint}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  // Build request body based on type
  let body: FormData | string
  let headers: Record<string, string> = { 'Accept': 'application/json' }

  if (useJson) {
    body = JSON.stringify(params)
    headers['Content-Type'] = 'application/json'
  } else {
    const formData = new FormData()
    const blob = new Blob([JSON.stringify(TEST_GEOJSON)], { type: 'application/geo+json' })
    formData.append('arquivo', blob, 'test.geojson')

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value))
      }
    })
    body = formData
  }

  try {
    // Tentar direto primeiro
    let response: Response
    try {
      response = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal
      })
    } catch {
      // Fallback para proxy
      console.log(`  [PROXY] Tentando via proxy...`)
      const proxyTarget = `${PROXY_URL}${encodeURIComponent(targetUrl)}`
      response = await fetch(proxyTarget, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal
      })
    }

    clearTimeout(timeoutId)

    const timeMs = Date.now() - startTime

    if (!response.ok) {
      const text = await response.text()
      return {
        endpoint,
        success: false,
        status: response.status,
        timeMs,
        error: text.substring(0, 200)
      }
    }

    const data = await response.json()
    
    return {
      endpoint,
      success: true,
      status: response.status,
      timeMs,
      dataPreview: summarizeData(data)
    }
  } catch (error: any) {
    clearTimeout(timeoutId)
    const timeMs = Date.now() - startTime

    if (error.name === 'AbortError') {
      return {
        endpoint,
        success: false,
        timeMs,
        error: `TIMEOUT após ${timeoutMs}ms`
      }
    }

    return {
      endpoint,
      success: false,
      timeMs,
      error: error.message
    }
  }
}

function summarizeData(data: any): any {
  if (Array.isArray(data)) {
    return {
      type: 'array',
      length: data.length,
      sample: data.slice(0, 2)
    }
  }

  if (typeof data === 'object' && data !== null) {
    const keys = Object.keys(data)
    const summary: any = { keys }

    // Procurar por arrays aninhados
    keys.forEach(key => {
      if (Array.isArray(data[key])) {
        summary[key] = { type: 'array', length: data[key].length }
      } else if (typeof data[key] === 'object') {
        summary[key] = { type: 'object', keys: Object.keys(data[key] || {}).slice(0, 5) }
      } else {
        summary[key] = data[key]
      }
    })

    return summary
  }

  return data
}

async function runTests() {
  console.log('=' .repeat(60))
  console.log('TESTE DE CONECTIVIDADE - API MERX')
  console.log('=' .repeat(60))
  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Proxy: ${PROXY_URL}`)
  console.log(`Geometria de teste: Polígono em Goiás (-49.25, -16.68)`)
  console.log('=' .repeat(60))
  console.log('')

  const today = new Date().toISOString().split('T')[0]
  const startDate = '2024-09-01'

  const tests = [
    {
      name: '1. Consulta NDVI (Safra Atual)',
      endpoint: '/consulta-ndvi',
      params: { start_date: startDate, end_date: today },
      timeout: 30000
    },
    {
      name: '2. Consulta Precipitação (JSON com pontos)',
      endpoint: '/consulta-precipitacao',
      params: { 
        pontos: [{ latitude: -16.68, longitude: -49.25 }],
        start_date: startDate, 
        end_date: today 
      },
      timeout: 30000,
      useJson: true
    },
    {
      name: '3. Consulta Área Lavoura',
      endpoint: '/consulta-area-lavoura',
      params: { cultura: 'SOJA' },
      timeout: 30000
    },
    {
      name: '4. Consulta Solo',
      endpoint: '/consulta-solo',
      params: {},
      timeout: 30000
    },
    {
      name: '5. Consulta Idade Lavoura',
      endpoint: '/consulta-idade-lavoura',
      params: { cultura: 'SOJA', data_plantio: startDate },
      timeout: 30000
    },
    {
      name: '6. Consulta ZARC Anual',
      endpoint: '/consulta-zarc-anual',
      params: { ano: 2024, cultura: 'SOJA' },
      timeout: 30000
    },
    {
      name: '7. Consulta NDVI Histórico (-1 ano)',
      endpoint: '/consulta-ndvi',
      params: { start_date: '2023-09-01', end_date: '2024-04-01' },
      timeout: 45000
    }
  ]

  const results: TestResult[] = []

  for (const test of tests) {
    console.log(`\n${test.name}`)
    console.log(`  Endpoint: ${test.endpoint}`)
    console.log(`  Params: ${JSON.stringify(test.params)}`)
    console.log(`  Timeout: ${test.timeout}ms`)
    process.stdout.write('  Testando...')

    const result = await testEndpoint(test.endpoint, test.params, test.timeout, (test as any).useJson || false)
    results.push(result)

    if (result.success) {
      console.log(` ✅ OK (${result.timeMs}ms)`)
      console.log(`  Status: ${result.status}`)
      console.log(`  Data: ${JSON.stringify(result.dataPreview, null, 2).split('\n').map((l, i) => i === 0 ? l : '        ' + l).join('\n')}`)
    } else {
      console.log(` ❌ FALHOU (${result.timeMs}ms)`)
      console.log(`  Erro: ${result.error}`)
    }
  }

  // Resumo
  console.log('\n')
  console.log('=' .repeat(60))
  console.log('RESUMO')
  console.log('=' .repeat(60))
  
  const successCount = results.filter(r => r.success).length
  const failCount = results.filter(r => !r.success).length
  const avgTime = Math.round(results.reduce((a, r) => a + r.timeMs, 0) / results.length)

  console.log(`Total: ${results.length} testes`)
  console.log(`Sucesso: ${successCount} (${Math.round(successCount / results.length * 100)}%)`)
  console.log(`Falhas: ${failCount}`)
  console.log(`Tempo médio: ${avgTime}ms`)

  if (failCount > 0) {
    console.log('\nEndpoints com falha:')
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.endpoint}: ${r.error}`)
    })
  }

  // Recomendações
  console.log('\n')
  console.log('=' .repeat(60))
  console.log('RECOMENDAÇÕES')
  console.log('=' .repeat(60))

  if (avgTime > 10000) {
    console.log('⚠️  Tempo médio alto (>10s). Considere:')
    console.log('   - Aumentar timeouts para histórico')
    console.log('   - Implementar cache para dados históricos')
  }

  if (failCount > 0) {
    console.log('⚠️  Algumas requisições falharam. Verifique:')
    console.log('   - Conectividade com a API')
    console.log('   - Limites de rate limiting')
    console.log('   - Validade dos parâmetros')
  }

  if (successCount === results.length) {
    console.log('✅ Todas as APIs estão funcionando corretamente!')
  }

  console.log('')
}

// Executar
runTests().catch(console.error)
