# database.py
# Conexão e operações com banco de dados SQLite

import sqlite3
import os
from datetime import datetime
from typing import Optional, List, Dict, Any
from contextlib import contextmanager

# Caminho do banco de dados
DB_PATH = os.path.join(os.path.dirname(__file__), "dataguard.db")


# ============================
# Inicialização do Banco
# ============================

def init_db():
    """Cria as tabelas necessárias se não existirem."""
    with get_db() as conn:
        cursor = conn.cursor()

        # Tabela de usuários
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                profile_picture TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP,
                analyses_count INTEGER DEFAULT 0,
                risks_found INTEGER DEFAULT 0
            )
        ''')

        # Tabela de configurações do usuário
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE NOT NULL,
                theme TEXT DEFAULT 'dark',
                language TEXT DEFAULT 'pt-BR',
                compact_interface INTEGER DEFAULT 0,
                auto_analysis INTEGER DEFAULT 0,
                min_risk_alert TEXT DEFAULT 'Médio',
                max_file_size_mb INTEGER DEFAULT 10,
                allowed_file_types TEXT DEFAULT 'txt,csv,json,pdf,xlsx',
                detectors_enabled TEXT DEFAULT '{}',
                notifications TEXT DEFAULT '{}',
                privacy TEXT DEFAULT '{}',
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ''')

        # Tabela de análises
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS analyses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                file_name TEXT NOT NULL,
                file_type TEXT NOT NULL,
                risk_score INTEGER NOT NULL,
                risk_level TEXT NOT NULL,
                alerts INTEGER DEFAULT 0,
                result_json TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ''')

        # Tabela de sessões
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                device_info TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ''')

        conn.commit()
        print("[DB] Banco de dados inicializado com sucesso.")


# ============================
# Context Manager para Conexão
# ============================

@contextmanager
def get_db():
    """Gerencia a conexão com o banco de dados."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


# ============================
# Operações de Usuário
# ============================

def create_user(name: str, email: str, password_hash: str) -> int:
    """Cria um novo usuário e retorna o ID."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
            (name, email, password_hash)
        )
        conn.commit()
        user_id = cursor.lastrowid

        # Cria configurações padrão
        cursor.execute(
            "INSERT INTO user_settings (user_id) VALUES (?)",
            (user_id,)
        )
        conn.commit()
        return user_id


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Busca usuário pelo e-mail."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """Busca usuário pelo ID."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def update_user(user_id: int, **fields) -> bool:
    """Atualiza campos do usuário."""
    if not fields:
        return False
    with get_db() as conn:
        cursor = conn.cursor()
        set_clause = ", ".join(f"{k} = ?" for k in fields.keys())
        values = list(fields.values()) + [user_id]
        cursor.execute(f"UPDATE users SET {set_clause} WHERE id = ?", values)
        conn.commit()
        return cursor.rowcount > 0


def update_last_login(user_id: int):
    """Atualiza o último login do usuário."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?",
            (user_id,)
        )
        conn.commit()


# ============================
# Operações de Configurações
# ============================

def get_user_settings(user_id: int) -> Optional[Dict[str, Any]]:
    """Busca configurações do usuário."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM user_settings WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def update_user_settings(user_id: int, **fields) -> bool:
    """Atualiza configurações do usuário."""
    if not fields:
        return False
    with get_db() as conn:
        cursor = conn.cursor()
        set_clause = ", ".join(f"{k} = ?" for k in fields.keys())
        values = list(fields.values()) + [user_id]
        cursor.execute(f"UPDATE user_settings SET {set_clause} WHERE user_id = ?", values)
        conn.commit()
        return cursor.rowcount > 0


# ============================
# Operações de Análise
# ============================

def save_analysis(user_id: int, file_name: str, file_type: str,
                  risk_score: int, risk_level: str, alerts: int,
                  result_json: str) -> int:
    """Salva uma análise no histórico."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO analyses
            (user_id, file_name, file_type, risk_score, risk_level, alerts, result_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (user_id, file_name, file_type, risk_score, risk_level, alerts, result_json)
        )
        conn.commit()
        analysis_id = cursor.lastrowid

        # Atualiza contadores do usuário
        cursor.execute(
            "UPDATE users SET analyses_count = analyses_count + 1 WHERE id = ?",
            (user_id,)
        )
        conn.commit()
        return analysis_id


def get_user_analyses(user_id: int) -> List[Dict[str, Any]]:
    """Retorna todas as análises de um usuário."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM analyses WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,)
        )
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def get_analysis_by_id(analysis_id: int) -> Optional[Dict[str, Any]]:
    """Busca uma análise pelo ID."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM analyses WHERE id = ?", (analysis_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_user_stats(user_id: int) -> Dict[str, Any]:
    """Retorna estatísticas do usuário."""
    with get_db() as conn:
        cursor = conn.cursor()

        # Total de análises
        cursor.execute(
            "SELECT COUNT(*) as total FROM analyses WHERE user_id = ?",
            (user_id,)
        )
        total_analyses = cursor.fetchone()["total"]

        # Total de alertas
        cursor.execute(
            "SELECT SUM(alerts) as total FROM analyses WHERE user_id = ?",
            (user_id,)
        )
        total_alerts = cursor.fetchone()["total"] or 0

        # Última análise
        cursor.execute(
            """SELECT file_name, risk_score, risk_level, created_at
            FROM analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1""",
            (user_id,)
        )
        last_analysis = cursor.fetchone()

        return {
            "total_analyses": total_analyses,
            "total_alerts": total_alerts,
            "last_analysis": dict(last_analysis) if last_analysis else None
        }


# ============================
# Operações de Sessão
# ============================

def create_session(user_id: int, token: str, expires_at: datetime,
                   device_info: str = None) -> int:
    """Cria uma nova sessão."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO sessions (user_id, token, expires_at, device_info)
            VALUES (?, ?, ?, ?)""",
            (user_id, token, expires_at.isoformat(), device_info)
        )
        conn.commit()
        return cursor.lastrowid


def get_session_by_token(token: str) -> Optional[Dict[str, Any]]:
    """Busca sessão pelo token."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM sessions WHERE token = ?", (token,))
        row = cursor.fetchone()
        return dict(row) if row else None


def delete_session(token: str) -> bool:
    """Remove uma sessão."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()
        return cursor.rowcount > 0


def delete_all_user_sessions(user_id: int) -> int:
    """Remove todas as sessões de um usuário."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
        conn.commit()
        return cursor.rowcount
