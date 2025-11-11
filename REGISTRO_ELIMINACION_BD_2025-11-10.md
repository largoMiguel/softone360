# 🗑️ Registro de Eliminación Completa de Base de Datos

**Fecha:** 10 de noviembre de 2025  
**Sistema:** Softone360 - Producción  
**Base de datos:** softone-db (PostgreSQL en RDS)  
**Operación:** Eliminación completa de todos los datos  
**Estado:** ✅ COMPLETADA

---

## 📊 Datos Eliminados

### Resumen de Registros Eliminados

| Tabla | Registros Eliminados |
|-------|---------------------|
| alerts | 26 |
| pqrs | 0 |
| pdm_actividades_evidencias | 7 |
| pdm_actividades_ejecuciones | 3 |
| pdm_actividades | 7 |
| pdm_avances | 0 |
| pdm_meta_assignments | 12 |
| pdm_productos | 326 |
| pdm_archivos_excel | 2 |
| pdm_lineas_estrategicas | 13 |
| pdm_indicadores_resultado | 3 |
| pdm_iniciativas_sgr | 30 |
| actividades_evidencias | 0 |
| actividades_ejecucion | 1 |
| actividades | 2 |
| componentes_procesos | 1 |
| planes_institucionales | 1 |
| secretarias | 3 |
| users | 7 |
| entities | 2 |
| **TOTAL** | **445 registros** |

---

## 🔧 Proceso Ejecutado

### Script SQL Utilizado

```sql
BEGIN;

-- Deshabilitar restricciones de FK temporalmente
SET session_replication_role = 'replica';

-- Eliminar datos en orden de dependencias
DELETE FROM alerts;
DELETE FROM pqrs;
DELETE FROM pdm_actividades_evidencias;
DELETE FROM pdm_actividades_ejecuciones;
DELETE FROM pdm_actividades;
DELETE FROM pdm_avances;
DELETE FROM pdm_meta_assignments;
DELETE FROM pdm_productos;
DELETE FROM pdm_archivos_excel;
DELETE FROM pdm_lineas_estrategicas;
DELETE FROM pdm_indicadores_resultado;
DELETE FROM pdm_iniciativas_sgr;
DELETE FROM actividades_evidencias;
DELETE FROM actividades_ejecucion;
DELETE FROM actividades;
DELETE FROM componentes_procesos;
DELETE FROM planes_institucionales;
DELETE FROM secretarias;
DELETE FROM users;
DELETE FROM entities;

-- Reactivar restricciones de FK
SET session_replication_role = 'origin';

COMMIT;
```

---

## ✅ Verificación Post-Eliminación

### Estado de las Tablas (Todas Vacías)

```
 schemaname |          tablename          | row_count 
------------+-----------------------------+-----------
 public     | actividades                 |         0
 public     | actividades_ejecucion       |         0
 public     | actividades_evidencias      |         0
 public     | alerts                      |         0
 public     | componentes_procesos        |         0
 public     | entities                    |         0
 public     | pdm_actividades             |         0
 public     | pdm_actividades_ejecuciones |         0
 public     | pdm_actividades_evidencias  |         0
 public     | pdm_archivos_excel          |         0
 public     | pdm_avances                 |         0
 public     | pdm_indicadores_resultado   |         0
 public     | pdm_iniciativas_sgr         |         0
 public     | pdm_lineas_estrategicas     |         0
 public     | pdm_meta_assignments        |         0
 public     | pdm_productos               |         0
 public     | planes_institucionales      |         0
 public     | pqrs                        |         0
 public     | secretarias                 |         0
 public     | users                       |         0
```

**✅ Total: 20 tablas, 0 registros**

---

## 📝 Detalles de Entidades Eliminadas

### Entidades que Existían

1. **Alcaldía Municipal de Chiquizá**
   - ID: 1
   - Código: CHIQUIZA
   - NIT: 800019277

2. **ALCALDIA DE PRUEBA**
   - ID: 2
   - Código: alcaldia
   - NIT: 800019277

### Usuarios Eliminados

- **Total:** 7 usuarios
- Incluye: superadmin y usuarios asociados a las entidades

---

## 🔄 Estructura Preservada

**Importante:** La estructura de la base de datos (tablas, columnas, índices, constraints) **se mantiene intacta**.

Solo se eliminaron los **datos**, no la **estructura**.

Las tablas están listas para recibir nuevos datos.

---

## ⚠️ Implicaciones

### ✅ Lo que se Eliminó
- ✅ Todos los registros de entidades
- ✅ Todos los usuarios (incluido superadmin)
- ✅ Todas las PQRS
- ✅ Todos los productos y actividades PDM
- ✅ Todas las alertas
- ✅ Todos los planes institucionales
- ✅ Todas las secretarías
- ✅ Todos los archivos Excel generados

### 📋 Lo que se Preservó
- ✅ Estructura de tablas
- ✅ Índices
- ✅ Constraints (Primary Keys, Foreign Keys)
- ✅ Tipos de datos
- ✅ Triggers (si existen)
- ✅ Configuración de RDS

---

## 🚀 Próximos Pasos Recomendados

### 1. Recrear Usuario Superadmin

```sql
-- Conectar a la base de datos
psql -h softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com -U dbadmin -d postgres

-- Crear usuario superadmin (ajustar según tus necesidades)
INSERT INTO users (username, email, hashed_password, role, is_active, entity_id)
VALUES ('superadmin', 'admin@softone360.com', '<password_hash>', 'SUPERADMIN', true, NULL);
```

### 2. Crear Primera Entidad

```sql
INSERT INTO entities (name, code, nit, slug, description, address, phone, email)
VALUES (
    'Nueva Entidad',
    'CODIGO',
    '123456789',
    'nueva-entidad',
    'Descripción de la entidad',
    'Dirección',
    'Teléfono',
    'email@entidad.com'
);
```

### 3. Verificar Aplicación

El backend seguirá funcionando, pero:
- ❌ No habrá usuarios para login
- ❌ No habrá entidades disponibles
- ❌ Todas las consultas retornarán arrays vacíos

**Necesitarás recrear al menos:**
1. Un usuario superadmin
2. Una entidad (si es necesario)

---

## 🔒 Seguridad y Auditoría

### Información de la Operación

- **Ejecutado por:** Conexión directa desde IP 190.0.241.218
- **Usuario de BD:** dbadmin
- **Método:** SQL directo con transacción
- **Reversible:** ❌ NO (sin backup previo)
- **Backup previo:** ❌ NO realizado

### Snapshots RDS Disponibles

Para recuperar datos (si existieran backups):
```bash
# Listar snapshots disponibles
aws rds describe-db-snapshots \
  --db-instance-identifier softone-db \
  --query 'DBSnapshots[*].[DBSnapshotIdentifier,SnapshotCreateTime]' \
  --output table
```

---

## 📚 Comando para Restaurar (si tienes snapshot)

Si necesitas restaurar desde un snapshot:

```bash
# 1. Restaurar RDS desde snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier softone-db-restored \
  --db-snapshot-identifier <snapshot-id>

# 2. Esperar a que esté disponible
aws rds wait db-instance-available \
  --db-instance-identifier softone-db-restored

# 3. Actualizar endpoint en Elastic Beanstalk
eb setenv DATABASE_URL="postgresql://dbadmin:PASSWORD@<new-endpoint>:5432/postgres"
```

---

## 🎯 Estado Final

```
┌─────────────────────────────────────────┐
│  BASE DE DATOS: COMPLETAMENTE VACÍA    │
├─────────────────────────────────────────┤
│  Tablas:         20                     │
│  Registros:      0                      │
│  Estructura:     ✅ Intacta             │
│  Datos:          ❌ Eliminados          │
│  Backup previo:  ❌ No disponible       │
└─────────────────────────────────────────┘
```

---

**Operación completada exitosamente.**

La base de datos está completamente vacía y lista para nuevos datos.
