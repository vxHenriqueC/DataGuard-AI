# auth.py
# Cadastro, login, JWT e autenticacao do DataGuard AI

from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from settings import settings
from database import (
    create_user, get_user_by_email, get_user_by_id,
    update_last_login, create_session
)
from models import UserRegister, UserLogin, UserResponse

# Esquema de seguranca para Bearer Token
security = HTTPBearer()


# ============================
# Hash de Senhas (bcrypt nativo)
# ============================

def hash_password(password: str) -> str:
    # Gera hash seguro da senha usando bcrypt nativo
    # bcrypt limita a 72 bytes
    password_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Verifica se a senha corresponde ao hash
    password_bytes = plain_password.encode("utf-8")[:72]
    hashed_bytes = hashed_password.encode("utf-8")
    return bcrypt.checkpw(password_bytes, hashed_bytes)


# ============================
# JWT - Tokens
# ============================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    # Cria um token JWT de acesso
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Optional[dict]:
    # Decodifica e valida um token JWT
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


# ============================
# Autenticacao de Usuario
# ============================

def authenticate_user(email: str, password: str):
    # Autentica um usuario pelo e-mail e senha
    user = get_user_by_email(email)
    if not user:
        return None
    if not verify_password(password, user["password_hash"]):
        return None
    return user


# ============================
# Dependencia de Rota Protegida
# ============================

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    # Obtem o usuario atual a partir do token JWT
    token = credentials.credentials
    payload = decode_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalido ou expirado.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalido.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = get_user_by_id(int(user_id))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario nao encontrado.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


# ============================
# Servicos de Registro e Login
# ============================

def register_user(user_data: UserRegister) -> dict:
    # Registra um novo usuario
    # Verifica se as senhas coincidem
    if user_data.password != user_data.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="As senhas nao coincidem."
        )

    # Verifica se o e-mail ja existe
    existing = get_user_by_email(user_data.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="E-mail ja cadastrado."
        )

    # Cria o hash da senha
    password_hash = hash_password(user_data.password)

    # Cria o usuario no banco
    user_id = create_user(user_data.name, user_data.email, password_hash)

    # Gera o token JWT
    access_token = create_access_token(data={"sub": str(user_id)})

    return {
        "success": True,
        "message": "Usuario cadastrado com sucesso.",
        "access_token": access_token,
        "token_type": "bearer"
    }


def login_user(user_data: UserLogin) -> dict:
    # Realiza o login do usuario
    user = authenticate_user(user_data.email, user_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos."
        )

    # Atualiza ultimo login
    update_last_login(user["id"])

    # Gera o token JWT
    access_token = create_access_token(data={"sub": str(user["id"])})

    # Cria sessao no banco
    expires_at = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    create_session(user["id"], access_token, expires_at)

    return {
        "success": True,
        "message": "Login realizado com sucesso.",
        "access_token": access_token,
        "token_type": "bearer"
    }

