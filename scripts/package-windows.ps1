$ErrorActionPreference = 'Stop'
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    npm ci
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
    npm test
    if ($LASTEXITCODE -ne 0) { throw 'Unit tests failed.' }
    npm run test:smoke
    if ($LASTEXITCODE -ne 0) { throw 'Electron smoke test failed.' }
    npm run package:win
    if ($LASTEXITCODE -ne 0) { throw 'Windows packaging failed.' }
    $archive = Join-Path (Get-Location) 'build/ReticleQuay-1.0.0-win32-x64.zip'
    Compress-Archive -Path 'build/ReticleQuay-win32-x64' -DestinationPath $archive -Force
    Get-FileHash -Algorithm SHA256 $archive
} finally { Pop-Location }
