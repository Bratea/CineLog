$ErrorActionPreference = 'Stop'

$javaSettings = (& java -XshowSettings:properties -version 2>&1 | Out-String)
$javaHomeMatch = [regex]::Match($javaSettings, 'java\.home\s*=\s*(.+)')
if (-not $javaHomeMatch.Success) {
  throw '未找到可用的 JDK。请安装 JDK 21 后重试。'
}

$env:JAVA_HOME = $javaHomeMatch.Groups[1].Value.Trim()

& npm.cmd run app:sync
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Push-Location (Join-Path $PSScriptRoot '..\android')
try {
  & .\gradlew.bat assembleDebug --init-script mirror.init.gradle
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
