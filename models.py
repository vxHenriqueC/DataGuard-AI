# models.py
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
    context_snippet: Optional[str] = None


class AnalysisSummary(BaseModel):
    total_findings: int = 0
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0


class AnalysisReportResponse(BaseModel):
    status: str = "completed"
    file: str
    file_type: str
    risk_score: int = Field(..., ge=0, le=100)
    risk_level: RiskLevel
    summary: AnalysisSummary
    findings: List[FindingItem]
    recommendations: List[str]


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
