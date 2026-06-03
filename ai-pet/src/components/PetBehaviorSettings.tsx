import {
  DEFAULT_PET_BEHAVIOR,
  type PetBehaviorSettings,
} from "../data/petBehaviorSettings";
import "./PetBehaviorSettings.css";

type PetBehaviorSettingsProps = {
  settings: PetBehaviorSettings;
  onChange: (next: PetBehaviorSettings) => void;
};

export function PetBehaviorSettingsCard({ settings, onChange }: PetBehaviorSettingsProps) {
  const patch = (partial: Partial<PetBehaviorSettings>): void => {
    onChange({ ...settings, ...partial });
  };

  return (
    <div className="pet-behavior-settings">
      <h4>无聊时自主行动</h4>
      <p className="pet-behavior-hint">悬浮宠物长时间没被戳、没拖文件时，会自己找乐子</p>

      <label className="pet-behavior-toggle">
        <input
          type="checkbox"
          checked={settings.autonomyEnabled}
          onChange={(e) => patch({ autonomyEnabled: e.target.checked })}
        />
        <span>启用自主行动</span>
      </label>

      <label className={`pet-behavior-toggle${!settings.autonomyEnabled ? " disabled" : ""}`}>
        <input
          type="checkbox"
          checked={settings.wanderWhenBored}
          disabled={!settings.autonomyEnabled}
          onChange={(e) => patch({ wanderWhenBored: e.target.checked })}
        />
        <span>游走（在屏幕上随机挪动）</span>
      </label>

      <label className={`pet-behavior-toggle${!settings.autonomyEnabled ? " disabled" : ""}`}>
        <input
          type="checkbox"
          checked={settings.mischiefWhenBored}
          disabled={!settings.autonomyEnabled}
          onChange={(e) => patch({ mischiefWhenBored: e.target.checked })}
        />
        <span>捣乱（弹台词，含「躲」会躲角落）</span>
      </label>

      <div className={`pet-behavior-interval${!settings.autonomyEnabled ? " disabled" : ""}`}>
        <div className="metric-row">
          <span>触发间隔</span>
          <strong>{settings.boredomIntervalSec} 秒</strong>
        </div>
        <input
          type="range"
          min={20}
          max={180}
          step={5}
          value={settings.boredomIntervalSec}
          disabled={!settings.autonomyEnabled}
          onChange={(e) => patch({ boredomIntervalSec: Number(e.target.value) })}
        />
      </div>

      <button
        type="button"
        className="pet-behavior-reset"
        onClick={() => onChange({ ...DEFAULT_PET_BEHAVIOR })}
      >
        恢复默认
      </button>
    </div>
  );
}
