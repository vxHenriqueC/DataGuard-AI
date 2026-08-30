# detectors.py
import re
from typing import List
from models import ExtractedUnit, FindingItem, RiskLevel

# Padrões Regex
CPF_PATTERN = re.compile(r"\b\d{3}[\.\s]?\d{3}[\.\s]?\d{3}[\-\s]?\d{2}\b")
EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
CREDIT_CARD_PATTERN = re.compile(r"\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14})\b")
PASSWORD_PATTERN = re.compile(r"(?:senha|password|passwd|pwd)[\s:=]+[\"\']?([^\"\'\s\n]{4,})[\"\']?", re.IGNORECASE)

def hybrid_detection(units: List[ExtractedUnit]) -> List[FindingItem]:
    findings = []
    for unit in units:
        text = unit.text
        
        # --- DADOS CRÍTICOS (Risco Máximo) ---
        for match in CREDIT_CARD_PATTERN.findall(text):
            findings.append(FindingItem(
                type="Cartão de Crédito", location=unit.location, risk=RiskLevel.CRITICO,
                value_masked=f"**** **** **** {match[-4:]}", reason="Dado financeiro que permite fraude direta.",
                recommendation="Truncar o número do cartão no banco de dados e apagar o original.", context_snippet=text[:50]
            ))
        
        # --- DADOS ALTOS (Risco de Acesso) ---
        for match in PASSWORD_PATTERN.findall(text):
            findings.append(FindingItem(
                type="Senha Exposta", location=unit.location, risk=RiskLevel.ALTO,
                value_masked="********", reason="Credencial de acesso exposta em texto claro.",
                recommendation="Forçar a rotação (troca) da senha no sistema e apagar este registro.", context_snippet=text[:50]
            ))

        # --- DADOS MÉDIOS (Risco LGPD) ---
        for match in CPF_PATTERN.findall(text):
            findings.append(FindingItem(
                type="CPF", location=unit.location, risk=RiskLevel.MEDIO,
                value_masked=f"***.***.***-{match[-2:]}", reason="Dado pessoal direto (Sujeito a multas da LGPD).",
                recommendation="Mascarar o CPF (anomimização) antes de tramitar o documento.", context_snippet=text[:50]
            ))

        # --- DADOS BAIXOS (Risco de Contato) ---
        for match in EMAIL_PATTERN.findall(text):
            findings.append(FindingItem(
                type="E-mail", location=unit.location, risk=RiskLevel.BAIXO,
                value_masked=f"{match[:3]}***@{match.split('@')[-1]}", reason="Dado de contato padrão.",
                recommendation="Evitar tráfego de listas de e-mails em redes não criptografadas.", context_snippet=text[:50]
            ))

    return findings
