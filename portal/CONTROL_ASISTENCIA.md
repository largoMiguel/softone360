# Sistema de Control de Asistencia

Sistema completo para el control de asistencia de funcionarios con aplicación de escritorio Windows y portal web.

## 📋 Descripción

Este sistema permite:
- ✅ Registro de funcionarios por entidad
- ✅ Control de asistencia con entrada/salida
- ✅ Máximo 2 registros por día por funcionario
- ✅ Captura de foto en cada registro
- ✅ Validación de equipos mediante UUID
- ✅ Dashboard con estadísticas en tiempo real
- ✅ Gestión completa desde el portal web

## 🏗️ Arquitectura

### Backend (FastAPI)

**Modelos:**
- `Funcionario`: Información de funcionarios
- `EquipoRegistro`: Equipos autorizados para registrar
- `RegistroAsistencia`: Registros de entrada/salida

**Endpoints API:**
- `POST /api/asistencia/funcionarios` - Crear funcionario
- `GET /api/asistencia/funcionarios` - Listar funcionarios
- `PUT /api/asistencia/funcionarios/{id}` - Actualizar funcionario
- `POST /api/asistencia/equipos` - Registrar equipo
- `GET /api/asistencia/equipos` - Listar equipos
- `POST /api/asistencia/equipos/validar` - Validar equipo
- `POST /api/asistencia/registros` - Crear registro (desde app escritorio)
- `GET /api/asistencia/registros` - Listar registros con filtros
- `GET /api/asistencia/estadisticas` - Estadísticas de asistencia

### Frontend (Angular)

**Componentes:**
- `VentanillaComponent`: Layout principal
- `DashboardAsistenciaComponent`: Dashboard con estadísticas
- `FuncionariosComponent`: Gestión de funcionarios
- `RegistrosAsistenciaComponent`: Visualización de registros
- `EquiposRegistroComponent`: Gestión de equipos

**Servicios:**
- `AsistenciaService`: Comunicación con API

### App Escritorio (Python/PyQt6)

**Características:**
- Interfaz gráfica intuitiva
- Captura de cédula
- Captura de foto con cámara web
- Validación de UUID del equipo
- Registro automático en servidor
- Log de actividades

## 📦 Instalación

### 1. Backend

```bash
cd portal/backend

# Instalar dependencias
pip install -r requirements.txt

# Ejecutar migraciones (se crean automáticamente)
# Las tablas se crean al iniciar el servidor

# Iniciar servidor
uvicorn app.main:app --reload
```

### 2. Frontend

```bash
cd portal/frontend

# Instalar dependencias
npm install

# Iniciar en desarrollo
ng serve

# Build para producción
ng build --configuration production
```

### 3. App Escritorio

```bash
cd ventanilla

# Instalar dependencias
pip install -r requirements.txt

# Ejecutar en desarrollo
python ventanilla_app.py

# Compilar a .exe (Windows)
build.bat
```

## 🚀 Uso

### Configurar Equipos

1. Instalar la app de escritorio en el equipo
2. Ejecutar la aplicación para obtener el UUID
3. En el portal web, ir a: **Ventanilla > Equipos > Nuevo Equipo**
4. Registrar el UUID con un nombre descriptivo
5. Reiniciar la app de escritorio

### Registrar Funcionarios

1. En el portal web, ir a: **Ventanilla > Funcionarios > Nuevo Funcionario**
2. Ingresar datos del funcionario
3. El funcionario ya puede registrar asistencia

### Registrar Asistencia

1. En la app de escritorio:
   - Iniciar cámara (opcional)
   - Ingresar cédula del funcionario
   - Seleccionar tipo: Entrada o Salida
   - Capturar foto (opcional)
   - Click en "Registrar Asistencia"

### Ver Registros

1. En el portal web, ir a: **Ventanilla > Dashboard**
   - Ver estadísticas del día
   - Ver últimos registros

2. O ir a: **Ventanilla > Registros**
   - Filtrar por fecha
   - Filtrar por tipo
   - Ver historial completo

## 🔒 Seguridad

### Validación de Equipos
- Solo equipos registrados pueden hacer registros
- Cada equipo tiene un UUID único
- UUID se valida en cada registro

### Control de Registros
- Máximo 2 registros por día por funcionario
- Primer registro del día debe ser "entrada"
- Segundo registro debe ser "salida"
- Validación en servidor

### Almacenamiento
- Fotos se guardan en AWS S3
- URLs firmadas para acceso seguro
- Base de datos PostgreSQL para producción

## 📊 Base de Datos

### Tabla: funcionarios
```sql
CREATE TABLE funcionarios (
    id SERIAL PRIMARY KEY,
    cedula VARCHAR(20) UNIQUE NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    email VARCHAR(150),
    telefono VARCHAR(20),
    cargo VARCHAR(150),
    foto_url VARCHAR(500),
    entity_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);
```

### Tabla: equipos_registro
```sql
CREATE TABLE equipos_registro (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(100) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    ubicacion VARCHAR(200),
    entity_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);
```

### Tabla: registros_asistencia
```sql
CREATE TABLE registros_asistencia (
    id SERIAL PRIMARY KEY,
    funcionario_id INTEGER NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
    equipo_id INTEGER NOT NULL REFERENCES equipos_registro(id) ON DELETE CASCADE,
    tipo_registro VARCHAR(10) NOT NULL CHECK (tipo_registro IN ('entrada', 'salida')),
    fecha_hora TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    foto_url VARCHAR(500),
    observaciones VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_registros_funcionario ON registros_asistencia(funcionario_id);
CREATE INDEX idx_registros_fecha ON registros_asistencia(fecha_hora);
```

## 🎨 Personalización

### URL del API (App Escritorio)

Editar `ventanilla/ventanilla_app.py`:
```python
self.API_URL = "https://tu-dominio.com"
```

### Configuración de Entidad

El sistema está integrado con el modelo de entidades existente. Los funcionarios pertenecen a la misma entidad que el secretario que los registra.

## 📝 Notas Importantes

1. **Primera ejecución**: Las tablas se crean automáticamente al iniciar el backend
2. **UUID del equipo**: En Windows se obtiene del hardware, en otros OS se genera único
3. **Fotos**: Requiere configuración de AWS S3 (ver `backend/app/config/settings.py`)
4. **Permisos**: Solo SUPERADMIN, ADMIN y SECRETARIO pueden gestionar funcionarios y equipos

## 🐛 Troubleshooting

### "Equipo no autorizado"
- Verificar que el UUID esté registrado en el sistema
- Verificar que el equipo esté activo

### "Funcionario no encontrado"
- Verificar que el funcionario esté registrado
- Verificar que el funcionario esté activo
- Verificar que pertenezca a la entidad correcta

### "Error al subir foto"
- Verificar configuración de AWS S3
- Verificar credenciales en `settings.py`
- Verificar permisos del bucket

### "No se pudo acceder a la cámara"
- Verificar que la cámara esté conectada
- Cerrar otras aplicaciones que usen la cámara
- Verificar permisos de la cámara en Windows

## 📞 Soporte

Para soporte técnico o reportar problemas, contactar al administrador del sistema.

## 🔄 Actualizaciones Futuras

- [ ] Reportes en PDF de asistencia
- [ ] Exportación a Excel
- [ ] Notificaciones por email
- [ ] App móvil para registro
- [ ] Reconocimiento facial
- [ ] Integración con nómina
