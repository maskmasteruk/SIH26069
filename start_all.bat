@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

set "LOCATION_TOPIC=location-data"
set "WEATHER_TOPIC=weather-data"
set "NEWS_TOPIC=india-weather-news"
set "SOCIAL_TOPIC=social_media_new_posts"

call :load_env_value "%ROOT%\weather_api\.env" KAFKA_INPUT_TOPIC LOCATION_TOPIC
call :load_env_value "%ROOT%\weather_api\.env" KAFKA_OUTPUT_TOPIC WEATHER_TOPIC
call :load_env_value "%ROOT%\news_scrapper\.env" KAFKA_TOPIC NEWS_TOPIC
call :load_env_value "%ROOT%\social_media_scrapper\.env" KAFKA_TOPIC SOCIAL_TOPIC

call :strip_quotes LOCATION_TOPIC
call :strip_quotes WEATHER_TOPIC
call :strip_quotes NEWS_TOPIC
call :strip_quotes SOCIAL_TOPIC

echo Project root: %ROOT%
echo.
echo Kafka topics:
echo   location input : %LOCATION_TOPIC%
echo   weather output : %WEATHER_TOPIC%
echo   news events    : %NEWS_TOPIC%
echo   social events  : %SOCIAL_TOPIC%
echo.

where docker >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker CLI was not found on PATH.
    pause
    exit /b 1
)

docker compose version >nul 2>&1
if errorlevel 1 (
    docker-compose version >nul 2>&1
    if errorlevel 1 (
        echo ERROR: Neither "docker compose" nor "docker-compose" was found.
        pause
        exit /b 1
    )

    set "COMPOSE_CMD=docker-compose"
) else (
    set "COMPOSE_CMD=docker compose"
)

echo Starting Kafka...
pushd "%ROOT%\kafka" || (
    echo ERROR: Could not open kafka directory.
    pause
    exit /b 1
)

%COMPOSE_CMD% up -d
if errorlevel 1 (
    popd
    echo ERROR: Kafka docker compose startup failed.
    pause
    exit /b 1
)

popd

echo Waiting for Kafka broker readiness...
for /l %%I in (1,1,60) do (
    docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list >nul 2>&1
    if not errorlevel 1 goto kafka_ready

    timeout /t 2 /nobreak >nul
)

echo ERROR: Kafka did not become ready within 120 seconds.
pause
exit /b 1

:kafka_ready
echo Kafka is ready.
echo.

call :create_topic "%LOCATION_TOPIC%"
call :create_topic "%WEATHER_TOPIC%"
call :create_topic "%NEWS_TOPIC%"
call :create_topic "%SOCIAL_TOPIC%"

call :write_monitor_script
start "Kafka Events Monitor" cmd /k "powershell -NoProfile -ExecutionPolicy Bypass -File ""%MONITOR_SCRIPT%"""

echo.
echo Starting Python services in their virtual environments...
for /d %%D in ("%ROOT%\*") do (
    if exist "%%~fD\main.py" (
        if exist "%%~fD\.venv\Scripts\activate.bat" (
            echo   Starting %%~nxD
            start "%%~nxD" cmd /k "cd /d ""%%~fD"" && call "".venv\Scripts\activate.bat"" && python main.py"
        ) else (
            echo   Skipping %%~nxD - missing .venv\Scripts\activate.bat
        )
    )
)

echo.
echo Done. Kafka and service windows are starting.
echo Close individual windows to stop services. Use "docker compose down" in kafka folder to stop Kafka.
echo.
pause
exit /b 0


:load_env_value
set "ENV_FILE=%~1"
set "ENV_KEY=%~2"
set "OUT_VAR=%~3"

if not exist "%ENV_FILE%" exit /b 0

for /f "usebackq tokens=1,* delims==" %%A in ("%ENV_FILE%") do (
    if /I "%%A"=="%ENV_KEY%" (
        set "%OUT_VAR%=%%B"
    )
)

exit /b 0


:strip_quotes
set "%~1=!%~1:"=!"
exit /b 0


:create_topic
if "%~1"=="" exit /b 0

echo Ensuring Kafka topic: %~1
docker exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --if-not-exists --topic "%~1" >nul 2>&1
if errorlevel 1 (
    echo   WARNING: Could not create or verify topic "%~1".
)

exit /b 0


:write_monitor_script
set "MONITOR_SCRIPT=%TEMP%\sih26069_kafka_monitor_%RANDOM%.ps1"

type nul > "%MONITOR_SCRIPT%"
>> "%MONITOR_SCRIPT%" echo $ErrorActionPreference = 'Continue'
>> "%MONITOR_SCRIPT%" echo $topics = @(
>> "%MONITOR_SCRIPT%" echo     '%LOCATION_TOPIC%',
>> "%MONITOR_SCRIPT%" echo     '%WEATHER_TOPIC%',
>> "%MONITOR_SCRIPT%" echo     '%NEWS_TOPIC%',
>> "%MONITOR_SCRIPT%" echo     '%SOCIAL_TOPIC%'
>> "%MONITOR_SCRIPT%" echo ) ^| Where-Object { $_ -and $_.Trim() -ne '' } ^| Select-Object -Unique
>> "%MONITOR_SCRIPT%" echo.
>> "%MONITOR_SCRIPT%" echo Write-Host ''
>> "%MONITOR_SCRIPT%" echo Write-Host 'Kafka topic-wise event monitor'
>> "%MONITOR_SCRIPT%" echo Write-Host 'Press Ctrl+C in this window to stop monitoring.'
>> "%MONITOR_SCRIPT%" echo Write-Host ''
>> "%MONITOR_SCRIPT%" echo.
>> "%MONITOR_SCRIPT%" echo $jobs = @()
>> "%MONITOR_SCRIPT%" echo foreach ($topic in $topics) {
>> "%MONITOR_SCRIPT%" echo     Write-Host ("Watching topic: {0}" -f $topic)
>> "%MONITOR_SCRIPT%" echo     $jobs += Start-Job -Name $topic -ArgumentList $topic -ScriptBlock {
>> "%MONITOR_SCRIPT%" echo         param($topicName)
>> "%MONITOR_SCRIPT%" echo         docker exec kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic $topicName --from-beginning --property print.key=true --property key.separator=' ^| '
>> "%MONITOR_SCRIPT%" echo     }
>> "%MONITOR_SCRIPT%" echo }
>> "%MONITOR_SCRIPT%" echo.
>> "%MONITOR_SCRIPT%" echo try {
>> "%MONITOR_SCRIPT%" echo     while ($true) {
>> "%MONITOR_SCRIPT%" echo         foreach ($job in $jobs) {
>> "%MONITOR_SCRIPT%" echo             $lines = Receive-Job -Job $job -ErrorAction SilentlyContinue
>> "%MONITOR_SCRIPT%" echo             foreach ($line in $lines) {
>> "%MONITOR_SCRIPT%" echo                 Write-Host ("[{0}] {1}" -f $job.Name, $line)
>> "%MONITOR_SCRIPT%" echo             }
>> "%MONITOR_SCRIPT%" echo         }
>> "%MONITOR_SCRIPT%" echo.
>> "%MONITOR_SCRIPT%" echo         Start-Sleep -Milliseconds 300
>> "%MONITOR_SCRIPT%" echo     }
>> "%MONITOR_SCRIPT%" echo } finally {
>> "%MONITOR_SCRIPT%" echo     $jobs ^| Stop-Job -ErrorAction SilentlyContinue
>> "%MONITOR_SCRIPT%" echo     $jobs ^| Remove-Job -Force -ErrorAction SilentlyContinue
>> "%MONITOR_SCRIPT%" echo }

exit /b 0
