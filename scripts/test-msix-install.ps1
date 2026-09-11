# Runs only on an isolated, disposable Windows CI runner.
# Keeps the unsigned Store package unchanged; temporary signing trust is removed in finally.
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
if (-not $IsWindows -or $env:CI -ne 'true') { throw 'Run this installation test only on an isolated Windows CI runner.' }
$sourceRoot=Split-Path -Parent $PSScriptRoot
$identity='1659hashfunction.ReticleQuay'
$publisher='CN=B6A2631A-FD32-45CC-AE12-82466975F528'
$package=Get-ChildItem (Join-Path $sourceRoot 'build/ReticleQuay_*_x64.msix') | Select-Object -First 1
if (-not $package) { throw 'Unsigned MSIX is missing.' }
if (Get-AppxPackage -Name $identity) { throw 'A ReticleQuay installation already exists; refusing to replace it.' }
$kitRoot=Join-Path ${env:ProgramFiles(x86)} 'Windows Kits/10/bin'
$signTool=Get-ChildItem "$kitRoot/*/x64/signtool.exe" | Sort-Object FullName -Descending | Select-Object -First 1
if (-not $signTool) { throw 'SignTool not available.' }
$testPackage=Join-Path $sourceRoot 'build/ReticleQuay-install-test.msix'
$certificatePath=Join-Path $sourceRoot 'build/ReticleQuay-install-test.cer'
$certificate=$null
$installed=$null
$passed=$false
try {
    Copy-Item -LiteralPath $package.FullName -Destination $testPackage
    $certificate=New-SelfSignedCertificate -Type Custom -KeyUsage DigitalSignature -CertStoreLocation 'Cert:\CurrentUser\My' -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3','2.5.29.19={text}') -Subject $publisher -FriendlyName 'ReticleQuay ephemeral CI installation test' -NotAfter (Get-Date).AddDays(1)
    Export-Certificate -Cert $certificate -FilePath $certificatePath | Out-Null
    Import-Certificate -FilePath $certificatePath -CertStoreLocation 'Cert:\LocalMachine\TrustedPeople' | Out-Null
    & $signTool.FullName sign /fd SHA256 /sha1 $certificate.Thumbprint /s My $testPackage
    if ($LASTEXITCODE -ne 0) { throw "Signing failed: $LASTEXITCODE" }
    & $signTool.FullName verify /pa $testPackage
    if ($LASTEXITCODE -ne 0) { throw "Signature verification failed: $LASTEXITCODE" }
    Add-AppxPackage -Path $testPackage
    $installed=Get-AppxPackage -Name $identity
    if (-not $installed -or $installed.Publisher -ne $publisher) { throw 'Installed identity/publisher mismatch.' }
    $env:RETICLEQUAY_EXECUTABLE=Join-Path $installed.InstallLocation 'ReticleQuay.exe'
    if (-not (Test-Path $env:RETICLEQUAY_EXECUTABLE)) { throw 'Installed executable absent.' }
    $env:RETICLEQUAY_SMOKE_ROOT=Join-Path $env:RUNNER_TEMP 'reticlequay-installed-smoke'
    node (Join-Path $sourceRoot 'tests/electron-smoke.cjs')
    if ($LASTEXITCODE -ne 0) { throw "Installed application workflow failed: $LASTEXITCODE" }
    Remove-AppxPackage -Package $installed.PackageFullName
    if (Get-AppxPackage -Name $identity) { throw 'Uninstall did not remove package registration.' }
    $passed=$true
    $evidencePath=Join-Path $sourceRoot 'build/build-evidence.json'
    $evidence=Get-Content $evidencePath -Raw | ConvertFrom-Json
    $evidence.installation_tested=$true
    $evidence | Add-Member -NotePropertyName installed_workflow_passed -NotePropertyValue $true -Force
    $evidence | Add-Member -NotePropertyName uninstall_tested -NotePropertyValue $true -Force
    $evidence | Add-Member -NotePropertyName installed_package_full_name -NotePropertyValue $installed.PackageFullName -Force
    $evidence | Add-Member -NotePropertyName test_signed_package_sha256 -NotePropertyValue (Get-FileHash $testPackage -Algorithm SHA256).Hash -Force
    $evidence.notes='Unsigned Store package unchanged. Disposable CI copy signed, installed, real installed executable workflow tested, then uninstalled. Physical mixed-DPI/game/hotkey checks and Store submission remain pending.'
    $evidence | ConvertTo-Json -Depth 8 | Set-Content $evidencePath -Encoding utf8NoBOM
    Write-Output 'PASS: signed test copy, verified signature, installed expected identity, exercised installed executable, uninstalled.'
} finally {
    if (-not $passed -and $installed) {
        Get-Process ReticleQuay -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        Remove-AppxPackage -Package $installed.PackageFullName -ErrorAction Continue
    }
    Remove-Item Env:RETICLEQUAY_EXECUTABLE -ErrorAction SilentlyContinue
    Remove-Item Env:RETICLEQUAY_SMOKE_ROOT -ErrorAction SilentlyContinue
    if ($certificate) {
        Remove-Item -LiteralPath ('Cert:\LocalMachine\TrustedPeople\'+$certificate.Thumbprint) -ErrorAction Continue
        Remove-Item -LiteralPath ('Cert:\CurrentUser\My\'+$certificate.Thumbprint) -ErrorAction Continue
    }
    Remove-Item -LiteralPath $certificatePath -ErrorAction SilentlyContinue
}
