import { getStoreProduct, resolveStoreProduct } from "./storeProducts";

export const PET_INVENTORY_STORAGE_KEY = "pet-inventory-v1";
export const PET_INVENTORY_CHANGED_EVENT = "pet-inventory-changed";

export type ActiveEffects = {
  /** 周一起床气：戳宠台词更暴躁，毫秒时间戳 */
  mondayMoodUntil?: number;
  /** 拖延卡生效日期 YYYY-MM-DD */
  procrastinationDay?: string;
};

export type PetInventoryState = {
  owned: string[];
  equippedHead: string | null;
  equippedBuffs: [string | null, string | null];
  equippedPersonalities: [string | null, string | null];
  equippedCorner: string | null;
  /** 可重复使用次数（奇趣消耗品） */
  consumableCharges: Record<string, number>;
  activeEffects: ActiveEffects;
};

const DEFAULT_STATE: PetInventoryState = {
  owned: [],
  equippedHead: null,
  equippedBuffs: [null, null],
  equippedPersonalities: [null, null],
  equippedCorner: null,
  consumableCharges: {},
  activeEffects: {},
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function loadPetInventory(): PetInventoryState {
  try {
    const raw = localStorage.getItem(PET_INVENTORY_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE, owned: [], consumableCharges: {}, activeEffects: {} };
    const parsed = JSON.parse(raw) as Partial<PetInventoryState>;
    return {
      owned: Array.isArray(parsed.owned) ? parsed.owned : [],
      equippedHead: parsed.equippedHead ?? null,
      equippedBuffs: [
        parsed.equippedBuffs?.[0] ?? null,
        parsed.equippedBuffs?.[1] ?? null,
      ],
      equippedPersonalities: [
        parsed.equippedPersonalities?.[0] ?? null,
        parsed.equippedPersonalities?.[1] ?? null,
      ],
      equippedCorner: parsed.equippedCorner ?? null,
      consumableCharges:
        parsed.consumableCharges && typeof parsed.consumableCharges === "object"
          ? parsed.consumableCharges
          : {},
      activeEffects: parsed.activeEffects ?? {},
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function savePetInventory(state: PetInventoryState): PetInventoryState {
  const normalized: PetInventoryState = {
    owned: [...new Set(state.owned)],
    equippedHead: state.equippedHead,
    equippedBuffs: [state.equippedBuffs[0], state.equippedBuffs[1]],
    equippedPersonalities: [
      state.equippedPersonalities?.[0] ?? null,
      state.equippedPersonalities?.[1] ?? null,
    ],
    equippedCorner: state.equippedCorner,
    consumableCharges: { ...state.consumableCharges },
    activeEffects: { ...state.activeEffects },
  };
  localStorage.setItem(PET_INVENTORY_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(PET_INVENTORY_CHANGED_EVENT));
  return normalized;
}

export function ownsProduct(state: PetInventoryState, productId: string): boolean {
  return state.owned.includes(productId);
}

export function addOwnedProduct(state: PetInventoryState, productId: string): PetInventoryState {
  if (state.owned.includes(productId)) return state;
  const product = getStoreProduct(productId);
  const next = { ...state, owned: [...state.owned, productId] };
  const resolved = product ? getStoreProduct(productId) : undefined;
  if (resolved?.effectType === "consumable" && resolved.usesOnPurchase) {
    next.consumableCharges = {
      ...next.consumableCharges,
      [productId]: (next.consumableCharges[productId] ?? 0) + resolved.usesOnPurchase,
    };
  }
  return savePetInventory(next);
}

export function removeOwnedProduct(state: PetInventoryState, productId: string): PetInventoryState {
  const product = getStoreProduct(productId);
  const nextCharges = { ...state.consumableCharges };
  delete nextCharges[productId];

  const nextActiveEffects = { ...state.activeEffects };
  if (product?.consumableId === "procrastination") {
    delete nextActiveEffects.procrastinationDay;
  }
  if (product?.consumableId === "monday_mood") {
    delete nextActiveEffects.mondayMoodUntil;
  }

  return savePetInventory({
    ...state,
    owned: state.owned.filter((id) => id !== productId),
    equippedHead: state.equippedHead === productId ? null : state.equippedHead,
    equippedBuffs: state.equippedBuffs.map((id) => (id === productId ? null : id)) as [
      string | null,
      string | null,
    ],
    equippedPersonalities: (state.equippedPersonalities ?? [null, null]).map((id) =>
      id === productId ? null : id,
    ) as [string | null, string | null],
    equippedCorner: state.equippedCorner === productId ? null : state.equippedCorner,
    consumableCharges: nextCharges,
    activeEffects: nextActiveEffects,
  });
}

export function equipHead(state: PetInventoryState, productId: string | null): PetInventoryState {
  if (productId && !state.owned.includes(productId)) return state;
  const resolved = productId ? getStoreProduct(productId) : null;
  if (productId && resolved?.category !== "head") {
    return state;
  }
  return savePetInventory({ ...state, equippedHead: productId });
}

export function equipBuff(
  state: PetInventoryState,
  slot: 0 | 1,
  productId: string | null,
): PetInventoryState {
  if (productId && !state.owned.includes(productId)) return state;
  const resolved = productId ? getStoreProduct(productId) : null;
  if (productId && resolved?.effectType !== "buff") return state;
  const buffs: [string | null, string | null] = [...state.equippedBuffs];
  buffs[slot] = productId;
  return savePetInventory({ ...state, equippedBuffs: buffs });
}

export function equipPersonality(
  state: PetInventoryState,
  slot: 0 | 1,
  productId: string | null,
): PetInventoryState {
  if (productId && !state.owned.includes(productId)) return state;
  const resolved = productId ? getStoreProduct(productId) : null;
  if (productId && resolved?.effectType !== "personality") return state;
  const personalities: [string | null, string | null] = [
    state.equippedPersonalities?.[0] ?? null,
    state.equippedPersonalities?.[1] ?? null,
  ];
  personalities[slot] = productId;
  return savePetInventory({ ...state, equippedPersonalities: personalities });
}

export function getEquippedPersonalityProducts(state: PetInventoryState) {
  return (state.equippedPersonalities ?? [])
    .map((id) => (id ? getStoreProduct(id) : undefined))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
}

export function getEquippedPersonalityIds(state: PetInventoryState): string[] {
  return getEquippedPersonalityProducts(state)
    .map((product) => product.personalityId)
    .filter((id): id is NonNullable<typeof id> => Boolean(id));
}

export function equipCorner(state: PetInventoryState, productId: string | null): PetInventoryState {
  if (productId && !state.owned.includes(productId)) return state;
  const resolved = productId ? getStoreProduct(productId) : null;
  if (productId && resolved?.effectType !== "scene") return state;
  return savePetInventory({ ...state, equippedCorner: productId });
}

export function getEquippedHeadProduct(state: PetInventoryState) {
  if (!state.equippedHead) return undefined;
  return getStoreProduct(state.equippedHead);
}

export function getEquippedCornerProduct(state: PetInventoryState) {
  if (!state.equippedCorner) return undefined;
  return getStoreProduct(state.equippedCorner);
}

export function getBuffCoinBonus(state: PetInventoryState): number {
  let bonus = 0;
  for (const id of state.equippedBuffs) {
    if (!id) continue;
    const p = id ? getStoreProduct(id) : undefined;
    if (p?.buffCoinBonus) bonus += p.buffCoinBonus;
  }
  return bonus;
}

export function isProcrastinationActive(state: PetInventoryState): boolean {
  return state.activeEffects.procrastinationDay === todayKey();
}

export function isMondayMoodActive(state: PetInventoryState): boolean {
  const until = state.activeEffects.mondayMoodUntil;
  return typeof until === "number" && until > Date.now();
}

const CORPORATE_LINES = [
  "好的收到，我们拉齐一下颗粒度。",
  "嗯嗯，先这样，有问题随时 sync。",
  "收到，我这边 push 一下进度。",
  "了解，我们做个闭环。",
  "可以，那先按这个方向推进。",
];

export type UseConsumableResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export function useConsumable(state: PetInventoryState, productId: string): {
  state: PetInventoryState;
  result: UseConsumableResult;
} {
  if (!state.owned.includes(productId)) {
    return { state, result: { ok: false, message: "你还没有这件物品。" } };
  }
  const product = getStoreProduct(productId);
  const resolved = product ? getStoreProduct(productId) : undefined;
  if (!resolved || resolved.effectType !== "consumable" || !resolved.consumableId) {
    return { state, result: { ok: false, message: "这件物品不能主动使用。" } };
  }
  const charges = state.consumableCharges[productId] ?? 0;
  if (charges <= 0) {
    return { state, result: { ok: false, message: "使用次数已用完，去小铺再买一张吧。" } };
  }

  let next: PetInventoryState = {
    ...state,
    consumableCharges: { ...state.consumableCharges, [productId]: charges - 1 },
    activeEffects: { ...state.activeEffects },
  };
  let message = "使用成功！";

  switch (resolved.consumableId) {
    case "procrastination":
      next.activeEffects.procrastinationDay = todayKey();
      message = "拖延卡已生效：今天完成任务不会增加周常计数（但宠物仍会夸你）。";
      break;
    case "monday_mood":
      next.activeEffects.mondayMoodUntil = Date.now() + 60 * 60 * 1000;
      message = "起床气已喷洒！接下来 1 小时戳宠会更暴躁。";
      break;
    case "corporate_speak": {
      const line = CORPORATE_LINES[Math.floor(Math.random() * CORPORATE_LINES.length)];
      void navigator.clipboard.writeText(line).catch(() => {});
      message = `已复制到剪贴板：「${line}」`;
      break;
    }
    default:
      return { state, result: { ok: false, message: "未知效果。" } };
  }

  next = savePetInventory(next);
  return { state: next, result: { ok: true, message } };
}

export function effectHintForProduct(productId: string): string {
  const p = getStoreProduct(productId);
  if (!p) return "";
  const resolved = resolveStoreProduct(p);
  switch (resolved.effectType) {
    case "cosmetic":
      return "装备后：悬浮宠与主界面显示装扮";
    case "personality":
      return "装备后：改变 Yarni 的聊天语气、任务建议和反馈风格";
    case "buff":
      return resolved.buffCoinBonus
        ? `装备后：完成任务额外 +${resolved.buffCoinBonus} 毛线币`
        : "装备后：被动加成（展示）";
    case "scene":
      return "摆放后：主界面安心角落氛围";
    case "consumable":
      return resolved.usesOnPurchase
        ? `购买得 ${resolved.usesOnPurchase} 次使用机会，在「我的物品」中使用`
        : "可在「我的物品」中使用";
    default:
      return "";
  }
}
