/** 台词含这些词时，桌宠会躲到屏幕角落 */
const FLEE_KEYWORDS = [
  "逃跑",
  "躲起来",
  "躲进",
  "躲到",
  "躲远",
  "躲开",
  "藏起来",
  "藏进",
  "藏到",
  "溜了",
  "溜掉",
  "闪人",
  "快闪",
  "不见了",
  "别找我",
  "勿扰",
  "关机",
  "躲猫猫",
  "滚",
] as const;

export function shouldPetFlee(line: string): boolean {
  const normalized = line.trim();
  if (!normalized) return false;
  return FLEE_KEYWORDS.some((word) => normalized.includes(word));
}
