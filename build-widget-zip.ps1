#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Genera widget.zip listo para subir al panel de integración pública de Kommo.

.DESCRIPTION
    Empaqueta únicamente los archivos necesarios según la documentación de Kommo:
    https://developers.kommo.com/docs/getting-listed#widgetzip-archive-requirements

    Contenido del zip:
      - manifest.json
      - script.js
      - i18n/en.json
      - i18n/es.json
      - images/logo.png       (108 x 108 px)
      - images/logo_main.png  (400 x 272 px)
      - images/logo_medium.png(240 x 84 px)
      - images/logo_min.png   ( 84 x 84 px)
      - images/logo_small.png (130 x 100 px)

    NO se incluyen:
      - config.js             (archivo de referencia local, no usado por el widget)
      - server-api.js         (helper del servidor, no cargado por el widget)
      - kommo-oauth-handler.js(código del servidor backend)
      - *.md                  (documentación, no requerida)
      - INTEGRATION_EXAMPLE.js(ejemplo de referencia)

.EXAMPLE
    .\build-widget-zip.ps1
    .\build-widget-zip.ps1 -OutputPath "dist\widget_v1.0.0.zip"
#>

param(
    [string]$OutputPath = "widget.zip"
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

# ─── Archivos a incluir (base obligatoria) ───────────────────────────────────
$filesToInclude = @(
    "manifest.json",
    "script.js",
    "i18n\en.json",
    "i18n\es.json",
    "images\logo.png",
    "images\logo_main.png",
    "images\logo_medium.png",
    "images\logo_min.png",
    "images\logo_small.png"
)

# ─── Agregar imágenes del tour si existen ─────────────────────────────────────
# El tour nativo de Kommo requiere imágenes JPG de 1188×616px en /images/
# Convención de nombre: slideshow_N_LANG.jpg  (N = 1..5, LANG = en|es|pt)
$tourImages = Get-ChildItem -Path (Join-Path $Root "images") -Filter "slideshow_*.jpg" -ErrorAction SilentlyContinue
foreach ($img in $tourImages) {
    $filesToInclude += "images\$($img.Name)"
}

# ─── Verificar que todos los archivos existen ─────────────────────────────────
Write-Host "`n[build] Verificando archivos requeridos..." -ForegroundColor Cyan
$missing = @()
foreach ($file in $filesToInclude) {
    $fullPath = Join-Path $Root $file
    if (Test-Path $fullPath) {
        Write-Host "  ✅  $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌  $file - NO ENCONTRADO" -ForegroundColor Red
        $missing += $file
    }
}

if ($missing.Count -gt 0) {
    Write-Error "`n[build] Faltan $($missing.Count) archivo(s). Corrígelos antes de empaquetar."
    exit 1
}

# ─── Validaciones rápidas ─────────────────────────────────────────────────────
Write-Host "`n[build] Ejecutando validaciones..." -ForegroundColor Cyan

# manifest.json debe ser JSON válido
try {
    $manifest = Get-Content (Join-Path $Root "manifest.json") -Raw | ConvertFrom-Json
    Write-Host "  ✅  manifest.json es JSON válido" -ForegroundColor Green
} catch {
    Write-Error "  ❌  manifest.json no es JSON válido: $_"
    exit 1
}

# Verificar campos requeridos en manifest.json
$requiredFields = @("widget", "locations", "settings")
foreach ($field in $requiredFields) {
    if ($manifest.$field) {
        Write-Host "  ✅  manifest.$field presente" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️   manifest.$field faltante" -ForegroundColor Yellow
    }
}

# i18n/en.json debe ser JSON válido
try {
    $en = Get-Content (Join-Path $Root "i18n\en.json") -Raw | ConvertFrom-Json
    Write-Host "  ✅  i18n/en.json es JSON válido" -ForegroundColor Green
} catch {
    Write-Error "  ❌  i18n/en.json no es JSON válido: $_"
    exit 1
}

# i18n/es.json debe ser JSON válido
try {
    $es = Get-Content (Join-Path $Root "i18n\es.json") -Raw | ConvertFrom-Json
    Write-Host "  ✅  i18n/es.json es JSON válido" -ForegroundColor Green
} catch {
    Write-Error "  ❌  i18n/es.json no es JSON válido: $_"
    exit 1
}

# Verificar que coinciden los locales de manifest con los archivos i18n
$manifestLocales = $manifest.widget.locale
if ($manifestLocales) {
    foreach ($locale in $manifestLocales) {
        $i18nFile = Join-Path $Root "i18n\$locale.json"
        if (Test-Path $i18nFile) {
            Write-Host "  ✅  i18n/$locale.json existe (declarado en manifest)" -ForegroundColor Green
        } else {
            Write-Host "  ❌  i18n/$locale.json faltante (declarado en manifest como locale)" -ForegroundColor Red
        }
    }
}

# Verificar tour (slideshow nativo de Kommo)
$tourOk = $false
if ($manifest.tour -and ($manifest.tour.is_tour -eq $true)) {
    $totalTourImgs = 0
    $manifest.tour.tour_images.PSObject.Properties | ForEach-Object {
        $locale = $_.Name
        $_.Value | ForEach-Object {
            $imgFull = Join-Path $Root $_.TrimStart('/')
            if (Test-Path $imgFull) {
                $totalTourImgs++
            } else {
                Write-Host "  [WARN] Tour image faltante ($locale): $_  --> Crea JPG 1188x616px en images/" -ForegroundColor Yellow
            }
        }
    }
    if ($totalTourImgs -gt 0) {
        Write-Host "  [OK]  Tour nativo configurado ($totalTourImgs imagen(es) encontradas)" -ForegroundColor Green
        $tourOk = $true
    } else {
        Write-Host "  [WARN] Tour configurado en manifest pero sin imagenes -- agrega JPGs 1188x616px en images/" -ForegroundColor Yellow
    }
}

# Verificar que no haya eval en script.js
$scriptContent = Get-Content (Join-Path $Root "script.js") -Raw
if ($scriptContent -match '\beval\(') {
    Write-Host "  ❌  script.js contiene eval() - prohibido por Kommo" -ForegroundColor Red
    exit 1
} else {
    Write-Host "  ✅  script.js sin eval()" -ForegroundColor Green
}

# Verificar que no haya async: false en script.js
if ($scriptContent -match 'async\s*:\s*false') {
    Write-Host "  ❌  script.js usa async: false - prohibido por Kommo" -ForegroundColor Red
    exit 1
} else {
    Write-Host "  ✅  script.js sin peticiones síncronas" -ForegroundColor Green
}

# Verificar que no haya console.log/warn/trace fuera de catch blocks (básico)
$debugLines = ($scriptContent -split "`n" | Where-Object { $_ -match '^\s*console\.(log|warn|trace)\(' }).Count
if ($debugLines -gt 0) {
    Write-Host "  ⚠️   script.js tiene $debugLines líneas de console.log/warn/trace - considera limpiarlas" -ForegroundColor Yellow
} else {
    Write-Host "  ✅  script.js sin console.log/warn/trace de debug" -ForegroundColor Green
}

# Verificar nombre del widget
$widgetName = $en.widget.name
if ($widgetName -and $widgetName.Length -le 30) {
    Write-Host "  ✅  Nombre del widget: '$widgetName' ($($widgetName.Length) chars <= 30)" -ForegroundColor Green
} elseif ($widgetName) {
    Write-Host "  ❌  Nombre del widget demasiado largo: '$widgetName' ($($widgetName.Length) chars > 30)" -ForegroundColor Red
}

# Verificar short_description
$shortDesc = $en.widget.short_description
if ($shortDesc -and $shortDesc.Length -le 50) {
    Write-Host "  ✅  short_description: '$shortDesc' ($($shortDesc.Length) chars <= 50)" -ForegroundColor Green
} elseif ($shortDesc) {
    Write-Host "  ❌  short_description demasiado larga: $($shortDesc.Length) chars > 50" -ForegroundColor Red
}

# ─── Crear el ZIP ─────────────────────────────────────────────────────────────
$outputFullPath = Join-Path $Root $OutputPath

# Eliminar zip anterior si existe
if (Test-Path $outputFullPath) {
    Remove-Item $outputFullPath -Force
    Write-Host "`n[build] ZIP anterior eliminado." -ForegroundColor Gray
}

Write-Host "`n[build] Creando $OutputPath..." -ForegroundColor Cyan

# Crear directorio temporal
$tempDir = Join-Path $env:TEMP "kommo_widget_build_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir | Out-Null

try {
    foreach ($file in $filesToInclude) {
        $src = Join-Path $Root $file
        $dst = Join-Path $tempDir $file
        $dstDir = Split-Path $dst -Parent
        if (-not (Test-Path $dstDir)) {
            New-Item -ItemType Directory -Path $dstDir | Out-Null
        }
        Copy-Item $src $dst
    }

    # Crear el ZIP desde el directorio temporal
    Compress-Archive -Path "$tempDir\*" -DestinationPath $outputFullPath -CompressionLevel Optimal

    $zipSize = (Get-Item $outputFullPath).Length / 1KB
    Write-Host "`n[build] ✅  $OutputPath creado correctamente ($([math]::Round($zipSize, 1)) KB)" -ForegroundColor Green

} finally {
    # Limpiar directorio temporal
    Remove-Item $tempDir -Recurse -Force
}

# ─── Resumen ─────────────────────────────────────────────────────────────────
Write-Host "`n[build] Resumen del ZIP:" -ForegroundColor Cyan
foreach ($file in $filesToInclude) {
    $src = Join-Path $Root $file
    $sizeKB = [math]::Round((Get-Item $src).Length / 1KB, 2)
    Write-Host "  📄  $file ($sizeKB KB)" -ForegroundColor Gray
}

Write-Host "`n[build] Próximos pasos:" -ForegroundColor Cyan
Write-Host "  1. Sube $OutputPath en el panel de tu cuenta técnica de Kommo:" -ForegroundColor Gray
Write-Host "     Settings → Integrations → [Tu integración] → Settings (Stage 2) → Upload Widget Archive" -ForegroundColor Gray
Write-Host "  2. Completa todos los campos del Stage 2 (nombre, descripción, imágenes, privacidad, soporte)." -ForegroundColor Gray
Write-Host "  3. Asegúrate de que el servidor tenga configurados los endpoints OAuth de Kommo:" -ForegroundColor Gray
Write-Host "     GET  /oauth/kommo/callback?code=...&referer=...&from_widget=true" -ForegroundColor Gray
Write-Host "     GET  /oauth/kommo/revoked?account_id=...&client_id=..." -ForegroundColor Gray
Write-Host "  4. Haz clic en 'Request Review' para enviar a moderación." -ForegroundColor Gray
Write-Host ""
