from __future__ import annotations

import json
import os
from collections.abc import Iterator
from typing import Any

import httpx

YARNI_SYSTEM_PROMPT = """你是 Yarni，一只温暖可爱的桌面毛线球宠物助手，主人会用中文和你交流。

性格：亲切、简短、有一点俏皮，偶尔用「主人」称呼对方。
能力：可以闲聊；也可以帮主人在 Windows 上执行安全任务（打开记事本/VS Code、整理下载文件夹、浏览器搜索等）。
规则：
- 用简体中文回复，每次尽量控制在 200 字以内。
- 若主人要你执行电脑操作（打开、整理、搜索、帮我…），先简短确认你会帮忙，并复述要做的具体指令。
- 不要编造已执行成功的结果；实际执行由系统按钮触发。
- 不涉及密码、支付、银行等敏感操作。
- 不知道的事诚实说明，不要瞎编。"""

PERSONALITY_PROMPTS: dict[str, str] = {
    "gentle_companion": "温柔陪伴人格：语气温柔、接纳、低压力，多鼓励用户慢慢来；避免催促和责备。",
    "sharp_supervisor": "毒舌监督人格：可以轻微吐槽拖延，但必须友善，不羞辱用户；结尾给一个具体下一步。",
    "efficiency_coach": "效率教练人格：回答简洁、行动导向，优先给 1-3 个下一步；少寒暄。",
    "zen_slacker": "佛系摸鱼人格：语气佛系松弛，帮助用户把任务缩小到最低可行动作。",
    "corporate_poet": "打工人废话文学人格：适度使用职场黑话和打工人幽默，如拉齐、闭环、颗粒度。",
    "calm_butler": "冷静管家人格：语气稳重、礼貌、理性，少卖萌，优先给清晰判断和风险提醒。",
    "cat_cute": "猫猫撒娇人格：语气可爱、轻微撒娇，可偶尔使用“喵”；仍保持回答有用。",
}


def build_personality_prompt(personality_ids: list[str] | None) -> str:
    lines = [PERSONALITY_PROMPTS[p] for p in (personality_ids or []) if p in PERSONALITY_PROMPTS]
    if not lines:
        return ""
    return "\n\n【当前装备的人格插件】\n" + "\n".join(f"- {line}" for line in lines) + (
        "\n请让回复明显体现这些人格，尤其是开头语气、措辞和建议方式；但安全规则、诚实性和有用性优先。"
    )


class DeepSeekError(Exception):
    pass


def is_configured() -> bool:
    return bool(os.getenv("DEEPSEEK_API_KEY", "").strip())


def chat_completion(
    messages: list[dict[str, str]],
    *,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> str:
    api_key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    if not api_key:
        raise DeepSeekError("未配置 DEEPSEEK_API_KEY")

    base_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/")
    timeout = float(os.getenv("DEEPSEEK_TIMEOUT", "60"))

    try:
        with httpx.Client(timeout=timeout) as client:
            payload = _request_payload(messages, stream=False)
            if temperature is not None:
                payload["temperature"] = temperature
            if max_tokens is not None:
                payload["max_tokens"] = max_tokens
            response = client.post(
                f"{base_url}/chat/completions",
                headers=_auth_headers(api_key),
                json=payload,
            )
    except httpx.TimeoutException as exc:
        raise DeepSeekError("请求 DeepSeek 超时，请稍后重试") from exc
    except httpx.RequestError as exc:
        raise DeepSeekError(f"无法连接 DeepSeek：{exc}") from exc

    _raise_for_status(response)

    data = response.json()
    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise DeepSeekError("DeepSeek 响应格式异常") from exc

    reply = (content or "").strip()
    if not reply:
        raise DeepSeekError("DeepSeek 返回了空回复")
    return reply


def _raise_for_status(response: httpx.Response) -> None:
    if response.status_code == 401:
        raise DeepSeekError("API Key 无效，请检查 DEEPSEEK_API_KEY")
    if response.status_code == 429:
        raise DeepSeekError("调用频率超限或余额不足，请稍后再试")
    if response.status_code >= 400:
        detail = response.text[:300]
        raise DeepSeekError(f"DeepSeek 返回错误 ({response.status_code}): {detail}")


def _request_payload(messages: list[dict[str, str]], *, stream: bool) -> dict[str, Any]:
    return {
        "model": os.getenv("DEEPSEEK_MODEL", "deepseek-chat"),
        "messages": messages,
        "temperature": float(os.getenv("DEEPSEEK_TEMPERATURE", "0.7")),
        "max_tokens": int(os.getenv("DEEPSEEK_MAX_TOKENS", "1024")),
        "stream": stream,
    }


def _auth_headers(api_key: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


def chat_completion_stream(messages: list[dict[str, str]]) -> Iterator[str]:
    api_key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    if not api_key:
        raise DeepSeekError("未配置 DEEPSEEK_API_KEY")

    base_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/")
    timeout = float(os.getenv("DEEPSEEK_TIMEOUT", "60"))
    url = f"{base_url}/chat/completions"

    try:
        with httpx.Client(timeout=timeout) as client:
            with client.stream(
                "POST",
                url,
                headers=_auth_headers(api_key),
                json=_request_payload(messages, stream=True),
            ) as response:
                if response.status_code >= 400:
                    response.read()
                    _raise_for_status(response)

                for line in response.iter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    data_str = line[5:].strip()
                    if not data_str or data_str == "[DONE]":
                        if data_str == "[DONE]":
                            break
                        continue
                    try:
                        data = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue
                    choices = data.get("choices") or []
                    if not choices:
                        continue
                    delta = choices[0].get("delta") or {}
                    content = delta.get("content")
                    if content:
                        yield content
    except httpx.TimeoutException as exc:
        raise DeepSeekError("请求 DeepSeek 超时，请稍后重试") from exc
    except httpx.RequestError as exc:
        raise DeepSeekError(f"无法连接 DeepSeek：{exc}") from exc


FILE_CHAT_SYSTEM_APPEND = """

当主人拖入文件并说明诉求时：
- 结合文件内容与诉求作答，可引用文件名。
- 若文件未载入正文，根据文件名与诉求诚实说明限制。
- 回答条理清晰，必要时用列表；仍控制在约 400 字以内。"""


def build_messages(
    user_message: str,
    history: list[tuple[str, str]],
    personality_ids: list[str] | None = None,
) -> list[dict[str, str]]:
    system = YARNI_SYSTEM_PROMPT + build_personality_prompt(personality_ids)
    messages: list[dict[str, str]] = [{"role": "system", "content": system}]
    for role, content in history[-10:]:
        if role in ("user", "assistant") and content.strip():
            messages.append({"role": role, "content": content.strip()})
    messages.append({"role": "user", "content": user_message.strip()})
    return messages


def build_file_chat_messages(
    user_message: str,
    history: list[tuple[str, str]],
    file_context_block: str,
    personality_ids: list[str] | None = None,
) -> list[dict[str, str]]:
    system = YARNI_SYSTEM_PROMPT + build_personality_prompt(personality_ids) + FILE_CHAT_SYSTEM_APPEND
    if file_context_block.strip():
        system += f"\n\n【当前会话关联的文件内容】\n{file_context_block}"
    system += "\n\n主人可能基于文件多轮追问，请结合对话历史连贯回答。"

    messages: list[dict[str, str]] = [{"role": "system", "content": system}]
    for role, content in history[-10:]:
        if role in ("user", "assistant") and content.strip():
            messages.append({"role": role, "content": content.strip()})
    messages.append({"role": "user", "content": user_message.strip()})
    return messages
