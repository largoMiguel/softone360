from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, cast, Date
from typing import List, Optional
from datetime import datetime, date, timedelta
import base64
import uuid as uuid_lib
import boto3
from botocore.exceptions import ClientError

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

# Configuración de S3 para almacenar fotos
s3_client = boto3.client(
    's3',
    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    region_name=settings.AWS_REGION
)
BUCKET_NAME = settings.AWS_S3_BUCKET


def upload_foto_s3(foto_base64: str, prefix: str = "asistencia") -> str:
    """
    Sube una foto en base64 a S3 y retorna la URL.
    """
    try:
        # Decodificar base64
        foto_data = base64.b64decode(foto_base64)
        
        # Generar nombre único
        file_name = f"{prefix}/{datetime.now().strftime('%Y%m%d')}/{uuid_lib.uuid4()}.jpg"
        
        # Subir a S3
        s3_client.put_object(
            Bucket=BUCKET_NAME,
            Key=file_name,
            Body=foto_data,
            ContentType='image/jpeg'
        )
        
        # Retornar URL
        return f"https://{BUCKET_NAME}.s3.amazonaws.com/{file_name}"
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al subir foto: {str(e)}")


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
    
    return db_funcionario


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
        foto_url = upload_foto_s3(registro.foto_base64, f"asistencia/{funcionario.cedula}")
    
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
