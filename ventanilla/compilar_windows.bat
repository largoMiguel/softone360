@echo off
echo ============================================
echo Compilador UNICO - Control de Asistencia
echo Softone360 - Empaquetado Windows
echo ============================================
echo.
echo NOTA IMPORTANTE:
echo Este proceso se hace SOLO UNA VEZ en cualquier PC con Windows
echo El .exe resultante sera TOTALMENTE INDEPENDIENTE
echo NO requerira instalar Python, librerias ni nada
echo.
echo ============================================
pause

REM Verificar Python
python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERROR: Python no esta instalado en ESTA maquina
    echo.
    echo Para COMPILAR necesitas Python, pero el .exe final
    echo NO requerira Python en las otras maquinas.
    echo.
    echo Descarga Python desde: https://python.org
    echo Marca "Add Python to PATH" al instalarlo
    pause
    exit /b 1
)

echo.
echo [1/5] Instalando dependencias para compilacion...
pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo ERROR: No se pudieron instalar las dependencias
    pause
    exit /b 1
)

echo [2/5] Instalando PyInstaller...
pip install pyinstaller --quiet
if errorlevel 1 (
    echo ERROR: No se pudo instalar PyInstaller
    pause
    exit /b 1
)

echo [3/5] Limpiando compilaciones anteriores...
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist
if exist ControlAsistencia.spec del /q ControlAsistencia.spec

echo [4/5] Empaquetando TODO en un solo .exe...
echo (Esto puede tomar 1-2 minutos)
pyinstaller --name="ControlAsistencia" ^
            --windowed ^
            --onefile ^
            --clean ^
            --noupx ^
            ventanilla_app.py

if errorlevel 1 (
    echo ERROR: La compilacion fallo
    pause
    exit /b 1
)

echo [5/5] Verificando archivo final...
if exist dist\ControlAsistencia.exe (
    echo.
    echo ============================================
    echo   EMPAQUETADO EXITOSO!
    echo ============================================
    echo.
    echo Archivo: dist\ControlAsistencia.exe
    echo.
    echo ESTE .EXE ES COMPLETAMENTE INDEPENDIENTE:
    echo   - NO requiere Python instalado
    echo   - NO requiere instalar librerias
    echo   - NO requiere instalar nada
    echo   - Pesa aprox. 50-80 MB con TODO incluido
    echo.
    echo SOLO necesitas:
    echo   1. Copiar este .exe a cualquier Windows 10/11
    echo   2. Hacer doble clic para ejecutar
    echo   3. Tener camara web conectada
    echo.
    echo YA PUEDES DISTRIBUIR: dist\ControlAsistencia.exe
    echo.
    explorer dist
) else (
    echo ERROR: No se genero el .exe
)

pause
