# Sistema de Control de Asistencia - Ventanilla

Aplicación de escritorio para Windows que permite el registro de asistencia de funcionarios mediante captura de cédula y foto.

## Características

- ✅ Captura de cédula del funcionario
- ✅ Captura de foto con cámara web
- ✅ Validación de equipo mediante UUID
- ✅ Registro de entrada y salida
- ✅ Máximo 2 registros por día por funcionario
- ✅ Interfaz gráfica intuitiva
- ✅ Log de actividades en tiempo real

## Requisitos

- Windows 10 o superior
- Python 3.10 o superior (para desarrollo)
- Cámara web conectada
- Conexión a internet

## Instalación para Desarrollo

1. Instalar Python 3.10 o superior desde [python.org](https://www.python.org/)

2. Instalar dependencias:
```bash
pip install -r requirements.txt
```

3. Ejecutar la aplicación:
```bash
python ventanilla_app.py
```

## Compilar a .EXE (Windows)

Para crear un ejecutable independiente para Windows:

1. Instalar PyInstaller (ya incluido en requirements.txt):
```bash
pip install pyinstaller
```

2. Compilar a .exe:
```bash
pyinstaller --name="ControlAsistencia" ^
            --windowed ^
            --onefile ^
            --add-data "machine_uuid.txt;." ^
            --icon=icon.ico ^
            ventanilla_app.py
```

**Opciones:**
- `--windowed`: No muestra consola
- `--onefile`: Crea un solo ejecutable
- `--add-data`: Incluye archivos adicionales
- `--icon`: Especifica el ícono (opcional)

3. El ejecutable estará en la carpeta `dist/ControlAsistencia.exe`

## Configuración

### URL del API

Editar en el archivo `ventanilla_app.py`:

```python
# Producción
self.API_URL = "https://api.softone360.com"

# Desarrollo local
# self.API_URL = "http://localhost:8000"
```

### UUID del Equipo

El UUID se genera automáticamente la primera vez que se ejecuta la aplicación:
- En Windows: usa `wmic csproduct get uuid`
- Se guarda en `machine_uuid.txt` para futuros usos

## Registro de Equipos

Para que un equipo pueda registrar asistencia, debe ser autorizado previamente:

1. Ejecutar la aplicación por primera vez
2. Copiar el UUID que aparece en la pantalla
3. Registrar el equipo en el portal web (módulo de Asistencia)
4. Reiniciar la aplicación

## Uso

1. **Iniciar Cámara**: Habilita la captura de foto
2. **Ingresar Cédula**: Número de cédula del funcionario
3. **Seleccionar Tipo**: Entrada o Salida
4. **Capturar Foto**: (Opcional) Captura la foto del funcionario
5. **Registrar**: Envía el registro al servidor

## Solución de Problemas

### "Equipo no autorizado"
- Verificar que el UUID esté registrado en el sistema
- Contactar al administrador

### "No se pudo acceder a la cámara"
- Verificar que la cámara esté conectada
- Verificar permisos de la cámara en Windows
- Cerrar otras aplicaciones que usen la cámara

### "Error de conexión"
- Verificar conexión a internet
- Verificar que la URL del API sea correcta
- Verificar que el servidor esté activo

## Distribución

Para distribuir la aplicación en múltiples equipos:

1. Compilar a .exe usando PyInstaller
2. Copiar `ControlAsistencia.exe` a cada equipo
3. Ejecutar por primera vez para generar UUID
4. Registrar cada equipo en el sistema
5. Reiniciar la aplicación

## Seguridad

- El UUID del equipo es único por máquina
- Solo equipos registrados pueden hacer registros
- Las fotos se almacenan en AWS S3
- La comunicación es mediante HTTPS

## Soporte

Para soporte técnico, contactar al administrador del sistema.
