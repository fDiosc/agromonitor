/**
 * Fixtures de geometria GeoJSON para testes.
 */

// Talhão em Londrina/PR (~100ha)
export const GEOMETRY_LONDRINA = {
  type: 'Polygon' as const,
  coordinates: [[
    [-51.17, -23.31],
    [-51.16, -23.31],
    [-51.16, -23.30],
    [-51.17, -23.30],
    [-51.17, -23.31],
  ]],
}

// Talhão em Sorriso/MT (~200ha)
export const GEOMETRY_SORRISO = {
  type: 'Polygon' as const,
  coordinates: [[
    [-55.72, -12.55],
    [-55.70, -12.55],
    [-55.70, -12.54],
    [-55.72, -12.54],
    [-55.72, -12.55],
  ]],
}

// Talhão em Cruz Alta/RS (~80ha)
export const GEOMETRY_CRUZ_ALTA = {
  type: 'Polygon' as const,
  coordinates: [[
    [-53.61, -28.64],
    [-53.60, -28.64],
    [-53.60, -28.63],
    [-53.61, -28.63],
    [-53.61, -28.64],
  ]],
}

// GeoJSON como string (formato usado no banco)
export const GEOMETRY_JSON_LONDRINA = JSON.stringify(GEOMETRY_LONDRINA)
export const GEOMETRY_JSON_SORRISO = JSON.stringify(GEOMETRY_SORRISO)
