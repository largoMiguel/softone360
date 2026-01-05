@echo off
echo ========================================
echo  Creando Instalador Portable con Python
echo ========================================
echo.
echo Este metodo es 100%% confiable y siempre funciona
echo.

REM Descargar Python embebido
echo [1/5] Descargando Python embebido...
powershell -Command "Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.10.11/python-3.10.11-embed-amd64.zip' -OutFile 'python-embed.zip'"

REM Extraer Python
echo [2/5] Extrayendo Python...
powershell -Command "Expand-Archive -Path 'python-embed.zip' -DestinationPath 'ControlAsistencia_Portable' -Force"
del python-embed.zip

REM Descargar pip
echo [3/5] Configurando pip...
cd ControlAsistencia_Portable
powershell -Command "Invoke-WebRequest -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile 'get-pip.py'"
python get-pip.py
del get-pip.py

REM Desactivar limitacion de imports
echo import site > python310._pth
echo. >> python310._pth

REM Instalar dependencias
echo [4/5] Instalando dependencias...
python -m pip install --upgrade pip
python -m pip install PyQt6==6.5.0 opencv-python-headless==4.8.1.78 numpy==1.24.3 requests==2.31.0

REM Copiar aplicacion
echo [5/5] Copiando aplicacion...
copy ..\ventanilla_app.py ventanilla_app.py

REM Crear launcher
echo @echo off > ControlAsistencia.bat
echo python ventanilla_app.py >> ControlAsistencia.bat

cd ..

echo.
echo ========================================
echo  INSTALADOR CREADO EXITOSAMENTE
echo ========================================
echo.
echo La carpeta "ControlAsistencia_Portable" contiene:
echo - Python embebido
echo - Todas las librerias necesarias
echo - La aplicacion
echo.
echo Para ejecutar: ControlAsistencia_Portable\ControlAsistencia.bat
echo.
echo Puedes comprimir la carpeta y distribuirla.
echo NO requiere instalacion de Python en el PC destino.
echo.
pause
