# Módulo de Correspondencia - Documentación

## Descripción
Sistema completo para la gestión de correspondencia oficial de la entidad. Permite registrar, radicary dar seguimiento a las comunicaciones oficiales entrantes y salientes.

## Componentes Implementados

### Backend

#### 1. Modelo de Datos (`app/models/correspondencia.py`)
- **Tabla**: `correspondencia`
- **Campos principales**:
  - `numero_radicado`: Generado automáticamente (CORR-YYYYMMDDNNN)
  - `fecha_envio`: Fecha de envío de la correspondencia
  - `procedencia`: Origen de la correspondencia (predeterminado: PERSONERIA MUNICIPAL)
  - `destinacion`: Destino de la correspondencia
  - `numero_folios`: Cantidad de folios
  - `tipo_radicacion`: Físico o Correo Electrónico
  - `tipo_solicitud`: Sugerencia, Petición, Queja, Reclamo, etc.
  - `estado`: Enviada, En Proceso, Resuelta, Cerrada
  - `tiempo_respuesta_dias`: 5, 10 o 15 días

#### 2. Esquemas de Validación (`app/schemas/correspondencia.py`)
- `CorrespondenciaCreate`: Validación para crear correspondencia
- `CorrespondenciaUpdate`: Validación para actualizar correspondencia
- `CorrespondenciaResponse`: Esquema de respuesta
- `CorrespondenciaWithDetails`: Incluye nombres de usuarios asignados

#### 3. Rutas API (`app/routes/correspondencia.py`)
- `POST /api/correspondencia/`: Crear nueva correspondencia
- `GET /api/correspondencia/`: Obtener lista de correspondencias (con filtros)
- `GET /api/correspondencia/{id}`: Obtener correspondencia por ID
- `PUT /api/correspondencia/{id}`: Actualizar correspondencia
- `DELETE /api/correspondencia/{id}`: Eliminar correspondencia (solo admin)
- `GET /api/correspondencia/next-radicado/preview`: Vista previa del siguiente radicado

### Frontend

#### 1. Modelos TypeScript (`src/app/models/correspondencia.model.ts`)
- Interfaces TypeScript que reflejan los modelos del backend
- Tipos para radicación, estados y tipos de solicitud
- Constantes con labels y colores para la UI

#### 2. Servicio (`src/app/services/correspondencia.service.ts`)
- Métodos para consumir la API de correspondencia
- Manejo de parámetros de filtrado
- Obtención del siguiente número de radicado

#### 3. Componente Dashboard (actualizado)
- Vista de listado de correspondencias
- Formulario para crear nueva correspondencia
- Vista de detalles de correspondencia
- Acciones para cambiar estado y eliminar

## Funcionalidades

### Características Principales
1. **Radicación Automática**: Número de radicado único generado automáticamente con formato CORR-YYYYMMDDNNN
2. **Validación según Tipo de Radicación**:
   - Si es por correo: requiere email válido
   - Si es físico: requiere dirección completa
3. **Gestión de Estados**: Enviada → En Proceso → Resuelta → Cerrada
4. **Asignación de Responsables**: Los administradores pueden asignar correspondencias a secretarios
5. **Tiempos de Respuesta**: Configurables en 5, 10 o 15 días
6. **Filtrado**: Por estado y tipo de solicitud
7. **Permisos por Rol**:
   - ADMIN: Puede ver, crear, editar, eliminar y asignar
   - SECRETARIO: Solo ve las correspondencias asignadas a él
   - CIUDADANO: No tiene acceso al módulo

### Tipos de Solicitud
- Sugerencia
- Petición
- Queja
- Reclamo
- Felicitación
- Solicitud de Información
- Otro

### Estados de Correspondencia
- **Enviada** (inicial): Correspondencia registrada pero sin procesar
- **En Proceso**: Se está gestionando activamente
- **Resuelta**: Se ha dado respuesta o solución
- **Cerrada**: Finalizada completamente

## Instalación y Migración

### 1. Ejecutar Migración de Base de Datos (Producción)

```bash
# Desde la raíz del proyecto
python portal/backend/migration_add_correspondencia.py
```

### 2. Verificar Tablas y ENUMs

La migración crea:
- ENUMs: `tiporadicacion`, `tiposolicitudcorrespondencia`, `estadocorrespondencia`
- Tabla: `correspondencia` con todos los campos e índices
- Índices en: numero_radicado, entity_id, estado, tipo_solicitud, assigned_to_id

### 3. Reiniciar Backend

```bash
# En producción con Elastic Beanstalk
eb deploy
```

### 4. Acceder al Módulo

1. Iniciar sesión en el sistema
2. Ir al Dashboard
3. Seleccionar "Correspondencia" en el menú lateral
4. Crear la primera correspondencia haciendo clic en "Nueva Correspondencia"

## Estructura de Archivos

```
portal/
├── backend/
│   ├── app/
│   │   ├── models/
│   │   │   └── correspondencia.py          # Modelo SQLAlchemy
│   │   ├── schemas/
│   │   │   └── correspondencia.py          # Esquemas Pydantic
│   │   ├── routes/
│   │   │   └── correspondencia.py          # Endpoints FastAPI
│   │   └── main.py                         # Registro de rutas (actualizado)
│   └── migration_add_correspondencia.py    # Script de migración
└── frontend/
    └── src/
        └── app/
            ├── models/
            │   └── correspondencia.model.ts    # Interfaces TypeScript
            ├── services/
            │   └── correspondencia.service.ts  # Servicio Angular
            └── components/
                └── dashboard/
                    ├── dashboard.ts            # Lógica (actualizado)
                    └── dashboard.html          # Vista (actualizado)
```

## Próximas Mejoras

1. **Adjuntar Archivos**: Implementar carga de archivos adjuntos (solicitud y respuesta) con S3
2. **Notificaciones**: Enviar notificaciones por email cuando cambie el estado
3. **Reportes**: Generar reportes en PDF/Excel de correspondencias
4. **Dashboard Estadístico**: Gráficos de correspondencias por estado, tipo, responsable
5. **Búsqueda Avanzada**: Filtros por fecha, radicado, procedencia, etc.
6. **Historial de Cambios**: Auditoría de cambios de estado y asignaciones
7. **Recordatorios**: Alertas automáticas para correspondencias próximas a vencer
8. **Portal Ciudadano**: Permitir a ciudadanos consultar el estado de sus correspondencias

## Notas Técnicas

- **Generación de Radicados**: Usa el helper `generate_radicado()` con prefijo "CORR"
- **Zona Horaria**: Las fechas se manejan en UTC y se convierten a hora de Colombia (UTC-5)
- **Validación**: Los formularios tienen validación tanto en frontend como en backend
- **Seguridad**: Los endpoints están protegidos con autenticación JWT
- **Performance**: Se usan índices en los campos más consultados

## Soporte

Para reportar problemas o sugerencias, contactar al equipo de desarrollo.

---

**Fecha de implementación**: Marzo 2026  
**Versión**: 1.0.0
