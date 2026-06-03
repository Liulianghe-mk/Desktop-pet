import {
  GROWTH_SKILL_DEFS,
  XP_PER_LEVEL,
  type GrowthSkillDef,
  type GrowthSkillId,
  type TrainingIntensity,
  getEvolutionStages,
  getLevelFromTotalXp,
  getLevelProgress,
  isSkillUnlockedAtLevel,
} from "./growth";

export const PET_GROWTH_STORAGE_KEY = "pet-growth-v1";
export const PET_GROWTH_CHANGED_EVENT = "pet-growth-changed";

export type PetGrowthState = {
  totalXp: number;
  training: TrainingIntensity;
  /** 未写入视为开启（仅已解锁技能有效） */
  skillEnabled: Partial<Record<GrowthSkillId, boolean>>;
  /** 花费毛线币提前解锁的技能 */
  earlyUnlocked: Partial<Record<GrowthSkillId, true>>;
};

const DEFAULT_STATE: PetGrowthState = {
  totalXp: 0,
  training: "standard",
  skillEnabled: {},
  earlyUnlocked: {},
};

export type AddXpResult = {
  state: PetGrowthState;
  gained: number;
  leveledUp: boolean;
  previousLevel: number;
  newLevel: number;
  newlyUnlocked: GrowthSkillDef[];
};

export function xpForTaskCompletion(training: TrainingIntensity): number {
  if (training === "leisurely") return 8;
  if (training === "full") return 24;
  return 15;
}

export function loadPetGrowth(): PetGrowthState {
  try {
    const raw = localStorage.getItem(PET_GROWTH_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE, skillEnabled: {}, earlyUnlocked: {} };
    const parsed = JSON.parse(raw) as Partial<PetGrowthState>;
    const training =
      parsed.training === "leisurely" || parsed.training === "full" || parsed.training === "standard"
        ? parsed.training
        : "standard";
    return {
      totalXp: typeof parsed.totalXp === "number" && parsed.totalXp >= 0 ? parsed.totalXp : 0,
      training,
      skillEnabled:
        parsed.skillEnabled && typeof parsed.skillEnabled === "object"
          ? { ...parsed.skillEnabled }
          : {},
      earlyUnlocked:
        parsed.earlyUnlocked && typeof parsed.earlyUnlocked === "object"
          ? { ...parsed.earlyUnlocked }
          : {},
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function savePetGrowth(state: PetGrowthState): PetGrowthState {
  const normalized: PetGrowthState = {
    totalXp: Math.max(0, Math.round(state.totalXp)),
    training: state.training,
    skillEnabled: { ...state.skillEnabled },
    earlyUnlocked: { ...state.earlyUnlocked },
  };
  localStorage.setItem(PET_GROWTH_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(PET_GROWTH_CHANGED_EVENT));
  return normalized;
}

export function getSkillsUnlockedAtLevel(level: number): GrowthSkillDef[] {
  return GROWTH_SKILL_DEFS.filter((s) => isSkillUnlockedAtLevel(s, level));
}

export function isSkillUnlocked(state: PetGrowthState, skillId: GrowthSkillId): boolean {
  if (state.earlyUnlocked[skillId]) return true;
  const level = getLevelFromTotalXp(state.totalXp);
  const def = GROWTH_SKILL_DEFS.find((s) => s.id === skillId);
  return def ? isSkillUnlockedAtLevel(def, level) : false;
}

/** 已解锁且开关为开（默认开） */
export function isSkillActive(state: PetGrowthState, skillId: GrowthSkillId): boolean {
  if (!isSkillUnlocked(state, skillId)) return false;
  return state.skillEnabled[skillId] !== false;
}

export function setSkillEnabled(
  state: PetGrowthState,
  skillId: GrowthSkillId,
  enabled: boolean,
): PetGrowthState {
  if (!isSkillUnlocked(state, skillId)) return state;
  return savePetGrowth({
    ...state,
    skillEnabled: { ...state.skillEnabled, [skillId]: enabled },
  });
}

export function setTrainingIntensity(
  state: PetGrowthState,
  training: TrainingIntensity,
): PetGrowthState {
  return savePetGrowth({ ...state, training });
}

export function unlockSkillEarly(
  state: PetGrowthState,
  skillId: GrowthSkillId,
): PetGrowthState {
  if (isSkillUnlocked(state, skillId)) return state;
  return savePetGrowth({
    ...state,
    earlyUnlocked: { ...state.earlyUnlocked, [skillId]: true },
  });
}

export function addPetGrowthXp(state: PetGrowthState, amount: number): AddXpResult {
  const previousLevel = getLevelFromTotalXp(state.totalXp);
  const prevUnlocked = new Set(
    getSkillsUnlockedAtLevel(previousLevel).map((s) => s.id),
  );
  const nextTotal = state.totalXp + Math.max(0, amount);
  const newLevel = getLevelFromTotalXp(nextTotal);
  const nextState = savePetGrowth({ ...state, totalXp: nextTotal });
  const newlyUnlocked = getSkillsUnlockedAtLevel(newLevel).filter(
    (s) => !prevUnlocked.has(s.id),
  );
  return {
    state: nextState,
    gained: amount,
    leveledUp: newLevel > previousLevel,
    previousLevel,
    newLevel,
    newlyUnlocked,
  };
}

export function growthSkillView(state: PetGrowthState) {
  const level = getLevelFromTotalXp(state.totalXp);
  const progress = getLevelProgress(state.totalXp);
  return {
    level,
    progress,
    xpPerLevel: XP_PER_LEVEL,
    evolutionStages: getEvolutionStages(level),
    skills: GROWTH_SKILL_DEFS.map((def) => ({
      ...def,
      unlocked: isSkillUnlocked(state, def.id),
      unlockedByCoins: Boolean(state.earlyUnlocked[def.id]),
      enabled: isSkillUnlocked(state, def.id) ? state.skillEnabled[def.id] !== false : false,
    })),
  };
}
