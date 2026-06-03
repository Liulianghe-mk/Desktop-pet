export type PetGifRotationSettings = {
  enabled: boolean;
  /** 切换间隔（秒） */
  intervalSec: number;
};

export const PET_GIF_ROTATION_STORAGE_KEY = "pet-gif-rotation-settings";
export const PET_GIF_ROTATION_CHANGED_EVENT = "pet-gif-rotation-changed";

export const DEFAULT_GIF_ROTATION: PetGifRotationSettings = {
  enabled: true,
  intervalSec: 30,
};

function clampInterval(sec: number): number {
  return Math.min(300, Math.max(10, Math.round(sec)));
}

export function loadPetGifRotationSettings(): PetGifRotationSettings {
  try {
    const raw = localStorage.getItem(PET_GIF_ROTATION_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_GIF_ROTATION };
    const parsed = JSON.parse(raw) as Partial<PetGifRotationSettings>;
    return {
      enabled: parsed.enabled ?? DEFAULT_GIF_ROTATION.enabled,
      intervalSec: clampInterval(parsed.intervalSec ?? DEFAULT_GIF_ROTATION.intervalSec),
    };
  } catch {
    return { ...DEFAULT_GIF_ROTATION };
  }
}

export function savePetGifRotationSettings(
  settings: PetGifRotationSettings,
): PetGifRotationSettings {
  const normalized: PetGifRotationSettings = {
    enabled: Boolean(settings.enabled),
    intervalSec: clampInterval(settings.intervalSec),
  };
  localStorage.setItem(PET_GIF_ROTATION_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(PET_GIF_ROTATION_CHANGED_EVENT));
  return normalized;
}

/** 按列表顺序切换到下一张 */
export function pickNextGif(current: string, list: string[]): string {
  if (list.length === 0) return current;
  if (list.length === 1) return list[0];
  const index = list.indexOf(current);
  if (index === -1) return list[0];
  return list[(index + 1) % list.length];
}
