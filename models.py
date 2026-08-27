# models.py
# Modelos do banco de dados e estruturas de dados do DataGuard AI

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


# ============================
# Enums
# ============================

class RiskLevel(str, Enum):
    BAIXO = "Baixo"
    MEDIO = "Médio"
    ALTO = "Alto"


class Severity(str, Enum):
    BAIXA = "Baixo"
    MEDIA = "Médio"
    ALTA = "Alto"


# ============================
# Modelos de Usuário
# ============================

class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8)
    confirm_password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    created_at: datetime
    last_login: Optional[datetime] = None
    analyses_count: int = 0
    risks_found: int = 0
    profile_picture: Optional[str] = None

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    profile_picture: Optional[str] = None


class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)
    confirm_new_password: str


# ============================
# Modelos de Análise
# ============================

class SensitiveDataFound(BaseModel):
    type: str
    count: int
    severity: Severity
    samples: List[str]


class AnalysisResult(BaseModel):
    success: bool
    file_name: str
    file_type: str
    risk_score: int = Field(..., ge=0, le=100)
    risk_level: RiskLevel
    sensitive_data: List[SensitiveDataFound]
    alerts: int
    recommendations: List[str]


class AnalysisHistory(BaseModel):
    id: int
    user_id: int
    file_name: str
    file_type: str
    risk_score: int
    risk_level: RiskLevel
    alerts: int
    created_at: datetime

    class Config:
        from_attributes = True


# ============================
# Modelos de Configurações
# ============================

class UserSettings(BaseModel):
    user_id: int
    theme: str = "dark"
    language: str = "pt-BR"
    compact_interface: bool = False
    auto_analysis: bool = False
    min_risk_alert: RiskLevel = RiskLevel.MEDIO
    max_file_size_mb: int = 10
    allowed_file_types: List[str] = ["txt", "csv", "json", "pdf", "xlsx"]
    detectors_enabled: dict = {}
    notifications: dict = {}
    privacy: dict = {}

    class Config:
        from_attributes = True


# ============================
# Modelos de Resposta Genérica
# ============================

class SuccessResponse(BaseModel):
    success: bool = True
    message: str


class ErrorResponse(BaseModel):
    success: bool = False
    error: str
