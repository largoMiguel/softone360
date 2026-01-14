from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, cast, Date
from typing import List, Optional
from datetime import datetime, date, timedelta
import base64
import uuid as uuid_lib
import os
import traceback

from app.config.database import get_db
from app.config.settings import settings
from app.models.funcionario import Funcionario, EquipoRegistro, RegistroAsistencia
from app.models.entity import Entity
from app.schemas.funcionario import (
    FuncionarioCreate, FuncionarioUpdate, FuncionarioResponse,
    EquipoRegistroCreate, EquipoRegistroUpdate, EquipoRegistroResponse,
    RegistroAsistenciaCreate, RegistroAsistenciaResponse, RegistroAsistenciaListResponse,
    EstadisticasAsistencia, ValidacionEquipoRequest, ValidacionEquipoResponse
)
from app.routes.auth import get_current_active_user
from app.models.user import User, UserRole

router = APIRouter(prefix="/asistencia", tags=["Asistencia"])

# Configuración de S3 para almacenar fotos de asistencia
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
# Usar bucket específico para fotos de asistencia
BUCKET_NAME = os.getenv("AWS_S3_BUCKET_ASISTENCIA", os.getenv("AWS_S3_BUCKET_PHOTOS", "softone360-humano-photos"))

# Inicializar S3 client
s3_client = None
try:
    import boto3
    from botocore.exceptions import ClientError
    
    # Intentar con credenciales explícitas primero, luego con credenciales del perfil
    if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
        s3_client = boto3.client(
            's3',
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            region_name=AWS_REGION
        )
        print(f"[INFO] S3 client inicializado con credenciales explícitas. Bucket: {BUCKET_NAME}")
    else:
        # Intentar con credenciales del perfil ~/.aws/credentials
        s3_client = boto3.client('s3', region_name=AWS_REGION)
        print(f"[INFO] S3 client inicializado con credenciales del perfil AWS. Bucket: {BUCKET_NAME}")
except Exception as e:
    print(f"[ERROR] No se pudo inicializar S3 client: {str(e)}")
    s3_client = None


def upload_foto_s3(foto_base64: str, prefix: str = "asistencia") -> str:
    """
    Sube una foto en base64 a S3 y retorna la URL pública.
    Si S3 no está configurado, retorna None.
    
    Nota: El bucket debe tener una política que permita lectura pública
    para la ruta asistencia/*
    """
    if not s3_client:
        # S3 no configurado, retornar None (foto no será almacenada)
        print("[WARNING] S3 client no configurado - foto no se guardará")
        return None
    
    try:
        # Decodificar base64
        foto_data = base64.b64decode(foto_base64)
        print(f"[DEBUG] Foto decodificada: {len(foto_data)} bytes")
        
        # Generar nombre único
        file_name = f"{prefix}/{datetime.now().strftime('%Y%m%d')}/{uuid_lib.uuid4()}.jpg"
        print(f"[DEBUG] Nombre archivo S3: {file_name}")
        
        # Subir a S3 (sin ACL, la política del bucket controla el acceso)
        s3_client.put_object(
            Bucket=BUCKET_NAME,
            Key=file_name,
            Body=foto_data,
            ContentType='image/jpeg'
        )
        
        # Retornar URL pública
        url = f"https://{BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{file_name}"
        print(f"[DEBUG] URL generada: {url}")
        return url
    except Exception as e:
        # Error al subir, pero no fallar el registro
        print(f"[ERROR] Error al subir foto a S3: {str(e)}")
        traceback.print_exc()
        return None


# ===== EQUIPOS DE REGISTRO =====

@router.post("/equipos", response_model=EquipoRegistroResponse, status_code=status.HTTP_201_CREATED)
def crear_equipo_registro(
    equipo: EquipoRegistroCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Registrar un nuevo equipo autorizado para control de asistencia.
    Solo SUPERADMIN, ADMIN y SECRETARIO pueden crear equipos.
    """
    # Verificar permisos
    if current_user.role not in [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.SECRETARIO]:
        raise HTTPException(status_code=403, detail="No tiene permisos para crear equipos")
    
    # Si no es SUPERADMIN, validar que sea de su entidad
    if current_user.role != UserRole.SUPERADMIN:
        if current_user.entity_id != equipo.entity_id:
            raise HTTPException(status_code=403, detail="Solo puede crear equipos para su entidad")
    
    # Verificar que la entidad existe
    entity = db.query(Entity).filter(Entity.id == equipo.entity_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entidad no encontrada")
    
    # Verificar que el UUID no existe
    existing = db.query(EquipoRegistro).filter(EquipoRegistro.uuid == equipo.uuid).first()
    if existing:
        raise HTTPException(status_code=400, detail="El UUID del equipo ya está registrado")
    
    # Crear equipo
    db_equipo = EquipoRegistro(**equipo.model_dump())
    db.add(db_equipo)
    db.commit()
    db.refresh(db_equipo)
    
    return db_equipo


@router.get("/equipos", response_model=List[EquipoRegistroResponse])
def listar_equipos_registro(
    entity_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Listar equipos de registro.
    """
    query = db.query(EquipoRegistro)
    
    # Filtrar por entidad si no es SUPERADMIN
    if current_user.role != UserRole.SUPERADMIN:
        query = query.filter(EquipoRegistro.entity_id == current_user.entity_id)
    elif entity_id:
        query = query.filter(EquipoRegistro.entity_id == entity_id)
    
    if is_active is not None:
        query = query.filter(EquipoRegistro.is_active == is_active)
    
    return query.all()


@router.put("/equipos/{equipo_id}", response_model=EquipoRegistroResponse)
def actualizar_equipo(
    equipo_id: int,
    equipo_update: EquipoRegistroUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Actualizar un equipo de registro.
    """
    # Verificar permisos
    if current_user.role not in [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.SECRETARIO]:
        raise HTTPException(status_code=403, detail="No tiene permisos para actualizar equipos")
    
    # Buscar el equipo
    db_equipo = db.query(EquipoRegistro).filter(EquipoRegistro.id == equipo_id).first()
    if not db_equipo:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
    
    # Si no es SUPERADMIN, validar que sea de su entidad
    if current_user.role != UserRole.SUPERADMIN:
        if current_user.entity_id != db_equipo.entity_id:
            raise HTTPException(status_code=403, detail="Solo puede actualizar equipos de su entidad")
    
    # Actualizar campos
    update_data = equipo_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_equipo, field, value)
    
    db.commit()
    db.refresh(db_equipo)
    
    return db_equipo


@router.delete("/equipos/{equipo_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_equipo(
    equipo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Eliminar un equipo de registro.
    """
    try:
        # Verificar permisos
        if current_user.role not in [UserRole.SUPERADMIN, UserRole.ADMIN]:
            raise HTTPException(status_code=403, detail="No tiene permisos para eliminar equipos")
        
        # Buscar el equipo
        db_equipo = db.query(EquipoRegistro).filter(EquipoRegistro.id == equipo_id).first()
        if not db_equipo:
            raise HTTPException(status_code=404, detail="Equipo no encontrado")
        
        # Si no es SUPERADMIN, validar que sea de su entidad
        if current_user.role != UserRole.SUPERADMIN:
            if current_user.entity_id != db_equipo.entity_id:
                raise HTTPException(status_code=403, detail="Solo puede eliminar equipos de su entidad")
        
        # Eliminar equipo (los registros asociados se eliminan en cascada)
        db.delete(db_equipo)
        db.commit()
        
        print(f"Equipo {equipo_id} eliminado exitosamente por usuario {current_user.email}")
        return None
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR al eliminar equipo {equipo_id}: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al eliminar el equipo: {str(e)}")


@router.post("/equipos/validar", response_model=ValidacionEquipoResponse)
def validar_equipo(
    request: ValidacionEquipoRequest,
    db: Session = Depends(get_db)
):
    """
    Validar si un equipo está autorizado para registrar asistencia.
    Endpoint público (sin autenticación) para uso de la app de escritorio.
    """
    equipo = db.query(EquipoRegistro).filter(
        EquipoRegistro.uuid == request.uuid,
        EquipoRegistro.is_active == True
    ).first()
    
    if not equipo:
        return ValidacionEquipoResponse(
            valido=False,
            mensaje="Equipo no autorizado o inactivo"
        )
    
    return ValidacionEquipoResponse(
        valido=True,
        equipo_id=equipo.id,
        entity_id=equipo.entity_id,
        mensaje=f"Equipo autorizado: {equipo.nombre}"
    )


# ===== FUNCIONARIOS =====

@router.post("/funcionarios", response_model=FuncionarioResponse, status_code=status.HTTP_201_CREATED)
def crear_funcionario(
    funcionario: FuncionarioCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Crear un nuevo funcionario.
    """
    try:
        print(f"\n=== CREAR FUNCIONARIO ===")
        print(f"Usuario: {current_user.email}")
        print(f"Datos recibidos: {funcionario.model_dump()}")
        
        # Verificar permisos
        if current_user.role not in [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.SECRETARIO]:
            raise HTTPException(status_code=403, detail="No tiene permisos para crear funcionarios")
        
        # Si no es SUPERADMIN, validar que sea de su entidad
        if current_user.role != UserRole.SUPERADMIN:
            if current_user.entity_id != funcionario.entity_id:
                raise HTTPException(status_code=403, detail="Solo puede crear funcionarios para su entidad")
        
        # Verificar que la entidad existe
        entity = db.query(Entity).filter(Entity.id == funcionario.entity_id).first()
        if not entity:
            raise HTTPException(status_code=404, detail="Entidad no encontrada")
        
        # Verificar que la cédula no existe
        existing = db.query(Funcionario).filter(Funcionario.cedula == funcionario.cedula).first()
        if existing:
            raise HTTPException(status_code=400, detail="La cédula ya está registrada")
        
        # Crear funcionario
        db_funcionario = Funcionario(**funcionario.model_dump())
        db.add(db_funcionario)
        db.commit()
        db.refresh(db_funcionario)
        
        print(f"Funcionario creado exitosamente: ID {db_funcionario.id}")
        return db_funcionario
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR al crear funcionario: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


@router.get("/funcionarios", response_model=List[FuncionarioResponse])
def listar_funcionarios(
    entity_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Listar funcionarios.
    """
    query = db.query(Funcionario)
    
    # Filtrar por entidad si no es SUPERADMIN
    if current_user.role != UserRole.SUPERADMIN:
        query = query.filter(Funcionario.entity_id == current_user.entity_id)
    elif entity_id:
        query = query.filter(Funcionario.entity_id == entity_id)
    
    if is_active is not None:
        query = query.filter(Funcionario.is_active == is_active)
    
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Funcionario.cedula.ilike(search_pattern),
                Funcionario.nombres.ilike(search_pattern),
                Funcionario.apellidos.ilike(search_pattern)
            )
        )
    
    return query.all()


@router.get("/funcionarios/{funcionario_id}", response_model=FuncionarioResponse)
def obtener_funcionario(
    funcionario_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Obtener un funcionario por ID.
    """
    funcionario = db.query(Funcionario).filter(Funcionario.id == funcionario_id).first()
    if not funcionario:
        raise HTTPException(status_code=404, detail="Funcionario no encontrado")
    
    # Verificar permisos
    if current_user.role != UserRole.SUPERADMIN:
        if funcionario.entity_id != current_user.entity_id:
            raise HTTPException(status_code=403, detail="No tiene permisos para ver este funcionario")
    
    return funcionario


@router.put("/funcionarios/{funcionario_id}", response_model=FuncionarioResponse)
def actualizar_funcionario(
    funcionario_id: int,
    funcionario_update: FuncionarioUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Actualizar un funcionario.
    """
    funcionario = db.query(Funcionario).filter(Funcionario.id == funcionario_id).first()
    if not funcionario:
        raise HTTPException(status_code=404, detail="Funcionario no encontrado")
    
    # Verificar permisos
    if current_user.role not in [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.SECRETARIO]:
        raise HTTPException(status_code=403, detail="No tiene permisos para actualizar funcionarios")
    
    if current_user.role != UserRole.SUPERADMIN:
        if funcionario.entity_id != current_user.entity_id:
            raise HTTPException(status_code=403, detail="No tiene permisos para actualizar este funcionario")
    
    # Actualizar campos
    for field, value in funcionario_update.model_dump(exclude_unset=True).items():
        setattr(funcionario, field, value)
    
    db.commit()
    db.refresh(funcionario)
    
    return funcionario


@router.delete("/funcionarios/{funcionario_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_funcionario(
    funcionario_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Eliminar un funcionario.
    Solo SUPERADMIN y ADMIN pueden eliminar funcionarios.
    """
    # Verificar permisos
    if current_user.role not in [UserRole.SUPERADMIN, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="No tiene permisos para eliminar funcionarios")
    
    # Buscar el funcionario
    funcionario = db.query(Funcionario).filter(Funcionario.id == funcionario_id).first()
    if not funcionario:
        raise HTTPException(status_code=404, detail="Funcionario no encontrado")
    
    # Si no es SUPERADMIN, validar que sea de su entidad
    if current_user.role != UserRole.SUPERADMIN:
        if funcionario.entity_id != current_user.entity_id:
            raise HTTPException(status_code=403, detail="Solo puede eliminar funcionarios de su entidad")
    
    # Eliminar funcionario
    db.delete(funcionario)
    db.commit()
    
    return None


# ===== REGISTROS DE ASISTENCIA =====

@router.post("/registros", response_model=RegistroAsistenciaResponse, status_code=status.HTTP_201_CREATED)
def crear_registro_asistencia(
    registro: RegistroAsistenciaCreate,
    db: Session = Depends(get_db)
):
    """
    Crear un registro de asistencia desde la app de escritorio.
    Endpoint público (sin autenticación).
    """
    # Validar equipo
    equipo = db.query(EquipoRegistro).filter(
        EquipoRegistro.uuid == registro.equipo_uuid,
        EquipoRegistro.is_active == True
    ).first()
    
    if not equipo:
        raise HTTPException(status_code=403, detail="Equipo no autorizado o inactivo")
    
    # Buscar funcionario
    funcionario = db.query(Funcionario).filter(
        Funcionario.cedula == registro.cedula,
        Funcionario.entity_id == equipo.entity_id,
        Funcionario.is_active == True
    ).first()
    
    if not funcionario:
        raise HTTPException(status_code=404, detail="Funcionario no encontrado o inactivo")
    
    # Verificar límite de 2 registros por día
    hoy = date.today()
    registros_hoy = db.query(RegistroAsistencia).filter(
        RegistroAsistencia.funcionario_id == funcionario.id,
        cast(RegistroAsistencia.fecha_hora, Date) == hoy
    ).count()
    
    if registros_hoy >= 2:
        raise HTTPException(
            status_code=400,
            detail="El funcionario ya ha registrado entrada y salida hoy"
        )
    
    # Validar tipo de registro según registros previos
    ultimo_registro = db.query(RegistroAsistencia).filter(
        RegistroAsistencia.funcionario_id == funcionario.id,
        cast(RegistroAsistencia.fecha_hora, Date) == hoy
    ).order_by(RegistroAsistencia.fecha_hora.desc()).first()
    
    if ultimo_registro:
        if ultimo_registro.tipo_registro == "entrada" and registro.tipo_registro == "entrada":
            raise HTTPException(status_code=400, detail="Ya hay un registro de entrada hoy. Debe registrar salida")
        if ultimo_registro.tipo_registro == "salida" and registro.tipo_registro == "salida":
            raise HTTPException(status_code=400, detail="Ya hay un registro de salida hoy")
    else:
        # Primer registro del día debe ser entrada
        if registro.tipo_registro != "entrada":
            raise HTTPException(status_code=400, detail="El primer registro del día debe ser de entrada")
    
    # Subir foto a S3 si se proporciona
    foto_url = None
    if registro.foto_base64:
        print(f"[DEBUG] Foto recibida: {len(registro.foto_base64)} caracteres")
        foto_url = upload_foto_s3(registro.foto_base64, f"asistencia/{funcionario.cedula}")
        if foto_url:
            print(f"[DEBUG] Foto subida a S3: {foto_url}")
        else:
            print("[WARNING] Foto no se subió a S3 (S3 no configurado o error)")
    else:
        print("[WARNING] No se recibió foto_base64 en el request")
    
    # Crear registro
    db_registro = RegistroAsistencia(
        funcionario_id=funcionario.id,
        equipo_id=equipo.id,
        tipo_registro=registro.tipo_registro,
        foto_url=foto_url,
        observaciones=registro.observaciones
    )
    
    db.add(db_registro)
    db.commit()
    db.refresh(db_registro)
    
    # Agregar información adicional
    response = RegistroAsistenciaResponse.model_validate(db_registro)
    response.funcionario_nombres = funcionario.nombres
    response.funcionario_apellidos = funcionario.apellidos
    response.funcionario_cedula = funcionario.cedula
    response.equipo_nombre = equipo.nombre
    response.equipo_ubicacion = equipo.ubicacion
    
    return response


@router.get("/registros", response_model=List[RegistroAsistenciaListResponse])
def listar_registros_asistencia(
    entity_id: Optional[int] = None,
    funcionario_id: Optional[int] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    tipo_registro: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Listar registros de asistencia con filtros.
    """
    query = db.query(
        RegistroAsistencia,
        Funcionario,
        EquipoRegistro
    ).join(
        Funcionario, RegistroAsistencia.funcionario_id == Funcionario.id
    ).join(
        EquipoRegistro, RegistroAsistencia.equipo_id == EquipoRegistro.id
    )
    
    # Filtrar por entidad si no es SUPERADMIN
    if current_user.role != UserRole.SUPERADMIN:
        query = query.filter(Funcionario.entity_id == current_user.entity_id)
    elif entity_id:
        query = query.filter(Funcionario.entity_id == entity_id)
    
    if funcionario_id:
        query = query.filter(RegistroAsistencia.funcionario_id == funcionario_id)
    
    if fecha_desde:
        query = query.filter(cast(RegistroAsistencia.fecha_hora, Date) >= fecha_desde)
    
    if fecha_hasta:
        query = query.filter(cast(RegistroAsistencia.fecha_hora, Date) <= fecha_hasta)
    
    if tipo_registro:
        query = query.filter(RegistroAsistencia.tipo_registro == tipo_registro)
    
    query = query.order_by(RegistroAsistencia.fecha_hora.desc())
    query = query.limit(limit).offset(offset)
    
    results = query.all()
    
    # Transformar resultados
    response_list = []
    for registro, funcionario, equipo in results:
        response_list.append(RegistroAsistenciaListResponse(
            id=registro.id,
            funcionario_id=funcionario.id,
            funcionario_nombres=funcionario.nombres,
            funcionario_apellidos=funcionario.apellidos,
            funcionario_cedula=funcionario.cedula,
            funcionario_cargo=funcionario.cargo,
            funcionario_foto_url=funcionario.foto_url,
            equipo_nombre=equipo.nombre,
            equipo_ubicacion=equipo.ubicacion,
            tipo_registro=registro.tipo_registro,
            fecha_hora=registro.fecha_hora,
            foto_url=registro.foto_url,
            observaciones=registro.observaciones
        ))
    
    return response_list


@router.get("/estadisticas", response_model=EstadisticasAsistencia)
def obtener_estadisticas_asistencia(
    entity_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Obtener estadísticas de asistencia.
    """
    # Determinar entidad
    target_entity_id = entity_id
    if current_user.role != UserRole.SUPERADMIN:
        target_entity_id = current_user.entity_id
    
    # Total de funcionarios activos
    total_funcionarios = db.query(Funcionario).filter(
        Funcionario.entity_id == target_entity_id,
        Funcionario.is_active == True
    ).count()
    
    # Registros de hoy
    hoy = date.today()
    registros_hoy_query = db.query(RegistroAsistencia).join(
        Funcionario, RegistroAsistencia.funcionario_id == Funcionario.id
    ).filter(
        Funcionario.entity_id == target_entity_id,
        cast(RegistroAsistencia.fecha_hora, Date) == hoy
    )
    
    registros_hoy = registros_hoy_query.count()
    entradas_hoy = registros_hoy_query.filter(RegistroAsistencia.tipo_registro == "entrada").count()
    salidas_hoy = registros_hoy_query.filter(RegistroAsistencia.tipo_registro == "salida").count()
    
    # Funcionarios presentes (entrada sin salida)
    funcionarios_presentes = entradas_hoy - salidas_hoy
    
    # Total de registros
    total_registros = db.query(RegistroAsistencia).join(
        Funcionario, RegistroAsistencia.funcionario_id == Funcionario.id
    ).filter(
        Funcionario.entity_id == target_entity_id
    ).count()
    
    # Promedio semanal (últimos 7 días)
    hace_7_dias = hoy - timedelta(days=7)
    registros_semana = db.query(func.count(RegistroAsistencia.id)).join(
        Funcionario, RegistroAsistencia.funcionario_id == Funcionario.id
    ).filter(
        Funcionario.entity_id == target_entity_id,
        cast(RegistroAsistencia.fecha_hora, Date) >= hace_7_dias,
        cast(RegistroAsistencia.fecha_hora, Date) <= hoy
    ).scalar()
    
    promedio_semanal = registros_semana / 7 if registros_semana else 0
    
    return EstadisticasAsistencia(
        total_funcionarios=total_funcionarios,
        total_registros=total_registros,
        registros_hoy=registros_hoy,
        entradas_hoy=entradas_hoy,
        salidas_hoy=salidas_hoy,
        funcionarios_presentes=funcionarios_presentes,
        promedio_asistencia_semanal=round(promedio_semanal, 2)
    )
