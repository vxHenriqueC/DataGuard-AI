# settings.py
# Gerenciamento das configurações do DataGuard AI

from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    # Configurações da aplicação
    APP_NAME: str = "DataGuard AI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # Segurança
    SECRET_KEY: str = "dataguard-super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Upload
    MAX_FILE_SIZE_MB: int = 10
    UPLOAD_DIR: str = "uploads"

    # Banco de dados
    DATABASE_URL: str = "sqlite:///./dataguard.db"

    class Config:
        env_file = ".env"


# Instância global de configurações
settings = Settings()
