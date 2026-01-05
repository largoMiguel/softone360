# Control de Asistencia - Instalación en Windows

## Opción 1: Con Python instalado (RECOMENDADO)

### Paso 1: Instalar Python
1. Descarga Python 3.10, 3.11, 3.12 o 3.13 desde https://www.python.org/downloads/
2. **IMPORTANTE**: Marca la opción "Add Python to PATH" durante la instalación
3. Reinicia tu PC

**Nota**: Si tienes Python 3.13, las dependencias se instalarán automáticamente en las versiones correctas.

### Paso 2: Instalar dependencias
1. Abre una carpeta con los archivos de la aplicación
2. Haz doble clic en: `instalar_dependencias.bat`
3. Espera a que termine (2-3 minutos)

### Paso 3: Ejecutar
Haz doble clic en: `ejecutar_app.bat`

---

## Opción 2: Sin instalar nada (Python Portable)

Si no quieres instalar Python en tu PC:

1. Descarga Python Portable desde: https://www.python.org/downloads/
2. Extrae en una carpeta
3. Copia los archivos de la app en la misma carpeta
4. Ejecuta: `python ventanilla_app.py`

---

## Opción 3: Usar WSL (Windows Subsystem for Linux)

En Windows 10/11:
1. Abre PowerShell como administrador
2. Ejecuta: `wsl --install`
3. Reinicia
4. Instala dependencias: `pip install -r requirements.txt`
5. Ejecuta: `python ventanilla_app.py`

---

## ¿Por qué no un .exe?

PyInstaller tiene incompatibilidades con PyQt6 en Windows que hacen que falle al cargar las DLLs de Qt.

La solución más confiable es ejecutar el código Python directamente, que es lo que funciona perfectamente.

---

## Requisitos Mínimos

- Windows 10 o superior
- Python 3.10, 3.11, 3.12 o 3.13
- Cámara web conectada
- Conexión a internet

---

## Solución de Problemas

### Error: "Python no está instalado"
Instala Python desde https://www.python.org/downloads/ y **marca "Add Python to PATH"**

### Error: "No module named 'PyQt6'"
Ejecuta: `pip install -r requirements.txt`

### La aplicación se abre pero está lenta
Esto es normal en la primera ejecución. En futuras ejecuciones será más rápida.

### La cámara no funciona
- Verifica que la cámara esté conectada
- Comprueba que no está siendo usada por otra aplicación
- Reinicia la aplicación

---

## Contacto

Si tienes problemas, contacta al equipo de soporte de Softone360.
