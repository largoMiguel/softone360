@echo off
REM Instalador de Control de Asistencia
REM Verifica si Python 3.10+ está instalado

echo ========================================
echo  Control de Asistencia - Instalador
echo ========================================
echo.

REM Verificar Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python no está instalado.
    echo.
    echo Descarga Python desde: https://www.python.org/downloads/
    echo Asegúrate de marcar "Add Python to PATH" durante la instalación
    echo.
    pause
    exit /b 1
)

for /f "tokens=2" %%i in ('python --version') do set PYTHON_VERSION=%%i
echo Detectado: Python %PYTHON_VERSION%

REM Verificar si es Python 3.14+ (alpha/beta)
echo %PYTHON_VERSION% | findstr /R "3\.1[4-9]\." >nul
if not errorlevel 1 (
    echo.
    echo [ADVERTENCIA] Tienes Python %PYTHON_VERSION% que es muy nuevo.
    echo Las librerias no tienen wheels precompilados para esta version.
    echo.
    echo RECOMENDACION: Instala Python 3.10, 3.11, 3.12 o 3.13
    echo Descarga desde: https://www.python.org/downloads/
    echo.
    echo Presiona Ctrl+C para cancelar, o cualquier tecla para intentar continuar...
    pause >nul
)

echo.

REM Instalar dependencias con wheels precompilados
echo Instalando dependencias... esto toma 2-3 minutos...
echo.

python -m pip install --upgrade pip

echo Instalando todas las dependencias...
echo Esto puede tardar dependiendo de tu conexion...
echo.

REM Intentar instalar solo wheels precompilados primero
python -m pip install --only-binary :all: PyQt6 numpy opencv-python-headless requests 2>nul

REM Si fallo, intentar con versiones especificas que tienen wheels
if errorlevel 1 (
    echo.
    echo Instalando versiones especificas con wheels precompilados...
    python -m pip install PyQt6==6.6.1 numpy==1.26.4 opencv-python-headless==4.9.0.80 requests==2.31.0
)

if errorlevel 1 (
    echo [ERROR] No se pudieron instalar las dependencias
    pause
    exit /b 1
)

echo.
echo ========================================
echo  INSTALACION EXITOSA
echo ========================================
echo.
echo Para ejecutar la aplicacion:
echo   python ventanilla_app.py
echo.
echo O haz doble clic en: ejecutar_app.bat
echo.
pause
