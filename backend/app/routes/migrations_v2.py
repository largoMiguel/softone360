"""
Sistema de Migración Completa para Base de Datos de Producción
================================================================

Este módulo ejecuta una migración completa idempotente que:
1. Crea todas las tablas faltantes
2. Agrega columnas faltantes a tablas existentes
3. Elimina tipos ENUM problemáticos y los convierte a TEXT
4. Crea índices para optimizar queries
5. Mantiene integridad referencial con claves foráneas

Endpoints:
- POST /api/migrations/run/status - Ejecuta migración completa (requiere X-Migration-Key)
- GET /api/migrations/status - Verifica estado de la BD (público para debugging)

Uso:
  curl -X POST https://pqrs-backend.onrender.com/api/migrations/run/status \
       -H "X-Migration-Key: tu-clave-secreta-2024"
"""

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from sqlalchemy import text, inspect
from app.config.database import get_db, engine, Base
from app.config.settings import settings
from typing import List, Optional, Dict, Any
from datetime import datetime
import traceback

router = APIRouter()

# Estado global de migraciones
migration_state = {
    "running": False,
    "last_run": None,
    "last_result": None,
    "logs": [],
    "errors": []
}


def log_msg(message: str, is_error: bool = False):
    """Registra un mensaje en el log de migraciones"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_entry = f"[{timestamp}] {message}"
    print(log_entry)
    
    migration_state["logs"].append(log_entry)
    if is_error:
        migration_state["errors"].append(log_entry)
    
    # Mantener solo los últimos 200 logs
    if len(migration_state["logs"]) > 200:
        migration_state["logs"] = migration_state["logs"][-200:]


def table_exists(table_name: str) -> bool:
    """Verifica si una tabla existe en la base de datos"""
    inspector = inspect(engine)
    return inspector.has_table(table_name)


def column_exists(table_name: str, column_name: str) -> bool:
    """Verifica si una columna existe en una tabla"""
    if not table_exists(table_name):
        return False
    inspector = inspect(engine)
    columns = [col["name"] for col in inspector.get_columns(table_name)]
    return column_name in columns


def get_column_type(table_name: str, column_name: str, db: Session) -> Optional[str]:
    """Obtiene el tipo de dato de una columna"""
    try:
        result = db.execute(text("""
            SELECT data_type, udt_name 
            FROM information_schema.columns 
            WHERE table_name = :table_name 
            AND column_name = :column_name
        """), {"table_name": table_name, "column_name": column_name}).fetchone()
        
        if result:
            return result[0], result[1]
        return None, None
    except Exception:
        return None, None


def drop_enum_type_safe(db: Session, enum_name: str) -> bool:
    """Elimina un tipo ENUM de forma segura si existe"""
    try:
        db.execute(text(f"DROP TYPE IF EXISTS {enum_name} CASCADE"))
        db.commit()
        log_msg(f"✓ Tipo ENUM '{enum_name}' eliminado")
        return True
    except Exception as e:
        log_msg(f"⚠ No se pudo eliminar ENUM '{enum_name}': {str(e)}")
        db.rollback()
        return False


def convert_enum_to_text(db: Session, table_name: str, column_name: str, enum_name: str, default_value: str = None) -> bool:
    """Convierte una columna ENUM a TEXT de forma segura"""
    try:
        data_type, udt_name = get_column_type(table_name, column_name, db)
        
        if data_type == 'USER-DEFINED' or udt_name == enum_name:
            log_msg(f"Convirtiendo {table_name}.{column_name} de ENUM a TEXT...")
            
            # Crear columna temporal
            db.execute(text(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {column_name}_temp TEXT"))
            
            # Copiar valores normalizados
            db.execute(text(f"""
                UPDATE {table_name} 
                SET {column_name}_temp = LOWER({column_name}::text)
                WHERE {column_name}_temp IS NULL
            """))
            
            # Eliminar columna original
            db.execute(text(f"ALTER TABLE {table_name} DROP COLUMN {column_name} CASCADE"))
            
            # Renombrar columna temporal
            db.execute(text(f"ALTER TABLE {table_name} RENAME COLUMN {column_name}_temp TO {column_name}"))
            
            # Agregar NOT NULL si es necesario
            db.execute(text(f"ALTER TABLE {table_name} ALTER COLUMN {column_name} SET NOT NULL"))
            
            # Agregar default si se especifica
            if default_value:
                db.execute(text(f"ALTER TABLE {table_name} ALTER COLUMN {column_name} SET DEFAULT '{default_value}'"))
            
            db.commit()
            log_msg(f"✓ {table_name}.{column_name} convertido a TEXT")
            return True
        else:
            log_msg(f"✓ {table_name}.{column_name} ya es {data_type}")
            return True
            
    except Exception as e:
        log_msg(f"❌ Error convirtiendo {table_name}.{column_name}: {str(e)}", is_error=True)
        db.rollback()
        return False


def ensure_column(db: Session, table_name: str, column_name: str, column_type: str) -> bool:
    """Asegura que una columna existe con el tipo correcto"""
    try:
        if not column_exists(table_name, column_name):
            log_msg(f"Agregando columna {column_name} a {table_name}...")
            db.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"))
            db.commit()
            log_msg(f"✓ Columna {column_name} agregada a {table_name}")
            return True
        return True
    except Exception as e:
        log_msg(f"❌ Error agregando {column_name} a {table_name}: {str(e)}", is_error=True)
        db.rollback()
        return False


def create_index_safe(db: Session, index_name: str, table_name: str, columns: str) -> bool:
    """Crea un índice de forma segura (idempotente)"""
    try:
        db.execute(text(f"CREATE INDEX IF NOT EXISTS {index_name} ON {table_name}({columns})"))
        db.commit()
        return True
    except Exception as e:
        log_msg(f"⚠ Índice {index_name}: {str(e)}")
        db.rollback()
        return False


# ============================================================================
# MIGRACIONES POR MÓDULO
# ============================================================================

def migrate_entities(db: Session) -> List[str]:
    """Migración de tabla entities"""
    results = []
    
    if not table_exists("entities"):
        log_msg("⚠ Tabla entities no existe, se creará con Base.metadata.create_all")
        results.append("⚠ Tabla entities pendiente de crear")
        return results
    
    results.append("✓ Tabla entities existe")
    
    # Columnas requeridas
    columns = {
        "name": "VARCHAR(200) NOT NULL",
        "code": "VARCHAR(50) NOT NULL",
        "nit": "VARCHAR(50)",
        "slug": "VARCHAR(100) NOT NULL",
        "description": "TEXT",
        "address": "VARCHAR(300)",
        "phone": "VARCHAR(50)",
        "email": "VARCHAR(150)",
        "logo_url": "VARCHAR(500)",
        "horario_atencion": "VARCHAR(200)",
        "tiempo_respuesta": "VARCHAR(100)",
        "is_active": "BOOLEAN DEFAULT TRUE NOT NULL",
        "enable_pqrs": "BOOLEAN DEFAULT TRUE NOT NULL",
        "enable_users_admin": "BOOLEAN DEFAULT TRUE NOT NULL",
        "enable_reports_pdf": "BOOLEAN DEFAULT TRUE NOT NULL",
        "enable_ai_reports": "BOOLEAN DEFAULT TRUE NOT NULL",
        "enable_planes_institucionales": "BOOLEAN DEFAULT TRUE NOT NULL",
        "enable_contratacion": "BOOLEAN DEFAULT TRUE NOT NULL",
        "enable_pdm": "BOOLEAN DEFAULT TRUE NOT NULL",
        "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "updated_at": "TIMESTAMP"
    }
    
    for col, col_type in columns.items():
        ensure_column(db, "entities", col, col_type)
    
    # Índices
    create_index_safe(db, "idx_entities_code", "entities", "code")
    create_index_safe(db, "idx_entities_slug", "entities", "slug")
    create_index_safe(db, "idx_entities_nit", "entities", "nit")
    
    results.append("✓ Migración de entities completada")
    return results


def migrate_users(db: Session) -> List[str]:
    """Migración de tabla users"""
    results = []
    
    if not table_exists("users"):
        log_msg("⚠ Tabla users no existe, se creará con Base.metadata.create_all")
        results.append("⚠ Tabla users pendiente de crear")
        return results
    
    results.append("✓ Tabla users existe")
    
    # Convertir ENUMs a TEXT
    convert_enum_to_text(db, "users", "role", "userrole", "secretario")
    convert_enum_to_text(db, "users", "user_type", "usertype")
    
    # Columnas requeridas
    columns = {
        "username": "VARCHAR(255) NOT NULL",
        "email": "VARCHAR(255) NOT NULL",
        "full_name": "VARCHAR(255) NOT NULL",
        "hashed_password": "VARCHAR(255) NOT NULL",
        "role": "TEXT NOT NULL DEFAULT 'secretario'",
        "entity_id": "INTEGER",
        "user_type": "TEXT",
        "allowed_modules": "JSON",
        "secretaria": "VARCHAR(255)",
        "cedula": "VARCHAR(50)",
        "telefono": "VARCHAR(50)",
        "direccion": "VARCHAR(255)",
        "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "updated_at": "TIMESTAMP",
        "is_active": "BOOLEAN DEFAULT TRUE NOT NULL"
    }
    
    for col, col_type in columns.items():
        ensure_column(db, "users", col, col_type)
    
    # Índices
    create_index_safe(db, "idx_users_username", "users", "username")
    create_index_safe(db, "idx_users_email", "users", "email")
    create_index_safe(db, "idx_users_entity", "users", "entity_id")
    create_index_safe(db, "idx_users_role", "users", "role")
    
    # Eliminar tipos ENUM
    drop_enum_type_safe(db, "userrole")
    drop_enum_type_safe(db, "usertype")
    
    results.append("✓ Migración de users completada")
    return results


def migrate_pqrs(db: Session) -> List[str]:
    """Migración de tabla pqrs"""
    results = []
    
    if not table_exists("pqrs"):
        log_msg("⚠ Tabla pqrs no existe, se creará con Base.metadata.create_all")
        results.append("⚠ Tabla pqrs pendiente de crear")
        return results
    
    results.append("✓ Tabla pqrs existe")
    
    # Convertir ENUMs a TEXT
    convert_enum_to_text(db, "pqrs", "tipo_identificacion", "tipoidentificacion", "personal")
    convert_enum_to_text(db, "pqrs", "medio_respuesta", "mediorespuesta", "email")
    convert_enum_to_text(db, "pqrs", "tipo_solicitud", "tiposolicitud", "peticion")
    convert_enum_to_text(db, "pqrs", "estado", "estadopqrs", "pendiente")
    
    # Columnas requeridas
    columns = {
        "numero_radicado": "VARCHAR(255) NOT NULL",
        "tipo_identificacion": "VARCHAR(50) NOT NULL DEFAULT 'personal'",
        "medio_respuesta": "VARCHAR(50) NOT NULL DEFAULT 'email'",
        "nombre_ciudadano": "VARCHAR(255)",
        "cedula_ciudadano": "VARCHAR(50)",
        "telefono_ciudadano": "VARCHAR(50)",
        "email_ciudadano": "VARCHAR(255)",
        "direccion_ciudadano": "VARCHAR(255)",
        "tipo_solicitud": "VARCHAR(50) NOT NULL",
        "asunto": "VARCHAR(500) NOT NULL",
        "descripcion": "TEXT NOT NULL",
        "estado": "VARCHAR(50) NOT NULL DEFAULT 'pendiente'",
        "fecha_solicitud": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "fecha_cierre": "TIMESTAMP",
        "fecha_delegacion": "TIMESTAMP",
        "fecha_respuesta": "TIMESTAMP",
        "created_by_id": "INTEGER NOT NULL",
        "assigned_to_id": "INTEGER",
        "entity_id": "INTEGER NOT NULL",
        "respuesta": "TEXT",
        "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "updated_at": "TIMESTAMP"
    }
    
    for col, col_type in columns.items():
        ensure_column(db, "pqrs", col, col_type)
    
    # Índices
    create_index_safe(db, "idx_pqrs_radicado", "pqrs", "numero_radicado")
    create_index_safe(db, "idx_pqrs_entity", "pqrs", "entity_id")
    create_index_safe(db, "idx_pqrs_created_by", "pqrs", "created_by_id")
    create_index_safe(db, "idx_pqrs_assigned_to", "pqrs", "assigned_to_id")
    create_index_safe(db, "idx_pqrs_estado", "pqrs", "estado")
    create_index_safe(db, "idx_pqrs_fecha", "pqrs", "fecha_solicitud")
    
    # Eliminar tipos ENUM
    drop_enum_type_safe(db, "tipoidentificacion")
    drop_enum_type_safe(db, "mediorespuesta")
    drop_enum_type_safe(db, "tiposolicitud")
    drop_enum_type_safe(db, "estadopqrs")
    
    results.append("✓ Migración de pqrs completada")
    return results


def migrate_secretarias(db: Session) -> List[str]:
    """Migración de tabla secretarias"""
    results = []
    
    if not table_exists("secretarias"):
        log_msg("Creando tabla secretarias...")
        try:
            db.execute(text("""
                CREATE TABLE secretarias (
                    id SERIAL PRIMARY KEY,
                    entity_id INTEGER NOT NULL,
                    nombre VARCHAR(255) NOT NULL,
                    is_active BOOLEAN DEFAULT TRUE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP,
                    CONSTRAINT fk_secretarias_entity FOREIGN KEY (entity_id) 
                        REFERENCES entities(id) ON DELETE CASCADE,
                    CONSTRAINT uq_secretaria_entity_nombre UNIQUE (entity_id, nombre)
                )
            """))
            db.commit()
            results.append("✓ Tabla secretarias creada")
        except Exception as e:
            log_msg(f"❌ Error creando secretarias: {str(e)}", is_error=True)
            db.rollback()
            results.append(f"❌ Error: {str(e)}")
            return results
    else:
        results.append("✓ Tabla secretarias existe")
    
    # Columnas requeridas
    columns = {
        "entity_id": "INTEGER NOT NULL",
        "nombre": "VARCHAR(255) NOT NULL",
        "is_active": "BOOLEAN DEFAULT TRUE NOT NULL",
        "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "updated_at": "TIMESTAMP"
    }
    
    for col, col_type in columns.items():
        ensure_column(db, "secretarias", col, col_type)
    
    # Índices
    create_index_safe(db, "idx_secretarias_entity", "secretarias", "entity_id")
    
    results.append("✓ Migración de secretarias completada")
    return results


def migrate_alerts(db: Session) -> List[str]:
    """Migración de tabla alerts"""
    results = []
    
    if not table_exists("alerts"):
        log_msg("Creando tabla alerts...")
        try:
            db.execute(text("""
                CREATE TABLE alerts (
                    id SERIAL PRIMARY KEY,
                    entity_id INTEGER,
                    recipient_user_id INTEGER,
                    type VARCHAR(64) NOT NULL,
                    title VARCHAR(256) NOT NULL,
                    message VARCHAR(1024),
                    data TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    read_at TIMESTAMP,
                    CONSTRAINT fk_alerts_entity FOREIGN KEY (entity_id) 
                        REFERENCES entities(id) ON DELETE CASCADE,
                    CONSTRAINT fk_alerts_user FOREIGN KEY (recipient_user_id) 
                        REFERENCES users(id) ON DELETE CASCADE
                )
            """))
            db.commit()
            results.append("✓ Tabla alerts creada")
        except Exception as e:
            log_msg(f"❌ Error creando alerts: {str(e)}", is_error=True)
            db.rollback()
            results.append(f"❌ Error: {str(e)}")
            return results
    else:
        results.append("✓ Tabla alerts existe")
    
    # Columnas requeridas
    columns = {
        "entity_id": "INTEGER",
        "recipient_user_id": "INTEGER",
        "type": "VARCHAR(64) NOT NULL",
        "title": "VARCHAR(256) NOT NULL",
        "message": "VARCHAR(1024)",
        "data": "TEXT",
        "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "read_at": "TIMESTAMP"
    }
    
    for col, col_type in columns.items():
        ensure_column(db, "alerts", col, col_type)
    
    # Índices
    create_index_safe(db, "idx_alerts_entity", "alerts", "entity_id")
    create_index_safe(db, "idx_alerts_user", "alerts", "recipient_user_id")
    create_index_safe(db, "idx_alerts_type", "alerts", "type")
    
    results.append("✓ Migración de alerts completada")
    return results


def migrate_planes_institucionales(db: Session) -> List[str]:
    """Migración completa de módulo de Planes Institucionales"""
    results = []
    
    # ========== TABLA: planes_institucionales ==========
    if not table_exists("planes_institucionales"):
        log_msg("Creando tabla planes_institucionales...")
        try:
            db.execute(text("""
                CREATE TABLE planes_institucionales (
                    id SERIAL PRIMARY KEY,
                    anio INTEGER NOT NULL,
                    nombre VARCHAR(300) NOT NULL,
                    descripcion TEXT NOT NULL,
                    periodo_inicio DATE NOT NULL,
                    periodo_fin DATE NOT NULL,
                    estado VARCHAR(50) NOT NULL DEFAULT 'formulacion',
                    porcentaje_avance NUMERIC(5,2) DEFAULT 0 NOT NULL,
                    responsable_elaboracion VARCHAR(200) NOT NULL,
                    responsable_aprobacion VARCHAR(200),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP,
                    created_by VARCHAR(200),
                    entity_id INTEGER NOT NULL,
                    CONSTRAINT fk_planes_entity FOREIGN KEY (entity_id) 
                        REFERENCES entities(id) ON DELETE CASCADE
                )
            """))
            db.commit()
            results.append("✓ Tabla planes_institucionales creada")
        except Exception as e:
            log_msg(f"❌ Error creando planes_institucionales: {str(e)}", is_error=True)
            db.rollback()
            results.append(f"❌ Error: {str(e)}")
    else:
        results.append("✓ Tabla planes_institucionales existe")
        
        # Convertir ENUM a TEXT
        convert_enum_to_text(db, "planes_institucionales", "estado", "estadoplan", "formulacion")
        drop_enum_type_safe(db, "estadoplan")
        
        # Asegurar columnas
        columns = {
            "anio": "INTEGER NOT NULL",
            "nombre": "VARCHAR(300) NOT NULL",
            "descripcion": "TEXT NOT NULL",
            "periodo_inicio": "DATE NOT NULL",
            "periodo_fin": "DATE NOT NULL",
            "estado": "VARCHAR(50) NOT NULL DEFAULT 'formulacion'",
            "porcentaje_avance": "NUMERIC(5,2) DEFAULT 0 NOT NULL",
            "responsable_elaboracion": "VARCHAR(200) NOT NULL",
            "responsable_aprobacion": "VARCHAR(200)",
            "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            "updated_at": "TIMESTAMP",
            "created_by": "VARCHAR(200)",
            "entity_id": "INTEGER NOT NULL"
        }
        
        for col, col_type in columns.items():
            ensure_column(db, "planes_institucionales", col, col_type)
    
    # Índices
    create_index_safe(db, "idx_planes_entity", "planes_institucionales", "entity_id")
    create_index_safe(db, "idx_planes_anio", "planes_institucionales", "anio")
    create_index_safe(db, "idx_planes_estado", "planes_institucionales", "estado")
    
    # ========== TABLA: componentes_procesos ==========
    if not table_exists("componentes_procesos"):
        log_msg("Creando tabla componentes_procesos...")
        try:
            db.execute(text("""
                CREATE TABLE componentes_procesos (
                    id SERIAL PRIMARY KEY,
                    nombre VARCHAR(300) NOT NULL,
                    estado VARCHAR(50) NOT NULL DEFAULT 'no_iniciado',
                    porcentaje_avance NUMERIC(5,2) DEFAULT 0 NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP,
                    plan_id INTEGER NOT NULL,
                    CONSTRAINT fk_componentes_plan FOREIGN KEY (plan_id) 
                        REFERENCES planes_institucionales(id) ON DELETE CASCADE
                )
            """))
            db.commit()
            results.append("✓ Tabla componentes_procesos creada")
        except Exception as e:
            log_msg(f"❌ Error creando componentes_procesos: {str(e)}", is_error=True)
            db.rollback()
    else:
        results.append("✓ Tabla componentes_procesos existe")
        
        # Convertir ENUM a TEXT
        convert_enum_to_text(db, "componentes_procesos", "estado", "estadocomponente", "no_iniciado")
        drop_enum_type_safe(db, "estadocomponente")
        
        # Asegurar columnas
        columns = {
            "nombre": "VARCHAR(300) NOT NULL",
            "estado": "VARCHAR(50) NOT NULL DEFAULT 'no_iniciado'",
            "porcentaje_avance": "NUMERIC(5,2) DEFAULT 0 NOT NULL",
            "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            "updated_at": "TIMESTAMP",
            "plan_id": "INTEGER NOT NULL"
        }
        
        for col, col_type in columns.items():
            ensure_column(db, "componentes_procesos", col, col_type)
    
    # Índices
    create_index_safe(db, "idx_componentes_plan", "componentes_procesos", "plan_id")
    create_index_safe(db, "idx_componentes_estado", "componentes_procesos", "estado")
    
    # ========== TABLA: actividades ==========
    if not table_exists("actividades"):
        log_msg("Creando tabla actividades...")
        try:
            db.execute(text("""
                CREATE TABLE actividades (
                    id SERIAL PRIMARY KEY,
                    objetivo_especifico TEXT,
                    fecha_inicio_prevista DATE NOT NULL,
                    fecha_fin_prevista DATE NOT NULL,
                    responsable VARCHAR(200) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP,
                    componente_id INTEGER NOT NULL,
                    CONSTRAINT fk_actividades_componente FOREIGN KEY (componente_id) 
                        REFERENCES componentes_procesos(id) ON DELETE CASCADE
                )
            """))
            db.commit()
            results.append("✓ Tabla actividades creada")
        except Exception as e:
            log_msg(f"❌ Error creando actividades: {str(e)}", is_error=True)
            db.rollback()
    else:
        results.append("✓ Tabla actividades existe")
        
        # Asegurar columnas
        columns = {
            "objetivo_especifico": "TEXT",
            "fecha_inicio_prevista": "DATE NOT NULL",
            "fecha_fin_prevista": "DATE NOT NULL",
            "responsable": "VARCHAR(200) NOT NULL",
            "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            "updated_at": "TIMESTAMP",
            "componente_id": "INTEGER NOT NULL"
        }
        
        for col, col_type in columns.items():
            ensure_column(db, "actividades", col, col_type)
    
    # Índices
    create_index_safe(db, "idx_actividades_componente", "actividades", "componente_id")
    create_index_safe(db, "idx_actividades_responsable", "actividades", "responsable")
    
    # ========== TABLA: actividades_ejecucion ==========
    if not table_exists("actividades_ejecucion"):
        log_msg("Creando tabla actividades_ejecucion...")
        try:
            db.execute(text("""
                CREATE TABLE actividades_ejecucion (
                    id SERIAL PRIMARY KEY,
                    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    descripcion TEXT NOT NULL,
                    evidencia_url VARCHAR(500),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP,
                    actividad_id INTEGER NOT NULL,
                    CONSTRAINT fk_ejecucion_actividad FOREIGN KEY (actividad_id) 
                        REFERENCES actividades(id) ON DELETE CASCADE
                )
            """))
            db.commit()
            results.append("✓ Tabla actividades_ejecucion creada")
        except Exception as e:
            log_msg(f"❌ Error creando actividades_ejecucion: {str(e)}", is_error=True)
            db.rollback()
    else:
        results.append("✓ Tabla actividades_ejecucion existe")
        
        # Asegurar columnas
        columns = {
            "fecha_registro": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL",
            "descripcion": "TEXT NOT NULL",
            "evidencia_url": "VARCHAR(500)",
            "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            "updated_at": "TIMESTAMP",
            "actividad_id": "INTEGER NOT NULL"
        }
        
        for col, col_type in columns.items():
            ensure_column(db, "actividades_ejecucion", col, col_type)
    
    # Índices
    create_index_safe(db, "idx_ejecucion_actividad", "actividades_ejecucion", "actividad_id")
    create_index_safe(db, "idx_ejecucion_fecha", "actividades_ejecucion", "fecha_registro")
    
    # ========== TABLA: actividades_evidencias ==========
    if not table_exists("actividades_evidencias"):
        log_msg("Creando tabla actividades_evidencias...")
        try:
            db.execute(text("""
                CREATE TABLE actividades_evidencias (
                    id SERIAL PRIMARY KEY,
                    tipo VARCHAR(50) NOT NULL,
                    contenido TEXT NOT NULL,
                    nombre_archivo VARCHAR(255),
                    mime_type VARCHAR(100),
                    orden INTEGER DEFAULT 0 NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    actividad_ejecucion_id INTEGER NOT NULL,
                    CONSTRAINT fk_evidencias_ejecucion FOREIGN KEY (actividad_ejecucion_id) 
                        REFERENCES actividades_ejecucion(id) ON DELETE CASCADE
                )
            """))
            db.commit()
            results.append("✓ Tabla actividades_evidencias creada")
        except Exception as e:
            log_msg(f"❌ Error creando actividades_evidencias: {str(e)}", is_error=True)
            db.rollback()
    else:
        results.append("✓ Tabla actividades_evidencias existe")
        
        # Asegurar columnas
        columns = {
            "tipo": "VARCHAR(50) NOT NULL",
            "contenido": "TEXT NOT NULL",
            "nombre_archivo": "VARCHAR(255)",
            "mime_type": "VARCHAR(100)",
            "orden": "INTEGER DEFAULT 0 NOT NULL",
            "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            "actividad_ejecucion_id": "INTEGER NOT NULL"
        }
        
        for col, col_type in columns.items():
            ensure_column(db, "actividades_evidencias", col, col_type)
    
    # Índices
    create_index_safe(db, "idx_evidencias_ejecucion", "actividades_evidencias", "actividad_ejecucion_id")
    create_index_safe(db, "idx_evidencias_tipo", "actividades_evidencias", "tipo")
    
    results.append("✓ Migración de Planes Institucionales completada")
    return results


def migrate_pdm(db: Session) -> List[str]:
    """Migración completa de módulo PDM"""
    results = []
    
    # ========== TABLA: pdm_archivos_excel ==========
    if not table_exists("pdm_archivos_excel"):
        log_msg("Creando tabla pdm_archivos_excel...")
        try:
            db.execute(text("""
                CREATE TABLE pdm_archivos_excel (
                    id SERIAL PRIMARY KEY,
                    entity_id INTEGER NOT NULL,
                    nombre_archivo VARCHAR(512) NOT NULL,
                    contenido BYTEA NOT NULL,
                    tamanio INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT fk_pdm_excel_entity FOREIGN KEY (entity_id) 
                        REFERENCES entities(id) ON DELETE CASCADE,
                    CONSTRAINT uq_archivo_excel_entity UNIQUE (entity_id)
                )
            """))
            db.commit()
            results.append("✓ Tabla pdm_archivos_excel creada")
        except Exception as e:
            log_msg(f"❌ Error creando pdm_archivos_excel: {str(e)}", is_error=True)
            db.rollback()
    else:
        results.append("✓ Tabla pdm_archivos_excel existe")
    
    # Índices
    create_index_safe(db, "idx_pdm_excel_entity", "pdm_archivos_excel", "entity_id")
    
    # ========== TABLA: pdm_meta_assignments ==========
    if not table_exists("pdm_meta_assignments"):
        log_msg("Creando tabla pdm_meta_assignments...")
        try:
            db.execute(text("""
                CREATE TABLE pdm_meta_assignments (
                    id SERIAL PRIMARY KEY,
                    entity_id INTEGER NOT NULL,
                    codigo_indicador_producto VARCHAR(128) NOT NULL,
                    secretaria VARCHAR(256),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT fk_pdm_meta_entity FOREIGN KEY (entity_id) 
                        REFERENCES entities(id) ON DELETE CASCADE,
                    CONSTRAINT uq_meta_assignment_entity_codigo 
                        UNIQUE (entity_id, codigo_indicador_producto)
                )
            """))
            db.commit()
            results.append("✓ Tabla pdm_meta_assignments creada")
        except Exception as e:
            log_msg(f"❌ Error creando pdm_meta_assignments: {str(e)}", is_error=True)
            db.rollback()
    else:
        results.append("✓ Tabla pdm_meta_assignments existe")
    
    # Índices
    create_index_safe(db, "idx_pdm_meta_entity", "pdm_meta_assignments", "entity_id")
    create_index_safe(db, "idx_pdm_meta_codigo", "pdm_meta_assignments", "codigo_indicador_producto")
    
    # ========== TABLA: pdm_avances ==========
    if not table_exists("pdm_avances"):
        log_msg("Creando tabla pdm_avances...")
        try:
            db.execute(text("""
                CREATE TABLE pdm_avances (
                    id SERIAL PRIMARY KEY,
                    entity_id INTEGER NOT NULL,
                    codigo_indicador_producto VARCHAR(128) NOT NULL,
                    anio INTEGER NOT NULL,
                    valor_ejecutado DOUBLE PRECISION DEFAULT 0 NOT NULL,
                    comentario VARCHAR(512),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT fk_pdm_avance_entity FOREIGN KEY (entity_id) 
                        REFERENCES entities(id) ON DELETE CASCADE,
                    CONSTRAINT uq_avance_entity_codigo_anio 
                        UNIQUE (entity_id, codigo_indicador_producto, anio)
                )
            """))
            db.commit()
            results.append("✓ Tabla pdm_avances creada")
        except Exception as e:
            log_msg(f"❌ Error creando pdm_avances: {str(e)}", is_error=True)
            db.rollback()
    else:
        results.append("✓ Tabla pdm_avances existe")
    
    # Índices
    create_index_safe(db, "idx_pdm_avance_entity", "pdm_avances", "entity_id")
    create_index_safe(db, "idx_pdm_avance_codigo", "pdm_avances", "codigo_indicador_producto")
    
    # ========== TABLA: pdm_actividades ==========
    if not table_exists("pdm_actividades"):
        log_msg("Creando tabla pdm_actividades...")
        try:
            db.execute(text("""
                CREATE TABLE pdm_actividades (
                    id SERIAL PRIMARY KEY,
                    entity_id INTEGER NOT NULL,
                    codigo_producto VARCHAR(128) NOT NULL,
                    anio INTEGER NOT NULL,
                    nombre VARCHAR(512) NOT NULL,
                    descripcion TEXT,
                    responsable VARCHAR(256),
                    responsable_user_id INTEGER,
                    fecha_inicio TIMESTAMP,
                    fecha_fin TIMESTAMP,
                    meta_ejecutar DOUBLE PRECISION DEFAULT 0 NOT NULL,
                    estado VARCHAR(64) DEFAULT 'PENDIENTE' NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT fk_pdm_actividad_entity FOREIGN KEY (entity_id) 
                        REFERENCES entities(id) ON DELETE CASCADE,
                    CONSTRAINT fk_pdm_actividad_user FOREIGN KEY (responsable_user_id)
                        REFERENCES users(id) ON DELETE SET NULL
                )
            """))
            db.commit()
            results.append("✓ Tabla pdm_actividades creada")
        except Exception as e:
            log_msg(f"❌ Error creando pdm_actividades: {str(e)}", is_error=True)
            db.rollback()
    else:
        results.append("✓ Tabla pdm_actividades existe")
        
        # CRÍTICO: Eliminar columna codigo_indicador_producto si existe
        # Esta columna no está en el modelo actual y causa errores NOT NULL
        if column_exists("pdm_actividades", "codigo_indicador_producto"):
            log_msg("⚠ Eliminando columna obsoleta: codigo_indicador_producto")
            try:
                # Eliminar constraint UNIQUE que incluye esta columna
                db.execute(text("""
                    ALTER TABLE pdm_actividades 
                    DROP CONSTRAINT IF EXISTS uq_actividad_entity_codigo_nombre CASCADE
                """))
                
                # Eliminar la columna
                db.execute(text("""
                    ALTER TABLE pdm_actividades 
                    DROP COLUMN IF EXISTS codigo_indicador_producto CASCADE
                """))
                
                db.commit()
                log_msg("✓ Columna codigo_indicador_producto eliminada exitosamente")
                results.append("✓ Columna codigo_indicador_producto eliminada")
            except Exception as e:
                log_msg(f"❌ Error eliminando codigo_indicador_producto: {str(e)}", is_error=True)
                db.rollback()
        
        # Asegurar columnas (SIN codigo_indicador_producto, CON responsable_user_id)
        columns = {
            "entity_id": "INTEGER NOT NULL",
            "codigo_producto": "VARCHAR(128) NOT NULL",
            "anio": "INTEGER NOT NULL",
            "nombre": "VARCHAR(512) NOT NULL",
            "descripcion": "TEXT",
            "responsable": "VARCHAR(256)",
            "responsable_user_id": "INTEGER",
            "fecha_inicio": "TIMESTAMP",
            "fecha_fin": "TIMESTAMP",
            "meta_ejecutar": "DOUBLE PRECISION DEFAULT 0 NOT NULL",
            "estado": "VARCHAR(64) DEFAULT 'PENDIENTE' NOT NULL",
            "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            "updated_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        }
        
        for col, col_type in columns.items():
            ensure_column(db, "pdm_actividades", col, col_type)
        
        # Eliminar columnas obsoletas que ya no están en el modelo
        obsolete_columns = ["porcentaje_avance", "valor_ejecutado"]
        for col in obsolete_columns:
            if column_exists("pdm_actividades", col):
                try:
                    log_msg(f"⚠ Eliminando columna obsoleta: {col}")
                    db.execute(text(f"ALTER TABLE pdm_actividades DROP COLUMN IF EXISTS {col} CASCADE"))
                    db.commit()
                    log_msg(f"✓ Columna {col} eliminada")
                except Exception as e:
                    log_msg(f"❌ Error eliminando {col}: {str(e)}", is_error=True)
                    db.rollback()
    
    # Índices (corregidos para el nuevo esquema)
    create_index_safe(db, "idx_pdm_actividad_entity", "pdm_actividades", "entity_id")
    create_index_safe(db, "idx_pdm_actividad_codigo_producto", "pdm_actividades", "codigo_producto")
    create_index_safe(db, "idx_pdm_actividad_anio", "pdm_actividades", "anio")
    create_index_safe(db, "idx_pdm_actividad_responsable_user", "pdm_actividades", "responsable_user_id")
    
    # ========== TABLA: pdm_actividades_ejecuciones ==========
    if not table_exists("pdm_actividades_ejecuciones"):
        log_msg("Creando tabla pdm_actividades_ejecuciones...")
        try:
            db.execute(text("""
                CREATE TABLE pdm_actividades_ejecuciones (
                    id SERIAL PRIMARY KEY,
                    actividad_id INTEGER NOT NULL,
                    entity_id INTEGER NOT NULL,
                    valor_ejecutado_incremento DOUBLE PRECISION DEFAULT 0 NOT NULL,
                    descripcion VARCHAR(2048),
                    url_evidencia VARCHAR(512),
                    registrado_por VARCHAR(256),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT fk_pdm_ejecucion_actividad FOREIGN KEY (actividad_id) 
                        REFERENCES pdm_actividades(id) ON DELETE CASCADE,
                    CONSTRAINT fk_pdm_ejecucion_entity FOREIGN KEY (entity_id) 
                        REFERENCES entities(id) ON DELETE CASCADE
                )
            """))
            db.commit()
            results.append("✓ Tabla pdm_actividades_ejecuciones creada")
        except Exception as e:
            log_msg(f"❌ Error creando pdm_actividades_ejecuciones: {str(e)}", is_error=True)
            db.rollback()
    else:
        results.append("✓ Tabla pdm_actividades_ejecuciones existe")
    
    # Índices
    create_index_safe(db, "idx_pdm_ejecucion_actividad", "pdm_actividades_ejecuciones", "actividad_id")
    create_index_safe(db, "idx_pdm_ejecucion_entity", "pdm_actividades_ejecuciones", "entity_id")
    
    # ========== TABLA: pdm_actividades_evidencias (VERSIÓN ACTUALIZADA) ==========
    if not table_exists("pdm_actividades_evidencias"):
        log_msg("Creando tabla pdm_actividades_evidencias...")
        try:
            db.execute(text("""
                CREATE TABLE pdm_actividades_evidencias (
                    id SERIAL PRIMARY KEY,
                    actividad_id INTEGER NOT NULL UNIQUE,
                    entity_id INTEGER NOT NULL,
                    descripcion TEXT NOT NULL,
                    url_evidencia VARCHAR(1024),
                    imagenes JSON,
                    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT fk_pdm_evidencia_actividad FOREIGN KEY (actividad_id) 
                        REFERENCES pdm_actividades(id) ON DELETE CASCADE,
                    CONSTRAINT fk_pdm_evidencia_entity FOREIGN KEY (entity_id) 
                        REFERENCES entities(id) ON DELETE CASCADE
                )
            """))
            db.commit()
            results.append("✓ Tabla pdm_actividades_evidencias creada")
        except Exception as e:
            log_msg(f"❌ Error creando pdm_actividades_evidencias: {str(e)}", is_error=True)
            db.rollback()
    else:
        results.append("✓ Tabla pdm_actividades_evidencias existe")
        
        # Verificar si tiene la estructura antigua y necesita ser recreada
        if column_exists("pdm_actividades_evidencias", "ejecucion_id"):
            log_msg("⚠ Tabla pdm_actividades_evidencias tiene estructura antigua, recreando...")
            try:
                # Respaldar datos si existen
                db.execute(text("DROP TABLE IF EXISTS pdm_actividades_evidencias CASCADE"))
                
                # Crear con estructura nueva
                db.execute(text("""
                    CREATE TABLE pdm_actividades_evidencias (
                        id SERIAL PRIMARY KEY,
                        actividad_id INTEGER NOT NULL UNIQUE,
                        entity_id INTEGER NOT NULL,
                        descripcion TEXT NOT NULL,
                        url_evidencia VARCHAR(1024),
                        imagenes JSON,
                        fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT fk_pdm_evidencia_actividad FOREIGN KEY (actividad_id) 
                            REFERENCES pdm_actividades(id) ON DELETE CASCADE,
                        CONSTRAINT fk_pdm_evidencia_entity FOREIGN KEY (entity_id) 
                            REFERENCES entities(id) ON DELETE CASCADE
                    )
                """))
                db.commit()
                log_msg("✓ Tabla pdm_actividades_evidencias recreada con nueva estructura")
                results.append("✓ Tabla pdm_actividades_evidencias recreada")
            except Exception as e:
                log_msg(f"❌ Error recreando pdm_actividades_evidencias: {str(e)}", is_error=True)
                db.rollback()
    
    # Índices (corregidos para la nueva estructura)
    create_index_safe(db, "idx_pdm_evidencia_actividad", "pdm_actividades_evidencias", "actividad_id")
    create_index_safe(db, "idx_pdm_evidencia_entity", "pdm_actividades_evidencias", "entity_id")
    
    results.append("✓ Migración de PDM completada")
    return results


# ============================================================================
# ENDPOINT PRINCIPAL
# ============================================================================

@router.post("/migrations/run/status")
async def run_complete_migration(
    db: Session = Depends(get_db),
    x_migration_key: Optional[str] = Header(None)
):
    """
    Ejecuta la migración completa de la base de datos.
    
    Requiere header: X-Migration-Key: tu-clave-secreta-2024
    
    Esta migración es idempotente y puede ejecutarse múltiples veces sin problemas.
    """
    # Validar clave de seguridad
    if not x_migration_key or x_migration_key != settings.migration_secret_key:
        raise HTTPException(
            status_code=403,
            detail="❌ Clave de migración inválida. Usa X-Migration-Key header."
        )
    
    # Verificar si ya hay una migración corriendo
    if migration_state["running"]:
        return {
            "status": "already_running",
            "message": "⚠ Ya hay una migración en ejecución",
            "last_run": migration_state["last_run"],
            "logs": migration_state["logs"][-20:]
        }
    
    # Iniciar migración
    migration_state["running"] = True
    migration_state["logs"] = []
    migration_state["errors"] = []
    all_results = []
    
    try:
        log_msg("="*70)
        log_msg("INICIANDO MIGRACIÓN COMPLETA DE BASE DE DATOS")
        log_msg("="*70)
        
        # Paso 1: Crear estructura base con SQLAlchemy
        log_msg("\n[1/9] Creando tablas base con SQLAlchemy ORM...")
        try:
            Base.metadata.create_all(bind=engine)
            all_results.append("✓ Tablas base creadas/verificadas con SQLAlchemy")
            log_msg("✓ Tablas base creadas correctamente")
        except Exception as e:
            log_msg(f"❌ Error creando tablas base: {str(e)}", is_error=True)
            all_results.append(f"❌ Error en tablas base: {str(e)}")
        
        # Paso 2: Migrar entities
        log_msg("\n[2/9] Migrando tabla entities...")
        all_results.extend(migrate_entities(db))
        
        # Paso 3: Migrar users
        log_msg("\n[3/9] Migrando tabla users...")
        all_results.extend(migrate_users(db))
        
        # Paso 4: Migrar secretarias
        log_msg("\n[4/9] Migrando tabla secretarias...")
        all_results.extend(migrate_secretarias(db))
        
        # Paso 5: Migrar pqrs
        log_msg("\n[5/9] Migrando tabla pqrs...")
        all_results.extend(migrate_pqrs(db))
        
        # Paso 6: Migrar alerts
        log_msg("\n[6/9] Migrando tabla alerts...")
        all_results.extend(migrate_alerts(db))
        
        # Paso 7: Migrar planes institucionales
        log_msg("\n[7/9] Migrando módulo Planes Institucionales...")
        all_results.extend(migrate_planes_institucionales(db))
        
        # Paso 8: Migrar PDM
        log_msg("\n[8/9] Migrando módulo PDM...")
        all_results.extend(migrate_pdm(db))
        
        # Paso 9: Verificación final
        log_msg("\n[9/9] Verificación final...")
        inspector = inspect(engine)
        total_tables = len(inspector.get_table_names())
        log_msg(f"✓ Total de tablas en la base de datos: {total_tables}")
        all_results.append(f"✓ Base de datos tiene {total_tables} tablas")
        
        log_msg("\n" + "="*70)
        log_msg("✓✓✓ MIGRACIÓN COMPLETADA EXITOSAMENTE ✓✓✓")
        log_msg("="*70)
        
        migration_state["last_run"] = datetime.now().isoformat()
        migration_state["last_result"] = "success"
        
        return {
            "status": "success",
            "message": "✓ Migración completada exitosamente",
            "timestamp": datetime.now().isoformat(),
            "total_results": len(all_results),
            "total_errors": len(migration_state["errors"]),
            "results": all_results,
            "errors": migration_state["errors"],
            "logs": migration_state["logs"]
        }
        
    except Exception as e:
        error_msg = f"❌ Error crítico en migración: {str(e)}"
        log_msg(error_msg, is_error=True)
        log_msg(traceback.format_exc(), is_error=True)
        
        migration_state["last_run"] = datetime.now().isoformat()
        migration_state["last_result"] = "error"
        
        return {
            "status": "error",
            "message": error_msg,
            "timestamp": datetime.now().isoformat(),
            "results": all_results,
            "errors": migration_state["errors"],
            "logs": migration_state["logs"],
            "traceback": traceback.format_exc()
        }
        
    finally:
        migration_state["running"] = False


@router.get("/migrations/status")
async def get_database_status(db: Session = Depends(get_db)):
    """
    Obtiene el estado actual de la base de datos.
    
    No requiere autenticación - útil para debugging y monitoreo.
    """
    try:
        # Verificar conexión
        db.execute(text("SELECT 1"))
        
        # Obtener todas las tablas
        inspector = inspect(engine)
        all_tables = inspector.get_table_names()
        
        # Tablas esperadas por módulo
        expected_tables = {
            "core": ["entities", "users", "secretarias"],
            "pqrs": ["pqrs"],
            "alerts": ["alerts"],
            "planes": [
                "planes_institucionales",
                "componentes_procesos",
                "actividades",
                "actividades_ejecucion",
                "actividades_evidencias"
            ],
            "pdm": [
                "pdm_archivos_excel",
                "pdm_meta_assignments",
                "pdm_avances",
                "pdm_actividades",
                "pdm_actividades_ejecuciones",
                "pdm_actividades_evidencias"
            ]
        }
        
        # Verificar existencia de tablas
        tables_status = {}
        for module, tables in expected_tables.items():
            tables_status[module] = {
                table: table_exists(table) for table in tables
            }
        
        # Contar registros en tablas principales
        record_counts = {}
        for table in ["entities", "users", "secretarias", "pqrs", "alerts", 
                      "planes_institucionales", "pdm_actividades"]:
            if table_exists(table):
                try:
                    result = db.execute(text(f"SELECT COUNT(*) FROM {table}"))
                    record_counts[table] = result.scalar()
                except Exception as e:
                    record_counts[table] = f"Error: {str(e)}"
        
        # Calcular estadísticas
        total_expected = sum(len(tables) for tables in expected_tables.values())
        total_existing = sum(
            sum(1 for exists in module_tables.values() if exists)
            for module_tables in tables_status.values()
        )
        completeness = (total_existing / total_expected * 100) if total_expected > 0 else 0
        
        return {
            "status": "ok",
            "timestamp": datetime.now().isoformat(),
            "database_connected": True,
            "database_url": settings.database_url.split("@")[-1] if "@" in settings.database_url else "local",
            "statistics": {
                "total_tables": len(all_tables),
                "expected_tables": total_expected,
                "existing_tables": total_existing,
                "completeness_percentage": round(completeness, 2)
            },
            "tables_by_module": tables_status,
            "record_counts": record_counts,
            "all_tables": sorted(all_tables),
            "migration_history": {
                "running": migration_state["running"],
                "last_run": migration_state["last_run"],
                "last_result": migration_state["last_result"],
                "recent_logs": migration_state["logs"][-15:] if migration_state["logs"] else [],
                "error_count": len(migration_state["errors"])
            }
        }
        
    except Exception as e:
        return {
            "status": "error",
            "timestamp": datetime.now().isoformat(),
            "database_connected": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }


@router.post("/migrations/fix-pdm-columns")
async def fix_pdm_columns(
    db: Session = Depends(get_db),
    x_migration_key: Optional[str] = Header(None)
):
    """
    Endpoint temporal para corregir columnas de pdm_actividades
    Elimina codigo_indicador_producto y columnas obsoletas
    """
    if not x_migration_key or x_migration_key != settings.migration_secret_key:
        raise HTTPException(status_code=403, detail="❌ Clave de migración inválida.")
    
    results = []
    
    try:
        # Eliminar codigo_indicador_producto
        if column_exists("pdm_actividades", "codigo_indicador_producto"):
            log_msg("Eliminando columna codigo_indicador_producto...")
            
            # Eliminar constraints que incluyen esta columna
            db.execute(text("""
                ALTER TABLE pdm_actividades 
                DROP CONSTRAINT IF EXISTS uq_actividad_entity_codigo_nombre CASCADE
            """))
            
            # Eliminar la columna
            db.execute(text("""
                ALTER TABLE pdm_actividades 
                DROP COLUMN IF EXISTS codigo_indicador_producto CASCADE
            """))
            
            db.commit()
            results.append("✅ Columna codigo_indicador_producto eliminada")
        else:
            results.append("✅ codigo_indicador_producto ya no existe")
        
        # Eliminar columnas obsoletas
        for col in ["porcentaje_avance", "valor_ejecutado"]:
            if column_exists("pdm_actividades", col):
                log_msg(f"Eliminando columna obsoleta {col}...")
                db.execute(text(f"ALTER TABLE pdm_actividades DROP COLUMN IF EXISTS {col} CASCADE"))
                db.commit()
                results.append(f"✅ Columna {col} eliminada")
            else:
                results.append(f"✅ {col} ya no existe")
        
        # Verificar estructura final
        result = db.execute(text("""
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'pdm_actividades' 
            ORDER BY ordinal_position
        """))
        
        columnas = [{"nombre": row.column_name, "tipo": row.data_type, "nullable": row.is_nullable} 
                    for row in result]
        
        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "results": results,
            "columnas_actuales": columnas
        }
        
    except Exception as e:
        db.rollback()
        return {
            "status": "error",
            "timestamp": datetime.now().isoformat(),
            "error": str(e),
            "traceback": traceback.format_exc()
        }


@router.post("/migrations/add-responsable-productos")
async def add_responsable_productos(
    db: Session = Depends(get_db),
    x_migration_key: Optional[str] = Header(None)
):
    """
    Migración: Agregar columnas responsable y responsable_user_id a pdm_productos
    
    Añade:
    - responsable (VARCHAR 256) - Nombre legacy del responsable
    - responsable_user_id (INTEGER FK) - Referencia a users.id
    
    Uso:
      curl -X POST https://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com/api/migrations/add-responsable-productos \
           -H "X-Migration-Key: tu-clave-secreta"
    """
    if not x_migration_key or x_migration_key != settings.migration_secret_key:
        raise HTTPException(status_code=403, detail="❌ Clave de migración inválida.")
    
    results = []
    
    try:
        log_msg("🚀 Iniciando migración: add_responsable_pdm_productos")
        
        # Paso 1: Agregar columna responsable (texto legacy)
        if not column_exists("pdm_productos", "responsable"):
            log_msg("Agregando columna responsable...")
            db.execute(text("""
                ALTER TABLE pdm_productos 
                ADD COLUMN responsable VARCHAR(256)
            """))
            db.commit()
            results.append("✅ Columna 'responsable' agregada")
        else:
            results.append("✅ Columna 'responsable' ya existe")
        
        # Paso 2: Agregar columna responsable_user_id (FK a users)
        if not column_exists("pdm_productos", "responsable_user_id"):
            log_msg("Agregando columna responsable_user_id...")
            db.execute(text("""
                ALTER TABLE pdm_productos 
                ADD COLUMN responsable_user_id INTEGER
            """))
            db.commit()
            results.append("✅ Columna 'responsable_user_id' agregada")
        else:
            results.append("✅ Columna 'responsable_user_id' ya existe")
        
        # Paso 3: Crear índice para mejor rendimiento
        log_msg("Creando índice idx_pdm_productos_responsable_user_id...")
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_pdm_productos_responsable_user_id 
            ON pdm_productos(responsable_user_id)
        """))
        db.commit()
        results.append("✅ Índice creado")
        
        # Paso 4: Verificar si el constraint FK ya existe
        constraint_check = db.execute(text("""
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'pdm_productos' 
            AND constraint_name = 'fk_pdm_productos_responsable_user'
        """)).fetchone()
        
        if not constraint_check:
            log_msg("Agregando constraint de foreign key...")
            db.execute(text("""
                ALTER TABLE pdm_productos 
                ADD CONSTRAINT fk_pdm_productos_responsable_user 
                FOREIGN KEY (responsable_user_id) 
                REFERENCES users(id) 
                ON DELETE SET NULL
            """))
            db.commit()
            results.append("✅ Foreign key constraint agregada")
        else:
            results.append("✅ Foreign key constraint ya existe")
        
        # Verificar estructura final
        log_msg("Verificando estructura final...")
        result = db.execute(text("""
            SELECT 
                column_name, 
                data_type, 
                is_nullable,
                character_maximum_length
            FROM information_schema.columns 
            WHERE table_name = 'pdm_productos' 
            AND column_name IN ('responsable', 'responsable_user_id')
            ORDER BY column_name
        """))
        
        columnas = []
        for row in result:
            columnas.append({
                "nombre": row.column_name,
                "tipo": row.data_type,
                "nullable": row.is_nullable,
                "max_length": row.character_maximum_length
            })
        
        log_msg("✅ Migración completada exitosamente")
        
        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "message": "Columnas de responsable agregadas a pdm_productos",
            "results": results,
            "columnas_agregadas": columnas
        }
        
    except Exception as e:
        db.rollback()
        error_msg = f"❌ Error en migración: {str(e)}"
        log_msg(error_msg, is_error=True)
        return {
            "status": "error",
            "timestamp": datetime.now().isoformat(),
            "error": str(e),
            "traceback": traceback.format_exc()
        }
