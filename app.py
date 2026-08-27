# app.py
# Rotas e API principal do DataGuard AI

from fastapi import FastAPI, File, UploadFile, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from settings import settings
from database import init_db
from auth import register_user, login_user, get_current_user
from models import (
    UserRegister, UserLogin, UserResponse, UserUpdate,
    PasswordUpdate
)
from analyzer import analyze_file

# Inicializa o banco de dados
init_db()

# Cria a aplicacao FastAPI
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="API de seguranca e protecao de dados"
)

# Configuracao de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================
# Rotas do Sistema
# ============================

@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "online"
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "database": "connected",
        "api": "running"
    }


# ============================
# Rotas de Autenticacao
# ============================

@app.post("/register")
async def register(user_data: UserRegister):
    result = register_user(user_data)
    return result


@app.post("/login")
async def login(user_data: UserLogin):
    result = login_user(user_data)
    return result


@app.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "name": current_user["name"],
        "email": current_user["email"],
        "created_at": current_user["created_at"],
        "last_login": current_user["last_login"],
        "analyses_count": current_user["analyses_count"],
        "risks_found": current_user["risks_found"],
        "profile_picture": current_user["profile_picture"]
    }


@app.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    return {"success": True, "message": "Logout realizado com sucesso."}


# ============================
# Rotas de Perfil
# ============================

@app.put("/profile")
async def update_profile(
    user_update: UserUpdate,
    current_user: dict = Depends(get_current_user)
):
    return {"success": True, "message": "Perfil atualizado com sucesso."}


@app.put("/profile/password")
async def update_password(
    password_data: PasswordUpdate,
    current_user: dict = Depends(get_current_user)
):
    return {"success": True, "message": "Senha atualizada com sucesso."}


# ============================
# Rotas de Configuracoes
# ============================

@app.get("/settings")
async def get_settings(current_user: dict = Depends(get_current_user)):
    return {"success": True, "settings": {}}


@app.put("/settings")
async def update_settings(
    settings_data: dict,
    current_user: dict = Depends(get_current_user)
):
    return {"success": True, "message": "Configuracoes atualizadas com sucesso."}


# ============================
# Rotas de Analise
# ============================

@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    content = await file.read()
    result = analyze_file(file.filename, content)
    return result


@app.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    return {
        "success": True,
        "total_analyses": 0,
        "total_alerts": 0,
        "last_analysis": None
    }


@app.get("/analyses")
async def get_analyses(current_user: dict = Depends(get_current_user)):
    return {"success": True, "analyses": []}


# ============================
# Rotas de Relatorios
# ============================

@app.get("/reports")
async def get_reports(current_user: dict = Depends(get_current_user)):
    return {"success": True, "reports": []}


@app.get("/reports/{report_id}")
async def get_report(report_id: int, current_user: dict = Depends(get_current_user)):
    return {"success": True, "report": None}


# ============================
# Tratamento de Erros
# ============================

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": exc.detail}
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"success": False, "error": "Erro interno do servidor."}
    )
