const API_BASE = "http://127.0.0.1:8765";

export type PetPokeResult = {
  line: string;
  mood: "normal" | "annoyed";
  provider: "deepseek" | "local";
};

export async function fetchPetPokeLine(
  clickIndex: number,
  recentLines: string[],
): Promise<PetPokeResult> {
  const response = await fetch(`${API_BASE}/pet/poke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      click_index: clickIndex,
      recent_lines: recentLines.slice(-5),
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`pet poke failed: ${response.status}`);
  }

  const data = (await response.json()) as PetPokeResult;
  return {
    line: data.line?.trim() || "主人，你干嘛？",
    mood: data.mood === "annoyed" ? "annoyed" : "normal",
    provider: data.provider === "deepseek" ? "deepseek" : "local",
  };
}
