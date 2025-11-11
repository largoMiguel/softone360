# ESTRATEGIA DE DESPLIEGUE SEGURO

## 📋 SITUACIÓN ACTUAL

**Cambios aplicados:**
1. ✅ Modelos PQRS: CASCADE en FKs de usuario
2. ✅ Modelos PDM: Timezone corregido
3. ❌ Eliminación de campos legacy USER → **ROMPE CÓDIGO EXISTENTE**
4. ❌ Eliminación de campos legacy PDM → **ROMPE CÓDIGO EXISTENTE**
5. ❌ Eliminación de tablas PDM → **ROMPE RUTAS**

## 🎯 DECISIÓN: DEPLOY INCREMENTAL

### **FASE 1: Correcciones CASCADE (SEGURAS - DEPLOY AHORA)**
- ✅ PQRS: `created_by_id` y `assigned_to_id` con `ondelete="SET NULL"`
- ✅ PQRS: Índices en `tipo_solicitud` y `estado`
- ✅ PDM: Todos los DateTime con `timezone=True` y `server_default=func.now()`

### **FASE 2: Limpieza de código (REQUIERE MÁS TRABAJO)**
- ⏸️ Eliminar campos legacy de User (después de corregir 13 referencias en rutas)
- ⏸️ Eliminar campos legacy de PDM (después de corregir rutas)
- ⏸️ Eliminar tablas PDM no usadas (después de refactorizar rutas)

## 🔄 ROLLBACK PARCIAL REQUERIDO

Para deployment seguro, REVERTIR los siguientes cambios:

### 1. Restaurar campos legacy en User
```python
# backend/app/models/user.py - Agregar después de allowed_modules:
secretaria = Column(String, nullable=True)  # Legacy - mantener por compatibilidad
cedula = Column(String, nullable=True)  # Para ciudadanos
telefono = Column(String, nullable=True)  # Para ciudadanos
direccion = Column(String, nullable=True)  # Para ciudadanos
```

### 2. Restaurar campos legacy en PDM
```python
# backend/app/models/pdm.py - PdmProducto:
responsable = Column(String(256), nullable=True)  # Legacy

# backend/app/models/pdm.py - PdmActividad:
responsable = Column(String(256), nullable=True)  # Legacy
```

### 3. Restaurar tablas PDM (antes de PdmProducto)
```python
# backend/app/models/pdm.py - Restaurar 3 clases completas
class PdmLineaEstrategica(Base):
    ...
class PdmIndicadorResultado(Base):
    ...
class PdmIniciativaSGR(Base):
    ...
```

### 4. Restaurar schemas PDM
```python
# backend/app/schemas/pdm_v2.py - Restaurar schemas eliminados
```

### 5. Restaurar imports en rutas
```python
# backend/app/routes/pdm_v2.py
from app.models.pdm import (
    PdmLineaEstrategica,
    PdmIndicadorResultado,
    PdmIniciativaSGR,
    PdmProducto,
    ...
)
```

## ✅ CAMBIOS QUE SÍ SE DESPLIEGAN (SEGUROS)

1. **PQRS CASCADE**: No rompe nada, mejora integridad
2. **PDM Timezone**: No rompe nada, mejora consistencia
3. **Índices PQRS**: Mejora performance

## 📝 RESUMEN

**Deploy actual:**
- Correcciones CASCADE y timezone ✅
- Rollback de eliminaciones de campos/tablas ⏪

**Deploy futuro (Fase 2):**
- Refactorizar rutas que usan campos legacy
- Eliminar tablas PDM no usadas
- Limpiar campos obsoletos

¿Proceder con rollback y deploy de Fase 1?
