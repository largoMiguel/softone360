# AUDITORÍA COMPLETA DE MODELOS - CASCADE Y CAMPOS NO UTILIZADOS

## 📊 RESUMEN EJECUTIVO

**Estado de la base de datos:** ✅ Esquema eliminado, listo para recreación
**Modelos auditados:** 7 archivos
**Problemas detectados:** 8 categorías

---

## ✅ MODELOS CON CASCADE CORRECTO

### 1. **Entity** (`entity.py`)
- ✅ Relación `users`: cascade="all, delete-orphan"
- ✅ Relación `secretarias`: cascade="all, delete-orphan"
- ✅ No tiene FKs (es tabla raíz)

### 2. **User** (`user.py`)
- ✅ `entity_id`: ondelete="CASCADE"

### 3. **Alert** (`alert.py`)
- ✅ `entity_id`: ondelete="CASCADE"
- ✅ `recipient_user_id`: ondelete="CASCADE"

### 4. **Secretaria** (`secretaria.py`)
- ✅ `entity_id`: ondelete="CASCADE"

### 5. **PQRS** (`pqrs.py`)
- ✅ `entity_id`: ondelete="CASCADE"
- ⚠️ `created_by_id`: **NO tiene CASCADE** (debe ser SET NULL)
- ⚠️ `assigned_to_id`: **NO tiene CASCADE** (debe ser SET NULL)

### 6. **Plan Institucional** (`plan.py`)
- ✅ `PlanInstitucional.entity_id`: ondelete="CASCADE"
- ✅ `ComponenteProceso.plan_id`: ondelete="CASCADE"
- ✅ `Actividad.componente_id`: ondelete="CASCADE"
- ✅ `ActividadEjecucion.actividad_id`: ondelete="CASCADE"
- ✅ `ActividadEvidencia.actividad_ejecucion_id`: ondelete="CASCADE"

### 7. **PDM** (`pdm.py`)
- ✅ Todos los modelos tienen `entity_id` con CASCADE:
  - `PdmLineaEstrategica`
  - `PdmIndicadorResultado`
  - `PdmIniciativaSGR`
  - `PdmProducto`
  - `PdmActividad`
  - `PdmActividadEvidencia`
  - `PdmArchivoExcel`
- ✅ `PdmActividadEvidencia.actividad_id`: ondelete="CASCADE"
- ✅ `PdmProducto.responsable_user_id`: ondelete="SET NULL" ✓
- ✅ `PdmActividad.responsable_user_id`: ondelete="SET NULL" ✓

---

## 🚨 PROBLEMAS DETECTADOS

### **Problema 1: PQRS - FKs de usuario sin CASCADE**
```python
# ❌ ACTUAL (pqrs.py líneas 125-126)
created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
```

**✅ CORRECCIÓN REQUERIDA:**
```python
created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
assigned_to_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
```

**Impacto:** Si se elimina un usuario que creó o tiene asignada una PQRS, daría error de integridad.  
**Solución:** Usar SET NULL para mantener el registro histórico.

---

### **Problema 2: Campos LEGACY no utilizados**

#### **user.py** - Campos duplicados/obsoletos:
```python
# ❌ CAMPOS NO USADOS (líneas 34-37)
secretaria = Column(String, nullable=True)        # LEGACY - usar secretaria_id
cedula = Column(String, nullable=True)            # Solo para CIUDADANO
telefono = Column(String, nullable=True)          # Solo para CIUDADANO  
direccion = Column(String, nullable=True)         # Solo para CIUDADANO
```

**Razones para eliminar:**
1. `secretaria` (String): Redundante - existe `secretaria_id` (FK a tabla secretarias)
2. `cedula`, `telefono`, `direccion`: Solo relevantes para ciudadanos (que no están en la tabla users), ocupan espacio innecesario

**✅ CORRECCIÓN:** Eliminar estos 4 campos

#### **pdm.py** - Campos de texto legacy:
```python
# ❌ CAMPOS LEGACY (PdmProducto línea 100, PdmActividad línea 149)
responsable = Column(String(256), nullable=True)  # LEGACY - usar responsable_user_id
```

**Razón:** Ya existe `responsable_user_id` con FK a users. El campo de texto es redundante.  
**✅ CORRECCIÓN:** Eliminar `responsable` de `PdmProducto` y `PdmActividad`

---

### **Problema 3: Tablas PDM posiblemente redundantes**

Tres tablas de PDM que solo almacenan datos importados del Excel pero **nunca se consultan en el sistema:**

1. **`PdmLineaEstrategica`** - 5 campos (solo metadatos del plan)
2. **`PdmIndicadorResultado`** - 9 campos (indicadores, no se usan)
3. **`PdmIniciativaSGR`** - 10 campos (iniciativas SGR, no se usan)

**Uso real:** Solo se usan `PdmProducto`, `PdmActividad`, `PdmActividadEvidencia`, `PdmArchivoExcel`

**✅ RECOMENDACIÓN:** 
- **Opción A (agresiva):** Eliminar las 3 tablas - Ahorro: ~24 campos innecesarios
- **Opción B (conservadora):** Mantenerlas por si se necesitan reportes históricos

---

### **Problema 4: Campos con valores por defecto inconsistentes**

#### **plan.py** - Valores JSON mal inicializados:
```python
# ❌ ACTUAL (Actividad línea 165)
recursos_externos = Column(JSON, nullable=True, default={})
```

**Problema:** `default={}` en Python crea un objeto mutable compartido.  
**✅ CORRECCIÓN:**
```python
recursos_externos = Column(JSON, nullable=True, default=lambda: {})
```

**Aplica también a:**
- `ActividadEjecucion.evidencias` (línea 196)
- `PdmProducto.presupuesto_*` (líneas 118-121)

---

### **Problema 5: Enums innecesarios en TypeDecorator**

#### **pqrs.py** - Complejidad innecesaria:
```python
# ❌ ACTUAL: Custom TypeDecorator de 56 líneas (líneas 9-65)
class EnumType(TypeDecorator):
    """Almacena enums como texto con lógica compleja..."""
```

**Problema:** SQLAlchemy ya maneja Enums nativamente con `Enum(tipo_enum)`.  
**✅ CORRECCIÓN:** Usar `Enum` de SQLAlchemy directamente:
```python
from sqlalchemy import Enum as SQLEnum

tipo_identificacion = Column(
    SQLEnum(TipoIdentificacion, values_callable=lambda obj: [e.value for e in obj]),
    nullable=False,
    default=TipoIdentificacion.PERSONAL
)
```

**Beneficio:** Menos código, más mantenible

---

### **Problema 6: Índices faltantes en consultas frecuentes**

#### **pqrs.py** - Campos filtrados sin índice:
```python
# ❌ SIN ÍNDICE (líneas 99-104)
tipo_solicitud = Column(EnumType(TipoSolicitud), nullable=False)
estado = Column(EnumType(EstadoPQRS), nullable=False, default=EstadoPQRS.PENDIENTE)
```

**Consultas frecuentes:** Filtrar PQRS por estado y tipo.  
**✅ CORRECCIÓN:** Agregar `index=True`

#### **pdm.py** - Filtros por año sin índice:
```python
# ❌ SIN ÍNDICE (PdmActividad línea 145)
anio = Column(Integer, nullable=False, index=True)  # ✓ Ya tiene
```
**Estado:** ✅ Ya corregido

---

### **Problema 7: Campos de fecha sin zona horaria**

#### **pdm.py** - DateTime sin timezone:
```python
# ❌ ACTUAL (líneas 20, 39, 61, etc.)
created_at = Column(DateTime, default=datetime.utcnow)
```

**Problema:** Puede causar problemas con DST y zonas horarias.  
**✅ CORRECCIÓN:**
```python
from sqlalchemy.sql import func
created_at = Column(DateTime(timezone=True), server_default=func.now())
```

**Aplica a:** TODOS los modelos PDM (8 tablas)

---

### **Problema 8: Validaciones de negocio faltantes**

#### **user.py** - Email sin validación:
```python
# ❌ ACTUAL (línea 30)
email = Column(String, unique=True, index=True, nullable=False)
```

**Mejora:** Agregar validación de formato en el modelo  
**✅ SUGERENCIA:** Validar en Pydantic schemas (ya existe)

#### **pqrs.py** - Transiciones de estado no validadas:
```python
# ❌ ACTUAL: Estado puede cambiar de CERRADO a PENDIENTE
estado = Column(EnumType(EstadoPQRS), nullable=False, default=EstadoPQRS.PENDIENTE)
```

**Mejora:** Implementar máquina de estados con transiciones válidas  
**✅ SUGERENCIA:** Agregar lógica en servicios/rutas

---

## 📋 PLAN DE CORRECCIÓN

### **FASE 1: Correcciones Críticas (Bloqueantes)**
1. ✅ Agregar CASCADE a PQRS FKs de usuario
2. ✅ Eliminar campos legacy de User
3. ✅ Eliminar campos legacy de PDM
4. ✅ Corregir timezone en PDM models

### **FASE 2: Optimizaciones (Recomendadas)**
5. ⚠️ Agregar índices a PQRS (tipo_solicitud, estado)
6. ⚠️ Corregir defaults de JSON (usar lambda)
7. ⚠️ Simplificar EnumType en PQRS

### **FASE 3: Limpieza Estructural (Opcional)**
8. 🔵 Evaluar eliminación de tablas PDM no usadas
9. 🔵 Implementar validaciones de estado en servicios

---

## 🎯 DECISIÓN REQUERIDA

**¿Eliminar las 3 tablas PDM no utilizadas?**
- `PdmLineaEstrategica`
- `PdmIndicadorResultado`
- `PdmIniciativaSGR`

**Pros de eliminar:**
- Base de datos más limpia
- Menos espacio
- Menos confusión

**Contras:**
- Se pierde data histórica del Excel original
- Si luego se necesitan reportes, habría que reimportarlas

---

## 📊 RESUMEN DE CAMBIOS

| Archivo | Cambios | Impacto |
|---------|---------|---------|
| `pqrs.py` | +2 ondelete, +2 índices | Alto - Previene errores |
| `user.py` | -4 campos legacy | Medio - Limpieza |
| `pdm.py` | -2 campos, +timezone en 8 tablas | Alto - Consistencia |
| `plan.py` | Corregir 2 defaults JSON | Bajo - Prevención |
| *(opcional)* | Eliminar 3 tablas PDM | Alto - Decisión arquitectural |

**Total estimado:** ~30 líneas modificadas/eliminadas

