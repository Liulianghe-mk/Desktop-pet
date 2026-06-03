from __future__ import annotations

import os
import random
import re

from deepseek import DeepSeekError, chat_completion, is_configured

POKE_MAX_CHARS = 18

POKE_SYSTEM_PROMPT = """你是 Yarni，一只住在电脑桌面上的可爱毛线球宠物。主人用鼠标戳你时，你要说一句话回应。

规则：
- 只用简体中文，恰好 1 句口语，总长不超过 18 个汉字
- 可爱、俏皮，可称呼「主人」
- 根据「第几次戳」调整情绪：越早越好奇/害羞，越多越委屈/不耐烦（禁止脏话、人身攻击）
- 偶尔（尤其戳多了）可以说要逃跑、躲起来、藏起来、溜了等（会触发桌宠躲到屏幕角落）
- 不要与「最近说过」的句子雷同
- 只输出台词正文，不要引号、不要括号说明、不要分行"""

LOCAL_POKE_LINES = [
    "主人，你干嘛？",
    "诶？又戳我一下…",
    "人家好好待着呢～",
    "哼，别老点我啦！",
    "不耐烦了！哼！",
    "再点我就躲起来了哦…",
    "……（已关机，勿扰）",
]

LOCAL_POKE_ANGRY = "哼！说了别点了！！"


def _mood_for_index(click_index: int) -> str:
    return "annoyed" if click_index >= 4 else "normal"


def _sanitize_line(text: str) -> str:
    line = text.strip().strip("\"'“”‘’")
    line = re.sub(r"\s+", "", line)
    if len(line) > POKE_MAX_CHARS:
        line = line[:POKE_MAX_CHARS]
    return line or "主人，你干嘛？"


def local_poke_line(click_index: int) -> str:
    if click_index < len(LOCAL_POKE_LINES):
        return LOCAL_POKE_LINES[click_index]
    return LOCAL_POKE_ANGRY


def _build_user_prompt(click_index: int, recent_lines: list[str]) -> str:
    n = click_index + 1
    if n == 1:
        tone = "第一次戳，略带好奇或害羞。"
    elif n <= 3:
        tone = "又戳了几次，有点委屈、撒娇。"
    elif n <= 6:
        tone = "戳了很多次，明显不耐烦，但仍可爱。"
    else:
        tone = "戳得太多了，赌气、想躲开，仍保持萌感。"

    parts = [f"主人第 {n} 次戳你。{tone}"]
    if recent_lines:
        parts.append("最近说过：" + "；".join(recent_lines[-5:]))
    parts.append("请换一句全新的台词。")
    return "\n".join(parts)


def generate_poke_line(
    click_index: int,
    recent_lines: list[str] | None = None,
) -> tuple[str, str, str]:
    """Return (line, mood, provider)."""
    recent = recent_lines or []
    mood = _mood_for_index(click_index)

    if is_configured():
        try:
            messages = [
                {"role": "system", "content": POKE_SYSTEM_PROMPT},
                {"role": "user", "content": _build_user_prompt(click_index, recent)},
            ]
            raw = chat_completion(
                messages,
                temperature=float(os.getenv("DEEPSEEK_POKE_TEMPERATURE", "0.95")),
                max_tokens=int(os.getenv("DEEPSEEK_POKE_MAX_TOKENS", "80")),
            )
            line = _sanitize_line(raw)
            return line, mood, "deepseek"
        except DeepSeekError:
            pass

    pool = [local_poke_line(click_index)]
    if click_index < len(LOCAL_POKE_LINES):
        pool.extend(LOCAL_POKE_LINES)
    choices = [line for line in pool if line not in recent] or pool
    return random.choice(choices), mood, "local"
