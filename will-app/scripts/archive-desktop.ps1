param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination
)
$ErrorActionPreference = 'Stop'
$resolvedSource = (Resolve-Path -LiteralPath $Source).Path
$resolvedDestination = [IO.Path]::GetFullPath($Destination)
if (Test-Path -LiteralPath $resolvedDestination) { throw 'Archive already exists.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::CreateFromDirectory(
    $resolvedSource, $resolvedDestination, [IO.Compression.CompressionLevel]::Optimal, $true
)
