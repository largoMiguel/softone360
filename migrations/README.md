# 📁 Migraciones de Base de Datos

Este directorio contiene todas las migraciones de base de datos para el proyecto SOFTONE360.

## 📋 Lista de Migraciones

### 1. `pdm_v2_migration.sql`
**Propósito:** Migración completa del sistema PDM antiguo a PDM V2

**Cambios:**
- Elimina tablas antiguas: `pdm_actividades`, `pdm_avances`, `pdm_meta_assignments`, `pdm_archivos_excel`, etc.
- Crea 6 nuevas tablas:
  - `pdm_lineas_estrategicas`
  - `pdm_indicadores_resultado`
  - `pdm_iniciativas_sgr`
  - `pdm_productos`
  - `pdm_actividades` (nueva estructura)
  - `pdm_actividades_evidencias`
- Agrega constraints y triggers para mantener integridad

**Base de datos:** PostgreSQL (Producción)

### 2. `add_constraints.sql`
**Propósito:** Agregar constraints de validación a todas las tablas

**Cambios:**
- Agrega CHECK constraints para validar datos
- Crea índices para mejorar performance
- Agrega constraints de fechas, rangos numéricos, estados válidos

**Tablas afectadas:**
- PDM: `pdm_actividades`, `pdm_avances`
- Planes: `planes_institucionales`, `componentes_procesos`, `actividades`
- PQRS: `pqrs`

**Base de datos:** PostgreSQL (Producción)

### 3. `fix_pdm_actividades_schema.sql`
**Propósito:** Corrección de esquema para actividades PDM

**Estado:** ⚠️ Obsoleto (reemplazado por pdm_v2_migration.sql)

### 4. `add_constraints_sqlite.sql`
**Propósito:** Versión SQLite de add_constraints.sql

**Base de datos:** SQLite (Desarrollo local)

## 🚀 Cómo Aplicar Migraciones

### Opción A: Script Automatizado (Recomendado)

```bash
cd migrations
./apply_all_migrations.sh
```

Este script:
- ✅ Detecta automáticamente si usa PostgreSQL o SQLite
- ✅ Crea backup automático antes de aplicar
- ✅ Aplica todas las migraciones en orden
- ✅ Verifica que todo se aplicó correctamente
- ✅ Muestra resumen de cambios

### Opción B: Manual (PostgreSQL)

```bash
# 1. Crear backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Aplicar migración PDM V2
psql $DATABASE_URL -f pdm_v2_migration.sql

# 3. Aplicar constraints
psql $DATABASE_URL -f add_constraints.sql

# 4. Verificar
psql $DATABASE_URL -c "SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'pdm_%';"
```

### Opción C: Manual (SQLite - Desarrollo)

```bash
# PDM V2 es solo para PostgreSQL
# Solo aplicar constraints:
sqlite3 ../backend/pqrs_alcaldia.db < add_constraints_sqlite.sql
```

## ⚠️ Consideraciones Importantes

### Antes de Aplicar en Producción

1. **Backup Obligatorio**
   ```bash
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Verificar que el backend y frontend estén actualizados**
   - Backend debe tener los nuevos modelos PDM V2
   - Frontend debe usar el servicio PDM actualizado

3. **Ventana de Mantenimiento**
   - La migración PDM V2 elimina tablas antiguas
   - Esto puede causar tiempo de inactividad
   - Programar en horario de baja actividad

4. **Prueba en Desarrollo Primero**
   ```bash
   # Crear base de datos de prueba
   createdb softone_test
   pg_dump $DATABASE_URL | psql softone_test
   
   # Probar migraciones
   DATABASE_URL=postgresql://user:pass@localhost/softone_test ./apply_all_migrations.sh
   ```

### Después de Aplicar

1. **Verificar tablas PDM V2**
   ```sql
   SELECT table_name, 
          (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as columns
   FROM information_schema.tables t
   WHERE table_schema = 'public' AND table_name LIKE 'pdm_%';
   ```

2. **Verificar constraints**
   ```sql
   SELECT table_name, constraint_name, constraint_type
   FROM information_schema.table_constraints
   WHERE table_name LIKE 'pdm_%';
   ```

3. **Probar funcionalidad PDM en el frontend**
   - Subir un archivo Excel
   - Crear actividades
   - Registrar evidencias
   - Verificar que se guarde en BD

## 🔄 Rollback

Si algo sale mal, restaurar desde el backup:

```bash
# Detener el backend primero
psql $DATABASE_URL < backup_TIMESTAMP.sql
```

## 📝 Crear Nueva Migración

```bash
cd migrations

# Crear archivo
touch nueva_migracion_$(date +%Y%m%d).sql

# Editar con estructura:
# BEGIN;
# -- Cambios aquí
# COMMIT;

# Agregar al array en apply_all_migrations.sh
```

## 🗄️ Estructura de Base de Datos PDM V2

```
pdm_lineas_estrategicas
├── id (PK)
├── entity_id (FK)
├── linea_estrategica
├── sector
├── programa_mga
└── ods

pdm_indicadores_resultado
├── id (PK)
├── entity_id (FK)
├── linea_estrategica_id (FK)
├── indicador_resultado
└── metas (2024-2027)

pdm_iniciativas_sgr
├── id (PK)
├── entity_id (FK)
├── linea_estrategica_id (FK)
├── nombre_proyecto
└── bpin

pdm_productos
├── id (PK)
├── entity_id (FK)
├── linea_estrategica_id (FK)
├── codigo (UNIQUE)
├── producto
├── metas (programacion_YYYY)
└── presupuesto (presupuesto_YYYY)

pdm_actividades
├── id (PK)
├── entity_id (FK)
├── producto_id (FK)
├── producto_codigo
├── nombre
├── meta_programada
├── meta_ejecutada
└── estado

pdm_actividades_evidencias
├── id (PK)
├── actividad_id (FK)
├── tipo_evidencia
├── url_archivo
└── descripcion
```

## 📞 Soporte

Si hay problemas con las migraciones:
1. Revisar logs del script `apply_all_migrations.sh`
2. Verificar errores en PostgreSQL: `tail -f /var/log/postgresql/postgresql-*.log`
3. Restaurar desde backup si es necesario
4. Contactar al equipo de desarrollo

---

**Última actualización:** 8 de noviembre de 2025
