# Builds libil2cpp.so locally using Unity's IL2CPP compiler (Windows).
# Required once before EAS cloud build — EAS Linux cannot run Windows il2cpp.exe.
$ErrorActionPreference = "Stop"

$UnityEditor = "C:\Program Files\Unity\Hub\Editor\6000.5.1f1\Editor"
$JavaHome = Join-Path $UnityEditor "Data\PlaybackEngines\AndroidPlayer\OpenJDK"
$AndroidSdk = Join-Path $UnityEditor "Data\PlaybackEngines\AndroidPlayer\SDK"
$NdkHome = Join-Path $UnityEditor "Data\PlaybackEngines\AndroidPlayer\NDK"
$FrontendRoot = Split-Path -Parent $PSScriptRoot
$UnityLibrary = Join-Path $FrontendRoot "unity\builds\android\unityLibrary"
$WorkingDir = $UnityLibrary -replace '\\', '/'
$Abi = "arm64-v8a"
$Arch = "arm64"
$Configuration = "Release"
$OutputSo = Join-Path $UnityLibrary "src\main\jniLibs\$Abi\libil2cpp.so"

if (-not (Test-Path $JavaHome)) {
  Write-Error "Unity OpenJDK not found at $JavaHome"
}
if (-not (Test-Path $NdkHome)) {
  Write-Error "Unity NDK not found at $NdkHome"
}
if (-not (Test-Path $UnityLibrary)) {
  Write-Error "unityLibrary export missing. Export ARFurniture from Unity first."
}

$Il2CppExe = Join-Path $UnityLibrary "src\main\Il2CppOutputProject\IL2CPP\build\deploy\il2cpp.exe"
if (-not (Test-Path $Il2CppExe)) {
  Write-Error "il2cpp.exe not found at $Il2CppExe"
}

$jniDir = Split-Path $OutputSo -Parent
New-Item -ItemType Directory -Force -Path $jniDir | Out-Null
$symbolsDir = Join-Path $UnityLibrary "symbols\$Abi"
New-Item -ItemType Directory -Force -Path $symbolsDir | Out-Null

$env:JAVA_HOME = $JavaHome
$env:ANDROID_SDK_ROOT = $AndroidSdk
$env:ANDROID_NDK_ROOT = $NdkHome
$env:NDK_ROOT = $NdkHome
$env:ANDROID_NDK_HOME = $NdkHome

$ndkPath = $NdkHome -replace '\\', '/'
$wd = $WorkingDir

$args = @(
  "--compile-cpp",
  "--platform=Android",
  "--architecture=$Arch",
  "--outputpath=$wd/src/main/jniLibs/$Abi/libil2cpp.so",
  "--baselib-directory=$wd/src/main/jniStaticLibs/$Abi",
  "--incremental-g-c-time-slice=3",
  "--configuration=$Configuration",
  "--dotnetprofile=unityaot-linux",
  "--usymtool-path=$wd/src/main/Il2CppOutputProject/usymtool.exe",
  "--profiler-report",
  "--profiler-output-file=$wd/build/il2cpp_${Abi}_${Configuration}/il2cpp_conv.traceevents",
  "--print-command-line",
  "--static-lib-il2-cpp",
  "--data-folder=$wd/src/main/Il2CppOutputProject/Source/il2cppOutput/data",
  "--generatedcppdir=$wd/src/main/Il2CppOutputProject/Source/il2cppOutput",
  "--cachedirectory=$wd/build/il2cpp_${Abi}_${Configuration}/il2cpp_cache",
  "--tool-chain-path=$ndkPath"
)

Write-Host 'Compiling IL2CPP (may take 5-15 minutes)...'
Write-Host "Output: $OutputSo"

Push-Location $UnityLibrary
try {
  & $Il2CppExe @args
  if ($LASTEXITCODE -ne 0) {
    Write-Error "il2cpp.exe failed with exit code $LASTEXITCODE"
  }
} finally {
  Pop-Location
}

if (-not (Test-Path $OutputSo)) {
  Write-Error "libil2cpp.so was not created."
}

$sizeMb = [math]::Round((Get-Item $OutputSo).Length / 1MB, 1)
Write-Host "Success: libil2cpp.so (${sizeMb} MB)"
Write-Host "Next: npx eas-cli build --profile development --platform android"
