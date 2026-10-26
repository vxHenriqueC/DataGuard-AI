# settings.py
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    APP_NAME: str = "DataGuard AI"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False

    # Segurança & JWT
    SECRET_KEY: str = "change-this-in-production-use-a-strong-random-secret"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

    # Upload & Arquivos
    MAX_FILE_SIZE_MB: int = 10
    ALLOWED_EXTENSIONS: List[str] = [
        "pdf", "csv", "xlsx", "docx", "txt", "json", "xml", "log"
    ]

    # Integração IA
    AI_API_KEY: str = ""
    AI_MODEL: str = "gemini-1.5-pro"
    AI_ENABLED: bool = True

    # Banco de dados
    DATABASE_URL: str = "sqlite:///./dataguard.db"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
