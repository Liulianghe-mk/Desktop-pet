from __future__ import annotations

import os
from pathlib import Path

from document_extract import extract_document

MAX_FILE_BYTES = int(os.getenv("FILE_CHAT_MAX_BYTES", "80000"))
MAX_FILES = int(os.getenv("FILE_CHAT_MAX_FILES", "3"))

TEXT_SUFFIXES = {
    ".txt",
    ".md",
    ".markdown",
    ".json",
    ".jsonl",
    ".xml",
    ".html",
    ".htm",
    ".css",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".py",
    ".java",
    ".c",
    ".cpp",
    ".h",
    ".hpp",
    ".cs",
    ".go",
    ".rs",
    ".rb",
    ".php",
    ".sql",
    ".yaml",
    ".yml",
    ".toml",
    ".ini",
    ".cfg",
    ".env",
    ".log",
    ".csv",
    ".bat",
    ".ps1",
    ".sh",
    ".vue",
    ".svelte",
    ".pdf",
    ".docx",
    ".doc",
}


def _is_probably_text(path: Path) -> bool:
    if path.suffix.lower() in TEXT_SUFFIXES:
        return True
    if not path.suffix:
        return True
    return False


def read_file_snippet(path_str: str) -> tuple[str, str]:
    """Return (filename, content_or_notice) for one local file path."""
    path = Path(path_str).expanduser().resolve()
    if not path.is_file():
        return path.name, f"（无法读取：不是有效文件 `{path}`）"

    size = path.stat().st_size
    name = path.name

    if size > MAX_FILE_BYTES * 8:
        return name, (
            f"（文件过大：{size} 字节，未载入内容。请主人说明诉求，或换用较小的文件。）"
        )

    doc_text = extract_document(path)
    if doc_text is not None:
        return name, doc_text

    if not _is_probably_text(path):
        return name, (
            f"（暂不支持此文件类型：{path.suffix or '无扩展名'}。"
            f"可尝试 .txt / .md / .pdf / .docx，或将内容复制到文本文件。）"
        )

    try:
        raw = path.read_bytes()
    except OSError as exc:
        return name, f"（读取失败：{exc}）"

    if len(raw) > MAX_FILE_BYTES:
        raw = raw[:MAX_FILE_BYTES]
        truncated = True
    else:
        truncated = False

    for encoding in ("utf-8", "utf-8-sig", "gbk", "latin-1"):
        try:
            text = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            text = None
    else:
        return name, "（无法解码为文本，请主人换用 UTF-8 文本文件。）"

    text = text.replace("\r\n", "\n").strip()
    if not text:
        return name, "（文件为空）"

    if truncated:
        text += f"\n\n…（已截断，仅展示前 {MAX_FILE_BYTES} 字节）"
    return name, text


def build_file_user_message(file_paths: list[str], user_request: str) -> str:
    """Compose the user message sent to the model."""
    request = user_request.strip() or "请根据文件内容回答主人的问题。"
    parts: list[str] = [f"主人的诉求：{request}", ""]

    limited = file_paths[:MAX_FILES]
    if len(file_paths) > MAX_FILES:
        parts.append(f"（另有 {len(file_paths) - MAX_FILES} 个文件未载入）")
        parts.append("")

    for path_str in limited:
        name, body = read_file_snippet(path_str)
        parts.append(f"--- 文件：{name} ---")
        parts.append(body)
        parts.append("")

    parts.append("请根据以上文件内容与主人诉求，用简体中文回答。")
    return "\n".join(parts).strip()


def build_file_system_context(file_paths: list[str]) -> str:
    """File bodies for system prompt (used across multi-turn file chat)."""
    limited = file_paths[:MAX_FILES]
    parts: list[str] = []
    if len(file_paths) > MAX_FILES:
        parts.append(f"（另有 {len(file_paths) - MAX_FILES} 个文件未载入）")
    for path_str in limited:
        name, body = read_file_snippet(path_str)
        parts.append(f"--- 文件：{name} ---\n{body}")
    return "\n\n".join(parts).strip()
