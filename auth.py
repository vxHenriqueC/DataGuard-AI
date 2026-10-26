from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from settings import settings
from database import (
    create_user, get_user_by_email, get_user_by_id,
    update_last_login, create_session, update_user
)
from models import UserRegister, UserLogin, PasswordUpdate

security = HTTPBearer()


# ============================
# Hash de Senhas (bcrypt nativo)
# ============================

def hash_password(password: str) -> str:
    password_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    password_bytes = plain_password.encode("utf-8")[:72]
    hashed_bytes = hashed_password.encode("utf-8")
    return bcrypt.checkpw(password_bytes, hashed_bytes)


# ============================
# JWT - Tokens
# ============================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


# ============================
# Autenticação de Usuário
# ============================

def authenticate_user(email: str, password: str):
    user = get_user_by_email(email)
    if not user:
        return None
    if not verify_password(password, user["password_hash"]):
        return None
    return user


# ============================
# Dependência de Rota Protegida
# ============================

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = get_user_by_id(int(user_id))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


# ============================
# Serviços de Registro, Login e Senha
# ============================

def register_user(user_data: UserRegister, device_info: str = "Navegador Web") -> dict:
    if user_data.password != user_data.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="As senhas não coincidem."
        )

    existing = get_user_by_email(user_data.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="E-mail já cadastrado."
        )

    password_hash = hash_password(user_data.password)
    user_id = create_user(user_data.name, user_data.email, password_hash)
    update_last_login(user_id)

    access_token = create_access_token(data={"sub": str(user_id)})
    expires_at = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    create_session(user_id, access_token, expires_at, device_info=device_info)

    return {
        "success": True,
        "message": "Usuário cadastrado com sucesso.",
        "access_token": access_token,
        "token_type": "bearer"
    }


def login_user(user_data: UserLogin, device_info: str = "Navegador Web") -> dict:
    user = authenticate_user(user_data.email, user_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos."
        )

    update_last_login(user["id"])

    access_token = create_access_token(data={"sub": str(user["id"])})
    expires_at = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    create_session(user["id"], access_token, expires_at, device_info=device_info)

    return {
        "success": True,
        "message": "Login realizado com sucesso.",
        "access_token": access_token,
        "token_type": "bearer"
    }


def change_user_password(user: dict, payload: PasswordUpdate) -> dict:
    if not verify_password(payload.current_password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A senha atual informada está incorreta."
        )

    if payload.confirm_new_password and payload.new_password != payload.confirm_new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A confirmação da nova senha não confere."
        )

    new_hash = hash_password(payload.new_password)
    update_user(user["id"], password_hash=new_hash)
    return {"success": True, "message": "Senha atualizada com sucesso."}
