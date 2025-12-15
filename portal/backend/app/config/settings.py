import os
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # Database
    database_url: str = "sqlite:///./pqrs_alcaldia.db"
    
    # JWT
    secret_key: str = "tu-clave-secreta-super-segura-cambiar-en-produccion"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # OpenAI
    openai_api_key: str = ""
    
    # Environment
    environment: str = "development"
    debug: bool = True
    
    # CORS - Múltiples orígenes separados por coma
    # Dominios permitidos para CORS
    allowed_origins: str = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:4200,https://www.softone360.com,https://softone360.com"
    )

    # Superadmin (para seed/control inicial)
    superadmin_username: str = "superadmin"
    superadmin_email: str = "superadmin@sistema.gov.co"
    superadmin_password: str = "changeMe!SuperSecure"
    
    # Migration secret key (para endpoint de migraciones)
    migration_secret_key: str = "change-me-in-production-migration-key-2024"
    
    # AWS SES Email Configuration
    aws_ses_region: str = "us-east-1"  # Región donde está configurado SES
    email_from: str = "noreply@tudominio.com"  # Correo verificado en AWS SES
    email_from_name: str = "Sistema PQRS"  # Nombre del remitente
    
    # Frontend URL (para links en emails)
    frontend_url: str = os.getenv("FRONTEND_URL", "https://www.softone360.com")
    
    # Timezone
    timezone: str = "America/Bogota"  # UTC-5 (Colombia)
    
    @property
    def cors_origins(self) -> List[str]:
        """Convierte la cadena de orígenes permitidos en una lista"""
        # Simplemente dividir por coma y limpiar espacios
        origins = [origin.strip() for origin in self.allowed_origins.split(",")]
        return origins
    
    class Config:
        env_file = ".env"
        extra = "ignore"  # Ignorar campos extra

settings = Settings()