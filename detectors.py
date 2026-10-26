import re
from typing import List
from models import ExtractedUnit, FindingItem, RiskLevel

# Padrões Regex Auditados
CPF_PATTERN = re.compile(r"\b\d{3}[\.\s]?\d{3}[\.\s]?\d{3}[\-\s]?\d{2}\b")
CNPJ_PATTERN = re.compile(r"\b\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}\b")
EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
CREDIT_CARD_PATTERN = re.compile(r"\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b")
PASSWORD_PATTERN = re.compile(r"(?:senha|password|passwd|pwd|secret_key|api_key)[\s:=]+[\"\']?([^\"\'\s\n]{4,})[\"\']?", re.IGNORECASE)
PRIVATE_KEY_OR_JWT_PATTERN = re.compile(
    r"(?:-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z\-_]{35})"
)


def _safe_snippet(text: str, max_len: int = 80) -> str:
    clean = " ".join(text.strip().split())
    return (clean[:max_len] + "...") if len(clean) > max_len else clean


def hybrid_detection(units: List[ExtractedUnit]) -> List[FindingItem]:
    findings: List[FindingItem] = []

    for unit in units:
        text = unit.text
        snippet = _safe_snippet(text)

        # --- 1. DADOS CRÍTICOS (Cartões de Crédito e Chaves Privadas / Tokens) ---
        for match in CREDIT_CARD_PATTERN.findall(text):
            rec = "Truncar o número do cartão no banco de dados (PCI-DSS) e apagar o registro original."
            findings.append(FindingItem(
                type="Cartão de Crédito",
                location=unit.location,
                risk=RiskLevel.CRITICO,
                value_masked=f"**** **** **** {match[-4:]}",
                reason="Dado financeiro crítico sujeito a fraude direta e normas PCI-DSS.",
                recommendation=rec,
                action=rec,
                context_snippet=snippet
            ))

        for match in PRIVATE_KEY_OR_JWT_PATTERN.findall(text):
            masked = f"{match[:10]}...[REDACTED]" if len(match) > 12 else "KEY...[REDACTED]"
            rec = "Revogar imediatamente a chave/token exposto e movê-lo para variáveis de ambiente seguras (.env / Vault)."
            findings.append(FindingItem(
                type="Chave Privada",
                location=unit.location,
                risk=RiskLevel.CRITICO,
                value_masked=masked,
                reason="Chave criptográfica, token JWT ou chave de API exposta em texto claro.",
                recommendation=rec,
                action=rec,
                context_snippet=snippet
            ))

        # --- 2. DADOS ALTOS (Senhas e Credenciais Expostas) ---
        for _ in PASSWORD_PATTERN.findall(text):
            rec = "Forçar a rotação imediata da credencial no sistema e expurgar este documento."
            findings.append(FindingItem(
                type="Senha Exposta",
                location=unit.location,
                risk=RiskLevel.ALTO,
                value_masked="********",
                reason="Credencial de acesso exposta em texto claro.",
                recommendation=rec,
                action=rec,
                context_snippet=snippet
            ))

        # --- 3. DADOS MÉDIOS (Identificadores LGPD: CPF / CNPJ) ---
        for match in CPF_PATTERN.findall(text):
            rec = "Mascarar o CPF (anonimização/pseudonimização) antes de tramitar ou compartilhar o documento."
            findings.append(FindingItem(
                type="CPF",
                location=unit.location,
                risk=RiskLevel.MEDIO,
                value_masked=f"***.***.***-{match[-2:]}",
                reason="Dado pessoal direto protegido pela LGPD (Art. 5º, I).",
                recommendation=rec,
                action=rec,
                context_snippet=snippet
            ))

        for match in CNPJ_PATTERN.findall(text):
            rec = "Validar necessidade de exposição cadastral ou restringir circulação ao escopo contratual."
            findings.append(FindingItem(
                type="CNPJ",
                location=unit.location,
                risk=RiskLevel.BAIXO,
                value_masked=f"**.***.***/****-{match[-2:]}",
                reason="Identificador cadastral empresarial.",
                recommendation=rec,
                action=rec,
                context_snippet=snippet
            ))

        # --- 4. DADOS BAIXOS (Risco de Contato / Phishing) ---
        for match in EMAIL_PATTERN.findall(text):
            domain = match.split("@")[-1]
            prefix = match[:3] if len(match.split("@")[0]) >= 3 else match[:1]
            rec = "Evitar tráfego de listas de e-mails sem controle de acesso ou criptografia."
            findings.append(FindingItem(
                type="E-mail",
                location=unit.location,
                risk=RiskLevel.BAIXO,
                value_masked=f"{prefix}***@{domain}",
                reason="Dado de contato identificável sujeito a engenharia social.",
                recommendation=rec,
                action=rec,
                context_snippet=snippet
            ))

    return findings
