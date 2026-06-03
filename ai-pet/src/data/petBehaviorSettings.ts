export type PetBehaviorSettings = {
  /** 总开关：无聊时自主行动 */
  autonomyEnabled: boolean;
  /** 无聊时在屏幕上随机移动 */
  wanderWhenBored: boolean;
  /** 无聊时弹出捣乱台词，偶尔躲角落 */
  mischiefWhenBored: boolean;
  /** 多久没有互动后触发（秒） */
  boredomIntervalSec: number;
};

export const PET_BEHAVIOR_STORAGE_KEY = "pet-behavior-settings";

export const DEFAULT_PET_BEHAVIOR: PetBehaviorSettings = {
  autonomyEnabled: true,
  wanderWhenBored: true,
  mischiefWhenBored: true,
  boredomIntervalSec: 55,
};

export const PET_BEHAVIOR_CHANGED_EVENT = "pet-behavior-settings-changed";

function clampInterval(sec: number): number {
  return Math.min(180, Math.max(20, Math.round(sec)));
}

export function loadPetBehaviorSettings(): PetBehaviorSettings {
  try {
    const raw = localStorage.getItem(PET_BEHAVIOR_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PET_BEHAVIOR };
    const parsed = JSON.parse(raw) as Partial<PetBehaviorSettings>;
    return {
      autonomyEnabled: parsed.autonomyEnabled ?? DEFAULT_PET_BEHAVIOR.autonomyEnabled,
      wanderWhenBored: parsed.wanderWhenBored ?? DEFAULT_PET_BEHAVIOR.wanderWhenBored,
      mischiefWhenBored: parsed.mischiefWhenBored ?? DEFAULT_PET_BEHAVIOR.mischiefWhenBored,
      boredomIntervalSec: clampInterval(
        parsed.boredomIntervalSec ?? DEFAULT_PET_BEHAVIOR.boredomIntervalSec,
      ),
    };
  } catch {
    return { ...DEFAULT_PET_BEHAVIOR };
  }
}

export function savePetBehaviorSettings(settings: PetBehaviorSettings): PetBehaviorSettings {
  const normalized: PetBehaviorSettings = {
    autonomyEnabled: Boolean(settings.autonomyEnabled),
    wanderWhenBored: Boolean(settings.wanderWhenBored),
    mischiefWhenBored: Boolean(settings.mischiefWhenBored),
    boredomIntervalSec: clampInterval(settings.boredomIntervalSec),
  };
  localStorage.setItem(PET_BEHAVIOR_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(PET_BEHAVIOR_CHANGED_EVENT));
  return normalized;
}
