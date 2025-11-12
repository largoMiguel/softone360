"""
Rutas para gestionar la ejecución presupuestal del PDM.
Permite cargar Excel de ejecución de gastos y consultar por producto.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from typing import List
import pandas as pd
import io
import re
from decimal import Decimal

from app.config.database import get_db
from app.models.pdm_ejecucion import PDMEjecucionPresupuestal
from app.models.user import User
from app.schemas.pdm_ejecucion import (
    PDMEjecucionResponse,
    PDMEjecucionResumen,
    PDMEjecucionUploadResponse
)
from app.utils.auth import get_current_user

router = APIRouter()


def limpiar_numero(valor) -> Decimal:
    """
    Limpia un valor numérico del Excel (puede venir con comas, puntos, comillas).
    Ejemplos:
      "14,430,365,174.00" -> 14430365174.00
      '"150,000,000.00"' -> 150000000.00
    """
    if pd.isna(valor) or valor == '':
        return Decimal('0.00')
    
    # Convertir a string y limpiar
    valor_str = str(valor).strip().replace('"', '').replace(',', '')
    
    try:
        return Decimal(valor_str)
    except:
        return Decimal('0.00')


def extraer_codigo_producto(producto_str: str) -> str:
    """
    Extrae el código del producto de un string como:
    "4003018 - Alcantarillados construidos"
    
    Returns: "4003018"
    """
    if not producto_str or pd.isna(producto_str):
        return ""
    
    # Buscar patrón: número de 7 dígitos seguido de " - "
    match = re.search(r'(\d{7})\s*-', str(producto_str))
    if match:
        return match.group(1)
    return ""


@router.post("/upload", response_model=PDMEjecucionUploadResponse)
async def upload_ejecucion_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Carga un archivo Excel/CSV de ejecución presupuestal.
    
    Filtra solo las filas donde:
    - ULT. NIVEL = "Si"
    - SECTOR tiene valor (no vacío)
    
    Extrae el código del producto de la columna PRODUCTO (ej: "4003018 - Alcantarillados construidos")
    """
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo debe ser CSV o Excel (.xlsx, .xls)"
        )
    
    try:
        # Leer el archivo
        contents = await file.read()
        
        # Determinar el tipo de archivo y leer con pandas
        if file.filename.endswith('.csv'):
            # CSV - puede tener encabezados en múltiples filas
            df = pd.read_csv(io.BytesIO(contents), skiprows=1, low_memory=False)
        else:
            # Excel
            df = pd.read_excel(io.BytesIO(contents), skiprows=1)
        
        # Verificar que las columnas necesarias existan
        columnas_requeridas = [
            'ULT. NIVEL', 'SECTOR', 'PRODUCTO', 'DESCRIPCIÓN FTE.',
            'PTO. INICIAL', 'ADICIÓN', 'REDUCCIÓN', 'CRÉDITO', 
            'CONTRACRÉDITO', 'PTO. DEFINITIVO', 'PAGOS'
        ]
        
        # Normalizar nombres de columnas (eliminar espacios extras)
        df.columns = df.columns.str.strip()
        
        columnas_faltantes = [col for col in columnas_requeridas if col not in df.columns]
        if columnas_faltantes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Columnas faltantes en el archivo: {', '.join(columnas_faltantes)}"
            )
        
        # Filtrar filas según criterios
        df_filtrado = df[
            (df['ULT. NIVEL'].astype(str).str.strip() == 'Si') &
            (df['SECTOR'].notna()) &
            (df['SECTOR'].astype(str).str.strip() != '')
        ].copy()
        
        registros_procesados = len(df_filtrado)
        registros_insertados = 0
        errores = []
        
        # Eliminar registros existentes de esta entidad antes de insertar
        deleted_count = db.query(PDMEjecucionPresupuestal).filter(
            PDMEjecucionPresupuestal.entity_id == current_user.entity_id
        ).delete()
        
        # IMPORTANTE: Hacer commit del DELETE antes de los INSERT para evitar conflictos
        db.commit()
        
        print(f"🗑️ Eliminados {deleted_count} registros previos de ejecución presupuestal para entity_id={current_user.entity_id}")
        
        # Procesar cada fila filtrada
        for idx, row in df_filtrado.iterrows():
            try:
                # Extraer código del producto
                codigo_producto = extraer_codigo_producto(row['PRODUCTO'])
                
                if not codigo_producto:
                    errores.append(f"Fila {idx + 2}: No se pudo extraer código de producto de '{row['PRODUCTO']}'")
                    continue
                
                # Crear registro
                ejecucion = PDMEjecucionPresupuestal(
                    codigo_producto=codigo_producto,
                    descripcion_fte=str(row['DESCRIPCIÓN FTE.']).strip(),
                    pto_inicial=limpiar_numero(row['PTO. INICIAL']),
                    adicion=limpiar_numero(row['ADICIÓN']),
                    reduccion=limpiar_numero(row['REDUCCIÓN']),
                    credito=limpiar_numero(row['CRÉDITO']),
                    contracredito=limpiar_numero(row['CONTRACRÉDITO']),
                    pto_definitivo=limpiar_numero(row['PTO. DEFINITIVO']),
                    pagos=limpiar_numero(row['PAGOS']),
                    sector=str(row['SECTOR']).strip() if pd.notna(row['SECTOR']) else None,
                    dependencia=str(row['DEPENDENCIA']).strip() if 'DEPENDENCIA' in row and pd.notna(row['DEPENDENCIA']) else None,
                    bpin=str(row['BPIN']).strip() if 'BPIN' in row and pd.notna(row['BPIN']) else None,
                    entity_id=current_user.entity_id
                )
                
                db.add(ejecucion)
                registros_insertados += 1
                
            except Exception as e:
                errores.append(f"Fila {idx + 2}: {str(e)}")
        
        db.commit()
        
        return PDMEjecucionUploadResponse(
            success=True,
            message=f"Archivo procesado exitosamente",
            registros_procesados=registros_procesados,
            registros_insertados=registros_insertados,
            errores=errores[:10]  # Limitar a 10 errores para no saturar la respuesta
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error procesando el archivo: {str(e)}"
        )


@router.get("/{codigo_producto}", response_model=PDMEjecucionResumen)
async def get_ejecucion_por_producto(
    codigo_producto: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Obtiene el resumen de ejecución presupuestal para un producto PDM específico.
    
    Retorna:
    - Lista única de fuentes (DESCRIPCIÓN FTE.)
    - Totales de cada columna presupuestal
    """
    # Obtener todos los registros de este producto para esta entidad
    registros = db.query(PDMEjecucionPresupuestal).filter(
        PDMEjecucionPresupuestal.codigo_producto == codigo_producto,
        PDMEjecucionPresupuestal.entity_id == current_user.entity_id
    ).all()
    
    if not registros:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontró información de ejecución para el producto {codigo_producto}"
        )
    
    # Obtener lista única de fuentes
    fuentes = list(set([r.descripcion_fte for r in registros]))
    fuentes.sort()  # Ordenar alfabéticamente
    
    # Calcular totales
    totales = {
        "pto_inicial": sum([r.pto_inicial for r in registros]),
        "adicion": sum([r.adicion for r in registros]),
        "reduccion": sum([r.reduccion for r in registros]),
        "credito": sum([r.credito for r in registros]),
        "contracredito": sum([r.contracredito for r in registros]),
        "pto_definitivo": sum([r.pto_definitivo for r in registros]),
        "pagos": sum([r.pagos for r in registros])
    }
    
    return PDMEjecucionResumen(
        codigo_producto=codigo_producto,
        fuentes=fuentes,
        totales=totales
    )


@router.delete("/{codigo_producto}")
async def delete_ejecucion_producto(
    codigo_producto: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Elimina todos los registros de ejecución de un producto"""
    deleted = db.query(PDMEjecucionPresupuestal).filter(
        PDMEjecucionPresupuestal.codigo_producto == codigo_producto,
        PDMEjecucionPresupuestal.entity_id == current_user.entity_id
    ).delete()
    
    db.commit()
    
    return {"message": f"Eliminados {deleted} registros del producto {codigo_producto}"}
