# detectors.py
# Detecao de dados sensiveis utilizando padroes e expressoes regulares

import re
from typing import List
from dataclasses import dataclass


# ============================
# Estrutura de Resultado
# ============================

@dataclass
class DetectionResult:
    type: str
    count: int
    severity: str
    samples: List[str]


# ============================
# Padroes de Expressoes Regulares
# ============================

# --- Dados Pessoais ---
CPF_PATTERN = re.compile(r"\b\d{3}[\.\s]?\d{3}[\.\s]?\d{3}[\-\s]?\d{2}\b")
CNPJ_PATTERN = re.compile(r"\b\d{2}[\.\s]?\d{3}[\.\s]?\d{3}[\/\s]?\d{4}[\-\s]?\d{2}\b")
EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
PHONE_PATTERN = re.compile(r"\b(?:\+?55\s?)?(?:\(?\d{2}\)?[\s\-]?)?\d{4,5}[\s\-]?\d{4}\b")
CEP_PATTERN = re.compile(r"\b\d{5}[\-\s]?\d{3}\b")

# --- Dados Financeiros ---
CREDIT_CARD_PATTERN = re.compile(
    r"\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|"
    r"3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|"
    r"(?:2131|1800|35\d{3})\d{11})\b"
)
BANK_DATA_PATTERN = re.compile(
    r"\b(?:ag[eê]ncia|ag)[\s:=]+\d{1,5}[\s,;]+(?:conta|cc)[\s:=]+\d{1,20}\b",
    re.IGNORECASE
)

# --- Credenciais ---
PASSWORD_PATTERN = re.compile(
    r"(?:senha|password|passwd|pwd)[\s:=]+[\"\']?([^\"\'\s\n]{4,})[\"\']?",
    re.IGNORECASE
)
TOKEN_PATTERN = re.compile(r"\b(?:sk-|ghp-|gho-|glpat-)[a-zA-Z0-9_\-]{20,}\b")
API_KEY_PATTERN = re.compile(
    r"(?:api[_-]?key|apikey|secret[_-]?key|access[_-]?key)[\s:=]+[\"\']?([a-zA-Z0-9_\-]{16,})[\"\']?",
    re.IGNORECASE
)
PRIVATE_KEY_PATTERN = re.compile(
    r"-----BEGIN (?:RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----",
    re.IGNORECASE
)

# --- Rede ---
IP_PATTERN = re.compile(
    r"\b(?:\d{1,3}\.){3}\d{1,3}\b|\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b"
)


# ============================
# Mascaramento
# ============================

def mask_cpf(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if len(digits) == 11:
        return f"***.***.***-{digits[-2:]}"
    return "***.***.***-**"


def mask_cnpj(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if len(digits) == 14:
        return f"**.***.***/****-{digits[-2:]}"
    return "**.***.***/****-**"


def mask_email(value: str) -> str:
    parts = value.split("@")
    if len(parts) == 2:
        local = parts[0]
        if len(local) > 1:
            return f"{local[0]}{'*' * (len(local) - 1)}@{parts[1]}"
    return "***@***.***"


def mask_phone(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if len(digits) >= 8:
        return f"(**) *****-{digits[-4:]}"
    return "(**) *****-****"


def mask_credit_card(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if len(digits) >= 4:
        return f"**** **** **** {digits[-4:]}"
    return "**** **** **** ****"


def mask_generic(value: str, visible_start: int = 2, visible_end: int = 2) -> str:
    if len(value) <= visible_start + visible_end:
        return "*" * len(value)
    return f"{value[:visible_start]}{'*' * (len(value) - visible_start - visible_end)}{value[-visible_end:]}"


def mask_value(value: str, data_type: str) -> str:
    maskers = {
        "CPF": mask_cpf,
        "CNPJ": mask_cnpj,
        "E-mail": mask_email,
        "Telefone": mask_phone,
        "Cartao de Credito": mask_credit_card,
        "CEP": lambda x: "*****-" + re.sub(r"\D", "", x)[-3:],
        "Senha Exposta": lambda x: "*" * len(x),
        "Token": lambda x: f"{x[:4]}{'*' * (len(x) - 4)}",
        "API Key": lambda x: f"{x[:4]}{'*' * (len(x) - 4)}",
        "Chave Privada": lambda x: "-----BEGIN PRIVATE KEY-----\n[CONTEUDO OCULTO]\n-----END PRIVATE KEY-----",
        "Endereco IP": lambda x: f"***.***.***.{x.split('.')[-1]}",
        "Dado Bancario": lambda x: "*** DADO BANCARIO ***",
    }
    masker = maskers.get(data_type, lambda x: mask_generic(x))
    return masker(value)


# ============================
# Detectores
# ============================

def detect_pattern(text: str, pattern: re.Pattern, data_type: str, severity: str):
    matches = pattern.findall(text)
    if not matches:
        return None

    # Remove duplicatas mantendo ordem
    unique_matches = list(dict.fromkeys(matches))

    # Limita amostras a 3
    samples = [mask_value(str(m), data_type) for m in unique_matches[:3]]

    return DetectionResult(
        type=data_type,
        count=len(unique_matches),
        severity=severity,
        samples=samples
    )


def analyze_text(text: str) -> List[DetectionResult]:
    results = []

    detectors = [
        (CPF_PATTERN, "CPF", "Medio"),
        (CNPJ_PATTERN, "CNPJ", "Medio"),
        (EMAIL_PATTERN, "E-mail", "Baixo"),
        (PHONE_PATTERN, "Telefone", "Medio"),
        (CEP_PATTERN, "CEP", "Baixo"),
        (CREDIT_CARD_PATTERN, "Cartao de Credito", "Alto"),
        (BANK_DATA_PATTERN, "Dado Bancario", "Medio"),
        (PASSWORD_PATTERN, "Senha Exposta", "Alto"),
        (TOKEN_PATTERN, "Token", "Alto"),
        (API_KEY_PATTERN, "API Key", "Alto"),
        (PRIVATE_KEY_PATTERN, "Chave Privada", "Alto"),
        (IP_PATTERN, "Endereco IP", "Baixo"),
    ]

    for pattern, data_type, severity in detectors:
        result = detect_pattern(text, pattern, data_type, severity)
        if result:
            results.append(result)

    return results


# ============================
# Configuracao de Detectores
# ============================

DETECTOR_CONFIG = {
    "CPF": {"enabled": True, "severity": "Medio"},
    "CNPJ": {"enabled": True, "severity": "Medio"},
    "E-mail": {"enabled": True, "severity": "Baixo"},
    "Telefone": {"enabled": True, "severity": "Medio"},
    "CEP": {"enabled": True, "severity": "Baixo"},
    "Cartao de Credito": {"enabled": True, "severity": "Alto"},
    "Dado Bancario": {"enabled": True, "severity": "Medio"},
    "Senha Exposta": {"enabled": True, "severity": "Alto"},
    "Token": {"enabled": True, "severity": "Alto"},
    "API Key": {"enabled": True, "severity": "Alto"},
    "Chave Privada": {"enabled": True, "severity": "Alto"},
    "Endereco IP": {"enabled": True, "severity": "Baixo"},
}
