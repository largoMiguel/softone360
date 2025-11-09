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
    # Incluye: localhost para desarrollo, Onrender (antiguo), y AWS S3 frontend (producción actual)
    allowed_origins: str = "http://localhost:4200,https://pqrs-frontend.onrender.com,https://softone-stratek.onrender.com,http://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com"

    # Superadmin (para seed/control inicial)
    superadmin_username: str = "superadmin"
    superadmin_email: str = "superadmin@sistema.gov.co"
    superadmin_password: str = "changeMe!SuperSecure"
    
    # Migration secret key (para endpoint de migraciones)
    migration_secret_key: str = "change-me-in-production-migration-key-2024"
    
    # Nota: Se removieron configuraciones de mantenimiento para producción.
    
    @property
    def cors_origins(self) -> List[str]:
        """Convierte la cadena de orígenes permitidos en una lista"""
        origins = [origin.strip() for origin in self.allowed_origins.split(",")]
        # Agregar automáticamente variantes comunes si estamos en producción
        production_origins = []
        for origin in origins:
            if "onrender.com" in origin:
                production_origins.append(origin)
                # Agregar versión sin www si no está
                if origin.startswith("https://www."):
                    production_origins.append(origin.replace("https://www.", "https://"))
                elif origin.startswith("https://") and "www." not in origin:
                    production_origins.append(origin.replace("https://", "https://www."))
        return list(set(origins + production_origins))  # Eliminar duplicados
    
    class Config:
        env_file = ".env"
        extra = "ignore"  # Ignorar campos extra

settings = Settings()