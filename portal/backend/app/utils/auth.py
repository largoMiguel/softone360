from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.config.database import get_db
from app.config.settings import settings
from app.models.user import User
from app.schemas.user import TokenData
from sqlalchemy.orm import Session
from app.config.database import get_db
from typing import Callable

# Configuración de encriptación
pwd_context = CryptContext(
    schemes=["bcrypt"], 
    deprecated="auto",
    bcrypt__rounds=12
)
security = HTTPBearer()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica si una contraseña coincide con su hash"""
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    """Genera un hash seguro de la contraseña"""
    try:
        # Asegurar que la contraseña sea string y esté dentro del límite de bcrypt (72 bytes)
        if not isinstance(password, str):
            password = str(password)
        
        # Convertir a bytes para medir correctamente
        password_bytes = password.encode('utf-8')
        
        # Truncar a 72 bytes si excede (límite de bcrypt)
        if len(password_bytes) > 72:
            # Truncar y decodificar, ignorando errores de UTF-8
            password = password_bytes[:72].decode('utf-8', errors='ignore')
        
        # Hashear la contraseña
        return pwd_context.hash(password)
        
    except Exception as e:
        # Log del error para debugging
        error_msg = f"Error hashing password: {str(e)}"
        print(f"❌ {error_msg}")
        print(f"   Password length: {len(password) if password else 0}")
        print(f"   Password bytes: {len(password.encode('utf-8')) if password else 0}")
        raise ValueError(error_msg)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Crear token JWT"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verificar token JWT"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudieron validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(credentials.credentials, settings.secret_key, algorithms=[settings.algorithm])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    
    return token_data

def get_current_user(db: Session = Depends(get_db), token_data: TokenData = Depends(verify_token)):
    """Obtener usuario actual desde el token"""
    from sqlalchemy.orm import joinedload
    
    # Eager load la entidad para evitar lazy loading issues
    print(f"🔍 get_current_user: buscando usuario {token_data.username}")
    user = db.query(User).options(joinedload(User.entity)).filter(User.username == token_data.username).first()
    
    if user is None:
        print(f"❌ Usuario no encontrado: {token_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado"
        )
    
    print(f"✅ Usuario encontrado: {user.username}")
    print(f"   entity_id: {user.entity_id}")
    print(f"   entity loaded: {user.entity is not None}")
    if user.entity:
        print(f"   entity.id: {user.entity.id}, entity.slug: {user.entity.slug}")
    
    return user

def get_current_active_user(current_user: User = Depends(get_current_user)):
    """Obtener usuario activo actual"""
    return current_user

def require_admin(current_user: User = Depends(get_current_active_user)):
    """Requerir que el usuario sea administrador"""
    if current_user.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permisos insuficientes"
        )
    return current_user

def require_superadmin(current_user: User = Depends(get_current_active_user)):
    """Requerir que el usuario sea super administrador"""
    if current_user.role.value != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Se requieren permisos de super administrador."
        )
    return current_user

def require_admin_or_superadmin(current_user: User = Depends(get_current_active_user)):
    """Requerir que el usuario sea administrador o super administrador"""
    if current_user.role.value not in ["admin", "superadmin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Se requieren permisos de administrador."
        )
    return current_user

def check_entity_access(current_user: User, target_entity_id: int):
    """
    Verificar que el usuario tenga acceso a la entidad especificada.
    - Superadmin: acceso a todas las entidades
    - Admin: solo a su entidad
    """
    if current_user.role.value == "superadmin":
        return True
    
    if current_user.role.value == "admin":
        if current_user.entity_id != target_entity_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes acceso a esta entidad"
            )
        return True
    
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Permisos insuficientes"
    )

def require_feature_enabled(feature_flag: str) -> Callable:
    """
    Crea una dependencia que valida si la entidad del usuario tiene habilitada una funcionalidad.
    - Superadmin: siempre permitido.
    - Admin/Secretario: requiere que su entidad tenga el flag en True.
    """
    def _checker(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
        if current_user.role.value == "superadmin":
            return True
        from app.models.entity import Entity
        entity = db.query(Entity).filter(Entity.id == current_user.entity_id).first()
        if not entity:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Entidad no encontrada para el usuario")
        if not getattr(entity, feature_flag, False):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Funcionalidad desactivada para esta entidad")
        return True
    return _checker