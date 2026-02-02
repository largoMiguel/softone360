"""
Rutas API para gestión de contratos RPS del PDM
✅ VERSIÓN EN MEMORIA - NO GUARDA EN BASE DE DATOS
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from typing import Optional, List
import pandas as pd
from io import BytesIO
from datetime import datetime

from app.config.database import get_db
from app.models.entity import Entity
from app.models.user import User, UserRole
from app.utils.auth import get_current_active_user
from pydantic import BaseModel


router = APIRouter(prefix="/pdm/contratos", tags=["PDM Contratos RPS"])


# ============================================
# Schemas
# ============================================

class ContratoRPSResponse(BaseModel):
    no_crp: str
    concepto: Optional[str]
    valor: float
    contratista: Optional[str] = None
    
    class Config:
        from_attributes = True


class UploadContratosResponse(BaseModel):
    mensaje: str
    registros_insertados: int
    registros_actualizados: int
    errores: List[str]
    procesados: int
    contratos_agrupados: int
    contratos: List[ContratoRPSResponse]


# ============================================
# Helpers
# ============================================

def get_entity_or_404(db: Session, slug: str) -> Entity:
    """Obtiene una entidad por slug o retorna 404"""
    entity = db.query(Entity).filter(Entity.slug == slug).first()
    if not entity:
        raise HTTPException(status_code=404, detail=f"Entidad '{slug}' no encontrada")
    return entity


def validar_permisos_carga(current_user: User):
    """Solo admin y superadmin pueden cargar archivos de contratos"""
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPERADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permisos para cargar archivos de contratos"
        )


# ============================================
# Endpoints
# ============================================

@router.post("/{slug}/upload", response_model=UploadContratosResponse)
async def upload_contratos_rps(
    slug: str,
    file: UploadFile = File(...),
    codigo_producto: Optional[str] = None,
    anio: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    ✅ PROCESA archivo Excel de contratos RPS EN MEMORIA (NO guarda en DB).
    
    Columnas esperadas:
    - PRODUCTO: Código del producto PDM
    - NO CRP: Número del CRP (agrupador)
    - CONCEPTO: Descripción del contrato
    - VALOR: Valor del contrato
    - AÑO (opcional): Año fiscal
    - CONTRATISTA (opcional): Nombre del contratista
    
    Query params opcionales:
    - codigo_producto: Filtrar solo contratos de un producto específico
    - anio: Filtrar solo contratos de un año específico
    """
    entity = get_entity_or_404(db, slug)
    validar_permisos_carga(current_user)
    
    # Validar extensión
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo debe ser Excel (.xlsx, .xls) o CSV (.csv)"
        )
    
    try:
        # Leer archivo
        contents = await file.read()
        
        if file.filename.endswith('.csv'):
            df = pd.read_csv(BytesIO(contents), encoding='utf-8')
        else:
            # Leer Excel sin encabezados primero para detectar dónde están
            df_raw = pd.read_excel(BytesIO(contents), header=None)
            
            # Buscar la fila que contiene los encabezados reales
            header_row = None
            for idx, row in df_raw.iterrows():
                row_str = ' '.join([str(x).upper() for x in row if pd.notna(x)])
                # Buscar fila que contenga palabras clave de encabezados
                if any(keyword in row_str for keyword in ['CRP', 'PRODUCTO', 'VALOR', 'CONCEPTO', 'CDP']):
                    header_row = idx
                    print(f"✅ Encabezados encontrados en fila {idx}: {row.tolist()}")
                    break
            
            if header_row is None:
                # Si no encontramos encabezados, asumir primera fila
                header_row = 0
            
            # Releer el archivo usando la fila correcta como encabezados
            df = pd.read_excel(BytesIO(contents), header=header_row)
        
        print(f"📊 Archivo cargado: {len(df)} filas")
        print(f"📋 Columnas originales: {df.columns.tolist()}")
        
        # Normalizar nombres de columnas (quitar espacios extras, mayúsculas, guiones bajos)
        df.columns = df.columns.str.strip().str.upper().str.replace(r'\s+', ' ', regex=True)
        
        # ✅ ELIMINAR COLUMNAS DUPLICADAS (tomar la primera ocurrencia)
        if df.columns.duplicated().any():
            print(f"⚠️ Columnas duplicadas detectadas: {df.columns[df.columns.duplicated()].tolist()}")
            df = df.loc[:, ~df.columns.duplicated()].copy()
            print(f"✅ Columnas duplicadas eliminadas")
        
        # ✅ RESETEAR ÍNDICE para evitar problemas con índices duplicados
        df = df.reset_index(drop=True)
        
        print(f"📋 Columnas normalizadas: {df.columns.tolist()}")
        
        # Primero, mostrar muestra de datos para debugging
        if len(df) > 0:
            print(f"🔍 Muestra primera fila: {df.iloc[0].to_dict()}")
        
        # ✅ SELECCIONAR COLUMNAS EXACTAS - Priorizar nombres exactos sobre variaciones
        columnas_requeridas = {
            'PRODUCTO': 'PRODUCTO',  # Usar PRODUCTO exacto, NO CÓDIGO
            'NO CRP': None,
            'VALOR': 'VALOR'
        }
        
        # Para NO CRP, buscar en orden de prioridad (NO CRP primero, NO CPC)
        crp_variaciones = ['NO CRP', 'NO_CRP', 'CRP', 'NUMERO CRP', 'NRO CRP', 'N° CRP']
        for var in crp_variaciones:
            if var in df.columns:
                columnas_requeridas['NO CRP'] = var
                break
        
        # Si NO CRP no se encontró, intentar con CDP como fallback
        if columnas_requeridas['NO CRP'] is None:
            cdp_variaciones = ['NO CDP', 'NO_CDP', 'CDP']
            for var in cdp_variaciones:
                if var in df.columns:
                    columnas_requeridas['NO CRP'] = var
                    print(f"⚠️ Usando '{var}' como NO CRP (no se encontró CPC)")
                    break
        
        # Validar que se encontraron todas
        columnas_faltantes = [k for k, v in columnas_requeridas.items() if v is None]
        if columnas_faltantes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Columnas faltantes: {', '.join(columnas_faltantes)}. Columnas disponibles: {', '.join(df.columns.tolist())}"
            )
        
        print(f"✅ Columnas seleccionadas: {columnas_requeridas}")
        
        # Seleccionar SOLO las columnas que necesitamos (+ opcionales si existen)
        columnas_a_usar = list(columnas_requeridas.values())
        
        # Agregar columnas opcionales si existen
        if 'CONCEPTO' in df.columns:
            columnas_a_usar.append('CONCEPTO')
        if 'CONTRATISTA' in df.columns:
            columnas_a_usar.append('CONTRATISTA')
        elif 'NOMBRE' in df.columns:
            columnas_a_usar.append('NOMBRE')
        if 'AÑO' in df.columns or 'ANIO' in df.columns:
            columnas_a_usar.append('AÑO' if 'AÑO' in df.columns else 'ANIO')
        
        # Seleccionar solo esas columnas
        df = df[columnas_a_usar].copy()
        
        # Renombrar al estándar
        rename_dict = {v: k for k, v in columnas_requeridas.items() if v != k}
        if 'NOMBRE' in df.columns and 'CONTRATISTA' not in df.columns:
            rename_dict['NOMBRE'] = 'CONTRATISTA'
        if 'ANIO' in df.columns:
            rename_dict['ANIO'] = 'AÑO'
        
        df = df.rename(columns=rename_dict)
        
        # ✅ RESETEAR ÍNDICE
        df = df.reset_index(drop=True)
        
        print(f"📋 Columnas finales: {df.columns.tolist()}")
        
        # Limpiar datos
        df = df.dropna(subset=['PRODUCTO', 'NO CRP', 'VALOR'])
        
        # Limpiar PRODUCTO: convertir a número primero, luego a int, luego a string
        # Esto maneja correctamente tanto "4599031" como "4599031.0" como "A1119"
        def limpiar_producto(val):
            try:
                # Intentar convertir a número y luego a int para eliminar decimales
                num = pd.to_numeric(val, errors='coerce')
                if pd.notna(num):
                    return str(int(num))
                else:
                    # Si no es número, retornar como string limpio
                    return str(val).strip().upper()
            except:
                return str(val).strip().upper()
        
        df['PRODUCTO'] = df['PRODUCTO'].apply(limpiar_producto)
        df['NO CRP'] = pd.to_numeric(df['NO CRP'], errors='coerce').fillna(0).astype(int).astype(str)
        df['VALOR'] = pd.to_numeric(df['VALOR'], errors='coerce').fillna(0)
        
        # Detectar año: prioridad query param > columna AÑO > año actual
        if anio:
            df['AÑO'] = anio
        elif 'AÑO' not in df.columns and 'ANIO' not in df.columns:
            df['AÑO'] = datetime.now().year
        else:
            col_anio = 'AÑO' if 'AÑO' in df.columns else 'ANIO'
            df['AÑO'] = pd.to_numeric(df[col_anio], errors='coerce').fillna(datetime.now().year).astype(int)
        
        print(f"✅ Datos limpios: {len(df)} filas válidas")
        
        # Obtener productos únicos de forma segura
        try:
            productos_col = df['PRODUCTO']
            productos_unicos = sorted(productos_col.unique().tolist())[:20]
            print(f"📊 Productos únicos en archivo: {productos_unicos}")
        except Exception as e:
            print(f"⚠️ Error obteniendo productos únicos: {e}")
            productos_unicos = []
        
        # ✅ FILTRAR por año (usar el año del modal si se especifica, si no usar todos)
        if anio:
            df_antes_filtro = len(df)
            df = df[df['AÑO'] == anio].copy()
            print(f"🔍 Filtrado por año {anio}: {len(df)} de {df_antes_filtro} filas")
            
            if len(df) == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"No se encontraron registros para el año {anio}"
                )
        
        # ✅ FILTRAR por producto si se especifica (comparación flexible)
        if codigo_producto:
            codigo_producto_limpio = str(codigo_producto).strip().upper()
            
            # Obtener productos disponibles de forma segura
            try:
                productos_disponibles = sorted(df['PRODUCTO'].unique().tolist())
            except Exception as e:
                print(f"⚠️ Error obteniendo productos disponibles: {e}")
                productos_disponibles = []
            
            print(f"🔍 Buscando producto '{codigo_producto_limpio}'")
            print(f"📋 Productos disponibles después de filtrar por año: {productos_disponibles[:20]}")
            
            df_antes_filtro_producto = len(df)
            df = df[df['PRODUCTO'] == codigo_producto_limpio]
            
            print(f"✅ Filtrado por producto '{codigo_producto_limpio}': {len(df)} de {df_antes_filtro_producto} filas")
            
            if len(df) == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"No se encontraron registros para el producto '{codigo_producto_limpio}'. Productos disponibles: {', '.join(productos_disponibles[:10])}"
                )
        
        registros_procesados = len(df)
        
        # Columnas opcionales (después del filtrado)
        if 'CONCEPTO' in df.columns:
            df['CONCEPTO'] = df['CONCEPTO'].fillna('').astype(str)
        else:
            df['CONCEPTO'] = ''
            
        if 'CONTRATISTA' in df.columns:
            df['CONTRATISTA'] = df['CONTRATISTA'].fillna('').astype(str)
        else:
            df['CONTRATISTA'] = ''
        
        # Agrupar por PRODUCTO + NO CRP + AÑO (sumar valores del mismo CRP)
        df_agrupado = df.groupby(['PRODUCTO', 'NO CRP', 'AÑO']).agg({
            'VALOR': 'sum',
            'CONCEPTO': 'first',  # Tomar el primero
            'CONTRATISTA': 'first'
        }).reset_index()
        
        print(f"📦 Después de agrupar por CRP: {len(df_agrupado)} registros únicos")
        
        # Convertir a lista de contratos
        contratos_lista = []
        for _, row in df_agrupado.iterrows():
            contratos_lista.append(ContratoRPSResponse(
                no_crp=str(row['NO CRP']),
                concepto=str(row['CONCEPTO']) if row['CONCEPTO'] else None,
                valor=float(row['VALOR']),
                contratista=str(row['CONTRATISTA']) if row['CONTRATISTA'] else None
            ))
        
        return UploadContratosResponse(
            mensaje=f"✅ Contratos RPS procesados exitosamente (filtros: producto={codigo_producto or 'todos'}, año={anio or 'todos'})",
            registros_insertados=0,
            registros_actualizados=0,
            errores=[],
            procesados=registros_procesados,
            contratos_agrupados=len(contratos_lista),
            contratos=contratos_lista
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error procesando archivo: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error procesando archivo: {str(e)}"
        )
