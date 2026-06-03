from __future__ import annotations

import json
import os
import random
import re
import sqlite3
import subprocess
import threading
import time
import uuid
import webbrowser
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Literal

from collections.abc import Iterator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from deepseek import (
    DeepSeekError,
    build_personality_prompt,
    build_file_chat_messages,
    build_messages,
    chat_completion,
    chat_completion_stream,
    is_configured,
)
from file_context import build_file_system_context
from pet_poke import generate_poke_line

BASE_DIR = Path(__file__).resolve().parent


def load_env_files() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    for path in (BASE_DIR / ".env", BASE_DIR.parent / ".env"):
        if path.exists():
            load_dotenv(path, override=False)


load_env_files()
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "tasks.db"

ALLOWLIST_APPS = {"code", "notepad", "calc", "explorer", "mspaint", "write"}
APP_ALIASES = {
    "vscode": "code",
    "vs code": "code",
    "visual studio code": "code",
    "记事本": "notepad",
    "计算器": "calc",
    "资源管理器": "explorer",
    "画图": "mspaint",
    "写字板": "write",
}
ALLOWLIST_DOMAINS = {"google.com", "github.com", "bing.com"}
DENYLIST_PATTERNS = {"password", "wallet", "payment", "bank"}
STOP_EVENT = threading.Event()
REMINDER_CACHE: dict[str, dict[str, Any]] = {}


def now_iso() -> str:
    return datetime.utcnow().isoformat()


def init_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS task_runs (
                task_id TEXT PRIMARY KEY,
                command TEXT NOT NULL,
                tool_name TEXT NOT NULL,
                risk_level TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                finished_at TEXT,
                detail_json TEXT NOT NULL
            )
            """
        )


class PlanRequest(BaseModel):
    command: str = Field(min_length=1)


class Step(BaseModel):
    tool_name: str
    args: dict[str, Any]


class PlanResponse(BaseModel):
    task_id: str
    command: str
    risk_level: Literal["low", "medium", "high"]
    requires_confirmation: bool
    reason: str
    steps: list[Step]


class ExecuteRequest(BaseModel):
    task_id: str
    approved: bool = False
    dry_run: bool = False


class StopResponse(BaseModel):
    stopped: bool
    message: str


class ChatHistoryItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    history: list[ChatHistoryItem] = Field(default_factory=list)
    personality_ids: list[str] = Field(default_factory=list, max_length=2)


class FileChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    file_paths: list[str] = Field(min_length=1, max_length=10)
    history: list[ChatHistoryItem] = Field(default_factory=list)
    personality_ids: list[str] = Field(default_factory=list, max_length=2)


class ExistingTaskItem(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    completed: bool = False
    effort: Literal["low", "medium", "high"] | None = None


class TaskSuggestRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    existing_tasks: list[ExistingTaskItem] = Field(default_factory=list, max_length=30)
    personality_ids: list[str] = Field(default_factory=list, max_length=2)


class SuggestedTaskItem(BaseModel):
    title: str = Field(min_length=1, max_length=40)
    subtitle: str = Field(default="AI 建议任务", max_length=80)
    effort: Literal["low", "medium", "high"] = "medium"
    reason: str = Field(default="", max_length=80)


class TaskSuggestResponse(BaseModel):
    reply: str
    tasks: list[SuggestedTaskItem]
    provider: Literal["deepseek", "local"] = "local"


class PetPokeRequest(BaseModel):
    click_index: int = Field(ge=0, le=30)
    recent_lines: list[str] = Field(default_factory=list, max_length=8)


class PetBubbleRequest(BaseModel):
    kind: Literal["idle", "music", "weather", "schedule", "focus", "dream", "emotion"]
    personality_ids: list[str] = Field(default_factory=list, max_length=2)
    pending_tasks: int = Field(default=0, ge=0, le=99)
    home_mode: str | None = Field(default=None, max_length=40)
    recent_lines: list[str] = Field(default_factory=list, max_length=8)


class PetPokeResponse(BaseModel):
    line: str
    mood: Literal["normal", "annoyed"]
    provider: Literal["deepseek", "local"]


class PetBubbleResponse(BaseModel):
    line: str
    mood: Literal["normal", "annoyed"] = "normal"
    provider: Literal["deepseek", "local"] = "local"


class ChatResponse(BaseModel):
    reply: str
    suggest_task: bool = False
    task_hint: str | None = None
    provider: Literal["deepseek", "local"] = "local"


@dataclass
class ToolResult:
    ok: bool
    detail: str
    evidence: dict[str, Any]


PLAN_CACHE: dict[str, PlanResponse] = {}
STATUS_CACHE: dict[str, dict[str, Any]] = {}


def classify_risk(command: str, tool_name: str) -> tuple[str, str]:
    normalized = command.lower()
    if any(token in normalized for token in DENYLIST_PATTERNS):
        return "high", "命中敏感关键词"
    if tool_name in {"organize_downloads", "clean_desktop"}:
        return "medium", "涉及批量文件操作"
    return "low", "常规桌面操作"


def detect_task_intent(message: str) -> tuple[bool, str | None]:
    normalized = message.strip()
    lower = normalized.lower()
    task_keywords = ("打开", "整理", "清理", "搜索", "执行", "帮我", "启动", "运行", "提醒", "快捷动作")
    if any(token in normalized for token in task_keywords) or "open" in lower:
        return True, normalized
    return False, None


def apply_local_personality(text: str, personality_ids: list[str] | None) -> str:
    personalities = personality_ids or []
    if "efficiency_coach" in personalities:
        return f"直接行动版：{text}\n下一步：先做一个最小动作。"
    if "gentle_companion" in personalities:
        return f"慢慢来，主人。{text}"
    if "sharp_supervisor" in personalities:
        return f"{text}\n小吐槽：别再让任务自己长毛啦，先动五分钟。"
    if "zen_slacker" in personalities:
        return f"{text}\n不急，先完成最低可行动作就算赢。"
    if "corporate_poet" in personalities:
        return f"{text}\n我们先拉齐一下颗粒度，形成一个小闭环。"
    if "calm_butler" in personalities:
        return f"已了解。{text}"
    if "cat_cute" in personalities:
        return f"喵～{text}"
    return text


def build_local_reply_text(message: str, personality_ids: list[str] | None = None) -> str:
    normalized = message.strip()
    lower = normalized.lower()

    if any(token in normalized for token in ("你好", "您好", "嗨", "hello", "hi")):
        return apply_local_personality("主人你好呀！想随便聊聊，还是让我帮你做点桌面上的事？", personality_ids)

    if any(token in normalized for token in ("谢谢", "感谢", "thx", "thanks")):
        return apply_local_personality("不客气～有需要随时叫我。", personality_ids)

    if any(token in normalized for token in ("你是谁", "叫什么", "介绍")):
        return apply_local_personality("我是 Yarni，你的桌面毛线球伙伴，可以陪你聊天，也能帮你执行安全的电脑任务。", personality_ids)

    if any(token in normalized for token in ("状态", "在线", "agent")):
        return apply_local_personality("本地 Agent 服务正常时，我就能帮你执行任务；你也可以在首页查看实时状态。", personality_ids)

    if any(token in normalized for token in ("音乐", "听歌", "播放")):
        return apply_local_personality("我记住你喜欢音乐啦～要是想让我打开播放器或搜索歌曲，直接告诉我就行。", personality_ids)

    if "?" in normalized or "？" in normalized or normalized.endswith("吗"):
        return apply_local_personality("这是个好问题！目前我还在成长中，你可以试试让我「打开记事本」或「整理下载文件夹」。", personality_ids)

    return apply_local_personality(
        f"收到：「{normalized}」。想执行任务可以说「帮我打开 VS Code」之类；想闲聊也可以继续聊～",
        personality_ids,
    )


def compose_chat_response(
    reply: str,
    message: str,
    provider: Literal["deepseek", "local"],
) -> ChatResponse:
    suggest_task, task_hint = detect_task_intent(message)
    return ChatResponse(
        reply=reply,
        suggest_task=suggest_task,
        task_hint=task_hint,
        provider=provider,
    )


def build_local_chat_response(payload: ChatRequest) -> ChatResponse:
    return compose_chat_response(
        build_local_reply_text(payload.message, payload.personality_ids),
        payload.message,
        "local",
    )


def build_deepseek_chat_response(payload: ChatRequest) -> ChatResponse:
    history = [(item.role, item.content) for item in payload.history]
    messages = build_messages(payload.message, history, payload.personality_ids)
    reply = chat_completion(messages)
    return compose_chat_response(reply, payload.message, "deepseek")


def _normalize_effort(value: str | None) -> Literal["low", "medium", "high"]:
    if value in ("low", "medium", "high"):
        return value
    return "medium"


def _local_effort_for_title(title: str) -> Literal["low", "medium", "high"]:
    if any(token in title for token in ("整理", "休息", "喝水", "活动", "散步", "查看")):
        return "low"
    if any(token in title for token in ("汇报", "论文", "方案", "完成", "最难", "复盘", "开发")):
        return "high"
    return "medium"


def _fallback_task_suggestions(payload: TaskSuggestRequest, note: str | None = None) -> TaskSuggestResponse:
    raw = payload.message.strip()
    existing_titles = {item.title.strip() for item in payload.existing_tasks}
    parts = [
        part.strip(" ，,。；;、\n\t")
        for part in raw.replace("和", "，").replace("还有", "，").replace("以及", "，").split("，")
    ]
    tasks: list[SuggestedTaskItem] = []
    for part in parts:
        if not part or part in existing_titles:
            continue
        title = part
        if len(title) > 28:
            title = title[:27] + "…"
        effort = _local_effort_for_title(title)
        tasks.append(
            SuggestedTaskItem(
                title=title,
                subtitle="先完成一个清晰的小步骤",
                effort=effort,
                reason="根据你的描述拆分",
            )
        )
        if len(tasks) >= 5:
            break
    if not tasks:
        tasks = [
            SuggestedTaskItem(
                title="专注 25 分钟",
                subtitle="从最容易开始的一步入手",
                effort="medium",
                reason="本地兜底推荐",
            )
        ]
    prefix = f"DeepSeek 暂不可用：{note}。" if note else "我先用本地规则拆好了。"
    return TaskSuggestResponse(reply=f"{prefix}建议先添加这些任务。", tasks=tasks, provider="local")


def _extract_json_object(text: str) -> dict[str, Any]:
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("no json object found")
    data = json.loads(text[start : end + 1])
    if not isinstance(data, dict):
        raise ValueError("json root is not object")
    return data


def build_deepseek_task_suggestions(payload: TaskSuggestRequest) -> TaskSuggestResponse:
    existing = [
        {
            "title": item.title,
            "completed": item.completed,
            "effort": item.effort,
        }
        for item in payload.existing_tasks[-20:]
    ]
    system = (
        "你是 Yarni 的任务规划助手。请把用户的自然语言计划拆成 1-5 个具体、可执行的小任务。"
        "只输出 JSON，不要 Markdown，不要代码块。JSON 格式："
        "{\"reply\":\"一句简短中文说明\",\"tasks\":[{\"title\":\"40字以内任务名\","
        "\"subtitle\":\"80字以内行动提示\",\"effort\":\"low|medium|high\",\"reason\":\"为什么推荐\"}]}。"
        "避免和 existing_tasks 中未完成任务重复。effort 低=5分钟内或轻松，中=普通任务，高=困难或耗时。"
    ) + build_personality_prompt(payload.personality_ids)
    user = json.dumps(
        {
            "message": payload.message,
            "existing_tasks": existing,
        },
        ensure_ascii=False,
    )
    content = chat_completion(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        temperature=0.35,
        max_tokens=900,
    )
    data = _extract_json_object(content)
    items = data.get("tasks", [])
    if not isinstance(items, list):
        raise DeepSeekError("任务建议格式异常")
    existing_titles = {item.title.strip() for item in payload.existing_tasks if not item.completed}
    tasks: list[SuggestedTaskItem] = []
    seen: set[str] = set()
    for item in items[:5]:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title", "")).strip()
        if not title or title in existing_titles or title in seen:
            continue
        seen.add(title)
        tasks.append(
            SuggestedTaskItem(
                title=title[:40],
                subtitle=str(item.get("subtitle") or "AI 建议任务").strip()[:80],
                effort=_normalize_effort(item.get("effort")),
                reason=str(item.get("reason") or "").strip()[:80],
            )
        )
    if not tasks:
        raise DeepSeekError("DeepSeek 未返回可用任务")
    reply = str(data.get("reply") or "我帮你拆成这些任务啦。").strip()
    return TaskSuggestResponse(reply=reply, tasks=tasks, provider="deepseek")


LOCAL_BUBBLE_LINES: dict[str, list[str]] = {
    "idle": ["我在这里陪你。", "主人，今天慢慢来。", "晒会儿太阳吧。"],
    "music": ["🎵 音乐氛围同步中。", "🎵 这首适合继续努力。", "🎵 Yarni 跟着晃一晃。"],
    "weather": ["🌤️ 记得看看窗外。", "☀️ 今天也要照顾自己。", "🌥️ 出门记得看天气。"],
    "schedule": ["📅 任务还在等你。", "📅 先挑最小的一件吧。", "📅 做完一项就很棒。"],
    "focus": ["🎯 先专注五分钟。", "🎯 别切走，我陪你。", "🎯 现在只做这一件。"],
    "dream": ["🌙 夜深啦，辛苦了。", "🌙 今天已经够努力。", "🌙 做个软软的梦。"],
    "emotion": ["我感觉你有点累。", "先深呼吸一下。", "不急，我陪你。"],
}


def _bubble_local_line(payload: PetBubbleRequest) -> str:
    if payload.kind == "schedule" and payload.pending_tasks > 0:
        return f"📅 还有 {payload.pending_tasks} 项任务。"
    pool = LOCAL_BUBBLE_LINES.get(payload.kind, LOCAL_BUBBLE_LINES["idle"])
    choices = [line for line in pool if line not in payload.recent_lines] or pool
    return random.choice(choices)


def _bubble_prompt(payload: PetBubbleRequest) -> str:
    lines = [
        "请为桌面宠物生成一句主动气泡台词。",
        f"气泡类型：{payload.kind}",
        f"首页模式：{payload.home_mode or '无'}",
        f"最近说过：{'；'.join(payload.recent_lines[-5:]) or '无'}",
    ]
    if payload.kind == "schedule":
        lines.append(f"未完成任务数：{payload.pending_tasks}")
    else:
        lines.append("日程管理未参与本次气泡，不要提任务、待办、完成进度。")
    lines.append("要求：简体中文，1 句，不超过 18 个汉字；可带一个 emoji；不要解释。")
    return "\n".join(lines)


def build_pet_bubble(payload: PetBubbleRequest) -> PetBubbleResponse:
    if is_configured():
        try:
            system = (
                "你是 Yarni，一只住在电脑桌面的毛线球宠物。你会根据成长技能主动冒出短气泡。"
                "语气可爱、简短、有陪伴感。"
            ) + build_personality_prompt(payload.personality_ids)
            raw = chat_completion(
                [{"role": "system", "content": system}, {"role": "user", "content": _bubble_prompt(payload)}],
                temperature=0.85,
                max_tokens=80,
            )
            line = raw.strip().strip("\"'“”‘’").replace("\n", "")
            if len(line) > 24:
                line = line[:24]
            return PetBubbleResponse(line=line or _bubble_local_line(payload), provider="deepseek")
        except DeepSeekError:
            pass
    return PetBubbleResponse(line=_bubble_local_line(payload), provider="local")


def _known_folder(name: str) -> Path | None:
    home = Path.home()
    mapping = {
        "desktop": home / "Desktop",
        "桌面": home / "Desktop",
        "downloads": home / "Downloads",
        "下载": home / "Downloads",
        "download": home / "Downloads",
        "documents": home / "Documents",
        "文档": home / "Documents",
        "pictures": home / "Pictures",
        "图片": home / "Pictures",
        "music": home / "Music",
        "音乐": home / "Music",
        "videos": home / "Videos",
        "视频": home / "Videos",
    }
    for key, value in mapping.items():
        if key in name:
            return value
    return None


def _safe_existing_folder(folder_hint: str) -> Path | None:
    known = _known_folder(folder_hint.lower())
    if known:
        return known if known.exists() else None

    match = re.search(r"([A-Za-z]:\\[^\"<>|]+|~[/\\][^\"<>|]+)", folder_hint)
    if not match:
        return None
    candidate = Path(match.group(1)).expanduser()
    if not candidate.exists() or not candidate.is_dir():
        return None
    try:
        candidate.resolve().relative_to(Path.home().resolve())
    except ValueError:
        return None
    return candidate


def _extract_minutes(command: str) -> int:
    match = re.search(r"(\d+)\s*(分钟|min|minute|minutes|m)\b?", command, re.IGNORECASE)
    if match:
        return max(1, min(24 * 60, int(match.group(1))))
    if "半小时" in command:
        return 30
    if "一小时" in command or "1小时" in command:
        return 60
    return 25


def _shortcut_action(command: str) -> str | None:
    lowered = command.lower()
    if "专注" in command or "focus" in lowered:
        return "focus_25"
    if "清理桌面" in command:
        return "clean_desktop"
    if "下载" in command or "download" in lowered:
        return "open_downloads"
    if "桌面" in command or "desktop" in lowered:
        return "open_desktop"
    if "文档" in command or "document" in lowered:
        return "open_documents"
    return None


def detect_tool_and_args(command: str) -> Step:
    normalized = command.lower()
    if "快捷动作" in command or "快速动作" in command or "quick action" in normalized:
        action_id = _shortcut_action(command) or "open_downloads"
        return Step(tool_name="run_quick_action", args={"action_id": action_id})
    if "提醒" in command or "remind" in normalized or "timer" in normalized:
        return Step(
            tool_name="create_reminder",
            args={"minutes": _extract_minutes(command), "text": command},
        )
    if "清理桌面" in command or ("clean" in normalized and "desktop" in normalized):
        return Step(tool_name="clean_desktop", args={})
    if "整理" in command and ("下载" in command or "download" in normalized):
        return Step(tool_name="organize_downloads", args={})
    if ("文件夹" in command or "目录" in command or "folder" in normalized) and (
        "打开" in command or "open" in normalized
    ):
        return Step(tool_name="open_folder", args={"folder_hint": command})
    if "打开" in command or "启动" in command or "运行" in command or "open" in normalized:
        app_name = "notepad"
        for alias, resolved in APP_ALIASES.items():
            if alias in normalized or alias in command:
                app_name = resolved
                break
        target_folder = str(_safe_existing_folder(command) or "")
        return Step(tool_name="launch_app", args={"app_name": app_name, "target_folder": target_folder})
    if "搜索" in command or "search" in normalized:
        query = command.replace("搜索", "").replace("search", "").strip() or "AI desktop pet"
        return Step(tool_name="browser_search", args={"query": query})
    if "状态" in command or "status" in normalized:
        return Step(tool_name="health_check", args={})
    return Step(tool_name="browser_search", args={"query": command})


def persist_task(
    task_id: str,
    command: str,
    tool_name: str,
    risk_level: str,
    status: str,
    detail: dict[str, Any],
    finished_at: str | None = None,
) -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO task_runs
            (task_id, command, tool_name, risk_level, status, created_at, finished_at, detail_json)
            VALUES (?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM task_runs WHERE task_id = ?), ?), ?, ?)
            """,
            (
                task_id,
                command,
                tool_name,
                risk_level,
                status,
                task_id,
                now_iso(),
                finished_at,
                json.dumps(detail, ensure_ascii=True),
            ),
        )


def tool_launch_app(app_name: str, dry_run: bool, target_folder: str | None = None) -> ToolResult:
    if app_name not in ALLOWLIST_APPS:
        return ToolResult(False, f"应用 {app_name} 不在 allowlist", {"app_name": app_name})
    args = [app_name]
    if app_name == "code" and target_folder:
        folder = _safe_existing_folder(target_folder)
        if folder:
            args.append(str(folder))
    if dry_run:
        return ToolResult(True, "dry-run: launch_app skipped", {"args": args})
    try:
        subprocess.Popen(args, shell=True)
        return ToolResult(True, "应用启动成功", {"args": args})
    except Exception as exc:  # noqa: BLE001
        return ToolResult(False, f"启动失败: {exc}", {"app_name": app_name})


def tool_open_folder(folder_hint: str, dry_run: bool) -> ToolResult:
    folder = _safe_existing_folder(folder_hint)
    if not folder:
        return ToolResult(False, "未找到可安全打开的文件夹", {"folder_hint": folder_hint})
    if dry_run:
        return ToolResult(True, "dry-run: open_folder skipped", {"path": str(folder)})
    try:
        subprocess.Popen(["explorer", str(folder)])
        return ToolResult(True, f"已打开文件夹：{folder}", {"path": str(folder)})
    except Exception as exc:  # noqa: BLE001
        return ToolResult(False, f"打开文件夹失败: {exc}", {"path": str(folder)})


def tool_organize_downloads(dry_run: bool) -> ToolResult:
    downloads = Path.home() / "Downloads"
    if not downloads.exists():
        return ToolResult(False, "下载目录不存在", {"path": str(downloads)})

    moved = 0
    for item in downloads.iterdir():
        if STOP_EVENT.is_set():
            return ToolResult(False, "任务被紧急停止", {"moved": moved})
        if item.is_dir():
            continue
        suffix = item.suffix.lower().lstrip(".") or "other"
        target_dir = downloads / suffix
        target = target_dir / item.name
        if dry_run:
            moved += 1
            continue
        target_dir.mkdir(exist_ok=True)
        if target.exists():
            target = target_dir / f"{item.stem}_{int(time.time())}{item.suffix}"
        item.rename(target)
        moved += 1
    return ToolResult(True, "下载目录整理完成", {"moved": moved})


def tool_clean_desktop(dry_run: bool) -> ToolResult:
    desktop = Path.home() / "Desktop"
    if not desktop.exists():
        return ToolResult(False, "桌面目录不存在", {"path": str(desktop)})

    root = desktop / "Yarni整理"
    moved = 0
    for item in desktop.iterdir():
        if STOP_EVENT.is_set():
            return ToolResult(False, "任务被紧急停止", {"moved": moved})
        if item.is_dir() or item.name == root.name:
            continue
        suffix = item.suffix.lower().lstrip(".") or "other"
        target_dir = root / suffix
        target = target_dir / item.name
        if dry_run:
            moved += 1
            continue
        target_dir.mkdir(parents=True, exist_ok=True)
        if target.exists():
            target = target_dir / f"{item.stem}_{int(time.time())}{item.suffix}"
        item.rename(target)
        moved += 1
    return ToolResult(True, f"桌面清理完成，已移动 {moved} 个文件", {"moved": moved, "target": str(root)})


def tool_browser_search(query: str, dry_run: bool) -> ToolResult:
    if dry_run:
        return ToolResult(True, "dry-run: browser_search skipped", {"query": query})
    domain = "google.com"
    if domain not in ALLOWLIST_DOMAINS:
        return ToolResult(False, "目标域名不在 allowlist", {"domain": domain})
    url = f"https://www.google.com/search?q={query}"
    webbrowser.open(url)
    return ToolResult(True, "浏览器搜索已打开", {"url": url})


def tool_health_check() -> ToolResult:
    return ToolResult(True, "服务运行正常", {"uptime": now_iso()})


def _notify_reminder(reminder_id: str, minutes: int, text: str) -> None:
    time.sleep(minutes * 60)
    REMINDER_CACHE[reminder_id]["status"] = "triggered"
    message = text.replace('"', "'")[:180] or "提醒时间到啦"
    if os.name == "nt":
        subprocess.Popen(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                (
                    "Add-Type -AssemblyName PresentationFramework;"
                    f"[System.Windows.MessageBox]::Show(\"{message}\", \"Yarni 提醒\")"
                ),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )


def tool_create_reminder(minutes: int, text: str, dry_run: bool) -> ToolResult:
    safe_minutes = max(1, min(24 * 60, int(minutes)))
    reminder_id = str(uuid.uuid4())
    if dry_run:
        return ToolResult(
            True,
            f"dry-run: 将在 {safe_minutes} 分钟后提醒",
            {"minutes": safe_minutes, "text": text},
        )
    REMINDER_CACHE[reminder_id] = {
        "text": text,
        "minutes": safe_minutes,
        "status": "scheduled",
        "created_at": now_iso(),
    }
    thread = threading.Thread(
        target=_notify_reminder,
        args=(reminder_id, safe_minutes, text),
        daemon=True,
    )
    thread.start()
    return ToolResult(
        True,
        f"已创建提醒：{safe_minutes} 分钟后提醒你",
        {"reminder_id": reminder_id, "minutes": safe_minutes},
    )


def tool_run_quick_action(action_id: str, dry_run: bool) -> ToolResult:
    if action_id == "open_downloads":
        return tool_open_folder("下载", dry_run)
    if action_id == "open_desktop":
        return tool_open_folder("桌面", dry_run)
    if action_id == "open_documents":
        return tool_open_folder("文档", dry_run)
    if action_id == "clean_desktop":
        return tool_clean_desktop(dry_run)
    if action_id == "focus_25":
        return tool_create_reminder(25, "专注 25 分钟结束啦，休息一下吧", dry_run)
    return ToolResult(False, f"未知快捷动作: {action_id}", {"action_id": action_id})


def run_step(step: Step, dry_run: bool) -> ToolResult:
    if step.tool_name == "launch_app":
        return tool_launch_app(
            str(step.args.get("app_name", "")),
            dry_run,
            str(step.args.get("target_folder") or ""),
        )
    if step.tool_name == "open_folder":
        return tool_open_folder(str(step.args.get("folder_hint", "")), dry_run)
    if step.tool_name == "organize_downloads":
        return tool_organize_downloads(dry_run)
    if step.tool_name == "clean_desktop":
        return tool_clean_desktop(dry_run)
    if step.tool_name == "browser_search":
        return tool_browser_search(str(step.args.get("query", "AI desktop pet")), dry_run)
    if step.tool_name == "create_reminder":
        return tool_create_reminder(
            int(step.args.get("minutes", 25)),
            str(step.args.get("text", "提醒时间到啦")),
            dry_run,
        )
    if step.tool_name == "run_quick_action":
        return tool_run_quick_action(str(step.args.get("action_id", "")), dry_run)
    if step.tool_name == "health_check":
        return tool_health_check()
    return ToolResult(False, f"未知工具: {step.tool_name}", {"tool": step.tool_name})


app = FastAPI(title="AI Desktop Pet Local Agent", version="0.1.0")

_cors_origins = os.getenv(
    "AI_PET_CORS_ORIGINS",
    "http://localhost:1420,http://127.0.0.1:1420,http://localhost:5173,http://127.0.0.1:5173",
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors_origins if o.strip()],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?|tauri://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()


@app.get("/status")
def status() -> dict[str, Any]:
    return {
        "ok": True,
        "running_tasks": STATUS_CACHE,
        "reminders": REMINDER_CACHE,
        "stop_flag": STOP_EVENT.is_set(),
        "chat_provider": "deepseek" if is_configured() else "local",
        "deepseek_model": os.getenv("DEEPSEEK_MODEL", "deepseek-chat") if is_configured() else None,
    }


@app.post("/plan", response_model=PlanResponse)
def plan_task(payload: PlanRequest) -> PlanResponse:
    task_id = str(uuid.uuid4())
    step = detect_tool_and_args(payload.command)
    risk_level, reason = classify_risk(payload.command, step.tool_name)
    plan = PlanResponse(
        task_id=task_id,
        command=payload.command,
        risk_level=risk_level,  # type: ignore[arg-type]
        requires_confirmation=risk_level in {"medium", "high"},
        reason=reason,
        steps=[step],
    )
    PLAN_CACHE[task_id] = plan
    STATUS_CACHE[task_id] = {"phase": "planned", "risk_level": risk_level, "command": payload.command}
    persist_task(
        task_id=task_id,
        command=payload.command,
        tool_name=step.tool_name,
        risk_level=risk_level,
        status="planned",
        detail={"reason": reason, "args": step.args},
    )
    return plan


@app.post("/execute")
def execute_task(payload: ExecuteRequest) -> dict[str, Any]:
    STOP_EVENT.clear()
    plan = PLAN_CACHE.get(payload.task_id)
    if not plan:
        raise HTTPException(status_code=404, detail="task_id not found")
    if plan.requires_confirmation and not payload.approved:
        raise HTTPException(status_code=400, detail="task requires explicit approval")

    STATUS_CACHE[payload.task_id] = {"phase": "executing", "risk_level": plan.risk_level, "command": plan.command}
    persist_task(
        task_id=payload.task_id,
        command=plan.command,
        tool_name=plan.steps[0].tool_name,
        risk_level=plan.risk_level,
        status="executing",
        detail={"step": plan.steps[0].model_dump(), "dry_run": payload.dry_run},
    )

    started = time.time()
    result = run_step(plan.steps[0], payload.dry_run)
    elapsed_ms = int((time.time() - started) * 1000)

    final_status = "succeeded" if result.ok else "failed"
    STATUS_CACHE[payload.task_id] = {
        "phase": final_status,
        "risk_level": plan.risk_level,
        "command": plan.command,
        "elapsed_ms": elapsed_ms,
    }
    persist_task(
        task_id=payload.task_id,
        command=plan.command,
        tool_name=plan.steps[0].tool_name,
        risk_level=plan.risk_level,
        status=final_status,
        detail={"result": result.detail, "evidence": result.evidence, "elapsed_ms": elapsed_ms},
        finished_at=now_iso(),
    )
    return {
        "task_id": payload.task_id,
        "status": final_status,
        "result": result.detail,
        "evidence": result.evidence,
        "elapsed_ms": elapsed_ms,
    }


@app.post("/stop", response_model=StopResponse)
def stop_task() -> StopResponse:
    STOP_EVENT.set()
    return StopResponse(stopped=True, message="stop flag raised")


def _sse_event(data: dict[str, Any]) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


def _stream_text_typewriter(text: str, delay_ms: int = 18) -> Iterator[str]:
    for char in text:
        yield _sse_event({"content": char})
        if delay_ms > 0:
            time.sleep(delay_ms / 1000)


def chat_stream_events(payload: ChatRequest) -> Iterator[str]:
    message = payload.message
    history = [(item.role, item.content) for item in payload.history]
    provider: Literal["deepseek", "local"] = "local"
    typewriter_ms = int(os.getenv("CHAT_TYPEWRITER_MS", "28"))

    try:
        if is_configured():
            provider = "deepseek"
            messages = build_messages(message, history, payload.personality_ids)
            for chunk in chat_completion_stream(messages):
                yield _sse_event({"content": chunk})
        else:
            yield from _stream_text_typewriter(
                build_local_reply_text(message, payload.personality_ids),
                typewriter_ms,
            )
    except DeepSeekError as exc:
        provider = "local"
        fallback = f"（DeepSeek：{exc}）\n\n{build_local_reply_text(message, payload.personality_ids)}"
        yield from _stream_text_typewriter(fallback, typewriter_ms)

    suggest_task, task_hint = detect_task_intent(message)
    yield _sse_event(
        {
            "done": True,
            "suggest_task": suggest_task,
            "task_hint": task_hint,
            "provider": provider,
        }
    )


@app.post("/chat/stream")
def chat_stream(payload: ChatRequest) -> StreamingResponse:
    return StreamingResponse(
        chat_stream_events(payload),
        media_type="text/event-stream; charset=utf-8",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def file_chat_stream_events(payload: FileChatRequest) -> Iterator[str]:
    history = [(item.role, item.content) for item in payload.history]
    file_context = build_file_system_context(payload.file_paths)
    provider: Literal["deepseek", "local"] = "local"
    typewriter_ms = int(os.getenv("CHAT_TYPEWRITER_MS", "28"))
    short_request = payload.message.strip()

    if not history:
        user_message = (
            f"主人的诉求：{short_request}\n\n"
            "请根据文件内容与诉求，用简体中文回答。"
        )
    else:
        user_message = short_request

    try:
        if is_configured():
            provider = "deepseek"
            messages = build_file_chat_messages(user_message, history, file_context, payload.personality_ids)
            for chunk in chat_completion_stream(messages):
                yield _sse_event({"content": chunk})
        else:
            names = ", ".join(Path(p).name for p in payload.file_paths[:3])
            local = (
                f"已收到文件：{names}。诉求：「{short_request}」。\n"
                "请在 backend/.env 配置 DEEPSEEK_API_KEY 后，我才能用大模型分析文件内容。"
            )
            yield from _stream_text_typewriter(local, typewriter_ms)
    except DeepSeekError as exc:
        provider = "local"
        names = ", ".join(Path(p).name for p in payload.file_paths[:3])
        fallback = (
            f"（DeepSeek：{exc}）\n\n"
            f"已收到：{names}，诉求「{short_request}」。请检查 API 配置或稍后重试。"
        )
        yield from _stream_text_typewriter(fallback, typewriter_ms)

    suggest_task, task_hint = detect_task_intent(short_request)
    yield _sse_event(
        {
            "done": True,
            "suggest_task": suggest_task,
            "task_hint": task_hint,
            "provider": provider,
        }
    )


@app.post("/pet/poke", response_model=PetPokeResponse)
def pet_poke(payload: PetPokeRequest) -> PetPokeResponse:
    line, mood, provider = generate_poke_line(payload.click_index, payload.recent_lines)
    return PetPokeResponse(
        line=line,
        mood=mood,  # type: ignore[arg-type]
        provider=provider,  # type: ignore[arg-type]
    )


@app.post("/pet/bubble", response_model=PetBubbleResponse)
def pet_bubble(payload: PetBubbleRequest) -> PetBubbleResponse:
    return build_pet_bubble(payload)


@app.post("/tasks/suggest", response_model=TaskSuggestResponse)
def suggest_tasks(payload: TaskSuggestRequest) -> TaskSuggestResponse:
    if is_configured():
        try:
            return build_deepseek_task_suggestions(payload)
        except (DeepSeekError, ValueError, json.JSONDecodeError) as exc:
            return _fallback_task_suggestions(payload, str(exc))
    return _fallback_task_suggestions(payload)


@app.post("/chat/file/stream")
def file_chat_stream(payload: FileChatRequest) -> StreamingResponse:
    return StreamingResponse(
        file_chat_stream_events(payload),
        media_type="text/event-stream; charset=utf-8",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest) -> ChatResponse:
    if is_configured():
        try:
            return build_deepseek_chat_response(payload)
        except DeepSeekError as exc:
            local = build_local_chat_response(payload)
            local.reply = f"（DeepSeek：{exc}）\n\n{local.reply}"
            return local
    return build_local_chat_response(payload)


@app.get("/history")
def history(limit: int = 20) -> dict[str, Any]:
    safe_limit = max(1, min(100, limit))
    with sqlite3.connect(DB_PATH) as conn:
        rows = conn.execute(
            """
            SELECT task_id, command, tool_name, risk_level, status, created_at, finished_at, detail_json
            FROM task_runs
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (safe_limit,),
        ).fetchall()
    records = [
        {
            "task_id": row[0],
            "command": row[1],
            "tool_name": row[2],
            "risk_level": row[3],
            "status": row[4],
            "created_at": row[5],
            "finished_at": row[6],
            "detail": json.loads(row[7]),
        }
        for row in rows
    ]
    return {"items": records}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=int(os.getenv("AI_PET_PORT", "8765")))
