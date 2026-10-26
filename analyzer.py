# analyzer.py
from datetime import datetime
from typing import Dict, Any, List
from file_reader import read_file_structural
from detectors import hybrid_detection
from ai_engine import analyze_with_ai
from settings import settings
from models import AnalysisReportResponse, AnalysisSummary, RiskLevel


def define_file_risk_and_actions(summary: AnalysisSummary) -> tuple[int, RiskLevel, List[str]]:
   
    risk_score = min(
        100,
        (summary.critical * 35) + (summary.high * 20) + (summary.medium * 10) + (summary.low * 5)
    )

    actions: List[str] = []

    if summary.critical > 0:
        risk_level = RiskLevel.CRITICO
        actions.append("BLOQUEIO IMEDIATO: O arquivo contém dados críticos (Cartões de crédito, Tokens JWT ou Chaves Privadas).")
        actions.append("AÇÃO TÉCNICA: Excluir o arquivo de ambientes de compartilhamento e revogar chaves/cartões expostos.")

    elif risk_score >= 70 or summary.high > 0:
        risk_level = RiskLevel.ALTO
        actions.append("QUARENTENA: Arquivo de alto risco devido à presença de senhas ou volume perigoso de dados sensíveis.")
        actions.append("AÇÃO TÉCNICA: Criptografar o arquivo em repouso e restringir o acesso exclusivamente aos administradores.")

    elif risk_score >= 40 or summary.medium > 0:
        risk_level = RiskLevel.MEDIO
        actions.append("ATENÇÃO: O arquivo contém dados pessoais identificáveis (LGPD).")
        actions.append("AÇÃO TÉCNICA: Aplicar mascaramento (anonimização) nos dados pessoais antes de tramitar o documento.")

    elif summary.total_findings > 0:
        risk_level = RiskLevel.BAIXO
        actions.append("MONITORAMENTO: Arquivo contém informações de baixo impacto (ex: e-mails ou cadastros públicos).")
        actions.append("AÇÃO TÉCNICA: Uso interno liberado, mas evite exposição pública desnecessária.")

    else:
        risk_level = RiskLevel.BAIXO
        actions.append("LIBERADO: Nenhum dado sensível detectado. Arquivo seguro para tráfego normal.")

    if summary.medium > 50:
        actions.append("ALERTA DE VAZAMENTO EM MASSA: Volume extremo de dados pessoais detectado. Acionar o DPO.")
        risk_level = RiskLevel.ALTO
        risk_score = max(risk_score, 85)

    return risk_score, risk_level, actions


def analyze_file(file_name: str, content: bytes) -> Dict[str, Any]:
    extraction = read_file_structural(file_name, content)
    if not extraction.success:
        return {
            "status": "error",
            "file": extraction.file_name,
            "file_name": extraction.file_name,
            "error": extraction.error
        }

    det_findings = hybrid_detection(extraction.units)
    final_findings = analyze_with_ai(extraction.units, det_findings)

    summary = AnalysisSummary()
    for f in final_findings:
        if f.risk == RiskLevel.CRITICO:
            summary.critical += 1
        elif f.risk == RiskLevel.ALTO:
            summary.high += 1
        elif f.risk == RiskLevel.MEDIO:
            summary.medium += 1
        else:
            summary.low += 1
    summary.total_findings = len(final_findings)

    risk_score, risk_level, global_actions = define_file_risk_and_actions(summary)

    all_recommendations = global_actions.copy()
    for f in final_findings:
        if f.recommendation and f.recommendation not in all_recommendations:
            all_recommendations.append(f.recommendation)

    ai_mode = "hybrid_ai" if (settings.AI_ENABLED and bool(settings.AI_API_KEY)) else "deterministic_engine"

    report = AnalysisReportResponse(
        status="completed",
        file=extraction.file_name,
        file_name=extraction.file_name,
        file_type=extraction.file_type,
        file_size=extraction.file_size,
        risk_score=risk_score,
        risk_level=risk_level,
        total_alerts=summary.total_findings,
        summary=summary,
        findings=final_findings,
        recommendations=all_recommendations,
        ai_mode=ai_mode,
        created_at=datetime.utcnow().isoformat()
    )
    return report.model_dump(mode="json")
