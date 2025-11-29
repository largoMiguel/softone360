"""
Rutas para gestionar la ejecución presupuestal del PDM.
Permite cargar Excel de ejecución de gastos y consultar por producto.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from typing import List, Optional, Tuple, Dict
import pandas as pd
import io
import unicodedata
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


def _normalize_text(s: str) -> str:
    if s is None:
        return ""
    s = str(s).strip()
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")  # quitar acentos
    s = s.replace(".", " ").replace(",", " ")
    s = re.sub(r"\s+", " ", s)
    return s.upper()


def _build_column_mapping(columns: List[str]) -> Tuple[Dict[str, str], List[str]]:
    """
    Crea un mapeo de nombres normalizados -> nombre real de columna.
    Retorna (mapping, normalized_columns)
    """
    mapping = {}
    normalized_cols = []
    for c in columns:
        norm = _normalize_text(c)
        mapping[norm] = c
        normalized_cols.append(norm)
    return mapping, normalized_cols


def _try_read_dataframe(contents: bytes, filename: str):
    """Lee el archivo intentando diferentes offsets de cabecera."""
    readers = []
    if filename.endswith('.csv'):
        readers = [
            lambda: pd.read_csv(io.BytesIO(contents), header=0, sep=None, engine='python', encoding='utf-8-sig'),
            lambda: pd.read_csv(io.BytesIO(contents), header=1, sep=None, engine='python', encoding='utf-8-sig'),
        ]
    else:
        readers = [
            lambda: pd.read_excel(io.BytesIO(contents), header=0),
            lambda: pd.read_excel(io.BytesIO(contents), header=1),
        ]

    errors = []
    for read in readers:
        try:
            return read(), None
        except Exception as e:
            errors.append(str(e))
    return None, errors


@router.post("/upload", response_model=PDMEjecucionUploadResponse)
async def upload_ejecucion_excel(
    file: UploadFile = File(...),
    anio: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Carga un archivo Excel/CSV de ejecución presupuestal para un año específico.
    
    Si se proporciona el año, elimina los registros existentes de ese año antes de insertar.
    
    Filtra solo las filas donde:
    - ULT. NIVEL = "Si"
    - SECTOR tiene valor (no vacío)
    
    Extrae el código del producto de la columna PRODUCTO (ej: "4003018 - Alcantarillados construidos")
    """
    # Convertir anio a int si se proporciona
    anio_int = None
    if anio:
        try:
            anio_int = int(anio)
            print(f"📊 Upload ejecución - file: {file.filename if file else 'None'}, anio: {anio_int}")
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Parámetro 'anio' inválido: '{anio}'. Debe ser un número entero."
            )
    else:
        print(f"📊 Upload ejecución - file: {file.filename if file else 'None'}, anio: None")
    
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo debe ser CSV o Excel (.xlsx, .xls)"
        )
    
    try:
        # Leer el archivo a memoria
        contents = await file.read()

        # Intentar diferentes cabeceras
        df, read_errors = _try_read_dataframe(contents, file.filename)
        if df is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No se pudo leer el archivo: {' | '.join(read_errors or [])}"
            )

        # Construir normalización y mapa de columnas
        required_norm = [
            "ULT NIVEL", "SECTOR", "PRODUCTO", "DESCRIPCION FTE",
            "PTO INICIAL", "ADICION", "REDUCCION", "CREDITO",
            "CONTRACREDITO", "PTO DEFINITIVO", "PAGOS"
        ]

        # Aliases permitidos
        alias = {
            "ULTIMO NIVEL": "ULT NIVEL",
            "ULT. NIVEL": "ULT NIVEL",
            "DESCRIPCION FTE": "DESCRIPCION FTE",
            "DESCRIPCION FTE ": "DESCRIPCION FTE",
            "DESCRIPCION FUENTE": "DESCRIPCION FTE",
            "DESCRIPCION DE LA FUENTE": "DESCRIPCION FTE",
            "PTO. INICIAL": "PTO INICIAL",
            "PRESUPUESTO INICIAL": "PTO INICIAL",
            "ADICION": "ADICION",
            "ADICIONES": "ADICION",
            "REDUCCION": "REDUCCION",
            "REDUCCIONES": "REDUCCION",
            "CREDITO": "CREDITO",
            "CONTRACREDITO": "CONTRACREDITO",
            "PTO. DEFINITIVO": "PTO DEFINITIVO",
            "PRESUPUESTO DEFINITIVO": "PTO DEFINITIVO",
            "PAGOS": "PAGOS",
        }

        def build_renamed(_df: pd.DataFrame) -> pd.DataFrame:
            mapping, normalized_cols = _build_column_mapping(list(_df.columns))
            rename_to_canonical = {}
            for norm_col in normalized_cols:
                base = alias.get(norm_col, norm_col)
                rename_to_canonical[mapping[norm_col]] = base
            return _df.rename(columns=rename_to_canonical)

        df_renamed = build_renamed(df)
        try:
            print("🧭 Columnas detectadas (normalizadas):",
                  [ _normalize_text(c) for c in list(df_renamed.columns) ])
        except Exception:
            pass

        # Verificar columnas requeridas, y si faltan, intentar detectar fila de cabecera
        present_norm = [alias.get(x, x) for x in set(df_renamed.columns.map(_normalize_text))]
        faltantes = [c for c in required_norm if c not in present_norm]
        if faltantes:
            # Intentar lectura sin cabecera y buscar la fila correcta
            try:
                if file.filename.endswith('.csv'):
                    df_raw = pd.read_csv(io.BytesIO(contents), header=None, sep=None, engine='python', encoding='utf-8-sig')
                else:
                    df_raw = pd.read_excel(io.BytesIO(contents), header=None)

                header_idx = None
                max_scan = min(30, len(df_raw))
                required_set = set(required_norm)
                for i in range(max_scan):
                    row_vals = [ _normalize_text(v) for v in list(df_raw.iloc[i].astype(str).fillna('')) ]
                    row_set = set(alias.get(x, x) for x in row_vals)
                    if required_set.issubset(row_set):
                        header_idx = i
                        break
                if header_idx is not None:
                    cols = list(df_raw.iloc[header_idx].astype(str).fillna(''))
                    df = df_raw.iloc[header_idx+1:].copy()
                    df.columns = cols
                    df_renamed = build_renamed(df)
                    present_norm = [alias.get(x, x) for x in set(df_renamed.columns.map(_normalize_text))]
                    faltantes = [c for c in required_norm if c not in present_norm]
                # si sigue faltando, proceder al error
            except Exception:
                pass

        if faltantes:
            disponibles = ", ".join([str(c) for c in df.columns])
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Columnas faltantes en el archivo: {', '.join(faltantes)}. Disponibles: {disponibles}"
            )
        
        # Asegurar columnas opcionales si existen con algún alias
        has_dependencia = any(_normalize_text(c) == "DEPENDENCIA" for c in df_renamed.columns)
        has_bpin = any(_normalize_text(c) == "BPIN" for c in df_renamed.columns)
        
        # Filtrar filas según criterios
        df_filtrado = df_renamed[
            (df_renamed['ULT NIVEL'].astype(str).str.strip().str.upper().isin(['SI', 'SÍ'])) &
            (df_renamed['SECTOR'].notna()) &
            (df_renamed['SECTOR'].astype(str).str.strip() != '')
        ].copy()
        try:
            # Métricas rápidas para depuración
            total_definitivo = df_filtrado['PTO DEFINITIVO'].apply(limpiar_numero).sum()
            print(f"📈 Registros filtrados: {len(df_filtrado)} | Suma PTO DEFINITIVO: {total_definitivo}")
        except Exception:
            pass
        
        registros_procesados = len(df_filtrado)
        registros_insertados = 0
        registros_actualizados = 0
        errores = []
        
        # Eliminar registros existentes según el año proporcionado
        if anio_int:
            # Si se proporciona año, eliminar solo los de ese año
            deleted_count = db.query(PDMEjecucionPresupuestal).filter(
                PDMEjecucionPresupuestal.entity_id == current_user.entity_id,
                PDMEjecucionPresupuestal.anio == anio_int
            ).delete()
            print(f"🗑️ Eliminados {deleted_count} registros de ejecución del año {anio_int} para entity_id={current_user.entity_id}")
        else:
            # Si no se proporciona año, eliminar todos los de la entidad (comportamiento anterior)
            deleted_count = db.query(PDMEjecucionPresupuestal).filter(
                PDMEjecucionPresupuestal.entity_id == current_user.entity_id
            ).delete()
            print(f"🗑️ Eliminados {deleted_count} registros previos de ejecución presupuestal para entity_id={current_user.entity_id}")
        
        # IMPORTANTE: Hacer commit del DELETE antes de los INSERT para evitar conflictos
        db.commit()
        
        # Diccionario para evitar duplicados dentro del mismo archivo
        # Clave: (codigo_producto, descripcion_fte)
        registros_unicos = {}
        
        # Procesar cada fila filtrada
        for idx, row in df_filtrado.iterrows():
            try:
                # Extraer código del producto
                codigo_producto = extraer_codigo_producto(row['PRODUCTO'])
                
                if not codigo_producto:
                    errores.append(f"Fila {idx + 2}: No se pudo extraer código de producto de '{row['PRODUCTO']}'")
                    continue
                
                descripcion_fte = str(row.get('DESCRIPCION FTE', '')).strip()
                
                # Crear clave única
                clave = (codigo_producto, descripcion_fte)
                
                # Si ya existe esta combinación en el archivo, actualizar valores
                if clave in registros_unicos:
                    # Sumar los valores (agregación)
                    registros_unicos[clave]['pto_inicial'] += limpiar_numero(row['PTO INICIAL'])
                    registros_unicos[clave]['adicion'] += limpiar_numero(row['ADICION'])
                    registros_unicos[clave]['reduccion'] += limpiar_numero(row['REDUCCION'])
                    registros_unicos[clave]['credito'] += limpiar_numero(row['CREDITO'])
                    registros_unicos[clave]['contracredito'] += limpiar_numero(row['CONTRACREDITO'])
                    registros_unicos[clave]['pto_definitivo'] += limpiar_numero(row['PTO DEFINITIVO'])
                    registros_unicos[clave]['pagos'] += limpiar_numero(row['PAGOS'])
                    registros_actualizados += 1
                else:
                    # Primera vez que aparece esta combinación
                    pto_inicial = limpiar_numero(row['PTO INICIAL'])
                    adicion = limpiar_numero(row['ADICION'])
                    reduccion = limpiar_numero(row['REDUCCION'])
                    credito = limpiar_numero(row['CREDITO'])
                    contracredito = limpiar_numero(row['CONTRACREDITO'])
                    pto_definitivo = limpiar_numero(row['PTO DEFINITIVO'])
                    
                    # Si pto_definitivo es 0 pero hay otros valores, calcularlo
                    if pto_definitivo == 0 and (pto_inicial != 0 or adicion != 0 or reduccion != 0 or credito != 0 or contracredito != 0):
                        pto_definitivo = pto_inicial + adicion - reduccion + credito - contracredito
                    
                    registros_unicos[clave] = {
                        'codigo_producto': codigo_producto,
                        'descripcion_fte': descripcion_fte,
                        'pto_inicial': pto_inicial,
                        'adicion': adicion,
                        'reduccion': reduccion,
                        'credito': credito,
                        'contracredito': contracredito,
                        'pto_definitivo': pto_definitivo,
                        'pagos': limpiar_numero(row['PAGOS']),
                        'sector': str(row['SECTOR']).strip() if pd.notna(row['SECTOR']) else None,
                        'dependencia': str(row['DEPENDENCIA']).strip() if has_dependencia and pd.notna(row.get('DEPENDENCIA')) else None,
                        'bpin': str(row['BPIN']).strip() if has_bpin and pd.notna(row.get('BPIN')) else None,
                        'anio': anio_int  # Agregar el año al registro
                    }
                
            except Exception as e:
                errores.append(f"Fila {idx + 2}: {str(e)}")
        
        # Ahora insertar los registros únicos
        for clave, datos in registros_unicos.items():
            try:
                ejecucion = PDMEjecucionPresupuestal(
                    entity_id=current_user.entity_id,
                    **datos
                )
                db.add(ejecucion)
                registros_insertados += 1
            except Exception as e:
                errores.append(f"Error insertando {clave}: {str(e)}")
        
        db.commit()
        
        mensaje_anio = f" para el año {anio_int}" if anio_int else ""
        print(f"✅ Insertados {registros_insertados} registros únicos{mensaje_anio}, {registros_actualizados} agregaciones de duplicados")
        
        return PDMEjecucionUploadResponse(
            success=True,
            message=f"Archivo procesado exitosamente{mensaje_anio}. {registros_insertados} registros únicos insertados.",
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
    anio: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Obtiene el resumen de ejecución presupuestal para un producto PDM específico.
    Opcionalmente filtra por año.
    
    Retorna:
    - Lista única de fuentes (DESCRIPCIÓN FTE.)
    - Totales de cada columna presupuestal
    """
    # Construir query base
    query = db.query(PDMEjecucionPresupuestal).filter(
        PDMEjecucionPresupuestal.codigo_producto == codigo_producto,
        PDMEjecucionPresupuestal.entity_id == current_user.entity_id
    )
    
    # Filtrar por año si se proporciona
    if anio:
        query = query.filter(PDMEjecucionPresupuestal.anio == anio)
    
    registros = query.all()
    
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
