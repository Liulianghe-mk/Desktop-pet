import {
  DEFAULT_GIF_ROTATION,
  type PetGifRotationSettings,
} from "../data/petGifRotation";
import "./PetGifRotationSettings.css";

type Props = {
  settings: PetGifRotationSettings;
  gifCount: number;
  onChange: (next: PetGifRotationSettings) => void;
};

export function PetGifRotationSettings({ settings, gifCount, onChange }: Props) {
  const canRotate = gifCount > 1;

  return (
    <div className="pet-gif-rotation">
      <label className={`pet-gif-rotation-toggle${!canRotate ? " disabled" : ""}`}>
        <input
          type="checkbox"
          checked={settings.enabled && canRotate}
          disabled={!canRotate}
          onChange={(e) => onChange({ ...settings, enabled: e.target.checked })}
        />
        <span>自动轮播 GIF</span>
      </label>
      {!canRotate ? (
        <p className="pet-gif-rotation-hint">添加 2 个及以上 GIF 后可自动切换</p>
      ) : (
        <>
          <div className={`pet-gif-rotation-interval${!settings.enabled ? " disabled" : ""}`}>
            <div className="metric-row">
              <span>切换间隔</span>
              <strong>{settings.intervalSec} 秒</strong>
            </div>
            <input
              type="range"
              min={10}
              max={300}
              step={5}
              value={settings.intervalSec}
              disabled={!settings.enabled}
              onChange={(e) =>
                onChange({ ...settings, intervalSec: Number(e.target.value) })
              }
            />
          </div>
          <button
            type="button"
            className="pet-gif-rotation-reset"
            onClick={() => onChange({ ...DEFAULT_GIF_ROTATION })}
          >
            恢复默认间隔
          </button>
        </>
      )}
    </div>
  );
}
