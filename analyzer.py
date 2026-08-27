# analyzer.py
# Processo principal de análise do DataGuard AI

from typing import Dict, Any
from file_reader import read_file
from detectors import analyze_text, DetectionResult
from risk import calculate_risk_score, classify_risk, generate_recommendations, count_alerts
from models import AnalysisResult, SensitiveDataFound, RiskLevel


def analyze_file(file_name: str, content: bytes) -> Dict[str, Any]:
    """
    Processo principal de análise de um arquivo.

    Fluxo:
    1. Lê o arquivo
    2. Detecta dados sensíveis
    3. Calcula score de risco
    4. Gera recomendações
    5. Retorna resultado estruturado
    """

    # Etapa 1: Lê o arquivo
    file_result = read_file(file_name, content)
    if not file_result["success"]:
        return file_result

    text_content = file_result["content"]
    file_type = file_result["file_type"]

    # Etapa 2: Detecta dados sensíveis
    detections = analyze_text(text_content)

    # Etapa 3: Calcula score de risco
    risk_score = calculate_risk_score(detections)
    risk_level = classify_risk(risk_score)

    # Etapa 4: Gera recomendações
    recommendations = generate_recommendations(detections)

    # Etapa 5: Conta alertas
    alerts = count_alerts(detections)

    # Converte detecções para o formato do modelo
    sensitive_data = [
        SensitiveDataFound(
            type=d.type,
            count=d.count,
            severity=d.severity,
            samples=d.samples
        ) for d in detections
    ]

    # Monta o resultado final
    result = AnalysisResult(
        success=True,
        file_name=file_name,
        file_type=file_type,
        risk_score=risk_score,
        risk_level=RiskLevel(risk_level),
        sensitive_data=sensitive_data,
        alerts=alerts,
        recommendations=recommendations
    )

    return result.model_dump()
