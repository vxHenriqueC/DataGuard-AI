# app.py
import json
from fastapi import FastAPI, File, UploadFile, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from database import init_db, save_analysis, get_user_analyses, get_user_stats, clear_user_analyses

from settings import settings
from database import (
    init_db, save_analysis, get_user_analyses, 
    get_user_stats, delete_session
)
from auth import register_user, login_user, get_current_user, security
from models import (
    UserRegister, UserLogin, UserResponse, UserUpdate,
    PasswordUpdate
)
from analyzer import analyze_file

# Inicializa o banco de dados
init_db()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================
# Rotas do Sistema & Autenticação
# ============================

@app.get("/")
async def root():
    return {"name": settings.APP_NAME, "version": settings.APP_VERSION, "status": "online"}

@app.post("/register")
async def register(user_data: UserRegister):
    return register_user(user_data)

@app.post("/login")
async def login(user_data: UserLogin):
    return login_user(user_data)

@app.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

@app.post("/logout")
async def logout(
    current_user: dict = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    # Remove a sessão ativa do banco de dados
    delete_session(credentials.credentials)
    return {"success": True, "message": "Logout realizado com sucesso."}


# ============================
# Rotas de Análise (Integradas ao Banco)
# ============================

@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    content = await file.read()
    
    # Executa a análise (Motor Híbrido)
    result = analyze_file(file.filename, content)
    
    if result.get("status") == "completed":
        # Salva o resultado no banco de dados para o histórico
        save_analysis(
            user_id=current_user["id"],
            file_name=result["file"],
            file_type=result["file_type"],
            risk_score=result["risk_score"],
            risk_level=result["risk_level"].value,
            alerts=result["summary"]["total_findings"],
            result_json=json.dumps(result)
        )
    
    return result

@app.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    # Busca estatísticas reais do banco
    stats = get_user_stats(current_user["id"])
    return {"success": True, **stats}

@app.get("/analyses")
async def get_analyses(current_user: dict = Depends(get_current_user)):
    # Busca histórico real do usuário
    history = get_user_analyses(current_user["id"])
    return {"success": True, "analyses": history}


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
        content={"success": False, "error": f"Erro interno do servidor: {str(exc)}"}
    )

@app.delete("/analyses")
async def clear_analyses(current_user: dict = Depends(get_current_user)):
    clear_user_analyses(current_user["id"])
    return {"message": "Histórico limpo com sucesso."}

