export const PET_SIZE_STORAGE_KEY = "pet-float-scale";
export const PET_SIZE_DEFAULT = 100;
export const PET_SIZE_MIN = 60;
export const PET_SIZE_MAX = 200;

export const PET_WINDOW_BASE_WIDTH = 220;
export const PET_WINDOW_BASE_HEIGHT = 280;
export const PET_IMAGE_BASE_PX = 200;

export function clampPetScale(value: number): number {
  return Math.min(PET_SIZE_MAX, Math.max(PET_SIZE_MIN, Math.round(value)));
}

export function loadPetScale(): number {
  const raw = localStorage.getItem(PET_SIZE_STORAGE_KEY);
  const parsed = raw ? Number(raw) : PET_SIZE_DEFAULT;
  return clampPetScale(Number.isFinite(parsed) ? parsed : PET_SIZE_DEFAULT);
}

export function savePetScale(scale: number): number {
  const normalized = clampPetScale(scale);
  localStorage.setItem(PET_SIZE_STORAGE_KEY, String(normalized));
  return normalized;
}

export function petWindowSize(
  scale: number,
  extraWidth = 0,
): { width: number; height: number } {
  const ratio = clampPetScale(scale) / 100;
  return {
    width: Math.round(PET_WINDOW_BASE_WIDTH * ratio) + extraWidth,
    height: Math.round(PET_WINDOW_BASE_HEIGHT * ratio),
  };
}

export function petImageSizePx(scale: number): number {
  return Math.round((PET_IMAGE_BASE_PX * clampPetScale(scale)) / 100);
}
