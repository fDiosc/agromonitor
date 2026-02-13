# Script de setup para desenvolvimento - MERX AGRO Monitor
# Execute após instalar Node.js 18+

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "=== MERX AGRO Monitor - Setup ===" -ForegroundColor Cyan

# 1. Instalar dependências
Write-Host "`n[1/4] Instalando dependencias..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install falhou" }

# 2. Gerar cliente Prisma
Write-Host "`n[2/4] Gerando cliente Prisma..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -ne 0) { throw "prisma generate falhou" }

# 3. Verificar .env.local
if (-not (Test-Path ".env.local")) {
    Write-Host "`n[3/4] Criando .env.local a partir de .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env.local"
    Write-Host "  IMPORTANTE: Edite .env.local e configure DATABASE_URL com seu PostgreSQL!" -ForegroundColor Red
} else {
    Write-Host "`n[3/4] .env.local ja existe." -ForegroundColor Green
}

# 4. Aplicar schema no banco (pode falhar se PostgreSQL nao estiver configurado)
Write-Host "`n[4/4] Aplicando schema no banco (prisma db push)..." -ForegroundColor Yellow
npx prisma db push 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  AVISO: db push falhou. Configure DATABASE_URL em .env.local e execute: npx prisma db push" -ForegroundColor Yellow
} else {
    Write-Host "  Banco configurado com sucesso!" -ForegroundColor Green
}

Write-Host "`n=== Setup concluido! ===" -ForegroundColor Green
Write-Host "Para iniciar o servidor: npm run dev" -ForegroundColor Cyan
