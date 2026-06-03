const API_BASE = "http://127.0.0.1:8765";

export type FileChatHistoryItem = {
  role: "user" | "assistant";
  content: string;
};

export type FileStreamDone = {
  done: true;
  provider?: "deepseek" | "local";
};

export async function streamFileChat(
  filePaths: string[],
  message: string,
  history: FileChatHistoryItem[],
  personalityIds: string[],
  onChunk: (text: string) => void,
  onDone: (payload: FileStreamDone) => void,
): Promise<void> {
  const response = await fetch(`${API_BASE}/chat/file/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_paths: filePaths, message, history, personality_ids: personalityIds }),
  });

  if (!response.ok) {
    throw new Error(`file chat failed: ${response.status}`);
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
        provider?: "deepseek" | "local";
      };

      if (data.content) {
        onChunk(data.content);
      }
      if (data.done) {
        onDone({ done: true, provider: data.provider });
      }
    }
  }
}

export async function checkAgentOnline(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/status`, { signal: AbortSignal.timeout(3000) });
    return response.ok;
  } catch {
    return false;
  }
}
