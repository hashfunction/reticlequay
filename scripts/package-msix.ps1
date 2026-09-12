# The identity below was read from ReticleQuay's Partner Center Product identity page.
# Build packages only; no signing certificate or upstream account credentials are reused.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if (-not $IsWindows) { throw 'MSIX packaging requires Windows.' }
$sourceRoot = Split-Path -Parent $PSScriptRoot
$portable = Join-Path $sourceRoot 'build/AimWisp-win32-x64'
if (-not (Test-Path (Join-Path $portable 'AimWisp.exe'))) { throw 'Run npm run package:win first.' }
$kitRoot = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits/10/bin'
$makeAppx = Get-ChildItem -Path "$kitRoot/*/x64/makeappx.exe" | Sort-Object FullName -Descending | Select-Object -First 1
if (-not $makeAppx) { throw 'Windows SDK MakeAppx.exe was not found.' }
$stage = Join-Path $sourceRoot 'build/msix-stage'
if (Test-Path $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null
Copy-Item -Path "$portable/*" -Destination $stage -Recurse
$assets = Join-Path $stage 'Assets'
New-Item -ItemType Directory -Path $assets -Force | Out-Null
Add-Type -AssemblyName System.Drawing
foreach ($item in @(@{Name='StoreLogo';Size=50},@{Name='Square44x44Logo';Size=44},@{Name='Square150x150Logo';Size=150})) {
    $size = $item.Size
    $bitmap = [System.Drawing.Bitmap]::new($size,$size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#101b27'))
        $pen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#72dec9'),[single]($size/16))
        try {
            $mid=[single]($size/2);$lo=[single]($size/8);$near=[single]($size*3/8);$far=[single]($size*5/8);$hi=[single]($size*7/8)
            $graphics.DrawLine($pen,$mid,$lo,$mid,$near);$graphics.DrawLine($pen,$mid,$far,$mid,$hi)
            $graphics.DrawLine($pen,$lo,$mid,$near,$mid);$graphics.DrawLine($pen,$far,$mid,$hi,$mid)
        } finally { $pen.Dispose() }
        $brush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#edf4f4'))
        try { $diameter=[single]($size/10);$graphics.FillEllipse($brush,[single](($size-$diameter)/2),[single](($size-$diameter)/2),$diameter,$diameter) } finally { $brush.Dispose() }
        $bitmap.Save((Join-Path $assets ($item.Name+'.png')),[System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $graphics.Dispose();$bitmap.Dispose() }
}
$package = Get-Content (Join-Path $sourceRoot 'package.json') -Raw | ConvertFrom-Json
$version = $package.version+'.0'
$manifest = @"
<?xml version="1.0" encoding="utf-8"?>
<Package xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10" xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10" xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities" IgnorableNamespaces="uap rescap">
 <Identity Name="1659hashfunction.ReticleQuay" Publisher="CN=B6A2631A-FD32-45CC-AE12-82466975F528" Version="$version" ProcessorArchitecture="x64"/>
 <Properties><DisplayName>AimWisp</DisplayName><PublisherDisplayName>hashfunction</PublisherDisplayName><Description>Independent crosshair presets for your displays.</Description><Logo>Assets\StoreLogo.png</Logo></Properties>
 <Resources><Resource Language="en-US"/></Resources>
 <Dependencies><TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.19041.0" MaxVersionTested="10.0.26100.0"/></Dependencies>
 <Applications><Application Id="ReticleQuay" Executable="AimWisp.exe" EntryPoint="Windows.FullTrustApplication"><uap:VisualElements DisplayName="AimWisp" Description="Independent crosshair presets for your displays." BackgroundColor="#101b27" Square150x150Logo="Assets\Square150x150Logo.png" Square44x44Logo="Assets\Square44x44Logo.png"/></Application></Applications>
 <Capabilities><rescap:Capability Name="runFullTrust"/></Capabilities>
</Package>
"@
$manifest | Set-Content -Path (Join-Path $stage 'AppxManifest.xml') -Encoding utf8NoBOM
$output = Join-Path $sourceRoot "build/AimWisp_$($version)_x64.msix"
& $makeAppx.FullName pack /d $stage /p $output /o
if ($LASTEXITCODE -ne 0) { throw "MakeAppx failed with exit $LASTEXITCODE" }
$evidence = [ordered]@{
    generated_at_utc=[DateTime]::UtcNow.ToString('o');version=$version;architecture='x64';
    source_commit=(git -C $sourceRoot rev-parse HEAD);operating_system=[Environment]::OSVersion.VersionString;
    electron_version='44.3.0';makeappx=$makeAppx.FullName;package_sha256=(Get-FileHash $output -Algorithm SHA256).Hash;
    executable_sha256=(Get-FileHash (Join-Path $portable 'AimWisp.exe') -Algorithm SHA256).Hash;
    signed=$false;installation_tested=$false;submitted=$false;
    notes='Unsigned package built with Store-assigned identity. Installation, installed workflow testing, hardware checks and Store submission remain separate gates.'
}
$evidence | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $sourceRoot 'build/build-evidence.json') -Encoding utf8NoBOM
Write-Output "Built unsigned package: $output"
