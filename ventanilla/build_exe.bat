@echo off
echo ========================================
echo  Compilando Control de Asistencia a .EXE
echo ========================================
echo.

REM Verificar si PyInstaller está instalado
python -c "import PyInstaller" 2>nul
if errorlevel 1 (
    echo [ERROR] PyInstaller no está instalado.
    echo Instalando PyInstaller...
    pip install pyinstaller
    if errorlevel 1 (
        echo [ERROR] No se pudo instalar PyInstaller
        pause
        exit /b 1
    )
)

echo [1/3] Limpiando compilaciones anteriores...
if exist "dist" rmdir /s /q dist
if exist "build" rmdir /s /q build
if exist "*.spec" del /q *.spec

echo [2/3] Compilando aplicación con PyInstaller...
pyinstaller --name="ControlAsistencia" ^
            --windowed ^
            --onefile ^
            --icon=NONE ^
            --clean ^
            --noconfirm ^
            ventanilla_app.py

if errorlevel 1 (
    echo [ERROR] La compilación falló
    pause
    exit /b 1
)

echo [3/3] Limpiando archivos temporales...
rmdir /s /q build
del /q *.spec

echo.
echo ========================================
echo  COMPILACION EXITOSA
echo ========================================
echo.
echo El ejecutable está en: dist\ControlAsistencia.exe
echo.
echo Puedes distribuir ese archivo a cualquier PC con Windows
echo sin necesidad de instalar Python.
echo.
pause
