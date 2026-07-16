$ErrorActionPreference = 'Stop'

$javaCandidates = @(
  (Get-ChildItem 'C:\Program Files\Java' -Directory -Filter 'jdk-21*' -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    Select-Object -ExpandProperty FullName),
  $env:JAVA_HOME,
  'C:\Program Files\Android\Android Studio\jbr'
) | Where-Object { $_ -and (Test-Path (Join-Path $_ 'bin\java.exe')) }

$javaHome = $javaCandidates | Select-Object -First 1
if (-not $javaHome) {
  throw 'No usable JDK was found. Install JDK 21 and try again.'
}

$env:JAVA_HOME = $javaHome

& npm.cmd run app:sync
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Push-Location (Join-Path $PSScriptRoot '..\android')
try {
  & .\gradlew.bat assembleDebug --init-script mirror.init.gradle
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
