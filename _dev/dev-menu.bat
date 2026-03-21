@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "ROOT_DIR=%%~fI"
set "CONFIG_FILE=%SCRIPT_DIR%dev-menu.config.bat"
set "DEFAULT_DEVICE=tv"

set "DEVICE=%DEFAULT_DEVICE%"
if exist "%CONFIG_FILE%" call "%CONFIG_FILE%"
if not defined DEVICE set "DEVICE=%DEFAULT_DEVICE%"
if not exist "%CONFIG_FILE%" call :save_config >nul

:menu
cls
title Bilibili webOS Dev Menu
echo ==========================================
echo        Bilibili webOS Dev Menu
echo ==========================================
echo Root   : %ROOT_DIR%
echo Device : %DEVICE%
echo Config : %CONFIG_FILE%
echo.
echo [1] Start PC Preview
echo [2] Lint
echo [3] Type Check
echo [4] Build
echo [5] Build webOS
echo [6] Package webOS IPK
echo [7] Install to TV
echo [8] Launch on TV
echo [9] List Installed Apps on TV
echo [10] Remove App from TV
echo [11] Full TV Deploy + Verify
echo [12] webOS Doctor
echo [13] Set TV Device Name
echo [0] Exit
echo.
set /p "CHOICE=Select an option: "

if "%CHOICE%"=="1" goto start_preview
if "%CHOICE%"=="2" goto lint
if "%CHOICE%"=="3" goto typecheck
if "%CHOICE%"=="4" goto build
if "%CHOICE%"=="5" goto build_webos
if "%CHOICE%"=="6" goto package_webos
if "%CHOICE%"=="7" goto install_tv
if "%CHOICE%"=="8" goto launch_tv
if "%CHOICE%"=="9" goto list_tv
if "%CHOICE%"=="10" goto remove_tv
if "%CHOICE%"=="11" goto full_deploy_verify
if "%CHOICE%"=="12" goto doctor
if "%CHOICE%"=="13" goto set_device
if "%CHOICE%"=="0" goto end

echo.
echo Invalid option.
pause
goto menu

:run_in_root
pushd "%ROOT_DIR%"
call %*
set "EXIT_CODE=%ERRORLEVEL%"
popd
if not "%EXIT_CODE%"=="0" (
    echo.
    echo Command failed with exit code %EXIT_CODE%.
)
echo.
pause
goto menu

:start_preview
call :run_in_root npm run dev

:lint
call :run_in_root npm run lint

:typecheck
call :run_in_root npm run typecheck

:build
call :run_in_root npm run build

:build_webos
call :run_in_root npm run build:webos

:package_webos
call :run_in_root npm run webos:package

:install_tv
call :run_in_root npm run webos:install -- --device %DEVICE%

:launch_tv
call :run_in_root npm run webos:launch -- --device %DEVICE%

:list_tv
call :run_in_root npm run webos:list -- --device %DEVICE%

:remove_tv
call :run_in_root npm run webos:remove -- --device %DEVICE%

:full_deploy_verify
pushd "%ROOT_DIR%"
call npm run webos:package
if errorlevel 1 goto combo_failed
call npm run webos:install -- --device %DEVICE%
if errorlevel 1 goto combo_failed
call npm run webos:launch -- --device %DEVICE%
if errorlevel 1 goto combo_failed
call npm run webos:list -- --device %DEVICE%
set "EXIT_CODE=%ERRORLEVEL%"
popd
if not "%EXIT_CODE%"=="0" (
    echo.
    echo Command failed with exit code %EXIT_CODE%.
)
echo.
pause
goto menu

:combo_failed
set "EXIT_CODE=%ERRORLEVEL%"
popd
echo.
echo Command failed with exit code %EXIT_CODE%.
echo.
pause
goto menu

:doctor
call :run_in_root npm run webos:doctor

:set_device
echo.
set /p "NEW_DEVICE=Enter TV device name: "
if "%NEW_DEVICE%"=="" (
    echo Device name was not changed.
) else (
    set "DEVICE=%NEW_DEVICE%"
    call :save_config
    echo Device name updated to !DEVICE!.
    echo Config saved.
)
echo.
pause
goto menu

:save_config
(
    echo @echo off
    echo set "DEVICE=!DEVICE!"
) > "%CONFIG_FILE%"
exit /b 0

:end
endlocal
