const API_BASE = "http://127.0.0.1:8765";

export type PetBubbleKind =
  | "idle"
  | "music"
  | "weather"
  | "schedule"
  | "focus"
  | "dream"
  | "emotion";

export type PetBubbleResult = {
  line: string;
  mood: "normal" | "annoyed";
  provider: "deepseek" | "local";
};

export async function fetchPetBubble(payload: {
  kind: PetBubbleKind;
  personalityIds: string[];
  pendingTasks: number;
  homeMode?: string | null;
  recentLines: string[];
}): Promise<PetBubbleResult> {
  const response = await fetch(`${API_BASE}/pet/bubble`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: payload.kind,
      personality_ids: payload.personalityIds,
      pending_tasks: payload.pendingTasks,
      home_mode: payload.homeMode,
      recent_lines: payload.recentLines.slice(-5),
    }),
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`pet bubble failed: ${response.status}`);
  }

  const data = (await response.json()) as PetBubbleResult;
  return {
    line: data.line?.trim() || "我在这里陪你。",
    mood: data.mood === "annoyed" ? "annoyed" : "normal",
    provider: data.provider === "deepseek" ? "deepseek" : "local",
  };
}
