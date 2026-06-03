/** 连点悬浮宠物时的台词，越点越不耐烦 */
export const PET_POKE_LINES = [
  "主人，你干嘛？",
  "诶？又戳我一下…",
  "人家好好待着呢～",
  "哼，别老点我啦！",
  "不耐烦了！哼！",
  "再点我就躲起来了哦…",
  "……（已关机，勿扰）",
] as const;

export const PET_POKE_ANGRY = "哼！说了别点了！！";

export function pokeLineForClick(clickIndex: number): string {
  if (clickIndex < PET_POKE_LINES.length) {
    return PET_POKE_LINES[clickIndex];
  }
  return PET_POKE_ANGRY;
}

/** 气泡自动消失（毫秒） */
export const PET_POKE_BUBBLE_MS = 4500;

/** 超过此时间未再点击则重置连点计数 */
export const PET_POKE_RESET_MS = 8000;
