/**
 * Geocoding Service
 * Geocodificação reversa via Nominatim (OpenStreetMap)
 */

export interface Location {
  city: string
  state: string
  lat: number
  lng: number
}

// Cache em memória para evitar rate limit do Nominatim
const cache = new Map<string, Location>()

/**
 * Geocodificação reversa - converte coordenadas em endereço
 */
export async function reverseGeocode(lat: number, lng: number): Promise<Location> {
  // Arredondar para reduzir variações e melhorar cache
  const roundedLat = Math.round(lat * 100) / 100
  const roundedLng = Math.round(lng * 100) / 100
  const cacheKey = `${roundedLat},${roundedLng}`

  // Verificar cache
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`,
      {
        headers: {
          'User-Agent': 'MerxAgroMonitor/1.0',
          'Accept-Language': 'pt-BR'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Nominatim error: ${response.status}`)
    }

    const data = await response.json()
    
    const location: Location = {
      city: data.address?.city || 
            data.address?.town || 
            data.address?.municipality ||
            data.address?.county ||
            'Zona Rural',
      state: data.address?.state || 'Estado Desconhecido',
      lat,
      lng
    }

    // Salvar no cache
    cache.set(cacheKey, location)

    return location
  } catch (error) {
    console.error('Geocoding error:', error)
    
    // Fallback baseado nas coordenadas
    return getDefaultLocation(lat, lng)
  }
}

/**
 * Retorna localização padrão baseada nas coordenadas
 */
function getDefaultLocation(lat: number, lng: number): Location {
  // Mapear estados brasileiros por região aproximada
  let state = 'Estado Desconhecido'
  
  if (lat > -5 && lng > -50) state = 'Maranhão'
  else if (lat > -10 && lat < -5 && lng > -45) state = 'Piauí'
  else if (lat > -10 && lat < -5 && lng < -45 && lng > -50) state = 'Tocantins'
  else if (lat > -15 && lat < -10 && lng > -50 && lng < -45) state = 'Bahia'
  else if (lat > -20 && lat < -10 && lng < -50 && lng > -60) state = 'Mato Grosso'
  else if (lat > -25 && lat < -20 && lng < -50 && lng > -60) state = 'Mato Grosso do Sul'
  else if (lat > -25 && lat < -15 && lng < -45 && lng > -55) state = 'Goiás'
  else if (lat > -30 && lat < -20 && lng < -45 && lng > -50) state = 'Minas Gerais'
  else if (lat > -30 && lat < -20 && lng > -45) state = 'São Paulo'
  else if (lat < -25 && lng > -55) state = 'Paraná'
  else if (lat < -27 && lng > -55) state = 'Santa Catarina'
  else if (lat < -28) state = 'Rio Grande do Sul'

  return {
    city: 'Zona Rural',
    state,
    lat,
    lng
  }
}

/**
 * Limpa o cache de geocodificação
 */
export function clearGeocodingCache(): void {
  cache.clear()
}
