import { Fragment, useCallback, useEffect, useState } from "react";
import {
  TRAINING_LABELS,
  TRAINING_MODE_LABEL,
  XP_PER_LEVEL,
  type GrowthSkillId,
  type TrainingIntensity,
} from "../data/growth";
import {
  growthSkillView,
  loadPetGrowth,
  PET_GROWTH_CHANGED_EVENT,
  PET_GROWTH_STORAGE_KEY,
  setSkillEnabled,
  setTrainingIntensity,
  type PetGrowthState,
} from "../data/petGrowth";
import { PET_GIF_FALLBACK } from "../petGif";
import "./GrowthPage.css";

type GrowthPageProps = {
  yarnCoins: number;
  petGifSrc: string;
  petGifName?: string;
  onEarlyUnlockSkill: (skillId: GrowthSkillId, cost: number, name: string) => boolean;
};

export function GrowthPage({ yarnCoins, petGifSrc, petGifName, onEarlyUnlockSkill }: GrowthPageProps) {
  const [growth, setGrowth] = useState<PetGrowthState>(loadPetGrowth);
  const [heroGifSrc, setHeroGifSrc] = useState(petGifSrc);
  const [selectedSkillId, setSelectedSkillId] = useState<GrowthSkillId>("music");

  const reloadGrowth = useCallback(() => {
    setGrowth(loadPetGrowth());
  }, []);

  useEffect(() => {
    setHeroGifSrc(petGifSrc);
  }, [petGifSrc]);

  useEffect(() => {
    window.addEventListener(PET_GROWTH_CHANGED_EVENT, reloadGrowth);
    const onStorage = (event: StorageEvent): void => {
      if (event.key === PET_GROWTH_STORAGE_KEY) reloadGrowth();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(PET_GROWTH_CHANGED_EVENT, reloadGrowth);
      window.removeEventListener("storage", onStorage);
    };
  }, [reloadGrowth]);

  const view = growthSkillView(growth);
  const { level, progress, evolutionStages, skills } = view;
  const xpRemaining = XP_PER_LEVEL - progress.xpInLevel;
  const unlockedSkills = skills.filter((s) => s.unlocked);
  const enabledCount = unlockedSkills.filter((s) => s.enabled).length;
  const selectedSkill = skills.find((s) => s.id === selectedSkillId) ?? skills[0];

  const onTrainingChange = (training: TrainingIntensity): void => {
    setGrowth(setTrainingIntensity(growth, training));
  };

  const onSkillToggle = (skillId: (typeof skills)[number]["id"]): void => {
    const skill = skills.find((s) => s.id === skillId);
    if (!skill?.unlocked) return;
    setGrowth(setSkillEnabled(growth, skillId, !skill.enabled));
  };

  return (
    <div className="growth-page">
      <header className="growth-header">
        <div>
          <h1>成长中心</h1>
          <p>完成任务获得成长值，解锁技能并在成长页开关控制悬浮宠行为。</p>
        </div>
        <div className="growth-coin-badge">
          <span aria-hidden>🧶</span>
          <strong>{yarnCoins.toLocaleString()}</strong>
          <span>毛线币</span>
        </div>
      </header>

      <section className="evolution-card">
        <h2>进化历程</h2>
        <div className="evolution-timeline" role="list">
          {evolutionStages.map((stage, index) => (
            <Fragment key={stage.id}>
              <div className={`evolution-step ${stage.status}`} role="listitem">
                <div className="evolution-icon-shell">
                  <div className="evolution-icon">{stage.icon}</div>
                </div>
                <div className="evolution-step-text">
                  <span className="evolution-label">{stage.label}</span>
                  {stage.sublabel ? <span className="evolution-sublabel">{stage.sublabel}</span> : null}
                </div>
              </div>
              {index < evolutionStages.length - 1 ? (
                <div
                  className={`evolution-connector ${
                    stage.status === "done" ? "filled" : stage.status === "current" ? "filled-partial" : ""
                  }`}
                  aria-hidden
                />
              ) : null}
            </Fragment>
          ))}
        </div>
      </section>

      <div className="growth-bottom-grid">
        <section className="pet-profile-card">
          <div className="pet-profile-visual">
            <span className="level-badge">LV. {level}</span>
            <img
              className="pet-profile-gif"
              src={heroGifSrc}
              alt={petGifName || "Yarni 桌宠"}
              draggable={false}
              onError={(e) => {
                const img = e.currentTarget;
                if (img.src.includes(PET_GIF_FALLBACK)) return;
                img.src = PET_GIF_FALLBACK;
              }}
            />
            {petGifName ? <p className="pet-profile-name">{petGifName}</p> : null}
          </div>
          <div className="xp-block">
            <div className="xp-header">
              <span>成长值</span>
              <strong>
                {progress.xpInLevel} / {XP_PER_LEVEL} XP
              </strong>
            </div>
            <div className="xp-track" role="progressbar" aria-valuenow={progress.xpInLevel} aria-valuemin={0} aria-valuemax={XP_PER_LEVEL}>
              <div className="xp-fill" style={{ width: `${progress.percent}%` }} />
            </div>
            <p className="xp-hint">
              距离下一级还差 <strong>{xpRemaining}</strong> XP（{progress.percent}%）
            </p>
          </div>
          <div className="status-badges">
            <div className="status-badge">
              <span>心情</span>
              <strong>开心</strong>
            </div>
            <div className="status-badge">
              <span>羁绊</span>
              <strong>亲密</strong>
            </div>
            <div className="status-badge status-badge-wide">
              <span>训练模式</span>
              <strong>{TRAINING_MODE_LABEL[growth.training]}</strong>
            </div>
          </div>
        </section>

        <div className="growth-right-column">
          <section className="skills-card">
            <header>
              <h2>已解锁技能</h2>
              <span>
                已开启 {enabledCount}/{unlockedSkills.length} · 共 {skills.length} 项
              </span>
            </header>
            <p className="skills-hint">点击已解锁技能可开关；锁定技能可用毛线币提前解锁。</p>
            <div className="skills-grid">
              {skills.map((skill) => (
                <div
                  key={skill.id}
                  className={`skill-slot ${skill.unlocked ? "unlocked" : "locked"} ${
                    skill.unlocked && skill.enabled ? "enabled" : skill.unlocked ? "disabled" : ""
                  }${selectedSkill.id === skill.id ? " active" : ""}`}
                  title={
                    skill.unlocked
                      ? `${skill.description}${skill.enabled ? "（已开启）" : "（已关闭）"}`
                      : `Lv.${skill.unlockLevel} 解锁 · ${skill.description}`
                  }
                >
                  {skill.unlocked ? (
                    <button
                      type="button"
                      className="skill-main-btn"
                      aria-pressed={skill.enabled}
                      onClick={() => setSelectedSkillId(skill.id)}
                    >
                      <span className="skill-icon">{skill.icon}</span>
                      <span className="skill-name">{skill.name}</span>
                      <span className="skill-toggle-hint">
                        {skill.unlockedByCoins ? "提前解锁" : skill.enabled ? "已开启" : "已关闭"}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="skill-main-btn"
                      onClick={() => setSelectedSkillId(skill.id)}
                    >
                      <span className="skill-lock">🔒</span>
                      <span className="skill-name">Lv.{skill.unlockLevel}</span>
                      <span className="skill-toggle-hint">{skill.name}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
            {selectedSkill ? (
              <section className="skill-settings-panel" aria-live="polite">
                <header className="skill-settings-header">
                  <h3>
                    {selectedSkill.icon} {selectedSkill.name} 设置
                  </h3>
                  <span>{selectedSkill.unlocked ? "已解锁" : `Lv.${selectedSkill.unlockLevel} 解锁`}</span>
                </header>
                <p className="skill-settings-desc">{selectedSkill.description}</p>
                <div className="skill-settings-row">
                  {selectedSkill.unlocked ? (
                    <button
                      type="button"
                      className={`skill-setting-toggle ${selectedSkill.enabled ? "on" : "off"}`}
                      onClick={() => onSkillToggle(selectedSkill.id)}
                    >
                      {selectedSkill.enabled ? "已开启（点击关闭）" : "已关闭（点击开启）"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="skill-unlock-btn"
                      disabled={yarnCoins < selectedSkill.earlyUnlockCost}
                      onClick={() =>
                        onEarlyUnlockSkill(
                          selectedSkill.id,
                          selectedSkill.earlyUnlockCost,
                          selectedSkill.name,
                        )
                      }
                    >
                      {yarnCoins < selectedSkill.earlyUnlockCost
                        ? `毛线币不足，还差 ${selectedSkill.earlyUnlockCost - yarnCoins}`
                        : `花费 ${selectedSkill.earlyUnlockCost} 毛线币提前解锁`}
                    </button>
                  )}
                </div>
              </section>
            ) : null}
          </section>

          <section className="training-card">
            <header>
              <h2>训练强度</h2>
              <span className="training-mode-tag">{TRAINING_MODE_LABEL[growth.training]}</span>
            </header>
            <p className="training-desc">
              提高训练强度可获得更多成长值，但会消耗更多体力。当前模式每次完成任务 +
              {growth.training === "leisurely" ? 8 : growth.training === "standard" ? 15 : 24} XP。
            </p>
            <div className="training-slider">
              <input
                type="range"
                min={0}
                max={2}
                step={1}
                value={growth.training === "leisurely" ? 0 : growth.training === "standard" ? 1 : 2}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  onTrainingChange(v === 0 ? "leisurely" : v === 1 ? "standard" : "full");
                }}
              />
              <div className="training-labels">
                {(Object.keys(TRAINING_LABELS) as TrainingIntensity[]).map((key) => (
                  <span key={key} className={growth.training === key ? "active" : ""}>
                    {TRAINING_LABELS[key]}
                  </span>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}