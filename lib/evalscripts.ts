/**
 * Evalscripts para renderização de imagens via CDSE Process API
 * Usados pelo pipeline de Validação Visual IA (Curador + Juiz)
 * 
 * NOTA: Evalscripts de estatísticas (STATS_*) NÃO estão aqui.
 * O Merx já possui os seus no sentinel1.service.ts.
 */

// ==================== Sentinel-2 ====================

export const EVALSCRIPT_TRUE_COLOR = `//VERSION=3
function setup() {
  return {
    input: ["B02", "B03", "B04", "SCL", "dataMask"],
    output: { bands: 4 }
  };
}

function evaluatePixel(sample) {
  // Mask clouds (8,9,10), cloud shadows (3), snow (11) as transparent
  var scl = sample.SCL;
  var isCloud = (scl === 3 || scl === 8 || scl === 9 || scl === 10 || scl === 11);
  var alpha = sample.dataMask * (isCloud ? 0.15 : 1.0);
  return [2.5 * sample.B04, 2.5 * sample.B03, 2.5 * sample.B02, alpha];
}`

export const EVALSCRIPT_NDVI = `//VERSION=3
function setup() {
  return {
    input: ["B04", "B08", "SCL", "dataMask"],
    output: { bands: 4 }
  };
}

function evaluatePixel(sample) {
  // Mask clouds (8,9,10), cloud shadows (3), snow (11) as transparent
  var scl = sample.SCL;
  var isCloud = (scl === 3 || scl === 8 || scl === 9 || scl === 10 || scl === 11);
  var alpha = sample.dataMask * (isCloud ? 0.15 : 1.0);

  var ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);

  // Color ramp: red (bare/water) -> yellow (sparse) -> green (dense vegetation)
  var r, g, b;
  if (ndvi < -0.2) { r=0.05; g=0.05; b=0.5; }       // Water - dark blue
  else if (ndvi < 0.0) { r=0.75; g=0.15; b=0.15; }   // Bare soil - red
  else if (ndvi < 0.1) { r=0.9; g=0.3; b=0.1; }      // Very sparse - orange-red
  else if (ndvi < 0.2) { r=1.0; g=0.5; b=0.0; }      // Sparse - orange
  else if (ndvi < 0.3) { r=1.0; g=0.8; b=0.0; }      // Low vegetation - yellow
  else if (ndvi < 0.4) { r=0.8; g=0.9; b=0.1; }      // Moderate - yellow-green
  else if (ndvi < 0.5) { r=0.5; g=0.8; b=0.1; }      // Moderate-dense - light green
  else if (ndvi < 0.6) { r=0.2; g=0.7; b=0.1; }      // Dense - green
  else if (ndvi < 0.7) { r=0.1; g=0.6; b=0.05; }     // Very dense - dark green
  else { r=0.0; g=0.5; b=0.0; }                       // Maximum vegetation - deep green

  return [r, g, b, alpha];
}`

// ==================== Sentinel-1 (Radar) ====================

export const EVALSCRIPT_RADAR = `//VERSION=3
function setup() {
  return {
    input: ["VV", "VH"],
    output: { bands: 3 }
  };
}

function evaluatePixel(sample) {
  // RGB composite: VV=red, VH=green, VV/VH=blue
  let vv = Math.sqrt(sample.VV);
  let vh = Math.sqrt(sample.VH);
  let ratio = sample.VH > 0 ? Math.sqrt(sample.VV / sample.VH) : 0;
  return [
    Math.min(1, vv * 3.0),
    Math.min(1, vh * 5.0),
    Math.min(1, ratio * 0.5)
  ];
}`

// ==================== Landsat 8-9 ====================

export const EVALSCRIPT_LANDSAT_TRUE_COLOR = `//VERSION=3
function setup() {
  return {
    input: ["B02", "B03", "B04", "BQA", "dataMask"],
    output: { bands: 4 }
  };
}
function evaluatePixel(sample) {
  var bqa = sample.BQA;
  var isCloud = ((bqa >> 4) & 1) === 1 || ((bqa >> 5) & 1) === 1;
  var alpha = sample.dataMask * (isCloud ? 0.15 : 1.0);
  return [2.5 * sample.B04, 2.5 * sample.B03, 2.5 * sample.B02, alpha];
}`

export const EVALSCRIPT_LANDSAT_NDVI = `//VERSION=3
function setup() {
  return {
    input: ["B04", "B05", "BQA", "dataMask"],
    output: { bands: 4 }
  };
}
function evaluatePixel(sample) {
  var bqa = sample.BQA;
  var isCloud = ((bqa >> 4) & 1) === 1 || ((bqa >> 5) & 1) === 1;
  var alpha = sample.dataMask * (isCloud ? 0.15 : 1.0);
  var ndvi = (sample.B05 - sample.B04) / (sample.B05 + sample.B04);
  var r, g, b;
  if (ndvi < -0.2) { r=0.05; g=0.05; b=0.5; }
  else if (ndvi < 0.0) { r=0.75; g=0.15; b=0.15; }
  else if (ndvi < 0.1) { r=0.9; g=0.3; b=0.1; }
  else if (ndvi < 0.2) { r=1.0; g=0.5; b=0.0; }
  else if (ndvi < 0.3) { r=1.0; g=0.8; b=0.0; }
  else if (ndvi < 0.4) { r=0.8; g=0.9; b=0.1; }
  else if (ndvi < 0.5) { r=0.5; g=0.8; b=0.1; }
  else if (ndvi < 0.6) { r=0.2; g=0.7; b=0.1; }
  else if (ndvi < 0.7) { r=0.1; g=0.6; b=0.05; }
  else { r=0.0; g=0.5; b=0.0; }
  return [r, g, b, alpha];
}`

// ==================== Sentinel-3 OLCI ====================

export const EVALSCRIPT_S3_NDVI = `//VERSION=3
function setup() {
  return {
    input: ["B08", "B17", "dataMask"],
    output: { bands: 4 }
  };
}
function evaluatePixel(sample) {
  var ndvi = (sample.B17 - sample.B08) / (sample.B17 + sample.B08);
  var r, g, b;
  if (ndvi < -0.2) { r=0.05; g=0.05; b=0.5; }
  else if (ndvi < 0.0) { r=0.75; g=0.15; b=0.15; }
  else if (ndvi < 0.1) { r=0.9; g=0.3; b=0.1; }
  else if (ndvi < 0.2) { r=1.0; g=0.5; b=0.0; }
  else if (ndvi < 0.3) { r=1.0; g=0.8; b=0.0; }
  else if (ndvi < 0.4) { r=0.8; g=0.9; b=0.1; }
  else if (ndvi < 0.5) { r=0.5; g=0.8; b=0.1; }
  else if (ndvi < 0.6) { r=0.2; g=0.7; b=0.1; }
  else if (ndvi < 0.7) { r=0.1; g=0.6; b=0.05; }
  else { r=0.0; g=0.5; b=0.0; }
  return [r, g, b, sample.dataMask];
}`
