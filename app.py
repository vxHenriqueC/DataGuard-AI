from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

# ==========================================
# DATA GUARD AI - BACKEND
# ==========================================

app = FastAPI(
    title="DataGuard AI",
    description="API de análise e proteção de documentos",
    version="1.0.0"
)

# ==========================================
# CONFIGURAÇÃO CORS
# ==========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# ROTA PRINCIPAL
# ==========================================

@app.get("/")
def home():
    return {
        "status": "online",
        "sistema": "DataGuard AI",
        "mensagem": "Backend funcionando corretamente!"
    }


# ==========================================
# STATUS DA API
# ==========================================

@app.get("/status")
def status():
    return {
        "online": True,
        "sistema": "DataGuard AI",
        "versao": "1.0.0"
    }


# ==========================================
# UPLOAD E ANÁLISE DO ARQUIVO
# ==========================================

@app.post("/analisar")
async def analisar_arquivo(file: UploadFile = File(...)):

    # Lê o arquivo enviado
    arquivo = await file.read()

    # Informações básicas
    nome = file.filename
    tamanho = len(arquivo)
    tipo = file.content_type

    return {
        "status": "sucesso",
        "arquivo": {
            "nome": nome,
            "tamanho": tamanho,
            "tipo": tipo
        },
        "analise": {
            "status": "pendente",
            "mensagem": "Arquivo recebido. A análise de dados sensíveis será executada."
        }
    }


# ==========================================
# TESTE
# ==========================================

@app.get("/teste")
def teste():
    return {
        "mensagem": "DataGuard AI está funcionando!"
    }