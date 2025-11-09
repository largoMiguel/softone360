#!/bin/bash

# ============================================================================
# SCRIPT DE APLICACIÓN DE MIGRACIONES
# Sistema: SOFTONE360
# Descripción: Aplica todas las migraciones pendientes a la base de datos
# ============================================================================

set -e  # Salir si hay algún error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir mensajes
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# ============================================================================
# CONFIGURACIÓN
# ============================================================================

# Detectar si estamos en local o producción
if [ -z "$DATABASE_URL" ]; then
    # Local: usar base de datos de desarrollo
    print_warning "DATABASE_URL no está configurada, usando SQLite local"
    DB_TYPE="sqlite"
    DB_PATH="../backend/pqrs_alcaldia.db"
else
    # Producción: usar PostgreSQL de AWS
    print_info "Usando DATABASE_URL de producción: $DATABASE_URL"
    DB_TYPE="postgresql"
fi

# ============================================================================
# VALIDACIONES PREVIAS
# ============================================================================

print_info "Validando pre-requisitos..."

# Verificar que estamos en el directorio correcto
if [ ! -f "pdm_v2_migration.sql" ]; then
    print_error "No se encontró pdm_v2_migration.sql. Ejecutar desde el directorio migrations/"
    exit 1
fi

if [ "$DB_TYPE" = "postgresql" ]; then
    # Verificar que psql esté instalado
    if ! command -v psql &> /dev/null; then
        print_error "psql no está instalado. Instalar con: brew install postgresql"
        exit 1
    fi
else
    # Para SQLite, verificar que sqlite3 esté instalado
    if ! command -v sqlite3 &> /dev/null; then
        print_error "sqlite3 no está instalado"
        exit 1
    fi
fi

print_success "Pre-requisitos validados"

# ============================================================================
# BACKUP
# ============================================================================

print_info "Creando backup de la base de datos..."

BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

if [ "$DB_TYPE" = "postgresql" ]; then
    BACKUP_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.sql"
    pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
    print_success "Backup creado: $BACKUP_FILE"
else
    BACKUP_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.db"
    cp "$DB_PATH" "$BACKUP_FILE"
    print_success "Backup creado: $BACKUP_FILE"
fi

# ============================================================================
# APLICAR MIGRACIONES
# ============================================================================

print_info "Iniciando aplicación de migraciones..."

apply_migration() {
    local migration_file=$1
    local migration_name=$(basename "$migration_file" .sql)
    
    print_info "Aplicando migración: $migration_name"
    
    if [ "$DB_TYPE" = "postgresql" ]; then
        if psql "$DATABASE_URL" -f "$migration_file" > /dev/null 2>&1; then
            print_success "Migración $migration_name aplicada correctamente"
            return 0
        else
            print_error "Error al aplicar migración $migration_name"
            return 1
        fi
    else
        print_warning "Migraciones de PostgreSQL no se pueden aplicar a SQLite"
        print_info "Saltando: $migration_name"
        return 0
    fi
}

# Lista de migraciones en orden
MIGRATIONS=(
    "pdm_v2_migration.sql"
    "add_constraints.sql"
)

# Aplicar cada migración
FAILED=0
for migration in "${MIGRATIONS[@]}"; do
    if [ -f "$migration" ]; then
        if ! apply_migration "$migration"; then
            FAILED=1
            print_error "La migración $migration falló"
            
            # Preguntar si continuar
            read -p "¿Desea continuar con las siguientes migraciones? (y/n): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                print_warning "Proceso de migración cancelado"
                exit 1
            fi
        fi
    else
        print_warning "Archivo de migración no encontrado: $migration"
    fi
done

# ============================================================================
# VERIFICACIÓN POST-MIGRACIÓN
# ============================================================================

print_info "Verificando estado de la base de datos..."

if [ "$DB_TYPE" = "postgresql" ]; then
    # Verificar tablas PDM V2
    print_info "Verificando tablas PDM V2..."
    
    TABLES_CHECK=$(psql "$DATABASE_URL" -t -c "
        SELECT COUNT(*) 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE 'pdm_%'
    " | tr -d ' ')
    
    print_info "Tablas PDM encontradas: $TABLES_CHECK"
    
    if [ "$TABLES_CHECK" -ge 6 ]; then
        print_success "Todas las tablas PDM V2 están presentes"
    else
        print_warning "Faltan algunas tablas PDM V2 (esperadas: 6, encontradas: $TABLES_CHECK)"
    fi
    
    # Verificar constraints
    print_info "Verificando constraints..."
    CONSTRAINTS_COUNT=$(psql "$DATABASE_URL" -t -c "
        SELECT COUNT(*) 
        FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
        AND table_name LIKE 'pdm_%'
        AND constraint_type = 'CHECK'
    " | tr -d ' ')
    
    print_info "Constraints CHECK encontrados: $CONSTRAINTS_COUNT"
fi

# ============================================================================
# RESUMEN
# ============================================================================

echo ""
echo "============================================================================"
if [ $FAILED -eq 0 ]; then
    print_success "TODAS LAS MIGRACIONES SE APLICARON CORRECTAMENTE"
else
    print_warning "ALGUNAS MIGRACIONES FALLARON - REVISAR LOGS"
fi
echo "============================================================================"
echo ""
print_info "Información del backup:"
print_info "  Archivo: $BACKUP_FILE"
print_info "  Tamaño: $(du -h "$BACKUP_FILE" | cut -f1)"
echo ""

if [ $FAILED -eq 0 ]; then
    print_info "Pasos siguientes:"
    echo "  1. Verificar que el backend inicie correctamente"
    echo "  2. Probar la funcionalidad PDM en el frontend"
    echo "  3. Si todo funciona, el backup puede eliminarse después de unos días"
else
    print_warning "Pasos de recuperación:"
    echo "  1. Revisar los errores en los logs"
    echo "  2. Si es necesario hacer rollback:"
    if [ "$DB_TYPE" = "postgresql" ]; then
        echo "     psql \$DATABASE_URL < $BACKUP_FILE"
    else
        echo "     cp $BACKUP_FILE $DB_PATH"
    fi
fi

echo ""
print_info "Migración completada: $(date)"
