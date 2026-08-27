# risk.py
# Cálculo do score e classificação de risco do DataGuard AI

from typing import List
from detectors import DetectionResult


# ============================
# Configuração de Pesos
# ============================

# Peso base por tipo de dado (0 a 100)
RISK_WEIGHTS = {
    "CPF": 25,
    "CNPJ": 25,
    "E-mail": 5,
    "Telefone": 20,
    "CEP": 5,
    "Cartão de Crédito": 50,
    "Dado Bancário": 25,
    "Senha Exposta": 60,
    "Token": 55,
    "API Key": 55,
    "Chave Privada": 70,
    "Endereço IP": 5,
}

# Multiplicador por quantidade encontrada
QUANTITY_MULTIPLIERS = {
    1: 1.0,
    2: 1.2,
    3: 1.4,
    4: 1.6,
    5: 1.8,
}

# Multiplicador para credenciais (dados críticos)
CREDENTIAL_MULTIPLIER = 1.5

# Tipos considerados credenciais críticas
CRITICAL_TYPES = {"Senha Exposta", "Token", "API Key", "Chave Privada", "Cartão de Crédito"}


# ============================
# Classificação de Risco
# ============================

def classify_risk(score: int) -> str:
    """Classifica o nível de risco baseado no score (0-100)."""
    if score <= 39:
        return "Baixo"
    elif score <= 69:
        return "Médio"
    else:
        return "Alto"


def get_risk_color(level: str) -> str:
    """Retorna a cor associada ao nível de risco."""
    colors = {
        "Baixo": "#22c55e",   # verde
        "Médio": "#f59e0b",   # amarelo/laranja
        "Alto": "#ef4444",    # vermelho
    }
    return colors.get(level, "#6b7280")


# ============================
# Cálculo de Score
# ============================

def calculate_risk_score(results: List[DetectionResult]) -> int:
    """Calcula o score de risco total baseado nos dados encontrados."""
    if not results:
        return 0

    total_score = 0
    has_critical = False

    for result in results:
        # Peso base do tipo de dado
        base_weight = RISK_WEIGHTS.get(result.type, 10)

        # Multiplicador por quantidade
        quantity = result.count
        if quantity >= 5:
            qty_multiplier = 2.0
        else:
            qty_multiplier = QUANTITY_MULTIPLIERS.get(quantity, 1.0)

        # Verifica se é crítico
        if result.type in CRITICAL_TYPES:
            has_critical = True
            item_score = base_weight * qty_multiplier * CREDENTIAL_MULTIPLIER
        else:
            item_score = base_weight * qty_multiplier

        total_score += item_score

    # Se houver dados críticos, adiciona bônus
    if has_critical:
        total_score += 15

    # Limita o score entre 0 e 100
    final_score = min(int(total_score), 100)

    return final_score


def generate_recommendations(results: List[DetectionResult]) -> List[str]:
    """Gera recomendações baseadas nos dados sensíveis encontrados."""
    recommendations = []

    # Recomendações baseadas em tipos encontrados
    found_types = {r.type for r in results}

    if "Senha Exposta" in found_types or "Token" in found_types or "API Key" in found_types:
        recommendations.append("Remover credenciais expostas do arquivo imediatamente.")
        recommendations.append("Revogar tokens e API keys comprometidos.")

    if "Cartão de Crédito" in found_types or "Dado Bancário" in found_types:
        recommendations.append("Remover dados financeiros sensíveis do arquivo.")
        recommendations.append("Aplicar criptografia para dados financeiros armazenados.")

    if "CPF" in found_types or "CNPJ" in found_types:
        recommendations.append("Anonimizar ou mascarar dados pessoais identificáveis.")

    if "E-mail" in found_types or "Telefone" in found_types:
        recommendations.append("Revisar a necessidade de manter dados de contato no arquivo.")

    if "Chave Privada" in found_types:
        recommendations.append("Gerar novas chaves privadas e revogar as expostas.")

    # Recomendações gerais
    if len(results) > 3:
        recommendations.append("O arquivo contém múltiplos tipos de dados sensíveis. Revisar política de dados.")

    recommendations.append("Aplicar criptografia para dados armazenados.")
    recommendations.append("Evitar o armazenamento de credenciais em arquivos de texto.")

    # Remove duplicatas mantendo ordem
    seen = set()
    unique_recommendations = []
    for rec in recommendations:
        if rec not in seen:
            seen.add(rec)
            unique_recommendations.append(rec)

    return unique_recommendations


def count_alerts(results: List[DetectionResult]) -> int:
    """Conta o número total de alertas (ocorrências de dados sensíveis)."""
    return sum(r.count for r in results)
