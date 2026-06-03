import type { EffortLevel, UserTask } from "../data/userTasks";

const API_BASE = "http://127.0.0.1:8765";

export type SuggestedTask = {
  title: string;
  subtitle: string;
  effort: EffortLevel;
  reason?: string;
};

export type TaskSuggestResponse = {
  reply: string;
  tasks: SuggestedTask[];
  provider: "deepseek" | "local";
};

export async function suggestTasks(
  message: string,
  existingTasks: UserTask[],
  personalityIds: string[] = [],
): Promise<TaskSuggestResponse> {
  const response = await fetch(`${API_BASE}/tasks/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      existing_tasks: existingTasks.map((task) => ({
        title: task.title,
        completed: task.completed,
        effort: task.effort,
      })),
      personality_ids: personalityIds,
    }),
  });

  if (!response.ok) {
    throw new Error(`task suggestion failed: ${response.status}`);
  }

  const data = (await response.json()) as TaskSuggestResponse;
  return {
    reply: data.reply || "我帮你拆成这些任务啦。",
    provider: data.provider === "deepseek" ? "deepseek" : "local",
    tasks: Array.isArray(data.tasks) ? data.tasks : [],
  };
}
