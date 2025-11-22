# Unificación de Modales PDM - Actividad con Evidencia

## 📋 Descripción del Cambio

Se ha unificado el flujo de creación de actividades y registro de evidencias en el componente PDM. Anteriormente existían dos modales separados:
1. **Modal "Nueva Actividad"**: Para crear actividades
2. **Modal "Registrar Evidencia"**: Para agregar evidencia después

Ahora existe un **único modal unificado** que permite:
- Crear actividades con todos sus campos
- Opcionalmente agregar evidencia en el mismo momento (descripción, URL, imágenes)
- Editar actividades y agregar evidencia posteriormente

## 🎯 Beneficios

- ✅ **Mejor UX**: Un solo formulario para crear actividad y evidencia
- ✅ **Flexibilidad**: La evidencia es opcional al crear, se puede agregar después
- ✅ **Eficiencia**: Menos clicks para el usuario
- ✅ **Diseño preservado**: Se mantiene el aspecto visual con cards organizadas
- ✅ **Lógica de estados**: Cuando se registra evidencia, la actividad pasa a estado COMPLETADA automáticamente

## 🔧 Cambios Técnicos

### Frontend (`frontend/src/app/components/pdm/`)

#### `pdm.html`
- **Unificado**: Modal de actividad ahora incluye sección de evidencia opcional
- **Eliminado**: Modal separado de evidencia (`mostrarModalEvidencia`)
- **Diseño**: Dos cards en el modal:
  1. Card azul: Información de la Actividad (obligatorio)
  2. Card verde: Evidencia de Cumplimiento (opcional)

#### `pdm.ts`
- **FormGroup unificado**: `formularioActividad` ahora incluye:
  ```typescript
  {
    nombre, descripcion, responsable_secretaria_id, estado,
    fecha_inicio, fecha_fin, meta_ejecutar,
    evidencia_descripcion, evidencia_url, imagenes  // NUEVOS campos opcionales
  }
  ```
- **Método actualizado**: `guardarActividad()` ahora:
  1. Guarda la actividad
  2. Si hay evidencia, la registra automáticamente
  3. El backend cambia el estado a COMPLETADA
- **Eliminados**: 
  - `formularioEvidencia`
  - `mostrarModalEvidencia`
  - `abrirModalEvidencia()`
  - `cerrarModalEvidencia()`
  - `guardarEvidencia()`
  - `validarEvidenciaRequerida()`
- **Nuevos**:
  - `registrarEvidenciaActividad()`: Método privado que registra evidencia
  - `eliminarImagen()`: Elimina una imagen de la lista antes de guardar

### Backend (Sin cambios mayores)

El backend ya soportaba correctamente el flujo:
- `POST /{slug}/actividades/{actividad_id}/evidencia`: Registra evidencia y cambia estado a COMPLETADA
- Modelos: `PdmActividad` y `PdmActividadEvidencia` con relación 1:1

## 📦 Migraciones de Base de Datos

### Archivos creados:
1. **`migrations/001_unificar_actividad_evidencia.sql`**: Para PostgreSQL (producción)
2. **`migrations/001_unificar_actividad_evidencia_sqlite.sql`**: Para SQLite (local)
3. **`apply_migrations.sh`**: Script para aplicar migraciones

### Tablas verificadas/creadas:
- `pdm_actividades`: Actividades con campos estándar + estado
- `pdm_actividades_evidencias`: Evidencias (relación 1:1 con actividades)

### Aplicar migraciones:

**Local (SQLite):**
```bash
cd backend
./apply_migrations.sh local
```

**Producción (PostgreSQL RDS):**
```bash
cd backend
./apply_migrations.sh production
```

## 🔄 Lógica de Estados de Actividad

| Estado | Descripción | Cuándo se aplica |
|--------|-------------|------------------|
| `PENDIENTE` | Actividad creada, sin iniciar | Al crear actividad sin evidencia |
| `EN_PROGRESO` | Actividad en ejecución | Seleccionado manualmente por usuario |
| `COMPLETADA` | Actividad finalizada con evidencia | **Automático** al registrar evidencia |
| `CANCELADA` | Actividad no se realizará | Seleccionado manualmente |

### Flujo de cambio de estado:
1. Usuario crea actividad → Estado: `PENDIENTE` (por defecto)
2. Usuario puede cambiar manualmente a `EN_PROGRESO`
3. Al agregar evidencia (al crear o editar) → Estado: `COMPLETADA` (automático en backend)
4. Usuario puede marcar como `CANCELADA`

## 🧪 Pruebas Realizadas

- [x] Crear actividad sin evidencia → Estado PENDIENTE
- [x] Crear actividad con evidencia → Estado COMPLETADA
- [x] Editar actividad y agregar evidencia después → Estado COMPLETADA
- [x] Cargar imágenes (máx 4, 2MB cada una) → Previsualización funcional
- [x] Eliminar imágenes antes de guardar → Funcional
- [x] Validaciones de formulario → Campos obligatorios marcados

## 📝 Notas Importantes

1. **Meta Completion**: Cuando una actividad se marca como COMPLETADA (con evidencia), su `meta_ejecutar` se cuenta en el cálculo de avance del producto.

2. **Responsables**: El campo `responsable_secretaria_id` permite asignar la secretaría responsable. Todos los usuarios de esa secretaría pueden ver y gestionar la actividad.

3. **Evidencia opcional**: No es obligatorio agregar evidencia al crear la actividad. Puede agregarse posteriormente editando la actividad.

4. **Imágenes**: Se almacenan en Base64 en el campo JSON `imagenes`. Máximo 4 imágenes de 2MB cada una.

## 🚀 Próximos Pasos

- [ ] Probar en producción después de desplegar
- [ ] Aplicar migración en RDS de producción
- [ ] Monitorear que el cálculo de avance funcione correctamente con evidencias

## 👤 Autor

Miguel Largo - 2025

## 📅 Fecha de Implementación

Enero 2025
