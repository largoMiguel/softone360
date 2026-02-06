"""
Rutas API para PDM - Versión 2
Alineadas con la estructura del frontend
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload, defer, noload, selectinload
from sqlalchemy import func
from typing import List
from datetime import datetime
import base64
import re
import uuid

from app.config.database import get_db
from app.models.entity import Entity
from app.models.user import User, UserRole
from app.models.secretaria import Secretaria
from app.models.alert import Alert
from app.models.pdm import (
    PdmProducto,
    PdmActividad,
    PdmActividadEvidencia,
    PdmIniciativaSGR
)
from app.schemas import pdm_v2 as schemas
from app.utils.auth import get_current_active_user

# S3 para almacenamiento de imágenes
try:
    import boto3
    from botocore.exceptions import ClientError
    S3_AVAILABLE = True
    S3_BUCKET = 'softone-pdm-evidencias'
    S3_REGION = 'us-east-1'
except ImportError:
    S3_AVAILABLE = False
    print("⚠️ boto3 no disponible - imágenes se guardarán en DB")

router = APIRouter(prefix="/pdm/v2", tags=["PDM V2 "])


# ==============================================
# Helpers
# ==============================================

def subir_imagenes_a_s3(imagenes_base64: List[str], entity_id: int, evidencia_id: int) -> List[str]:
    """
    Sube imágenes Base64 a S3 y retorna lista de URLs.
    
    Args:
        imagenes_base64: Lista de strings Base64
        entity_id: ID de la entidad
        evidencia_id: ID de la evidencia
    
    Returns:
        Lista de URLs S3
    
    Raises:
        HTTPException: Si falla la subida a S3
    """
    if not S3_AVAILABLE:
        raise HTTPException(
            status_code=500,
            detail="Servicio S3 no disponible - contacte al administrador"
        )
    
    if not imagenes_base64:
        return []
    
    try:
        s3_client = boto3.client('s3', region_name=S3_REGION)
        urls = []
        
        for idx, imagen_base64 in enumerate(imagenes_base64):
            # Decodificar Base64
            try:
                imagen_data = base64.b64decode(imagen_base64)
            except Exception as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Imagen {idx + 1} tiene formato Base64 inválido"
                )
            
            # Determinar extensión (por defecto jpg)
            extension = 'jpg'
            if imagen_base64.startswith('/9j/'):
                extension = 'jpg'
            elif imagen_base64.startswith('iVBORw0KGgo'):
                extension = 'png'
            
            # Generar key S3 única
            unique_id = str(uuid.uuid4())[:8]
            s3_key = f"entity_{entity_id}/evidencia_{evidencia_id}/imagen_{idx}_{unique_id}.{extension}"
            
            # Subir a S3
            s3_client.put_object(
                Bucket=S3_BUCKET,
                Key=s3_key,
                Body=imagen_data,
                ContentType=f'image/{extension}',
                CacheControl='max-age=31536000'  # Cache 1 año
            )
            
            # Generar URL pública
            url = f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{s3_key}"
            urls.append(url)
        
        return urls
        
    except ClientError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error subiendo imágenes a S3: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error inesperado: {str(e)}"
        )


def validar_imagenes_evidencia(imagenes: List[str]) -> None:
    """
    Valida las imágenes de evidencia en formato Base64.
    
    Validaciones:
    - Máximo 4 imágenes
    - Cada imagen no debe exceder 3MB en Base64 (~2MB original)
    
    Raises:
        HTTPException: Si alguna validación falla
    """
    if not imagenes:
        return
    
    # Validar cantidad máxima
    if len(imagenes) > 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Máximo 4 imágenes permitidas. Se recibieron {len(imagenes)} imágenes."
        )
    
    # Validar tamaño de cada imagen
    MAX_SIZE_MB = 3  # ~2MB original después de decodificar Base64
    MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024
    
    for idx, imagen_b64 in enumerate(imagenes, 1):
        try:
            # Verificar formato Base64
            if not imagen_b64 or not isinstance(imagen_b64, str):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Imagen {idx}: Formato inválido. Debe ser una cadena Base64."
                )
            
            # Extraer datos Base64 (puede venir con prefijo data:image/...)
            imagen_data = imagen_b64
            if ',' in imagen_b64:
                imagen_data = imagen_b64.split(',', 1)[1]
            
            # ✅ OPTIMIZADO: Calcular tamaño sin decodificar (más rápido)
            tamaño_bytes = len(imagen_data)
            tamaño_mb = tamaño_bytes / (1024 * 1024)
            
            # Validar tamaño
            if tamaño_bytes > MAX_SIZE_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Imagen {idx}: Tamaño excedido ({tamaño_mb:.2f}MB). Máximo permitido: {MAX_SIZE_MB}MB. "
                           f"Por favor, comprime la imagen antes de subirla."
                )
            
            # ✅ OPTIMIZADO: Validar Base64 solo con regex (sin decodificar)
            # Base64 solo contiene: A-Z, a-z, 0-9, +, /, = (padding)
            import re
            if not re.match(r'^[A-Za-z0-9+/]*={0,2}$', imagen_data):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Imagen {idx}: Formato Base64 inválido."
                )
                
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Imagen {idx}: Error al validar - {str(e)}"
            )
    
    print(f"✅ Validación exitosa: {len(imagenes)} imagen(es) válida(s)")


# ==============================================
# Helpers - Original
# ==============================================

def get_entity_or_404(db: Session, slug: str) -> Entity:
    """Obtiene una entidad por slug o retorna 404"""
    entity = db.query(Entity).filter(Entity.slug == slug).first()
    if not entity:
        print(f"❌ Entidad no encontrada con slug: {slug}")
        raise HTTPException(status_code=404, detail=f"Entidad '{slug}' no encontrada")
    print(f"✅ Entidad encontrada: {slug} (id={entity.id}, nombre={entity.name})")
    return entity


def enrich_actividad_with_secretaria(actividad: PdmActividad, db: Session, current_user: User = None) -> dict:
    """Enriquece una actividad con el nombre de la secretaría responsable y lógica de UI
    
    Retorna un dict que mapea:
    - Para ADMIN: muestra nombre de la secretaría
    - Para SECRETARIO: muestra "Tu Secretaría" 
    """
    actividad_dict = schemas.ActividadResponse.model_validate(actividad).model_dump()
    
    # Si hay secretaría asignada, obtener su nombre
    if actividad.responsable_secretaria_id:
        secretaria = db.query(Secretaria).filter(
            Secretaria.id == actividad.responsable_secretaria_id
        ).first()
        
        if secretaria:
            # Determinar qué mostrar según el rol del usuario
            if current_user and current_user.secretaria_id == actividad.responsable_secretaria_id:
                # Si es secretario de esa secretaría, mostrar "Tu Secretaría"
                actividad_dict['responsable_secretaria_nombre'] = f"Tu Secretaría ({secretaria.nombre})"
            else:
                # Si es admin u otro rol, mostrar el nombre completo
                actividad_dict['responsable_secretaria_nombre'] = secretaria.nombre
    
    return actividad_dict


def ensure_user_can_manage_entity(user: User, entity: Entity):
    """Verifica que el usuario pueda gestionar la entidad
    
    Soporta múltiples formas de validación:
    1. Si el usuario es SUPERADMIN, acceso completo
    2. Si user.entity_id coincide con entity.id
    3. Si user.entity está cargada y coincide
    
    IMPORTANTE: Si entity_id es NULL (legacy data), fallback a relación entity.
    Si la relación entity no está cargada (lazy proxy), acepta basándose en que
    probablemente sea el mismo usuario varias veces.
    """
    print(f"\n🔐 VALIDACIÓN DE PERMISOS:")
    print(f"   Usuario: {user.username} (id={user.id}, role={user.role})")
    print(f"   entity_id: {user.entity_id}")
    print(f"   entity type: {type(user.entity)}")
    print(f"   entity is None: {user.entity is None}")
    if user.entity:
        print(f"   entity.id: {user.entity.id}, entity.slug: {user.entity.slug}")
    print(f"   Target entity: {entity.slug} (id={entity.id})")
    
    # Normalizar role a string (puede ser Enum o string)
    user_role = user.role.value if hasattr(user.role, 'value') else str(user.role).lower()
    
    # SUPERADMIN siempre tiene acceso
    if user_role == "superadmin":
        print(f"✅ SUPERADMIN - Acceso permitido\n")
        return
    
    # Validación 1: Si entity_id está definido y coincide
    if user.entity_id is not None:
        if user.entity_id == entity.id:
            print(f"✅ entity_id coincide ({user.entity_id} == {entity.id}) - Acceso permitido\n")
            return
        else:
            print(f"❌ entity_id NO coincide ({user.entity_id} != {entity.id})\n")
            raise HTTPException(
                status_code=403,
                detail="No tiene permisos para gestionar esta entidad"
            )
    
    # Validación 2 (Fallback): Si entity_id es NULL pero entity está cargada
    if user.entity is not None:
        try:
            if user.entity.id == entity.id or (hasattr(user.entity, 'slug') and user.entity.slug == entity.slug):
                print(f"✅ entity relationship coincide - Acceso permitido\n")
                return
        except Exception as e:
            print(f"⚠️ Error al acceder a user.entity: {e}")
    
    # Si nada coincide, denegar acceso
    print(f"❌ ACCESO DENEGADO - No se puede validar permisos (entity_id={user.entity_id}, entity={user.entity})\n")
    raise HTTPException(
        status_code=403,
        detail="No tiene permisos para gestionar esta entidad"
    )


# ==============================================
# Estado de carga del PDM
# ==============================================

@router.get("/{slug}/status", response_model=schemas.PDMLoadStatusResponse)
async def get_pdm_status(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Verifica si hay datos del PDM cargados para esta entidad"""
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)
    
    total_productos = db.query(func.count(PdmProducto.id)).filter(
        PdmProducto.entity_id == entity.id
    ).scalar()
    
    fecha_ultima_carga = None
    if total_productos > 0:
        producto_mas_reciente = db.query(PdmProducto).filter(
            PdmProducto.entity_id == entity.id
        ).order_by(PdmProducto.created_at.desc()).first()
        if producto_mas_reciente:
            fecha_ultima_carga = producto_mas_reciente.created_at
    
    return schemas.PDMLoadStatusResponse(
        tiene_datos=total_productos > 0,
        total_productos=total_productos,
        fecha_ultima_carga=fecha_ultima_carga
    )


# ==============================================
# Carga masiva de datos del Excel
# ==============================================

@router.post("/{slug}/upload", response_model=schemas.PDMLoadStatusResponse)
async def upload_pdm_data(
    slug: str,
    data: schemas.PDMDataUpload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Carga/actualiza productos del Excel PDM. Actualiza existentes y agrega nuevos."""
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)
    
    # Upsert productos (clave: codigo_producto)
    for item in data.productos_plan_indicativo:
        existing = db.query(PdmProducto).filter(
            PdmProducto.entity_id == entity.id,
            PdmProducto.codigo_producto == item.codigo_producto
        ).first()
        
        if existing:
            # Actualizar campos del Excel, preservar responsable_user_id
            for key, value in item.model_dump().items():
                if key != 'responsable_user_id':
                    setattr(existing, key, value)
        else:
            # Insertar nuevo producto
            producto = PdmProducto(entity_id=entity.id, **item.model_dump())
            db.add(producto)
    
    # ✅ NUEVO: Upsert iniciativas SGR (clave: consecutivo)
    # Primero, eliminar todas las iniciativas SGR existentes para esta entidad
    # (ya que el Excel es la fuente de verdad)
    try:
        deleted_sgr = db.query(PdmIniciativaSGR).filter(
            PdmIniciativaSGR.entity_id == entity.id
        ).delete()
        
        # IMPORTANTE: Commit después del DELETE para evitar conflictos con el constraint único
        db.commit()
        
        print(f"🗑️ Eliminadas {deleted_sgr} iniciativas SGR previas para entity_id={entity.id}")
        
        # Luego agregar las nuevas iniciativas SGR
        for item in data.iniciativas_sgr:
            iniciativa = PdmIniciativaSGR(
                entity_id=entity.id,
                **item.model_dump()
            )
            db.add(iniciativa)
    except Exception as e:
        db.rollback()
        print(f"⚠️ Error al procesar iniciativas SGR: {str(e)}")
        # Continuar sin fallar, las iniciativas SGR son opcionales
    
    db.commit()
    
    # Retornar status
    return await get_pdm_status(slug, db, current_user)


# ==============================================
# Obtener todos los datos del PDM
# ==============================================

@router.get("/{slug}/data")
async def get_pdm_data(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtiene los productos del PDM cargados con sus actividades y otros arrays del frontend
    
    OPTIMIZACIÓN: Carga productos en lotes internos de 50 para evitar OOM
    pero retorna todos en una sola respuesta
    
    FILTRADO POR ROL EN BACKEND:
    - ADMIN: ve TODOS los productos
    - SECRETARIO: ve SOLO sus productos asignados
    """
    try:
        print(f"\n📊 GET /pdm/v2/{slug}/data - Usuario: {current_user.username}")
        
        entity = get_entity_or_404(db, slug)
        ensure_user_can_manage_entity(current_user, entity)
        
        # ✅ OPTIMIZADO: Construir query con defer + selectinload para evitar N+1
        query = db.query(PdmProducto).options(
            defer(PdmProducto.presupuesto_2024),
            defer(PdmProducto.presupuesto_2025),
            defer(PdmProducto.presupuesto_2026),
            defer(PdmProducto.presupuesto_2027),
            selectinload(PdmProducto.responsable_secretaria)  # Precarga secretarías
        ).filter(PdmProducto.entity_id == entity.id)
        
        # FILTRADO POR ROL: Secretarios solo ven productos asignados a SU secretaría
        if current_user.role == UserRole.SECRETARIO:
            # ✅ Si el usuario es secretario, ver productos asignados a su secretaría
            if current_user.secretaria_id:
                query = query.filter(PdmProducto.responsable_secretaria_id == current_user.secretaria_id)
                print(f"🔐 Usuario SECRETARIO {current_user.username} (secretaria_id={current_user.secretaria_id}) - filtrando por productos de su secretaría")
            else:
                # Si no tiene secretaría asignada, no ver productos
                query = query.filter(PdmProducto.id == -1)  # Query que no retorna nada
                print(f"🔐 Usuario SECRETARIO {current_user.username} sin secretaría asignada - sin acceso a productos")
        else:
            print(f"👨‍💼 Usuario {current_user.role} - viendo TODOS los productos")
        
        # Ordenar por código para resultados consistentes
        query = query.order_by(PdmProducto.codigo_producto)
        
        # Contar total
        total_productos = query.count()
        print(f"📊 Total de productos en DB: {total_productos}")
        
        # ✅ OPTIMIZACIÓN CRÍTICA: Procesar en lotes de 10 para evitar OOM
        # Cada lote se procesa COMPLETAMENTE antes de cargar el siguiente
        BATCH_SIZE = 10
        productos_validos = []
        lineas_set = set()
        offset = 0
        
        while offset < total_productos:
            # Cargar lote de productos
            batch_productos = query.limit(BATCH_SIZE).offset(offset).all()
            if not batch_productos:
                break
            
            print(f"📦 Procesando lote {offset//BATCH_SIZE + 1}: {len(batch_productos)} productos")
            
            # ✅ OPTIMIZADO: Cargar actividades con selectinload de secretaría (SIN evidencias para no causar OOM)
            codigos_batch = [p.codigo_producto for p in batch_productos]
            actividades_batch = db.query(PdmActividad).options(
                selectinload(PdmActividad.responsable_secretaria)
                # NO cargar evidencias aquí - se cargan bajo demanda para evitar OOM
            ).filter(
                PdmActividad.entity_id == entity.id,
                PdmActividad.codigo_producto.in_(codigos_batch)
            ).all()
            
            # Obtener IDs de actividades con evidencia (eficiente con SQL)
            actividad_ids = [act.id for act in actividades_batch]
            evidencias_existentes = set()
            if actividad_ids:
                evidencias_query = db.query(PdmActividadEvidencia.actividad_id).filter(
                    PdmActividadEvidencia.actividad_id.in_(actividad_ids)
                ).all()
                evidencias_existentes = {ev.actividad_id for ev in evidencias_query}
            
            # Convertir actividades a dict (SIN evidencias completas para evitar OOM)
            actividades_dict_por_codigo = {}
            for act in actividades_batch:
                # Crear dict desde el objeto ORM con TODOS los campos del schema
                act_dict = {
                    'id': act.id,
                    'entity_id': act.entity_id,
                    'codigo_producto': act.codigo_producto,
                    'anio': act.anio,
                    'nombre': act.nombre,
                    'descripcion': act.descripcion,
                    'responsable_secretaria_id': act.responsable_secretaria_id,
                    'responsable_secretaria_nombre': act.responsable_secretaria.nombre if act.responsable_secretaria else None,
                    'fecha_inicio': act.fecha_inicio,
                    'fecha_fin': act.fecha_fin,
                    'meta_ejecutar': act.meta_ejecutar,
                    'estado': act.estado,
                    'tiene_evidencia': act.id in evidencias_existentes,  # ✅ Basado en query eficiente
                    # NO incluir evidencia completa aquí - se carga bajo demanda
                    'created_at': act.created_at,
                    'updated_at': act.updated_at
                }
                
                if act.codigo_producto not in actividades_dict_por_codigo:
                    actividades_dict_por_codigo[act.codigo_producto] = []
                actividades_dict_por_codigo[act.codigo_producto].append(act_dict)
            
            print(f"   ├─ Actividades: {len(actividades_batch)}")
            
            # Procesar productos del lote
            for p in batch_productos:
                try:
                    # Obtener actividades del diccionario (ahora son dicts con tiene_evidencia)
                    actividades_dicts = actividades_dict_por_codigo.get(p.codigo_producto, [])
                    
                    # Convertir dicts a objetos Pydantic para validación
                    actividades_validadas = [schemas.ActividadResponse(**act_dict) for act_dict in actividades_dicts]
                    
                    # Enriquecer con nombre del responsable (SECRETARÍA) si existe
                    responsable_nombre = None
                    
                    # ✅ Mostrar SECRETARÍA como responsable (no usuario)
                    if p.responsable_secretaria_nombre:
                        responsable_nombre = p.responsable_secretaria_nombre
                    
                    # ✅ OPTIMIZACIÓN: No cargar presupuesto_XXXX (JSON pesado), solo totales
                    # Esto reduce payload de ~300KB a ~60KB por cada 100 productos
                    p.presupuesto_2024 = None
                    p.presupuesto_2025 = None
                    p.presupuesto_2026 = None
                    p.presupuesto_2027 = None
                    
                    # Validar el producto SIN las actividades Pydantic (que causarían error)
                    prod_response = schemas.ProductoResponse.model_validate(p)
                    
                    # DESPUÉS de validar, asignar las actividades al response
                    prod_response.actividades = actividades_validadas
                    
                    # Agregar el nombre de la secretaría responsable al response
                    prod_response.responsable_nombre = responsable_nombre

                    # ===============================
                    # Cálculo de avance de metas del cuatrienio
                    # Cada año con programacion_X > 0 se considera una meta.
                    # Una meta anual se cumple si suma(meta_ejecutar de actividades COMPLETADAS del año) >= programacion_X.
                    # Avance general = metas_cumplidas / metas_totales * 100.
                    # ===============================
                    programaciones_por_anio = {
                        2024: p.programacion_2024 or 0,
                        2025: p.programacion_2025 or 0,
                        2026: p.programacion_2026 or 0,
                        2027: p.programacion_2027 or 0,
                    }

                    detalle_metas = []
                    metas_totales = 0
                    metas_cumplidas = 0
                    puede_agregar_actividad_anio = {}

                    actividades_por_anio = {}
                    # Agrupar actividades por año
                    for act_dict in actividades_dicts:
                        anio = act_dict['anio']
                        actividades_por_anio.setdefault(anio, []).append(act_dict)

                    for anio, programado in programaciones_por_anio.items():
                        if programado and programado > 0:
                            metas_totales += 1
                            lista_acts = actividades_por_anio.get(anio, [])
                            ejecutado = sum(a['meta_ejecutar'] for a in lista_acts if a['estado'] == 'COMPLETADA')
                            cumplida = ejecutado >= programado and ejecutado > 0
                            if cumplida:
                                metas_cumplidas += 1
                            detalle_metas.append({
                                "anio": anio,
                                "programado": programado,
                                "ejecutado": ejecutado,
                                "cumplida": cumplida
                            })
                            # Puede agregar actividad si la meta del año no está cumplida
                            puede_agregar_actividad_anio[str(anio)] = not cumplida
                        else:
                            lista_acts = actividades_por_anio.get(anio, [])
                            ejecutado = sum(a['meta_ejecutar'] for a in lista_acts if a['estado'] == 'COMPLETADA') if lista_acts else 0
                            detalle_metas.append({
                                "anio": anio,
                                "programado": 0,
                                "ejecutado": ejecutado,
                                "cumplida": False
                            })
                            puede_agregar_actividad_anio[str(anio)] = False

                    avance_general_porcentaje = (metas_cumplidas / metas_totales * 100) if metas_totales > 0 else 0
                    prod_response.metas_totales = metas_totales
                    prod_response.metas_cumplidas = metas_cumplidas
                    prod_response.avance_general_porcentaje = round(avance_general_porcentaje, 2)
                    prod_response.detalle_metas = detalle_metas
                    prod_response.puede_agregar_actividad_anio = puede_agregar_actividad_anio
                    
                    # ✅ OPTIMIZACIÓN: Calcular porcentaje_ejecucion en backend
                    # Esto evita que el frontend tenga que recalcular para cada producto
                    # Cálculo: promedio de avance por año basado en metas ejecutadas
                    sum_avances_anuales = 0
                    anios_con_meta = 0
                    
                    for detalle in detalle_metas:
                        programado = detalle['programado']
                        ejecutado = detalle['ejecutado']
                        if programado > 0:
                            avance_anual = min(100, (ejecutado / programado) * 100)
                            sum_avances_anuales += avance_anual
                            anios_con_meta += 1
                    
                    porcentaje_ejecucion = (sum_avances_anuales / anios_con_meta) if anios_con_meta > 0 else 0
                    prod_response.porcentaje_ejecucion = round(porcentaje_ejecucion, 2)

                    productos_validos.append(prod_response)
                    
                    # Recolectar líneas estratégicas únicas
                    if p.linea_estrategica:
                        lineas_set.add(p.linea_estrategica)
                    
                except Exception as e:
                    print(f"⚠️ Error validando producto {p.id}: {str(e)}")
                    import traceback
                    traceback.print_exc()
                    continue  # Continuar con el siguiente producto
            
            # Liberar memoria después de procesar el lote
            db.expire_all()
            print(f"   └─ Procesados: {len(batch_productos)} productos del lote")
            
            offset += BATCH_SIZE
        
        print(f"✅ Total productos procesados: {len(productos_validos)}")
        
        # ✅ Cargar iniciativas SGR desde la tabla separada (no del BPIN de productos)
        iniciativas_sgr_db = db.query(PdmIniciativaSGR).filter(
            PdmIniciativaSGR.entity_id == entity.id
        ).all()
        
        # Convertir sets a listas de diccionarios
        lineas_estrategicas = [{"nombre": linea} for linea in sorted(lineas_set)]
        iniciativas_sgr = [
            {
                "consecutivo": i.consecutivo,
                "iniciativa_sgr": i.iniciativa_sgr,
                "recursos_sgr_indicativos": i.recursos_sgr_indicativos,
                "bpin": i.bpin
            }
            for i in iniciativas_sgr_db
        ]
        
        print(f"✅ Retornando {len(productos_validos)} productos + {len(lineas_estrategicas)} líneas + {len(iniciativas_sgr)} iniciativas SGR")
        return schemas.PDMDataResponse(
            productos_plan_indicativo=productos_validos,
            lineas_estrategicas=lineas_estrategicas,
            indicadores_resultado=[],  # Empty for now
            iniciativas_sgr=iniciativas_sgr,
            total_productos=len(productos_validos),
            limit=len(productos_validos),
            offset=0,
            has_more=False
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error en get_pdm_data: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error cargando datos PDM: {str(e)}"
        )


# ==============================================
# Gestión de Actividades
# ==============================================

@router.post("/{slug}/actividades", response_model=schemas.ActividadResponse, status_code=status.HTTP_201_CREATED)
async def create_actividad(
    slug: str,
    actividad: schemas.ActividadCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Crea una nueva actividad para un producto"""
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)
    
    # Convertir fechas ISO string a datetime
    actividad_data = actividad.model_dump()
    if actividad_data.get('fecha_inicio'):
        try:
            actividad_data['fecha_inicio'] = datetime.fromisoformat(actividad_data['fecha_inicio'].replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            actividad_data['fecha_inicio'] = None
    
    if actividad_data.get('fecha_fin'):
        try:
            actividad_data['fecha_fin'] = datetime.fromisoformat(actividad_data['fecha_fin'].replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            actividad_data['fecha_fin'] = None
    
    nueva_actividad = PdmActividad(
        entity_id=entity.id,
        **actividad_data
    )
    db.add(nueva_actividad)
    db.commit()
    db.refresh(nueva_actividad)
    
    # Generar alertas si se asignó a una secretaría
    if nueva_actividad.responsable_secretaria_id:
        secretaria = db.query(Secretaria).filter(Secretaria.id == nueva_actividad.responsable_secretaria_id).first()
        if secretaria:
            # Obtener todos los usuarios de esa secretaría
            usuarios_secretaria = db.query(User).filter(
                User.secretaria_id == secretaria.id,
                User.is_active == True,
                User.entity_id == entity.id
            ).all()
            
            for usuario in usuarios_secretaria:
                alerta = Alert(
                    entity_id=entity.id,
                    recipient_user_id=usuario.id,
                    type="PDM_ACTIVIDAD_ASIGNADA",
                    title=f"Nueva actividad en {secretaria.nombre}: {nueva_actividad.nombre}",
                    message=f"Se ha asignado la actividad '{nueva_actividad.nombre}' a la Secretaría {secretaria.nombre} para el año {nueva_actividad.anio}.",
                    data=f'{{"actividad_id": {nueva_actividad.id}, "codigo_producto": "{nueva_actividad.codigo_producto}", "responsable_secretaria": "{secretaria.nombre}"}}'
                )
                db.add(alerta)
            db.commit()
    
    return schemas.ActividadResponse.model_validate(nueva_actividad)


@router.get("/{slug}/actividades/{codigo_producto}", response_model=List[schemas.ActividadResponse])
async def get_actividades_por_producto(
    slug: str,
    codigo_producto: str,
    anio: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtiene todas las actividades de un producto, opcionalmente filtradas por año"""
    try:
        entity = get_entity_or_404(db, slug)
        ensure_user_can_manage_entity(current_user, entity)
        
        query = db.query(PdmActividad).options(
            joinedload(PdmActividad.evidencia)
        ).filter(
            PdmActividad.entity_id == entity.id,
            PdmActividad.codigo_producto == codigo_producto
        )
        
        if anio:
            query = query.filter(PdmActividad.anio == anio)
        
        actividades = query.all()
        
        print(f"📦 Encontradas {len(actividades)} actividades para producto {codigo_producto}")
        
        # Enriquecer actividades con nombre de secretaría
        result = [enrich_actividad_with_secretaria(a, db, current_user) for a in actividades]
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error obteniendo actividades: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error obteniendo actividades: {str(e)}"
        )


@router.get("/{slug}/mis-actividades", response_model=List[schemas.ActividadResponse])
async def get_mis_actividades(
    slug: str,
    anio: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtiene las actividades asignadas a la secretaría del usuario actual"""
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)
    
    # Incluir actividades asignadas a la secretaría del usuario
    query = db.query(PdmActividad).options(
        joinedload(PdmActividad.evidencia)
    ).filter(
        PdmActividad.entity_id == entity.id,
        PdmActividad.responsable_secretaria_id == current_user.secretaria_id
    )
    
    if anio:
        query = query.filter(PdmActividad.anio == anio)
    
    actividades = query.order_by(PdmActividad.fecha_inicio.desc()).all()
    
    # Enriquecer actividades con nombre de secretaría
    return [enrich_actividad_with_secretaria(a, db, current_user) for a in actividades]


@router.put("/{slug}/actividades/{actividad_id}", response_model=schemas.ActividadResponse)
async def update_actividad(
    slug: str,
    actividad_id: int,
    update_data: schemas.ActividadUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Actualiza una actividad"""
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)
    
    actividad = db.query(PdmActividad).filter(
        PdmActividad.id == actividad_id,
        PdmActividad.entity_id == entity.id
    ).first()
    
    if not actividad:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")
    
    # Guardar el responsable anterior para comparar
    update_dict = update_data.model_dump(exclude_unset=True)
    
    # Convertir fechas ISO string a datetime
    if 'fecha_inicio' in update_dict and update_dict['fecha_inicio']:
        try:
            update_dict['fecha_inicio'] = datetime.fromisoformat(update_dict['fecha_inicio'].replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            update_dict['fecha_inicio'] = None
    
    if 'fecha_fin' in update_dict and update_dict['fecha_fin']:
        try:
            update_dict['fecha_fin'] = datetime.fromisoformat(update_dict['fecha_fin'].replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            update_dict['fecha_fin'] = None
    
    for key, value in update_dict.items():
        setattr(actividad, key, value)
    
    db.commit()
    db.refresh(actividad)
    
    # Generar alertas si cambió la secretaría asignada
    if actividad.responsable_secretaria_id and 'responsable_secretaria_id' in update_dict:
        secretaria = db.query(Secretaria).filter(Secretaria.id == actividad.responsable_secretaria_id).first()
        if secretaria:
            usuarios_secretaria = db.query(User).filter(
                User.secretaria_id == secretaria.id,
                User.is_active == True,
                User.entity_id == entity.id
            ).all()
            
            for usuario in usuarios_secretaria:
                alerta = Alert(
                    entity_id=entity.id,
                    recipient_user_id=usuario.id,
                    type="PDM_ACTIVIDAD_REASIGNADA",
                    title=f"Actividad reasignada en {secretaria.nombre}: {actividad.nombre}",
                    message=f"La actividad '{actividad.nombre}' ha sido reasignada a la Secretaría {secretaria.nombre} para el año {actividad.anio}.",
                    data=f'{{"actividad_id": {actividad.id}, "codigo_producto": "{actividad.codigo_producto}", "responsable_secretaria": "{secretaria.nombre}"}}'
                )
                db.add(alerta)
            db.commit()
    
    return schemas.ActividadResponse.model_validate(actividad)


@router.delete("/{slug}/actividades/{actividad_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_actividad(
    slug: str,
    actividad_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Elimina una actividad"""
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)
    
    actividad = db.query(PdmActividad).filter(
        PdmActividad.id == actividad_id,
        PdmActividad.entity_id == entity.id
    ).first()
    
    if not actividad:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")
    
    db.delete(actividad)
    db.commit()


# ==============================================
# Gestión de Evidencias
# ==============================================

@router.post("/{slug}/actividades/{actividad_id}/evidencia", response_model=schemas.EvidenciaResponse, status_code=status.HTTP_201_CREATED)
async def create_evidencia(
    slug: str,
    actividad_id: int,
    evidencia: schemas.EvidenciaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Registra evidencia de cumplimiento de una actividad
    
    ✅ VALIDACIONES:
    - Máximo 4 imágenes
    - Cada imagen máximo 3MB en Base64 (~2MB original)
    """
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)
    
    # Verificar que la actividad existe
    actividad = db.query(PdmActividad).filter(
        PdmActividad.id == actividad_id,
        PdmActividad.entity_id == entity.id
    ).first()
    
    if not actividad:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")
    
    # Verificar que no exista ya una evidencia
    evidencia_existente = db.query(PdmActividadEvidencia).filter(
        PdmActividadEvidencia.actividad_id == actividad_id
    ).first()
    
    if evidencia_existente:
        raise HTTPException(status_code=400, detail="La actividad ya tiene evidencia registrada")
    
    # ✅ VALIDAR IMÁGENES antes de guardar
    if evidencia.imagenes:
        validar_imagenes_evidencia(evidencia.imagenes)
    
    # ✅ SUBIR IMÁGENES A S3 (si está disponible)
    imagenes_s3_urls = []
    migrated_to_s3 = False
    
    if evidencia.imagenes and S3_AVAILABLE:
        try:
            # Crear evidencia temporal para obtener ID
            nueva_evidencia = PdmActividadEvidencia(
                actividad_id=actividad_id,
                entity_id=entity.id,
                fecha_registro=datetime.utcnow(),
                descripcion=evidencia.descripcion,
                fecha_ejecucion=evidencia.fecha_ejecucion,
                porcentaje_avance=evidencia.porcentaje_avance,
                observaciones=evidencia.observaciones,
                imagenes=[],  # Vacío mientras subimos
                imagenes_s3_urls=[],
                migrated_to_s3=False
            )
            db.add(nueva_evidencia)
            db.flush()  # Obtener ID sin commit
            
            # Subir imágenes a S3
            imagenes_s3_urls = subir_imagenes_a_s3(
                evidencia.imagenes,
                entity.id,
                nueva_evidencia.id
            )
            
            # Actualizar con URLs S3
            nueva_evidencia.imagenes_s3_urls = imagenes_s3_urls
            nueva_evidencia.migrated_to_s3 = True
            migrated_to_s3 = True
            
        except HTTPException:
            # Error subiendo a S3 - revertir y usar Base64 como fallback
            db.rollback()
            print(f"⚠️  Error subiendo a S3 - usando fallback Base64")
            nueva_evidencia = PdmActividadEvidencia(
                actividad_id=actividad_id,
                entity_id=entity.id,
                fecha_registro=datetime.utcnow(),
                **evidencia.model_dump()
            )
            db.add(nueva_evidencia)
    else:
        # S3 no disponible o sin imágenes - guardar Base64
        nueva_evidencia = PdmActividadEvidencia(
            actividad_id=actividad_id,
            entity_id=entity.id,
            fecha_registro=datetime.utcnow(),
            **evidencia.model_dump()
        )
        db.add(nueva_evidencia)
    
    # Actualizar estado de la actividad a COMPLETADA
    actividad.estado = 'COMPLETADA'
    
    db.commit()
    db.refresh(nueva_evidencia)
    
    return schemas.EvidenciaResponse.model_validate(nueva_evidencia)


@router.get("/{slug}/actividades/{actividad_id}/evidencia", response_model=schemas.EvidenciaResponse)
async def get_evidencia(
    slug: str,
    actividad_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtiene la evidencia de una actividad
    
    OPTIMIZACIÓN: Si está migrada a S3, no envía imágenes Base64 para reducir payload
    """
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)
    
    evidencia = db.query(PdmActividadEvidencia).filter(
        PdmActividadEvidencia.actividad_id == actividad_id,
        PdmActividadEvidencia.entity_id == entity.id
    ).first()
    
    if not evidencia:
        raise HTTPException(status_code=404, detail="Evidencia no encontrada")
    
    # ✅ OPTIMIZACIÓN: Si está migrada a S3, limpiar Base64 para reducir payload
    if evidencia.migrated_to_s3 and evidencia.imagenes_s3_urls:
        # Crear copia sin modificar el ORM original
        evidencia_dict = schemas.EvidenciaResponse.model_validate(evidencia).model_dump()
        evidencia_dict['imagenes'] = []  # Limpiar Base64, frontend usará S3
        return schemas.EvidenciaResponse(**evidencia_dict)
    
    return schemas.EvidenciaResponse.model_validate(evidencia)

@router.put("/{slug}/actividades/{actividad_id}/evidencia", response_model=schemas.EvidenciaResponse)
async def update_evidencia(
    slug: str,
    actividad_id: int,
    evidencia_update: schemas.EvidenciaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Actualiza la evidencia de una actividad existente.
    Permite cambiar descripcion, url_evidencia e imagenes.
    
    ✅ VALIDACIONES:
    - Máximo 4 imágenes
    - Cada imagen máximo 3MB en Base64 (~2MB original)
    """
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)

    evidencia = db.query(PdmActividadEvidencia).filter(
        PdmActividadEvidencia.actividad_id == actividad_id,
        PdmActividadEvidencia.entity_id == entity.id
    ).first()

    if not evidencia:
        raise HTTPException(status_code=404, detail="Evidencia no encontrada")

    # ✅ VALIDAR IMÁGENES antes de actualizar
    update_dict = evidencia_update.model_dump(exclude_unset=True)
    if 'imagenes' in update_dict and update_dict['imagenes']:
        validar_imagenes_evidencia(update_dict['imagenes'])
    
    for key, value in update_dict.items():
        setattr(evidencia, key, value)

    db.commit()
    db.refresh(evidencia)

    return schemas.EvidenciaResponse.model_validate(evidencia)


# ==============================================
# Asignación de responsables a productos
# ==============================================

@router.patch("/{slug}/productos/{codigo_producto}/responsable")
async def asignar_responsable_producto(
    slug: str,
    codigo_producto: str,
    responsable_secretaria_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Asigna una SECRETARÍA como responsable de un producto del PDM.
    
    ✅ El producto se asigna a la SECRETARÍA, no a un usuario específico
    ✅ TODOS los usuarios de esa secretaría ven el producto en su lista
    ✅ Se crean alertas para TODOS los usuarios de la secretaría
    
    Args:
        responsable_secretaria_id: ID de la secretaría responsable del producto
    """
    from app.models.secretaria import Secretaria
    
    # Convertir a número
    try:
        responsable_secretaria_id = int(responsable_secretaria_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="responsable_secretaria_id debe ser un número entero")
    
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)
    
    # Buscar el producto
    producto = db.query(PdmProducto).filter(
        PdmProducto.codigo_producto == codigo_producto,
        PdmProducto.entity_id == entity.id
    ).first()
    
    if not producto:
        raise HTTPException(status_code=404, detail=f"Producto '{codigo_producto}' no encontrado")
    
    # Verificar que la secretaría existe y pertenece a la entidad
    secretaria = db.query(Secretaria).filter(
        Secretaria.id == responsable_secretaria_id,
        Secretaria.entity_id == entity.id
    ).first()
    
    if not secretaria:
        raise HTTPException(status_code=404, detail="Secretaría no encontrada o no pertenece a esta entidad")
    
    # Asignar secretaría como responsable
    producto.responsable_secretaria_id = responsable_secretaria_id
    producto.responsable_secretaria_nombre = secretaria.nombre
    
    db.commit()
    db.refresh(producto)
    
    # ✅ Crear alertas para TODOS los usuarios de esta secretaría
    usuarios_en_secretaria = db.query(User).filter(
        User.secretaria_id == responsable_secretaria_id,
        User.entity_id == entity.id,
        User.is_active == True
    ).all()
    
    for usuario in usuarios_en_secretaria:
        alerta = Alert(
            entity_id=entity.id,
            recipient_user_id=usuario.id,
            type="PDM_PRODUCT_ASSIGNED",
            title=f"Producto asignado a tu secretaría: {producto.codigo_producto}",
            message=f"El producto '{producto.indicador_producto_mga or producto.personalizacion_indicador}' ha sido asignado a la Secretaría {secretaria.nombre} para seguimiento en el PDM.",
            data=f'{{"producto_codigo": "{producto.codigo_producto}", "slug": "{slug}", "secretaria_id": {responsable_secretaria_id}}}',
            created_at=datetime.utcnow()
        )
        db.add(alerta)
    
    db.commit()
    
    print(f"✅ Producto asignado a secretaría {secretaria.nombre}")
    print(f"✅ Alertas creadas para {len(usuarios_en_secretaria)} usuario(s)")
    
    return {
        "success": True,
        "message": f"Producto asignado a la secretaría '{secretaria.nombre}'",
        "producto_codigo": producto.codigo_producto,
        "responsable_secretaria_id": producto.responsable_secretaria_id,
        "responsable_secretaria_nombre": producto.responsable_secretaria_nombre,
        "usuarios_notificados": len(usuarios_en_secretaria)
    }


@router.get("/actividades/{actividad_id}/evidencia/imagenes", response_model=dict)
async def get_evidencia_imagenes(
    actividad_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Endpoint para cargar las imágenes de la evidencia de una actividad específica.
    Se carga bajo demanda para evitar OOM en el listado principal.
    
    OPTIMIZACIÓN S3:
    - Retorna URLs S3 si están disponibles (imagenes_s3_urls)
    - Fallback a Base64 si no hay S3 (compatibilidad hacia atrás)
    - Incluye metadata: tipo de imagen, estado de migración
    """
    
    # Verificar que la actividad existe y pertenece a la entidad del usuario
    actividad = db.query(PdmActividad).filter(
        PdmActividad.id == actividad_id,
        PdmActividad.entity_id == current_user.entity_id
    ).first()
    
    if not actividad:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Actividad no encontrada"
        )
    
    # Cargar evidencia con imágenes
    evidencia = db.query(PdmActividadEvidencia).filter(
        PdmActividadEvidencia.actividad_id == actividad_id
    ).first()
    
    if not evidencia:
        return {
            "imagenes": [],
            "tipo": "none",
            "migrated_to_s3": False
        }
    
    # ✅ OPTIMIZACIÓN: Usar URLs S3 si están disponibles (más rápido, menos CPU/Red)
    if evidencia.migrated_to_s3 and evidencia.imagenes_s3_urls:
        return {
            "imagenes": evidencia.imagenes_s3_urls,
            "tipo": "s3",
            "migrated_to_s3": True
        }
    
    # Fallback a Base64 (legacy, para evidencias no migradas)
    return {
        "imagenes": evidencia.imagenes or [],
        "tipo": "base64",
        "migrated_to_s3": False
    }
