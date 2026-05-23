# RAGE OPTIMIZATION — NETLIFY INTEGRATED STATIC BUILD SCRIPT
# This script compiles the React frontends and merges the Admin Panel into the Website under the '/admin' subfolder.

$ErrorActionPreference = "Stop"

Write-Host "=== STEP 1: Building Admin Panel ===" -ForegroundColor Cyan
Set-Location "c:\Users\Admin\Downloads\RBZ_PC_Optimizer_Project\AdminPanel"
npm run build

Write-Host "=== STEP 2: Building Website ===" -ForegroundColor Cyan
Set-Location "c:\Users\Admin\Downloads\RBZ_PC_Optimizer_Project\Website"
npm run build

Write-Host "=== STEP 3: Merging Portals ===" -ForegroundColor Cyan
$webDist = "c:\Users\Admin\Downloads\RBZ_PC_Optimizer_Project\Website\dist"
$adminTarget = Join-Path $webDist "admin"

if (Test-Path $adminTarget) {
    Remove-Item -Path $adminTarget -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $adminTarget | Out-Null
Copy-Item -Path "c:\Users\Admin\Downloads\RBZ_PC_Optimizer_Project\AdminPanel\dist\*" -Destination $adminTarget -Recurse -Force

# Create netlify redirect rules for clean routing of SPA pages
$redirectsFile = Join-Path $webDist "_redirects"
Set-Content -Path $redirectsFile -Value @"
/admin/*    /admin/index.html   200
/*          /index.html         200
"@

Set-Location "c:\Users\Admin\Downloads\RBZ_PC_Optimizer_Project"
Write-Host "=============================================" -ForegroundColor Green
Write-Host "SUCCESS: Combined site is ready in: Website/dist" -ForegroundColor Green
Write-Host "Deploy the folder 'Website/dist' directly to Netlify." -ForegroundColor Green
Write-Host "Website will serve at your root domain, and Admin at /admin." -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
