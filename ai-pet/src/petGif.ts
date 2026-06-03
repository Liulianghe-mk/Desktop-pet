export const PET_GIF_STORAGE_KEY = "pet-float-gif-current";
export const PET_GIF_LIST_STORAGE_KEY = "pet-float-gif-list";
export const PET_GIF_NAME_MAP_STORAGE_KEY = "pet-float-gif-name-map";
export const PET_GIF_DEFAULT = "/chongwu.gif";
export const PET_GIF_FALLBACK = "/yarni-pet.png";

export function normalizeGifPath(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function loadCurrentPetGif(): string {
  const stored = localStorage.getItem(PET_GIF_STORAGE_KEY);
  const normalized = stored ? normalizeGifPath(stored) : "";
  return normalized || PET_GIF_DEFAULT;
}

export function saveCurrentPetGif(path: string): string {
  const normalized = normalizeGifPath(path) || PET_GIF_DEFAULT;
  localStorage.setItem(PET_GIF_STORAGE_KEY, normalized);
  return normalized;
}

export function loadPetGifList(): string[] {
  const raw = localStorage.getItem(PET_GIF_LIST_STORAGE_KEY);
  const base = [PET_GIF_DEFAULT];
  if (!raw) return base;
  try {
    const arr = JSON.parse(raw) as string[];
    const list = arr
      .map((item) => normalizeGifPath(item))
      .filter((item) => item.length > 0);
    return Array.from(new Set([...base, ...list]));
  } catch {
    return base;
  }
}

export function savePetGifList(list: string[]): string[] {
  const normalized = Array.from(
    new Set(
      list
        .map((item) => normalizeGifPath(item))
        .filter((item) => item.length > 0),
    ),
  );
  const ensured = normalized.includes(PET_GIF_DEFAULT)
    ? normalized
    : [PET_GIF_DEFAULT, ...normalized];
  localStorage.setItem(PET_GIF_LIST_STORAGE_KEY, JSON.stringify(ensured));
  return ensured;
}

export function loadPetGifNameMap(): Record<string, string> {
  const raw = localStorage.getItem(PET_GIF_NAME_MAP_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    const normalizedEntries = Object.entries(parsed)
      .map(([path, name]) => [normalizeGifPath(path), (name ?? "").trim()] as const)
      .filter(([path, name]) => path.length > 0 && name.length > 0);
    return Object.fromEntries(normalizedEntries);
  } catch {
    return {};
  }
}

export function savePetGifNameMap(nameMap: Record<string, string>): Record<string, string> {
  const normalizedEntries = Object.entries(nameMap)
    .map(([path, name]) => [normalizeGifPath(path), (name ?? "").trim()] as const)
    .filter(([path, name]) => path.length > 0 && name.length > 0);
  const normalized = Object.fromEntries(normalizedEntries);
  localStorage.setItem(PET_GIF_NAME_MAP_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}
