# Discord Clone - Setup Script
# Run this after installing Node.js from https://nodejs.org

Write-Host "Setting up Discord Clone..." -ForegroundColor Cyan

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Node.js is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Download it from https://nodejs.org (LTS version)" -ForegroundColor Yellow
    exit 1
}

$nodeVersion = node --version
Write-Host "Node.js $nodeVersion found." -ForegroundColor Green

# Install server dependencies
Write-Host "`nInstalling server dependencies..." -ForegroundColor Cyan
Set-Location "C:\Users\Mitchell\Projects\discord-clone\server"
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "Server install failed!" -ForegroundColor Red; exit 1 }

# Run database migration
Write-Host "`nCreating database..." -ForegroundColor Cyan
node db/migrate.js
if ($LASTEXITCODE -ne 0) { Write-Host "Migration failed!" -ForegroundColor Red; exit 1 }

# Install client dependencies
Write-Host "`nInstalling client dependencies..." -ForegroundColor Cyan
Set-Location "C:\Users\Mitchell\Projects\discord-clone\client"
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "Client install failed!" -ForegroundColor Red; exit 1 }

Write-Host "`n========================================" -ForegroundColor Green
Write-Host " Setup complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "To start the app, open TWO terminal windows:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Terminal 1 (Backend):"
Write-Host "    cd C:\Users\Mitchell\Projects\discord-clone\server"
Write-Host "    node index.js"
Write-Host ""
Write-Host "  Terminal 2 (Frontend):"
Write-Host "    cd C:\Users\Mitchell\Projects\discord-clone\client"
Write-Host "    npm run dev"
Write-Host ""
Write-Host "  Then open http://localhost:3000 in your browser." -ForegroundColor Cyan
Write-Host ""
Write-Host "  To let friends on your local network join, share your LAN IP:" -ForegroundColor Yellow
Write-Host "  Run 'ipconfig' and look for 'IPv4 Address' (e.g. 192.168.1.x)" -ForegroundColor Yellow
Write-Host "  Update client\.env.local and server\.env with that IP." -ForegroundColor Yellow
