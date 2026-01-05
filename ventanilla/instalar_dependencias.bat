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

python --version
echo.

REM Verificar version de Python y ajustar dependencias
echo Instalando dependencias... esto toma 2-3 minutos...
echo.

python -m pip install --upgrade pip

REM Usar versiones compatibles con Python 3.10+
echo Instalando PyQt6...
python -m pip install PyQt6==6.7.0

echo Instalando numpy...
python -m pip install numpy>=1.26.0

echo Instalando OpenCV...
python -m pip install opencv-python-headless>=4.8.0

echo Instalando requests...
python -m pip install requests>=2.31.0

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
