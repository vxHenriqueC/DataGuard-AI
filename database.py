import sqlite3
import os
import shutil
import json
from datetime import datetime
from typing import Optional, List, Dict, Any
from contextlib import contextmanager

# Caminho do banco de dados preservado na raiz do módulo
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dataguard.db")
BACKUP_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dataguard.db.bak")

# Whitelists estritas para atualizações dinâmicas seguras
ALLOWED_USER_COLUMNS = {
    "name", "email", "password_hash", "profile_picture",
    "last_login", "analyses_count", "risks_found"
}
ALLOWED_SETTINGS_COLUMNS = {
    "theme", "language", "compact_interface", "auto_analysis",
    "min_risk_alert", "max_file_size_mb", "allowed_file_types",
    "detectors_enabled", "notifications", "privacy"
}


# ============================
# Context Manager para Conexão
# ============================

@contextmanager
def get_db():
    """Gerencia a conexão transacional com o banco de dados SQLite."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=15.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# Alias de retrocompatibilidade para evitar NameError em chamadas legadas
get_db_connection = get_db


# ============================
# Inicialização e Backup Seguro
# ============================

def backup_database_if_exists():
    """Realiza um backup preventivo do banco existente antes de inicializar/migrar."""
    if os.path.exists(DB_PATH) and os.path.getsize(DB_PATH) > 0:
        try:
            shutil.copy2(DB_PATH, BACKUP_PATH)
        except OSError:
            pass


def init_db():
    """Garante que todas as tabelas e índices existam sem sobrescrever dados."""
    backup_database_if_exists()

    with get_db() as conn:
        cursor = conn.cursor()

        # Tabela de usuários (Esquema original preservado)
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

        # Tabela de configurações do usuário (Esquema original preservado)
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
                allowed_file_types TEXT DEFAULT 'txt,csv,json,pdf,xlsx,docx,xml,log',
                detectors_enabled TEXT DEFAULT '{}',
                notifications TEXT DEFAULT '{"security_alerts": true}',
                privacy TEXT DEFAULT '{"save_history": true}',
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ''')

        # Tabela de análises (Esquema original preservado)
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

        # Tabela de sessões (Esquema original preservado)
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

        # Índices de performance não destrutivos
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_analyses_user_created ON analyses(user_id, created_at DESC)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)")

        conn.commit()
        print("[DB] Banco de dados SQLite verificado e inicializado com sucesso.")


# ============================
# Operações de Usuário
# ============================

def create_user(name: str, email: str, password_hash: str) -> int:
    """Cria um novo usuário e suas configurações padrão em uma única transação."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
            (name.strip(), email.strip().lower(), password_hash)
        )
        user_id = cursor.lastrowid

        cursor.execute(
            """INSERT OR IGNORE INTO user_settings 
            (user_id, notifications, privacy) VALUES (?, ?, ?)""",
            (
                user_id,
                json.dumps({"security_alerts": True}),
                json.dumps({"save_history": True})
            )
        )
        conn.commit()
        return user_id


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Busca usuário pelo e-mail."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE LOWER(email) = LOWER(?)", (email.strip(),))
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
    """Atualiza campos permitidos do usuário com validação de whitelist."""
    safe_fields = {k: v for k, v in fields.items() if k in ALLOWED_USER_COLUMNS and v is not None}
    if not safe_fields:
        return False

    with get_db() as conn:
        cursor = conn.cursor()
        set_clause = ", ".join(f"{k} = ?" for k in safe_fields.keys())
        values = list(safe_fields.values()) + [user_id]
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

def get_user_settings(user_id: int) -> Dict[str, Any]:
    """Busca configurações do usuário (cria registro padrão se não existir)."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM user_settings WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()
        if not row:
            cursor.execute(
                "INSERT INTO user_settings (user_id, notifications, privacy) VALUES (?, ?, ?)",
                (user_id, json.dumps({"security_alerts": True}), json.dumps({"save_history": True}))
            )
            conn.commit()
            cursor.execute("SELECT * FROM user_settings WHERE user_id = ?", (user_id,))
            row = cursor.fetchone()

        data = dict(row)
        for json_col in ("detectors_enabled", "notifications", "privacy"):
            raw = data.get(json_col)
            if isinstance(raw, str):
                try:
                    data[json_col] = json.loads(raw) if raw else {}
                except json.JSONDecodeError:
                    data[json_col] = {}
        return data


def update_user_settings(user_id: int, **fields) -> bool:
    """Atualiza configurações do usuário com serialização JSON segura."""
    get_user_settings(user_id)
    safe_fields = {}
    for k, v in fields.items():
        if k in ALLOWED_SETTINGS_COLUMNS and v is not None:
            if isinstance(v, (dict, list)):
                safe_fields[k] = json.dumps(v)
            else:
                safe_fields[k] = v

    if not safe_fields:
        return False

    with get_db() as conn:
        cursor = conn.cursor()
        set_clause = ", ".join(f"{k} = ?" for k in safe_fields.keys())
        values = list(safe_fields.values()) + [user_id]
        cursor.execute(f"UPDATE user_settings SET {set_clause} WHERE user_id = ?", values)
        conn.commit()
        return cursor.rowcount > 0


# ============================
# Operações de Análise
# ============================

def save_analysis(user_id: int, file_name: str, file_type: str,
                  risk_score: int, risk_level: str, alerts: int,
                  result_json: str) -> int:
    """Salva uma análise no histórico e sincroniza contadores do usuário."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO analyses
            (user_id, file_name, file_type, risk_score, risk_level, alerts, result_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (user_id, file_name, file_type, risk_score, risk_level, alerts, result_json)
        )
        analysis_id = cursor.lastrowid

        cursor.execute(
            """UPDATE users 
               SET analyses_count = analyses_count + 1,
                   risks_found = risks_found + ?
               WHERE id = ?""",
            (alerts, user_id)
        )
        conn.commit()
        return analysis_id


def get_user_analyses(user_id: int) -> List[Dict[str, Any]]:
    """Retorna todas as análises de um usuário ordenadas pela mais recente."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM analyses WHERE user_id = ? ORDER BY created_at DESC, id DESC",
            (user_id,)
        )
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def get_analysis_by_id(analysis_id: int, user_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
    """Busca uma análise pelo ID (opcionalmente validando propriedade do usuário)."""
    with get_db() as conn:
        cursor = conn.cursor()
        if user_id is not None:
            cursor.execute(
                "SELECT * FROM analyses WHERE id = ? AND user_id = ?",
                (analysis_id, user_id)
            )
        else:
            cursor.execute("SELECT * FROM analyses WHERE id = ?", (analysis_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def delete_analysis_by_id(analysis_id: int, user_id: int) -> bool:
    """Remove uma análise específica pertencente ao usuário."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM analyses WHERE id = ? AND user_id = ?",
            (analysis_id, user_id)
        )
        conn.commit()
        return cursor.rowcount > 0


def clear_user_analyses(user_id: int) -> int:
    """Limpa todo o histórico de análises de um usuário de forma segura."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM analyses WHERE user_id = ?", (user_id,))
        deleted = cursor.rowcount
        cursor.execute(
            "UPDATE users SET analyses_count = 0, risks_found = 0 WHERE id = ?",
            (user_id,)
        )
        conn.commit()
        return deleted


def get_user_stats(user_id: int) -> Dict[str, Any]:
    """Retorna estatísticas consolidadas e reais do usuário."""
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute(
            "SELECT COUNT(*) as total FROM analyses WHERE user_id = ?",
            (user_id,)
        )
        total_analyses = cursor.fetchone()["total"] or 0

        cursor.execute(
            "SELECT COALESCE(SUM(alerts), 0) as total FROM analyses WHERE user_id = ?",
            (user_id,)
        )
        total_alerts = cursor.fetchone()["total"] or 0

        cursor.execute(
            "SELECT COUNT(*) as safe_count FROM analyses WHERE user_id = ? AND risk_level = 'BAIXO'",
            (user_id,)
        )
        safe_analyses = cursor.fetchone()["safe_count"] or 0

        cursor.execute(
            """SELECT id, file_name, file_type, risk_score, risk_level, alerts, created_at
            FROM analyses WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 1""",
            (user_id,)
        )
        last_analysis = cursor.fetchone()

        return {
            "total_analyses": total_analyses,
            "total_alerts": total_alerts,
            "safe_analyses": safe_analyses,
            "risk_analyses": max(0, total_analyses - safe_analyses),
            "last_analysis": dict(last_analysis) if last_analysis else None
        }


# ============================
# Operações de Sessão
# ============================

def create_session(user_id: int, token: str, expires_at: datetime,
                   device_info: str = "Navegador Web") -> int:
    """Cria uma nova sessão no banco."""
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


def get_user_sessions(user_id: int) -> List[Dict[str, Any]]:
    """Lista todas as sessões ativas do usuário."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, created_at, expires_at, device_info, token FROM sessions WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,)
        )
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def delete_session(token: str) -> bool:
    """Remove uma sessão pelo token."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()
        return cursor.rowcount > 0


def delete_session_by_id(session_id: int, user_id: int) -> bool:
    """Remove uma sessão específica pelo ID."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sessions WHERE id = ? AND user_id = ?", (session_id, user_id))
        conn.commit()
        return cursor.rowcount > 0


def delete_all_user_sessions(user_id: int) -> int:
    """Remove todas as sessões de um usuário."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
        conn.commit()
        return cursor.rowcount
