from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class RiskLevel(str, Enum):
    BAIXO = "BAIXO"
    MEDIO = "MÉDIO"
    ALTO = "ALTO"
    CRITICO = "CRÍTICO"


# ============================
# Contrato de Análise
# ============================

class FindingItem(BaseModel):
    type: str
    location: str
    risk: RiskLevel
    value_masked: str
    reason: str
    recommendation: str
    action: Optional[str] = None
    context_snippet: Optional[str] = None


class AnalysisSummary(BaseModel):
    total_findings: int = 0
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0


class AnalysisReportResponse(BaseModel):
    id: Optional[int] = None
    status: str = "completed"
    file: str
    file_name: Optional[str] = None
    file_type: str
    file_size: Optional[int] = 0
    risk_score: int = Field(..., ge=0, le=100)
    risk_level: RiskLevel
    total_alerts: int = 0
    summary: AnalysisSummary
    findings: List[FindingItem]
    recommendations: List[str]
    ai_mode: str = "deterministic_engine"
    created_at: Optional[str] = None


# ============================
# Modelos de Extração Estruturada
# ============================

class ExtractedUnit(BaseModel):
    location: str
    text: str


class FileExtractionResult(BaseModel):
    success: bool
    file_name: str
    file_type: str
    file_size: int
    units: List[ExtractedUnit] = []
    error: Optional[str] = None


# ============================
# Modelos de Autenticação / Usuário
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
    created_at: Optional[datetime] = None
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
    confirm_new_password: Optional[str] = None


class UserSettingsUpdate(BaseModel):
    theme: Optional[str] = None
    language: Optional[str] = None
    compact_interface: Optional[int] = None
    auto_analysis: Optional[int] = None
    min_risk_alert: Optional[str] = None
    max_file_size_mb: Optional[int] = None
    allowed_file_types: Optional[str] = None
    detectors_enabled: Optional[Dict[str, Any]] = None
    notifications: Optional[Dict[str, Any]] = None
    privacy: Optional[Dict[str, Any]] = None
