export type PetQuickActionKind = "web" | "exe" | "builtin";

export type PetBuiltinTarget = "main" | "hide";

export type PetQuickAction = {
  id: string;
  label: string;
  icon: string;
  kind: PetQuickActionKind;
  /** 网页地址（kind=web）或 exe 无路径时的回退网页（kind=exe） */
  webUrl: string;
  /** 桌面程序路径（kind=exe） */
  exePath: string;
  builtin: PetBuiltinTarget | null;
  enabled: boolean;
};

export const PET_QUICK_ACTIONS_STORAGE_KEY = "pet-quick-actions";
export const PET_QUICK_ACTIONS_CHANGED_EVENT = "pet-quick-actions-changed";
export const PET_QUICK_ACTIONS_MAX = 5;
export const PET_QUICK_RAIL_WIDTH = 68;

export const DEFAULT_PET_QUICK_ACTIONS: PetQuickAction[] = [
  {
    id: "qqvideo",
    label: "腾讯视频",
    icon: "▶",
    kind: "web",
    webUrl: "https://v.qq.com/",
    exePath: "",
    builtin: null,
    enabled: true,
  },
  {
    id: "netease",
    label: "网易云",
    icon: "♫",
    kind: "web",
    webUrl: "https://music.163.com/",
    exePath: "",
    builtin: null,
    enabled: true,
  },
  {
    id: "main",
    label: "主界面",
    icon: "⌂",
    kind: "builtin",
    webUrl: "",
    exePath: "",
    builtin: "main",
    enabled: true,
  },
];

function normalizeAction(raw: Partial<PetQuickAction>, index: number): PetQuickAction {
  const fallback = DEFAULT_PET_QUICK_ACTIONS[index] ?? DEFAULT_PET_QUICK_ACTIONS[0];
  const kind =
    raw.kind === "exe" || raw.kind === "builtin" || raw.kind === "web"
      ? raw.kind
      : fallback.kind;
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : fallback.id,
    label: typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : fallback.label,
    icon: typeof raw.icon === "string" && raw.icon.trim() ? raw.icon.trim().slice(0, 2) : fallback.icon,
    kind,
    webUrl: typeof raw.webUrl === "string" ? raw.webUrl.trim() : fallback.webUrl,
    exePath: typeof raw.exePath === "string" ? raw.exePath.trim() : fallback.exePath,
    builtin:
      raw.builtin === "main" || raw.builtin === "hide"
        ? raw.builtin
        : kind === "builtin"
          ? fallback.builtin
          : null,
    enabled: raw.enabled !== false,
  };
}

export function loadPetQuickActions(): PetQuickAction[] {
  try {
    const raw = localStorage.getItem(PET_QUICK_ACTIONS_STORAGE_KEY);
    if (!raw) return DEFAULT_PET_QUICK_ACTIONS.map((a) => ({ ...a }));
    const parsed = JSON.parse(raw) as Partial<PetQuickAction>[];
    if (!Array.isArray(parsed)) return DEFAULT_PET_QUICK_ACTIONS.map((a) => ({ ...a }));
    const normalized = parsed
      .slice(0, PET_QUICK_ACTIONS_MAX)
      .map((item, i) => normalizeAction(item, i));
    return normalized.length > 0 ? normalized : DEFAULT_PET_QUICK_ACTIONS.map((a) => ({ ...a }));
  } catch {
    return DEFAULT_PET_QUICK_ACTIONS.map((a) => ({ ...a }));
  }
}

export function savePetQuickActions(actions: PetQuickAction[]): PetQuickAction[] {
  const normalized = actions
    .slice(0, PET_QUICK_ACTIONS_MAX)
    .map((item, i) => normalizeAction(item, i));
  localStorage.setItem(PET_QUICK_ACTIONS_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(PET_QUICK_ACTIONS_CHANGED_EVENT));
  return normalized;
}

export function getEnabledQuickActions(actions: PetQuickAction[]): PetQuickAction[] {
  return actions.filter((a) => a.enabled);
}
