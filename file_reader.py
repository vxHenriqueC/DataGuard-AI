# file_reader.py
# Leitura de diferentes tipos de arquivos para análise

import os
import csv
import json
from io import StringIO, BytesIO
from typing import Optional

# Placeholder para bibliotecas adicionais (serão adicionadas nas etapas 13 e 14)
# import pandas as pd  # Para XLSX
# import PyPDF2 ou pdfplumber  # Para PDF


# ============================
# Constantes
# ============================

ALLOWED_EXTENSIONS = {"txt", "csv", "json", "pdf", "xlsx"}
MAX_FILE_SIZE_MB = 10
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024


# ============================
# Validação
# ============================

def validate_file(file_name: str, file_size: int) -> tuple[bool, Optional[str]]:
    """Valida o arquivo antes da leitura."""
    # Verifica extensão
    ext = file_name.rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return False, f"Formato não suportado: .{ext}. Formatos aceitos: {', '.join(ALLOWED_EXTENSIONS)}"

    # Verifica tamanho
    if file_size > MAX_FILE_SIZE_BYTES:
        return False, f"Arquivo muito grande. Tamanho máximo: {MAX_FILE_SIZE_MB}MB"

    # Verifica se não está vazio
    if file_size == 0:
        return False, "Arquivo vazio."

    return True, None


def get_file_extension(file_name: str) -> str:
    """Retorna a extensão do arquivo em minúsculas."""
    return file_name.rsplit(".", 1)[-1].lower()


# ============================
# Leitores de Arquivo
# ============================

def read_txt(content: bytes) -> str:
    """Lê o conteúdo de um arquivo TXT."""
    try:
        text = content.decode("utf-8")
        return text
    except UnicodeDecodeError:
        # Tenta com latin-1 como fallback
        text = content.decode("latin-1")
        return text


def read_csv(content: bytes) -> str:
    """Lê o conteúdo de um arquivo CSV e retorna como texto concatenado."""
    try:
        text = content.decode("utf-8")
        reader = csv.reader(StringIO(text))
        lines = []
        for row in reader:
            lines.append(", ".join(row))
        return "\n".join(lines)
    except Exception:
        # Fallback: lê como texto simples
        return content.decode("utf-8", errors="ignore")


def read_json(content: bytes) -> str:
    """Lê o conteúdo de um arquivo JSON e retorna como texto concatenado."""
    try:
        data = json.loads(content.decode("utf-8"))
        # Converte todo o JSON em string para análise
        return json.dumps(data, ensure_ascii=False)
    except json.JSONDecodeError:
        return content.decode("utf-8", errors="ignore")


def read_xlsx(content: bytes) -> str:
    """Lê o conteúdo de um arquivo XLSX. (Implementação na Etapa 14)"""
    # Placeholder - será implementado com pandas/openpyxl
    return "[XLSX - Leitura será implementada na Etapa 14]"


def read_pdf(content: bytes) -> str:
    """Lê o conteúdo de um arquivo PDF. (Implementação na Etapa 14)"""
    # Placeholder - será implementado com PyPDF2/pdfplumber
    return "[PDF - Leitura será implementada na Etapa 14]"


# ============================
# Leitor Principal
# ============================

def read_file(file_name: str, content: bytes) -> dict:
    """Lê um arquivo e retorna seu conteúdo textual."""
    ext = get_file_extension(file_name)
    file_size = len(content)

    # Validação
    valid, error = validate_file(file_name, file_size)
    if not valid:
        return {"success": False, "error": error}

    try:
        if ext == "txt":
            text = read_txt(content)
        elif ext == "csv":
            text = read_csv(content)
        elif ext == "json":
            text = read_json(content)
        elif ext == "xlsx":
            text = read_xlsx(content)
        elif ext == "pdf":
            text = read_pdf(content)
        else:
            return {"success": False, "error": "Formato não suportado."}

        return {
            "success": True,
            "file_name": file_name,
            "file_type": ext,
            "file_size": file_size,
            "content": text
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"Erro ao ler arquivo: {str(e)}"
        }
