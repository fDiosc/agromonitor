/**
 * Geometry Service
 * Validação e processamento de geometrias KML/GeoJSON
 */

export interface GeometryValidation {
  isValid: boolean
  type: 'Polygon' | 'MultiPolygon' | 'Unknown'
  vertexCount: number
  areaHa: number
  centroid: { lat: number; lng: number }
  geojson: GeoJSON.FeatureCollection | null
  errors: string[]
  warnings: string[]
}

export interface Coordinates {
  lng: number
  lat: number
}

/**
 * Valida e processa um arquivo de geometria (KML ou GeoJSON)
 */
export function validateGeometry(
  fileContent: string,
  fileName: string
): GeometryValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const ext = fileName.split('.').pop()?.toLowerCase()

  try {
    let coords: [number, number][] = []
    let type: 'Polygon' | 'MultiPolygon' | 'Unknown' = 'Unknown'
    let geojson: GeoJSON.FeatureCollection | null = null

    // Parse baseado no formato
    if (ext === 'geojson' || ext === 'json' || fileContent.trim().startsWith('{')) {
      const result = parseGeoJSON(fileContent)
      coords = result.coords
      type = result.type
      geojson = result.geojson
      errors.push(...result.errors)
    } else if (ext === 'kml' || fileContent.includes('<kml')) {
      const result = parseKML(fileContent)
      coords = result.coords
      type = result.type
      geojson = result.geojson
      errors.push(...result.errors)
    } else {
      errors.push('Formato de arquivo não suportado. Use GeoJSON ou KML.')
      return createErrorResult(errors, warnings)
    }

    if (coords.length === 0) {
      errors.push('Nenhuma coordenada encontrada no arquivo.')
      return createErrorResult(errors, warnings)
    }

    // Validações
    if (coords.length < 4) {
      errors.push(`Polígono precisa de pelo menos 3 vértices (encontrado: ${coords.length - 1})`)
    }

    // Verificar se polígono está fechado
    const first = coords[0]
    const last = coords[coords.length - 1]
    if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
      warnings.push('Polígono não está fechado. Será fechado automaticamente.')
      coords.push([first[0], first[1]])
    }

    // Calcular centroid
    const centroid = calculateCentroid(coords)

    // Verificar coordenadas dentro do Brasil
    if (centroid.lat < -34 || centroid.lat > 6 || centroid.lng < -74 || centroid.lng > -32) {
      warnings.push('Coordenadas parecem estar fora do Brasil')
    }

    // Calcular área
    const areaHa = calculateSphericalArea(coords)

    if (areaHa < 0.5) {
      warnings.push('Área muito pequena (< 0.5 ha). Verifique as coordenadas.')
    }

    if (areaHa > 50000) {
      warnings.push('Área muito grande (> 50.000 ha). Verifique se o polígono está correto.')
    }

    // Normalizar GeoJSON se não foi criado
    if (!geojson) {
      geojson = createGeoJSON(coords)
    }

    return {
      isValid: errors.length === 0,
      type,
      vertexCount: coords.length - 1,
      areaHa,
      centroid,
      geojson,
      errors,
      warnings
    }
  } catch (e) {
    errors.push(`Erro ao processar arquivo: ${e instanceof Error ? e.message : 'Erro desconhecido'}`)
    return createErrorResult(errors, warnings)
  }
}

function parseGeoJSON(content: string): {
  coords: [number, number][]
  type: 'Polygon' | 'MultiPolygon' | 'Unknown'
  geojson: GeoJSON.FeatureCollection | null
  errors: string[]
} {
  const errors: string[] = []
  
  try {
    const json = JSON.parse(content)
    let feature: any = null

    if (json.type === 'FeatureCollection') {
      feature = json.features?.[0]
    } else if (json.type === 'Feature') {
      feature = json
    } else if (json.type === 'Polygon' || json.type === 'MultiPolygon') {
      feature = { type: 'Feature', geometry: json, properties: {} }
    }

    if (!feature?.geometry) {
      errors.push('Geometria não encontrada no arquivo GeoJSON')
      return { coords: [], type: 'Unknown', geojson: null, errors }
    }

    const geometry = feature.geometry
    let coords: [number, number][] = []
    let type: 'Polygon' | 'MultiPolygon' | 'Unknown' = 'Unknown'

    if (geometry.type === 'Polygon') {
      type = 'Polygon'
      coords = geometry.coordinates[0] as [number, number][]
    } else if (geometry.type === 'MultiPolygon') {
      type = 'MultiPolygon'
      coords = geometry.coordinates[0][0] as [number, number][]
    } else {
      errors.push(`Tipo de geometria não suportado: ${geometry.type}. Use Polygon ou MultiPolygon.`)
    }

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [feature]
    }

    return { coords, type, geojson, errors }
  } catch (e) {
    errors.push('Erro ao parsear GeoJSON: arquivo inválido')
    return { coords: [], type: 'Unknown', geojson: null, errors }
  }
}

function parseKML(content: string): {
  coords: [number, number][]
  type: 'Polygon' | 'MultiPolygon' | 'Unknown'
  geojson: GeoJSON.FeatureCollection | null
  errors: string[]
} {
  const errors: string[] = []

  try {
    const match = content.match(/<coordinates>([\s\S]*?)<\/coordinates>/)
    
    if (!match) {
      errors.push('Tag <coordinates> não encontrada no KML')
      return { coords: [], type: 'Unknown', geojson: null, errors }
    }

    const rawCoords = match[1].trim().split(/\s+/)
    const coords: [number, number][] = rawCoords.map(r => {
      const parts = r.split(',')
      return [parseFloat(parts[0]), parseFloat(parts[1])] as [number, number]
    }).filter(c => !isNaN(c[0]) && !isNaN(c[1]))

    const geojson = createGeoJSON(coords)

    return { coords, type: 'Polygon', geojson, errors }
  } catch (e) {
    errors.push('Erro ao parsear KML: arquivo inválido')
    return { coords: [], type: 'Unknown', geojson: null, errors }
  }
}

function createGeoJSON(coords: [number, number][]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [coords]
      }
    }]
  }
}

function calculateCentroid(coords: [number, number][]): Coordinates {
  if (coords.length === 0) return { lat: 0, lng: 0 }
  
  let sumLng = 0
  let sumLat = 0
  
  for (const [lng, lat] of coords) {
    sumLng += lng
    sumLat += lat
  }
  
  return {
    lng: sumLng / coords.length,
    lat: sumLat / coords.length
  }
}

/**
 * Calcula área usando algoritmo de shoelace esférico
 * @returns Área em hectares
 */
export function calculateSphericalArea(coords: [number, number][]): number {
  if (coords.length < 3) return 0

  const R = 6371000 // Raio da Terra em metros
  const toRad = Math.PI / 180

  let area = 0
  for (let i = 0; i < coords.length - 1; i++) {
    const p1 = coords[i]
    const p2 = coords[i + 1]
    area += (p2[0] - p1[0]) * toRad * (2 + Math.sin(p1[1] * toRad) + Math.sin(p2[1] * toRad))
  }

  area = Math.abs(area * R * R / 2)
  return area / 10000 // Conversão de m² para Hectares
}

function createErrorResult(errors: string[], warnings: string[]): GeometryValidation {
  return {
    isValid: false,
    type: 'Unknown',
    vertexCount: 0,
    areaHa: 0,
    centroid: { lat: 0, lng: 0 },
    geojson: null,
    errors,
    warnings
  }
}
