# app.py
import os
import json
from fastapi import FastAPI, File, UploadFile, Depends, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.security import HTTPAuthorizationCredentials

from settings import settings
from database import (
    init_db, save_analysis, get_user_analyses, get_analysis_by_id,
    delete_analysis_by_id, get_user_stats, clear_user_analyses,
    delete_session, get_user_settings, update_user_settings,
    update_user, get_user_by_email, get_user_sessions, delete_session_by_id
)
from auth import (
    register_user, login_user, get_current_user,
    change_user_password, security
)
from models import (
    UserRegister, UserLogin, UserResponse, UserUpdate,
    PasswordUpdate, UserSettingsUpdate
)
from analyzer import analyze_file

init_db()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Plataforma de Análise de Dados Sensíveis, Prevenção de Vazamentos (DLP) e Conformidade LGPD"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def _extract_device_info(request: Request) -> str:
    ua = request.headers.get("user-agent", "")
    if not ua:
        return "Navegador Web"
    if "Edg/" in ua:
        browser = "Microsoft Edge"
    elif "Chrome/" in ua:
        browser = "Google Chrome"
    elif "Firefox/" in ua:
        browser = "Mozilla Firefox"
    elif "Safari/" in ua:
        browser = "Apple Safari"
    else:
        browser = "Navegador Web"

    os_name = "Windows" if "Windows" in ua else "macOS" if "Mac OS" in ua else "Linux" if "Linux" in ua else "Dispositivo"
    return f"{browser} ({os_name})"


# ============================
# Rotas do Sistema & Front-end
# ============================

@app.get("/health")
async def health_check():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "online",
        "ai_configured": bool(settings.AI_API_KEY)
    }


@app.get("/")
async def root(request: Request):
    accept = request.headers.get("accept", "")
    index_path = os.path.join(BASE_DIR, "index.html")
    if "text/html" in accept and os.path.exists(index_path):
        return FileResponse(index_path)
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "online",
        "ai_configured": bool(settings.AI_API_KEY)
    }


@app.get("/app")
async def serve_app():
    index_path = os.path.join(BASE_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    raise HTTPException(status_code=404, detail="index.html não encontrado.")


@app.get("/style.css")
async def serve_css():
    css_path = os.path.join(BASE_DIR, "style.css")
    if os.path.exists(css_path):
        return FileResponse(css_path, media_type="text/css")
    raise HTTPException(status_code=404, detail="style.css não encontrado.")


@app.get("/script.js")
async def serve_js():
    js_path = os.path.join(BASE_DIR, "script.js")
    if os.path.exists(js_path):
        return FileResponse(js_path, media_type="application/javascript")
    raise HTTPException(status_code=404, detail="script.js não encontrado.")


# ============================
# Rotas de Autenticação
# ============================

@app.post("/register")
async def register(user_data: UserRegister, request: Request):
    return register_user(user_data, device_info=_extract_device_info(request))


@app.post("/login")
async def login(request: Request):
    """
    Suporta tanto JSON {"email": "...", "password": "..."}
    quanto application/x-www-form-urlencoded (username & password)
    para compatibilidade total.
    """
    content_type = request.headers.get("content-type", "")
    email = None
    password = None

    if "application/json" in content_type:
        body = await request.json()
        email = body.get("email") or body.get("username")
        password = body.get("password")
    else:
        form = await request.form()
        email = form.get("email") or form.get("username")
        password = form.get("password")

    if not email or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Informe o e-mail e a senha."
        )

    user_login = UserLogin(email=str(email), password=str(password))
    return login_user(user_login, device_info=_extract_device_info(request))


@app.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user


@app.post("/logout")
async def logout(
    current_user: dict = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    delete_session(credentials.credentials)
    return {"success": True, "message": "Logout realizado com sucesso."}


# ============================
# Rotas de Perfil, Senha, Sessões e Configurações
# ============================

@app.put("/profile")
async def update_profile(
    payload: UserUpdate,
    current_user: dict = Depends(get_current_user)
):
    fields = {}
    if payload.name:
        fields["name"] = payload.name.strip()
    if payload.email and payload.email.lower() != current_user["email"].lower():
        existing = get_user_by_email(payload.email)
        if existing and existing["id"] != current_user["id"]:
            raise HTTPException(status_code=400, detail="Este e-mail já está em uso por outra conta.")
        fields["email"] = payload.email.strip().lower()
    if payload.profile_picture is not None:
        fields["profile_picture"] = payload.profile_picture

    if fields:
        update_user(current_user["id"], **fields)

    updated = get_user_by_email(fields.get("email", current_user["email"]))
    return {
        "success": True,
        "message": "Perfil atualizado com sucesso.",
        "user": {
            "id": updated["id"],
            "name": updated["name"],
            "email": updated["email"]
        }
    }


@app.put("/profile/password")
async def update_password(
    payload: PasswordUpdate,
    current_user: dict = Depends(get_current_user)
):
    return change_user_password(current_user, payload)


@app.get("/settings")
async def read_settings(current_user: dict = Depends(get_current_user)):
    prefs = get_user_settings(current_user["id"])
    return {
        "success": True,
        "settings": prefs,
        "system": {
            "max_file_size_mb": settings.MAX_FILE_SIZE_MB,
            "allowed_extensions": settings.ALLOWED_EXTENSIONS,
            "ai_configured": bool(settings.AI_API_KEY),
            "ai_model": settings.AI_MODEL
        }
    }


@app.put("/settings")
async def save_settings(
    payload: UserSettingsUpdate,
    current_user: dict = Depends(get_current_user)
):
    update_data = payload.model_dump(exclude_none=True)
    update_user_settings(current_user["id"], **update_data)
    return {
        "success": True,
        "message": "Preferências salvas com sucesso.",
        "settings": get_user_settings(current_user["id"])
    }


@app.get("/sessions")
async def list_sessions(
    current_user: dict = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    raw_sessions = get_user_sessions(current_user["id"])
    current_token = credentials.credentials
    sanitized = []
    for s in raw_sessions:
        sanitized.append({
            "id": s["id"],
            "device_info": s.get("device_info") or "Navegador Web",
            "created_at": s["created_at"],
            "expires_at": s["expires_at"],
            "is_current": s["token"] == current_token
        })
    return {"success": True, "sessions": sanitized}


@app.delete("/sessions/{session_id}")
async def revoke_session(
    session_id: int,
    current_user: dict = Depends(get_current_user)
):
    removed = delete_session_by_id(session_id, current_user["id"])
    if not removed:
        raise HTTPException(status_code=404, detail="Sessão não encontrada.")
    return {"success": True, "message": "Sessão encerrada com sucesso."}


# ============================
# Rotas de Análise e Histórico (SQLite)
# ============================

@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    content = await file.read()
    result = analyze_file(file.filename or "documento", content)

    if result.get("status") == "error":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Falha ao validar ou processar o arquivo.")
        )

    user_prefs = get_user_settings(current_user["id"])
    privacy_cfg = user_prefs.get("privacy") if isinstance(user_prefs.get("privacy"), dict) else {}
    should_save = privacy_cfg.get("save_history", True)

    if result.get("status") == "completed" and should_save:
        risk_level_val = (
            result["risk_level"].value
            if hasattr(result["risk_level"], "value")
            else str(result["risk_level"])
        )
        analysis_id = save_analysis(
            user_id=current_user["id"],
            file_name=result["file"],
            file_type=result["file_type"],
            risk_score=result["risk_score"],
            risk_level=risk_level_val,
            alerts=result["summary"]["total_findings"],
            result_json=json.dumps(result, ensure_ascii=False)
        )
        result["id"] = analysis_id

    return result


@app.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    stats = get_user_stats(current_user["id"])
    return {"success": True, **stats}


@app.get("/analyses")
async def get_analyses(current_user: dict = Depends(get_current_user)):
    history = get_user_analyses(current_user["id"])
    return {"success": True, "analyses": history}


@app.get("/analyses/{analysis_id}")
async def get_single_analysis(
    analysis_id: int,
    current_user: dict = Depends(get_current_user)
):
    row = get_analysis_by_id(analysis_id, user_id=current_user["id"])
    if not row:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")
    parsed_result = None
    if row.get("result_json"):
        try:
            parsed_result = json.loads(row["result_json"])
        except json.JSONDecodeError:
            parsed_result = None
    return {"success": True, "analysis": row, "report": parsed_result}


@app.delete("/analyses/{analysis_id}")
async def remove_single_analysis(
    analysis_id: int,
    current_user: dict = Depends(get_current_user)
):
    deleted = delete_analysis_by_id(analysis_id, current_user["id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Registro de análise não encontrado.")
    return {"success": True, "message": "Análise removida com sucesso."}


@app.delete("/analyses")
async def clear_analyses(current_user: dict = Depends(get_current_user)):
    deleted_count = clear_user_analyses(current_user["id"])
    return {"success": True, "deleted": deleted_count, "message": "Histórico limpo com sucesso."}


# ============================
# Tratamento de Erros Consistente
# ============================

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": exc.detail, "detail": exc.detail}
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": "Ocorreu um erro interno ao processar sua solicitação.",
            "detail": str(exc) if settings.DEBUG else "Erro interno do servidor."
        }
    )
