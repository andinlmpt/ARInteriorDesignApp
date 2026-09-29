# Builds and installs the Expo dev client with embedded Unity on Android.
# Uses Unity JDK/NDK and a writable copy of Unity Android SDK (Program Files SDK is read-only).
$ErrorActionPreference = "Stop"

$UnityEditor = "C:\Program Files\Unity\Hub\Editor\6000.5.1f1\Editor"
$JavaHome = Join-Path $UnityEditor "Data\PlaybackEngines\AndroidPlayer\OpenJDK"
$UnitySdk = Join-Path $UnityEditor "Data\PlaybackEngines\AndroidPlayer\SDK"
$NdkHome = Join-Path $UnityEditor "Data\PlaybackEngines\AndroidPlayer\NDK"
$FrontendRoot = Split-Path -Parent $PSScriptRoot
$WritableSdk = Join-Path $env:LOCALAPPDATA "ARAndroidSdk"

function Ensure-WritableAndroidSdk {
    param(
        [string]$SourceSdk,
        [string]$DestSdk,
        [string]$JdkHome
    )

    $marker = Join-Path $DestSdk ".synced-from-unity"
    if (-not (Test-Path $marker)) {
        Write-Host "One-time copy: Unity SDK -> $DestSdk (writable for Gradle licenses/packages)..."
        New-Item -ItemType Directory -Force -Path $DestSdk | Out-Null
        & robocopy $SourceSdk $DestSdk /MIR /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
        if ($LASTEXITCODE -gt 7) {
            Write-Error "robocopy failed copying Android SDK (exit $LASTEXITCODE)."
        }
        Set-Content -Path $marker -Value (Get-Date).ToString("o") -Encoding ASCII
    }

    $cmdlineSdkManager = Join-Path $DestSdk 'cmdline-tools\latest\bin\sdkmanager.bat'
    if (-not (Test-Path $cmdlineSdkManager)) {
        Write-Host 'Downloading Android cmdline-tools (one-time)...'
        $zipPath = Join-Path $env:TEMP 'android-cmdline-tools.zip'
        $extractPath = Join-Path $env:TEMP 'android-cmdline-tools'
        $cmdlineToolsUrl = 'https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip'
        Invoke-WebRequest -Uri $cmdlineToolsUrl -OutFile $zipPath
        if (Test-Path $extractPath) { Remove-Item -Recurse -Force $extractPath }
        Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force
        $cmdlineParent = Join-Path $DestSdk 'cmdline-tools'
        New-Item -ItemType Directory -Force -Path $cmdlineParent | Out-Null
        $latestDir = Join-Path $cmdlineParent 'latest'
        if (Test-Path $latestDir) { Remove-Item -Recurse -Force $latestDir }
        Move-Item -Path (Join-Path $extractPath 'cmdline-tools') -Destination $latestDir
    }

    if (Test-Path $cmdlineSdkManager) {
        $env:JAVA_HOME = $JdkHome
        $prevEap = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
            $licenseFile = Join-Path $DestSdk 'licenses\android-sdk-license'
            if (-not (Test-Path $licenseFile)) {
                Write-Host 'Accepting Android SDK licenses...'
                1..60 | ForEach-Object { 'y' } | & $cmdlineSdkManager --sdk_root=$DestSdk --licenses | Out-Null
            }
            $buildTools35 = Join-Path $DestSdk 'build-tools\35.0.0'
            if (-not (Test-Path $buildTools35)) {
                Write-Host 'Installing Android build-tools 35.0.0...'
                & $cmdlineSdkManager --sdk_root=$DestSdk 'build-tools;35.0.0'
            }
            $ndkDir = Join-Path $DestSdk 'ndk\27.2.12479018'
            if (-not (Test-Path $ndkDir)) {
                Write-Host 'Installing Android NDK 27.2.12479018...'
                & $cmdlineSdkManager --sdk_root=$DestSdk 'ndk;27.2.12479018'
            }
        }
        finally {
            $ErrorActionPreference = $prevEap
        }
    }
}

foreach ($path in @($JavaHome, $UnitySdk, $NdkHome)) {
    if (-not (Test-Path $path)) {
        $msg = "Missing Android toolchain path: $path. Install Android Build Support in Unity Hub for 6000.5.1f1."
        Write-Error $msg
    }
}

Ensure-WritableAndroidSdk -SourceSdk $UnitySdk -DestSdk $WritableSdk -JdkHome $JavaHome

$AndroidSdk = $WritableSdk
$Adb = Join-Path $AndroidSdk "platform-tools\adb.exe"
if (-not (Test-Path $Adb)) {
    Write-Error "adb missing in writable SDK at $AndroidSdk"
}

$env:JAVA_HOME = $JavaHome
$env:ANDROID_HOME = $AndroidSdk
$env:ANDROID_SDK_ROOT = $AndroidSdk
$env:ANDROID_NDK_HOME = $NdkHome
$env:NDK_ROOT = $NdkHome
$pathParts = @(
    (Join-Path $AndroidSdk 'platform-tools')
    (Join-Path $AndroidSdk 'cmdline-tools/latest/bin')
    (Join-Path $AndroidSdk 'tools/bin')
    (Join-Path $JavaHome 'bin')
    $env:Path
)
$env:Path = ($pathParts -join ';')

Write-Host "ANDROID_HOME=$AndroidSdk"
Write-Host "JAVA_HOME=$JavaHome"
Write-Host "NDK=$NdkHome"

& $Adb version | Select-Object -First 1

$unityLibrary = Join-Path $FrontendRoot "unity\builds\android\unityLibrary\build.gradle"
if (-not (Test-Path $unityLibrary)) {
    Write-Error "Unity export missing. Export ARDesignScene to frontend\unity\builds\android first."
}

function Write-LocalProperties($dir) {
    if (-not (Test-Path $dir)) { return }
    $escapedSdk = $AndroidSdk -replace '\\', '\\'
    # Use SDK-managed NDK (ndk/27.x) — Unity's standalone NDK breaks RN C++ linking.
    Set-Content -Path (Join-Path $dir "local.properties") -Value "sdk.dir=$escapedSdk" -Encoding ASCII
}

Write-LocalProperties (Join-Path $FrontendRoot "android")
Write-LocalProperties (Join-Path $FrontendRoot "unity\builds\android")

$unityLibraryGradle = Join-Path $FrontendRoot "unity\builds\android\unityLibrary\build.gradle"
if (Test-Path $unityLibraryGradle) {
    $gradle = Get-Content $unityLibraryGradle -Raw
    $ndkPathPattern = '\s*ndkPath\s+"[^"]+"\s*(\r?\n)'
    $patched = $gradle -replace $ndkPathPattern, [Environment]::NewLine
    if ($patched -ne $gradle) {
        Set-Content -Path $unityLibraryGradle -Value $patched -NoNewline
        Write-Host "Patched unityLibrary/build.gradle (removed ndkPath)."
    }
}

$azesmwayGradle = Join-Path $FrontendRoot "node_modules\@azesmway\react-native-unity\android\build.gradle"
if (Test-Path $azesmwayGradle) {
    $gradle = Get-Content $azesmwayGradle -Raw
    if ($gradle -notmatch 'buildToolsVersion getExtOrDefault\("buildToolsVersion"\)') {
        $patched = $gradle -replace 'compileSdkVersion getExtOrIntegerDefault\("compileSdkVersion"\)', @'
compileSdkVersion getExtOrIntegerDefault("compileSdkVersion")
  buildToolsVersion getExtOrDefault("buildToolsVersion")
'@
        Set-Content -Path $azesmwayGradle -Value $patched -NoNewline
        Write-Host 'Patched @azesmway/react-native-unity buildToolsVersion.'
    }
}

# Re-apply Unity UaaL Java patches (pause instead of destroy so AR can reopen).
$azesmwayJavaSrc = Join-Path $FrontendRoot "node_modules\@azesmway\react-native-unity\android\src\main\java\com\azesmwayreactnativeunity"
$azesmwayPatches = Join-Path $FrontendRoot "patches\azesmway-react-native-unity"
if ((Test-Path $azesmwayJavaSrc) -and (Test-Path $azesmwayPatches)) {
    foreach ($name in @('UPlayer.java', 'ReactNativeUnity.java', 'ReactNativeUnityViewManager.java', 'ReactNativeUnityView.java')) {
        $from = Join-Path $azesmwayPatches $name
        $to = Join-Path $azesmwayJavaSrc $name
        if (Test-Path $from) {
            Copy-Item $from $to -Force
            Write-Host "Applied Unity patch: $name"
        }
    }
}

Push-Location $FrontendRoot
try {
    npx expo run:android @args
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
