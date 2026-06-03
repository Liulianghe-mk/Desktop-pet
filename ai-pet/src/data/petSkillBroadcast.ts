import type { GrowthSkillId } from "./growth";
import { isSkillActive, loadPetGrowth, type PetGrowthState } from "./petGrowth";
import { loadUserTasks } from "./userTasks";

const MUSIC_LINES = [
  "🎵 正在同步你的播放氛围…",
  "🎵 这首不错，Yarni 也跟着晃尾巴～",
  "🎵 检测到好听的歌，心情 +1",
];

const FOCUS_LINES = [
  "🎯 专注时间到，先搞定一件事？",
  "🎯 深呼吸，25 分钟后再摸鱼",
  "🎯 我在旁边守着你，别刷手机啦",
];

const DREAM_LINES = [
  "🌙 晚安模式…做个软软的梦",
  "🌙 星星亮了，今天也很辛苦",
  "🌙 梦里见，明天继续加油",
];

const WEATHER_FALLBACK = [
  "🌤️ 今天适合晒晒太阳",
  "🌥️ 记得带件外套，别着凉",
  "☀️ 天气不错，出门走走？",
];

const DEFAULT_LAT = 39.9042;
const DEFAULT_LON = 116.4074;

export const SKILL_BROADCAST_INTERVAL_MS: Record<
  Exclude<GrowthSkillId, "emotion">,
  number
> = {
  music: 35 * 60 * 1000,
  weather: 45 * 60 * 1000,
  schedule: 28 * 60 * 1000,
  focus: 22 * 60 * 1000,
  dream: 40 * 60 * 1000,
};

export function isDreamHours(): boolean {
  const h = new Date().getHours();
  return h >= 22 || h < 6;
}

export async function fetchWeatherLine(): Promise<string> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${DEFAULT_LAT}&longitude=${DEFAULT_LON}&current_weather=true`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error("weather fetch failed");
    const data = (await res.json()) as {
      current_weather?: { temperature?: number; windspeed?: number };
    };
    const temp = data.current_weather?.temperature;
    if (typeof temp === "number") {
      const feel = temp >= 28 ? "有点热" : temp <= 5 ? "挺冷" : "还算舒适";
      return `🌤️ 北京 ${Math.round(temp)}°C，${feel}`;
    }
  } catch {
    /* fallback */
  }
  return WEATHER_FALLBACK[Math.floor(Math.random() * WEATHER_FALLBACK.length)];
}

export function getScheduleReminderLine(): string | null {
  const tasks = loadUserTasks();
  const pending = tasks.filter((t) => !t.completed);
  if (pending.length === 0) return "📅 今日任务都搞定啦，真棒！";
  if (pending.length === 1) return `📅 还有 1 件事：${pending[0].title}`;
  return `📅 还有 ${pending.length} 项任务待完成`;
}

export function pickMusicLine(): string {
  return MUSIC_LINES[Math.floor(Math.random() * MUSIC_LINES.length)];
}

export function pickFocusLine(): string {
  return FOCUS_LINES[Math.floor(Math.random() * FOCUS_LINES.length)];
}

export function pickDreamLine(): string {
  return DREAM_LINES[Math.floor(Math.random() * DREAM_LINES.length)];
}

export type SkillBroadcastKind = Exclude<GrowthSkillId, "emotion">;

export async function lineForSkillBroadcast(
  kind: SkillBroadcastKind,
): Promise<string | null> {
  const growth = loadPetGrowth();
  if (!isSkillActive(growth, kind)) return null;

  switch (kind) {
    case "music":
      return pickMusicLine();
    case "weather":
      return await fetchWeatherLine();
    case "schedule":
      return getScheduleReminderLine();
    case "focus":
      return pickFocusLine();
    case "dream":
      if (!isDreamHours()) return null;
      return pickDreamLine();
    default:
      return null;
  }
}

/** 无聊闲逛时优先使用的台词（专注 / 梦境） */
export function pickBoredSkillLine(state: PetGrowthState): string | null {
  if (isSkillActive(state, "dream") && isDreamHours()) {
    return pickDreamLine();
  }
  if (isSkillActive(state, "focus") && Math.random() < 0.55) {
    return pickFocusLine();
  }
  return null;
}

export function shouldSuppressWanderForFocus(state: PetGrowthState): boolean {
  return isSkillActive(state, "focus");
}
