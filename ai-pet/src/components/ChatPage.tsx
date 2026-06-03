import { FormEvent, useEffect, useRef, useState } from "react";
import { PET_GIF_FALLBACK } from "../petGif";
import "./ChatPage.css";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  taskHint?: string;
  streaming?: boolean;
};

type ChatPageProps = {
  apiBase: string;
  agentOnline: boolean;
  petGifSrc: string;
  petGifName?: string;
  personalityIds?: string[];
  onBack: () => void;
  onExecuteTask: (command: string) => Promise<void>;
};

type StreamDonePayload = {
  done: true;
  suggest_task?: boolean;
  task_hint?: string | null;
  provider?: "deepseek" | "local";
};

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content: "主人你好，我是 Yarni～可以和我聊天",
};

function appendToMessage(messages: ChatMessage[], id: string, chunk: string): ChatMessage[] {
  return messages.map((m) => (m.id === id ? { ...m, content: m.content + chunk } : m));
}

function finalizeMessage(
  messages: ChatMessage[],
  id: string,
  done: StreamDonePayload,
  fallbackTaskText: string,
): ChatMessage[] {
  return messages.map((m) => {
    if (m.id !== id) return m;
    return {
      ...m,
      streaming: false,
      taskHint: done.suggest_task ? done.task_hint ?? fallbackTaskText : undefined,
    };
  });
}

async function consumeChatStream(
  apiBase: string,
  body: { message: string; history: { role: string; content: string }[]; personality_ids?: string[] },
  onChunk: (text: string) => void,
  onDone: (payload: StreamDonePayload) => void,
): Promise<void> {
  const response = await fetch(`${apiBase}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error("chat stream failed");
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("no stream body");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;

      const payload = trimmed.slice(5).trim();
      if (!payload) continue;

      const data = JSON.parse(payload) as {
        content?: string;
        done?: boolean;
        suggest_task?: boolean;
        task_hint?: string | null;
        provider?: "deepseek" | "local";
      };

      if (data.content) {
        onChunk(data.content);
      }
      if (data.done) {
        onDone({
          done: true,
          suggest_task: data.suggest_task,
          task_hint: data.task_hint,
          provider: data.provider,
        });
      }
    }
  }
}

export function ChatPage({
  apiBase,
  agentOnline,
  petGifSrc,
  petGifName,
  personalityIds = [],
  onBack,
  onExecuteTask,
}: ChatPageProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [chatProvider, setChatProvider] = useState<"deepseek" | "local" | null>(null);
  const [deepseekModel, setDeepseekModel] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadStatus = async (): Promise<void> => {
      try {
        const response = await fetch(`${apiBase}/status`);
        if (!response.ok) return;
        const data = (await response.json()) as {
          chat_provider?: "deepseek" | "local";
          deepseek_model?: string | null;
        };
        setChatProvider(data.chat_provider ?? "local");
        setDeepseekModel(data.deepseek_model ?? null);
      } catch {
        setChatProvider(null);
      }
    };
    void loadStatus();
  }, [apiBase]);

  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const sendMessage = async (event?: FormEvent): Promise<void> => {
    event?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    const assistantId = crypto.randomUUID();
    const assistantPlaceholder: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      streaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
    setInput("");
    setSending(true);

    try {
      const history = [...messages, userMsg]
        .filter((m) => m.id !== "welcome")
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      await consumeChatStream(
        apiBase,
        { message: text, history, personality_ids: personalityIds },
        (chunk) => {
          setMessages((prev) => appendToMessage(prev, assistantId, chunk));
        },
        (done) => {
          if (done.provider) {
            setChatProvider(done.provider);
          }
          setMessages((prev) => finalizeMessage(prev, assistantId, done, text));
        },
      );
    } catch {
      setMessages((prev) => {
        const withoutPlaceholder = prev.filter((m) => m.id !== assistantId);
        return [
          ...withoutPlaceholder,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: agentOnline
              ? "刚才没连上对话服务，请稍后再试。"
              : "本地 Agent 未启动，请先运行 start-agent.bat，我才能好好陪你聊天和执行任务。",
          },
        ];
      });
    } finally {
      setSending(false);
    }
  };

  const runSuggestedTask = async (message: ChatMessage): Promise<void> => {
    if (!message.taskHint) return;
    setExecutingId(message.id);
    try {
      await onExecuteTask(message.taskHint);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "任务已提交执行，你可以在右侧任务记录里查看进度。",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "任务执行失败了，请确认 Agent 在线后重试。",
        },
      ]);
    } finally {
      setExecutingId(null);
    }
  };

  return (
    <div className="chat-page">
      <header className="chat-header">
        <button type="button" className="chat-back-btn" onClick={onBack}>
          ← 返回首页
        </button>
        <div className="chat-header-info">
          <img
            className="chat-header-avatar"
            src={petGifSrc}
            alt={petGifName || "Yarni"}
            draggable={false}
            onError={(e) => {
              const img = e.currentTarget;
              if (img.src.includes(PET_GIF_FALLBACK)) return;
              img.src = PET_GIF_FALLBACK;
            }}
          />
          <div>
            <h1>{petGifName ? `${petGifName} · 对话` : "Yarni 对话"}</h1>
            <p>
              {agentOnline
                ? chatProvider === "deepseek"
                  ? `DeepSeek 流式对话${deepseekModel ? ` · ${deepseekModel}` : ""}`
                  : chatProvider === "local"
                    ? "本地规则回复 · 配置 DEEPSEEK_API_KEY 可启用大模型"
                    : "在线 · 可聊天与执行任务"
                : "离线 · 请先启动 start-agent.bat"}
            </p>
          </div>
        </div>
      </header>

      <div className="chat-feed" ref={feedRef}>
        {messages.map((message) => (
          <div
            key={message.id}
            className={`chat-bubble-row ${message.role === "user" ? "user" : "assistant"}`}
          >
            {message.role === "assistant" ? (
              <img
                className="chat-bubble-avatar"
                src={petGifSrc}
                alt=""
                aria-hidden
                draggable={false}
                onError={(e) => {
                  const img = e.currentTarget;
                  if (img.src.includes(PET_GIF_FALLBACK)) return;
                  img.src = PET_GIF_FALLBACK;
                }}
              />
            ) : null}
            <div className="chat-bubble-wrap">
              <div
                className={`chat-bubble ${message.role}${message.streaming ? " streaming" : ""}`}
              >
                {message.content}
                {message.streaming && !message.content ? (
                  <span className="chat-thinking">正在思考</span>
                ) : null}
              </div>
              {message.taskHint && !message.streaming ? (
                <button
                  type="button"
                  className="chat-task-btn"
                  disabled={executingId === message.id}
                  onClick={() => void runSuggestedTask(message)}
                >
                  {executingId === message.id ? "执行中…" : "执行此任务"}
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <form className="chat-composer" onSubmit={(e) => void sendMessage(e)}>
        <input
          value={input}
          onChange={(e) => setInput(e.currentTarget.value)}
          placeholder="和 Yarni 说点什么…"
          disabled={sending}
        />
        <button type="submit" disabled={sending || !input.trim()}>
          发送
        </button>
      </form>
    </div>
  );
}
