export type TrainingIntensity = "leisurely" | "standard" | "full";

export type GrowthSkillId =
  | "music"
  | "weather"
  | "schedule"
  | "emotion"
  | "focus"
  | "dream";

export type GrowthSkillDef = {
  id: GrowthSkillId;
  name: string;
  icon: string;
  unlockLevel: number;
  earlyUnlockCost: number;
  description: string;
};

export type EvolutionStage = {
  id: string;
  label: string;
  icon: string;
  status: "done" | "current" | "locked";
  sublabel?: string;
};

export const TRAINING_LABELS: Record<TrainingIntensity, string> = {
  leisurely: "悠闲",
  standard: "标准",
  full: "全力",
};

export const TRAINING_MODE_LABEL: Record<TrainingIntensity, string> = {
  leisurely: "悠闲",
  standard: "平衡",
  full: "全力",
};

/** 每升一级所需成长值（当前等级 → 下一级） */
export const XP_PER_LEVEL = 1200;

export const GROWTH_SKILL_DEFS: GrowthSkillDef[] = [
  {
    id: "music",
    name: "音乐同步",
    icon: "🎵",
    unlockLevel: 1,
    earlyUnlockCost: 0,
    description: "悬浮宠偶尔播报正在同步的播放氛围",
  },
  {
    id: "weather",
    name: "天气播报",
    icon: "🌤️",
    unlockLevel: 1,
    earlyUnlockCost: 0,
    description: "定时在气泡里播报简要天气",
  },
  {
    id: "schedule",
    name: "日程管理",
    icon: "📅",
    unlockLevel: 2,
    earlyUnlockCost: 180,
    description: "提醒未完成任务数量",
  },
  {
    id: "emotion",
    name: "情绪感知",
    icon: "💫",
    unlockLevel: 3,
    earlyUnlockCost: 260,
    description: "戳宠时使用更丰富的 AI 情绪台词",
  },
  {
    id: "focus",
    name: "专注辅助",
    icon: "🎯",
    unlockLevel: 8,
    earlyUnlockCost: 620,
    description: "减少乱跑，弹出专注提醒",
  },
  {
    id: "dream",
    name: "梦境陪伴",
    icon: "🌙",
    unlockLevel: 10,
    earlyUnlockCost: 880,
    description: "夜间用温柔梦境台词陪伴",
  },
];

export function isSkillUnlockedAtLevel(skill: GrowthSkillDef, level: number): boolean {
  return level >= skill.unlockLevel;
}

export function getLevelFromTotalXp(totalXp: number): number {
  if (totalXp < 0) return 1;
  return Math.floor(totalXp / XP_PER_LEVEL) + 1;
}

export function getLevelProgress(totalXp: number): {
  xpInLevel: number;
  xpToNext: number;
  percent: number;
} {
  const xpInLevel = totalXp % XP_PER_LEVEL;
  const xpToNext = XP_PER_LEVEL;
  const percent = Math.round((xpInLevel / XP_PER_LEVEL) * 100);
  return { xpInLevel, xpToNext, percent };
}

export function getEvolutionStages(level: number): EvolutionStage[] {
  const stages = [
    { id: "seed", label: "种子期", icon: "🌱", minLevel: 1 },
    { id: "sprout", label: "萌芽期", icon: "🪴", minLevel: 3 },
    { id: "companion", label: "陪伴期", icon: "🐾", minLevel: 5 },
    { id: "shine", label: "闪耀期", icon: "✨", minLevel: 10 },
  ];
  let currentAssigned = false;
  return stages.map((s, index) => {
    if (level >= s.minLevel) {
      const next = stages[index + 1];
      if (next && level >= next.minLevel) {
        return { id: s.id, label: s.label, icon: s.icon, status: "done" as const };
      }
      if (!currentAssigned) {
        currentAssigned = true;
        return {
          id: s.id,
          label: s.label,
          icon: s.icon,
          status: "current" as const,
          sublabel: `Lv. ${level}`,
        };
      }
      return { id: s.id, label: s.label, icon: s.icon, status: "done" as const };
    }
    return { id: s.id, label: s.label, icon: s.icon, status: "locked" as const };
  });
}
