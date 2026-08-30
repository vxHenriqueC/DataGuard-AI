# analyzer.py
from typing import Dict, Any, List
from file_reader import read_file_structural
from detectors import hybrid_detection
from ai_engine import analyze_with_ai
from models import AnalysisReportResponse, AnalysisSummary, RiskLevel

def define_file_risk_and_actions(summary: AnalysisSummary) -> tuple[int, RiskLevel, List[str]]:
    """
    Identifica o risco global do arquivo com base na combinação (conjunto)
    de vulnerabilidades e define as ações/recomendações globais.
    """
    # Cálculo do Score (0 a 100) baseado no conjunto de dados encontrados
    risk_score = min(100, (summary.critical * 35) + (summary.high * 20) + (summary.medium * 10) + (summary.low * 5))
    
    actions = []
    
    # 1. Avaliação de Risco CRÍTICO
    if summary.critical > 0:
        risk_level = RiskLevel.CRITICO
        actions.append("BLOQUEIO IMEDIATO: O arquivo contém dados críticos (Cartões de crédito, Tokens JWT ou Chaves Privadas).")
        actions.append("AÇÃO TÉCNICA: Excluir o arquivo de ambientes de compartilhamento e revogar chaves/cartões expostos.")
        
    # 2. Avaliação de Risco ALTO
    elif risk_score >= 70 or summary.high > 0:
        risk_level = RiskLevel.ALTO
        actions.append("QUARENTENA: Arquivo de alto risco devido à presença de senhas ou volume perigoso de dados sensíveis.")
        actions.append("AÇÃO TÉCNICA: Criptografar o arquivo em repouso e restringir o acesso exclusivamente aos administradores.")
        
    # 3. Avaliação de Risco MÉDIO
    elif risk_score >= 40 or summary.medium > 0:
        risk_level = RiskLevel.MEDIO
        actions.append("ATENÇÃO: O arquivo contém dados pessoais identificáveis (LGPD).")
        actions.append("AÇÃO TÉCNICA: Aplicar mascaramento (anonimização) nos dados pessoais antes de tramitar o documento.")
        
    # 4. Avaliação de Risco BAIXO
    elif summary.total_findings > 0:
        risk_level = RiskLevel.BAIXO
        actions.append("MONITORAMENTO: Arquivo contém informações de baixo impacto (ex: e-mails públicos).")
        actions.append("AÇÃO TÉCNICA: Uso interno liberado, mas evite exposição pública.")
        
    # 5. Arquivo Seguro
    else:
        risk_level = RiskLevel.BAIXO
        actions.append("LIBERADO: Nenhum dado sensível detectado. Arquivo seguro para tráfego normal.")
        
    # REGRA DE CONJUNTO (Volume massivo eleva o risco automaticamente)
    if summary.medium > 50:
        actions.append("ALERTA DE VAZAMENTO EM MASSA: Volume extremo de dados pessoais detectado. Acionar o DPO.")
        risk_level = RiskLevel.ALTO # Força a elevação do risco do arquivo
        risk_score = max(risk_score, 85)

    return risk_score, risk_level, actions

def analyze_file(file_name: str, content: bytes) -> Dict[str, Any]:
    # 1. Extração Estruturada
    extraction = read_file_structural(file_name, content)
    if not extraction.success:
        return {"status": "error", "file": file_name, "error": extraction.error}

    # 2. Detecção Híbrida e IA
    det_findings = hybrid_detection(extraction.units)
    final_findings = analyze_with_ai(extraction.units, det_findings)

    # 3. Sumarização do Conjunto
    summary = AnalysisSummary()
    for f in final_findings:
        if f.risk == RiskLevel.CRITICO: summary.critical += 1
        elif f.risk == RiskLevel.ALTO: summary.high += 1
        elif f.risk == RiskLevel.MEDIO: summary.medium += 1
        else: summary.low += 1
    summary.total_findings = len(final_findings)

    # 4. Definição do Nível do Arquivo e Ações Globais
    risk_score, risk_level, global_actions = define_file_risk_and_actions(summary)

    # 5. Mescla ações globais com as correções específicas de cada dado
    all_recommendations = global_actions.copy()
    for f in final_findings:
        if f.recommendation not in all_recommendations:
            all_recommendations.append(f.recommendation)

    return AnalysisReportResponse(
        status="completed", 
        file=extraction.file_name, 
        file_type=extraction.file_type,
        risk_score=risk_score, 
        risk_level=risk_level, 
        summary=summary,
        findings=final_findings, 
        recommendations=all_recommendations
    ).model_dump()
