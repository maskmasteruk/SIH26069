@echo off
setlocal EnableExtensions

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

set "KAFKA_CONTAINER=kafka"
set "POSTGRES_CONTAINER=disaster_postgres"

echo Project root: %ROOT%
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

call :compose_down "%ROOT%\kafka" "Kafka"
call :compose_down "%ROOT%\postgres" "PostgreSQL"

echo.
echo Removing any remaining known containers...
call :remove_container "%KAFKA_CONTAINER%"
call :remove_container "%POSTGRES_CONTAINER%"

echo.
echo Done. Docker containers created by start_all.bat have been stopped and removed.
pause
exit /b 0


:compose_down
set "COMPOSE_DIR=%~1"
set "SERVICE_NAME=%~2"

if not exist "%COMPOSE_DIR%\docker-compose.yml" (
    echo Skipping %SERVICE_NAME% - docker-compose.yml was not found.
    exit /b 0
)

echo Stopping and removing %SERVICE_NAME% containers...
pushd "%COMPOSE_DIR%" || (
    echo WARNING: Could not open %COMPOSE_DIR%.
    exit /b 0
)

%COMPOSE_CMD% down --remove-orphans
if errorlevel 1 (
    echo WARNING: %SERVICE_NAME% docker compose down failed.
)

popd
exit /b 0


:remove_container
set "CONTAINER_NAME=%~1"

docker container inspect "%CONTAINER_NAME%" >nul 2>&1
if errorlevel 1 (
    echo   %CONTAINER_NAME% is already removed.
    exit /b 0
)

docker rm -f "%CONTAINER_NAME%" >nul 2>&1
if errorlevel 1 (
    echo   WARNING: Could not remove %CONTAINER_NAME%.
    exit /b 0
)

echo   Removed %CONTAINER_NAME%.
exit /b 0
