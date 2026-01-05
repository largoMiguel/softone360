# Instrucciones para Crear el Ejecutable .EXE

## Opción 1: Usar el Script Automático (Recomendado)

En una PC con **Windows**:

1. Asegúrate de tener Python 3.10 o superior instalado
2. Abre el símbolo del sistema (CMD) en la carpeta `ventanilla`
3. Instala las dependencias:
   ```cmd
   pip install -r requirements.txt
   ```
4. Ejecuta el script de compilación:
   ```cmd
   build_exe.bat
   ```
5. El ejecutable estará en la carpeta `dist\ControlAsistencia.exe`

## Opción 2: Comando Manual

```cmd
pyinstaller --name="ControlAsistencia" --windowed --onefile --clean --noconfirm ventanilla_app.py
```

## Opción 3: Compilar desde macOS para Windows (Avanzado)

No es posible crear directamente un .exe desde macOS. Necesitas:

### A. Usar una máquina virtual con Windows
1. Instala VirtualBox o VMware
2. Crea una VM con Windows 10/11
3. Copia los archivos a la VM
4. Sigue la Opción 1 dentro de la VM

### B. Usar Wine (No recomendado, puede tener problemas)
```bash
# Instalar Wine
brew install wine-stable

# Instalar Python en Wine
wine python-installer.exe

# Compilar (puede no funcionar correctamente)
wine pyinstaller ventanilla_app.py
```

### C. Usar GitHub Actions (Recomendado para macOS)
1. Crear un repositorio en GitHub
2. Subir el código
3. Crear un workflow que compile en Windows
4. Descargar el .exe generado

## Opción 4: Usar un Servicio en la Nube

### AWS EC2 con Windows
1. Crear una instancia EC2 con Windows
2. Conectar via RDP
3. Instalar Python
4. Compilar con el script

### Microsoft Azure VM
Similar a AWS EC2

## Distribuir el Ejecutable

Una vez compilado el `ControlAsistencia.exe`:

1. **El archivo es portable**: No requiere instalación de Python
2. **Tamaño aproximado**: 80-120 MB (incluye Python y todas las librerías)
3. **Requisitos del PC destino**:
   - Windows 10 o superior
   - Cámara web conectada
   - Conexión a internet
4. **Antivirus**: Puede marcar falsos positivos al ser un .exe sin firma digital

## Solución de Problemas

### Error: "PyInstaller no es reconocido"
```cmd
pip install pyinstaller
```

### Error: "No module named 'PyQt6'"
```cmd
pip install -r requirements.txt
```

### El .exe no inicia
- Ejecutar desde CMD para ver errores:
  ```cmd
  ControlAsistencia.exe
  ```

### Antivirus bloquea el .exe
- Agregar excepción en el antivirus
- O firmar digitalmente el ejecutable (requiere certificado)

## Crear con Interfaz Visual

Si prefieres una interfaz gráfica para compilar:

1. Instala **auto-py-to-exe**:
   ```cmd
   pip install auto-py-to-exe
   ```

2. Ejecuta:
   ```cmd
   auto-py-to-exe
   ```

3. Configura:
   - Script: `ventanilla_app.py`
   - One File: ✅
   - Window Based: ✅ (No console)
   - Click "CONVERT .PY TO .EXE"

## Notas Importantes

- ⚠️ La compilación **DEBE hacerse en Windows** para generar un .exe funcional
- ⚠️ El ejecutable solo funciona en Windows (no en Linux ni macOS)
- ⚠️ Cada vez que actualices el código, debes recompilar
- ✅ El .exe incluye todo: Python, PyQt6, OpenCV, etc.
