@echo off
chcp 65001 >nul
title Push to Ev01

cd /d "%~dp0"

echo.
echo ===== Push 到 Ev01 =====
echo.

set /p "msg=請輸入改動說明: "
if "%msg%"=="" (
    echo 未輸入說明，已取消。
    pause
    exit /b 1
)

echo.
echo 改動說明: %msg%
echo.
echo 即將執行:
echo   git add .
echo   git commit -m "%msg%"
echo   git push origin Ev01
echo.
set /p "ok=確認執行? (Y/N): "
if /i not "%ok%"=="Y" (
    echo 已取消。
    pause
    exit /b 0
)

echo.
echo [1/3] git add .
git add .
if errorlevel 1 (
    echo 發生錯誤。
    pause
    exit /b 1
)

echo.
echo [2/3] git commit ...
git commit -m "%msg%"
if errorlevel 1 (
    echo 可能沒有變更或發生錯誤。要繼續 push 嗎?
    set /p "cont=輸入 Y 繼續 push，其他鍵取消: "
    if /i not "%cont%"=="Y" exit /b 1
)

echo.
echo [3/3] git push origin Ev01
git push origin Ev01
if errorlevel 1 (
    echo Push 失敗，請檢查網路或權限。
    pause
    exit /b 1
)

echo.
echo ===== 完成 =====
pause
