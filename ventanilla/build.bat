@echo off
echo ================================================
echo   Compilando Control de Asistencia para Windows
echo ================================================
echo.

echo Instalando dependencias...
pip install -r requirements.txt

echo.
echo Compilando aplicacion...
pyinstaller --name="ControlAsistencia" ^
            --windowed ^
            --onefile ^
            ventanilla_app.py

echo.
echo ================================================
echo   Compilacion completada!
echo   El ejecutable esta en: dist\ControlAsistencia.exe
echo ================================================
pause
