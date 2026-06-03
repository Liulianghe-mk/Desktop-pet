export type EffortLevel = "low" | "medium" | "high";

export type UserTask = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  tag: string;
  completed: boolean;
  effort?: EffortLevel;
};

export const USER_TASKS_STORAGE_KEY = "user-tasks-v1";

export const DAILY_TASK_GOAL = 8;
export const WEEKLY_TASK_GOAL = 40;

export const INITIAL_USER_TASKS: UserTask[] = [
  {
    id: "water",
    title: "喝水",
    subtitle: "保持水分！目标：今日 2 升",
    icon: "💧",
    tag: "优先级 高",
    completed: false,
  },
  {
    id: "focus",
    title: "专注 25 分钟",
    subtitle: "为你的主要项目进行深度工作",
    icon: "⏱️",
    tag: "时间",
    completed: true,
  },
  {
    id: "walk",
    title: "散步 3000 步",
    subtitle: "轻微运动以清空思绪",
    icon: "🚶",
    tag: "目标",
    completed: false,
  },
  {
    id: "breakfast",
    title: "营养早餐",
    subtitle: "开启元气满满的一天",
    icon: "🥐",
    tag: "习惯",
    completed: true,
  },
  {
    id: "journal",
    title: "记录今日心情",
    subtitle: "写下一件让你开心的小事",
    icon: "📓",
    tag: "成长",
    completed: true,
  },
];

export const EFFORT_LABELS: Record<EffortLevel, string> = {
  low: "低",
  medium: "中",
  high: "高",
};

export const EFFORT_REWARDS: Record<EffortLevel, { xp: number; coins: number }> = {
  low: { xp: 8, coins: 4 },
  medium: { xp: 15, coins: 8 },
  high: { xp: 24, coins: 14 },
};

export function effortForTask(task: UserTask): EffortLevel {
  if (task.effort) return task.effort;
  if (task.tag.includes("高")) return "high";
  if (task.tag.includes("低")) return "low";
  return "medium";
}

export function rewardForTask(task: UserTask): { xp: number; coins: number } {
  return EFFORT_REWARDS[effortForTask(task)];
}

export function loadUserTasks(): UserTask[] {
  try {
    const raw = localStorage.getItem(USER_TASKS_STORAGE_KEY);
    if (!raw) return INITIAL_USER_TASKS.map((t) => ({ ...t }));
    const parsed = JSON.parse(raw) as UserTask[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return INITIAL_USER_TASKS.map((t) => ({ ...t }));
    }
    return parsed;
  } catch {
    return INITIAL_USER_TASKS.map((t) => ({ ...t }));
  }
}

export function saveUserTasks(tasks: UserTask[]): void {
  localStorage.setItem(USER_TASKS_STORAGE_KEY, JSON.stringify(tasks));
}
