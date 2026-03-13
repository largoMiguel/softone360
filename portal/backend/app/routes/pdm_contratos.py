"""
Rutas API para gestión de contratos RPS del PDM.
Guarda en base de datos. DELETE+INSERT por entidad+año en cada carga.
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
from app.models.pdm_contratos import PDMContratoRPS
from app.utils.auth import get_current_active_user
from pydantic import BaseModel


router = APIRouter(prefix="/pdm/contratos", tags=["PDM Contratos RPS"])


# ============================================
# Schemas
# ============================================

class ContratoRPSResponse(BaseModel):
    id: int
    no_crp: str
    codigo_producto: str
    concepto: Optional[str]
    valor: float
    contratista: Optional[str] = None
    anio: int

    class Config:
        from_attributes = True


class UploadContratosResponse(BaseModel):
    mensaje: str
    registros_insertados: int
    registros_eliminados: int
    errores: List[str]
    procesados: int
    contratos_agrupados: int
    contratos: List[ContratoRPSResponse]


class ResumenContratosResponse(BaseModel):
    contratos: List[ContratoRPSResponse]
    total_contratado: float
    cantidad_contratos: int
    anio: int


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
    anio: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Carga archivo Excel de contratos RPS y GUARDA EN DB.
    DELETE+INSERT por entidad+año: reemplaza todos los contratos del año seleccionado.

    Columnas esperadas:
    - PRODUCTO: Código del producto PDM
    - NO CRP: Número del CRP (agrupador)
    - CONCEPTO: Descripción del contrato
    - VALOR: Valor del contrato
    - AÑO (opcional): Año fiscal (también puede venir como query param)
    - CONTRATISTA (opcional): Nombre del contratista
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
        
        # Determinar año de carga: query param > moda del DataFrame > año actual
        anio_carga = int(anio) if anio else int(df['AÑO'].mode()[0]) if len(df) > 0 else datetime.now().year

        # Filtrar solo registros del año de carga
        df_antes_filtro = len(df)
        df = df[df['AÑO'] == anio_carga].copy()
        print(f"🔍 Filtrado por año {anio_carga}: {len(df)} de {df_antes_filtro} filas")

        if len(df) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No se encontraron registros para el año {anio_carga}"
            )

        registros_procesados = len(df)

        # Columnas opcionales
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
            'CONCEPTO': 'first',
            'CONTRATISTA': 'first'
        }).reset_index()

        print(f"📦 Después de agrupar: {len(df_agrupado)} contratos únicos para año {anio_carga}")

        # ── DELETE: eliminar contratos del mismo año para esta entidad ──
        eliminados = db.query(PDMContratoRPS).filter(
            PDMContratoRPS.entity_id == entity.id,
            PDMContratoRPS.anio == anio_carga
        ).delete()
        db.flush()
        print(f"🗑️ Eliminados {eliminados} contratos previos (entity_id={entity.id}, año={anio_carga})")

        # ── INSERT: insertar los nuevos contratos ──
        nuevos = []
        for _, row in df_agrupado.iterrows():
            contrato = PDMContratoRPS(
                entity_id=entity.id,
                codigo_producto=str(row['PRODUCTO']),
                no_crp=str(row['NO CRP']),
                concepto=str(row['CONCEPTO']) if row['CONCEPTO'] else None,
                valor=float(row['VALOR']),
                contratista=str(row['CONTRATISTA']) if row['CONTRATISTA'] else None,
                anio=anio_carga
            )
            db.add(contrato)
            nuevos.append(contrato)

        db.commit()
        for c in nuevos:
            db.refresh(c)

        print(f"✅ {len(nuevos)} contratos guardados en DB (entity_id={entity.id}, año={anio_carga})")

        contratos_response = [
            ContratoRPSResponse(
                id=c.id,
                no_crp=c.no_crp,
                codigo_producto=c.codigo_producto,
                concepto=c.concepto,
                valor=float(c.valor),
                contratista=c.contratista,
                anio=c.anio
            ) for c in nuevos
        ]

        return UploadContratosResponse(
            mensaje=f"✅ {len(nuevos)} contratos RPS guardados para año {anio_carga}",
            registros_insertados=len(nuevos),
            registros_eliminados=eliminados,
            errores=[],
            procesados=registros_procesados,
            contratos_agrupados=len(nuevos),
            contratos=contratos_response
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Error procesando contratos: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error procesando archivo: {str(e)}"
        )


# ============================================
# GET endpoints
# ============================================

@router.get("/{slug}/contratos", response_model=ResumenContratosResponse)
async def get_contratos(
    slug: str,
    anio: Optional[int] = None,
    codigo_producto: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Retorna contratos RPS guardados en DB para la entidad.
    Filtra por año y/o producto.
    """
    entity = get_entity_or_404(db, slug)

    query = db.query(PDMContratoRPS).filter(PDMContratoRPS.entity_id == entity.id)

    if anio:
        query = query.filter(PDMContratoRPS.anio == anio)
    if codigo_producto:
        query = query.filter(PDMContratoRPS.codigo_producto == str(codigo_producto).strip())

    contratos = query.order_by(PDMContratoRPS.codigo_producto, PDMContratoRPS.no_crp).all()

    total = sum(float(c.valor) for c in contratos)
    anio_resp = anio or (contratos[0].anio if contratos else 0)

    return ResumenContratosResponse(
        contratos=[
            ContratoRPSResponse(
                id=c.id,
                no_crp=c.no_crp,
                codigo_producto=c.codigo_producto,
                concepto=c.concepto,
                valor=float(c.valor),
                contratista=c.contratista,
                anio=c.anio
            ) for c in contratos
        ],
        total_contratado=total,
        cantidad_contratos=len(contratos),
        anio=anio_resp
    )


@router.get("/{slug}/anios")
async def get_anios_disponibles(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Retorna los años con contratos cargados para la entidad."""
    entity = get_entity_or_404(db, slug)

    from sqlalchemy import distinct
    anios = db.query(distinct(PDMContratoRPS.anio)).filter(
        PDMContratoRPS.entity_id == entity.id
    ).order_by(PDMContratoRPS.anio.desc()).all()

    return {"anios": [a[0] for a in anios]}
