import {
  DEFAULT_PET_QUICK_ACTIONS,
  PET_QUICK_ACTIONS_MAX,
  savePetQuickActions,
  type PetQuickAction,
  type PetQuickActionKind,
} from "../data/petQuickActions";
import "./PetQuickActionsSettings.css";

type PetQuickActionsSettingsProps = {
  actions: PetQuickAction[];
  onChange: (next: PetQuickAction[]) => void;
};

export function PetQuickActionsSettingsCard({
  actions,
  onChange,
}: PetQuickActionsSettingsProps) {
  const patch = (id: string, partial: Partial<PetQuickAction>): void => {
    onChange(actions.map((a) => (a.id === id ? { ...a, ...partial } : a)));
  };

  const addSlot = (): void => {
    if (actions.length >= PET_QUICK_ACTIONS_MAX) return;
    const seed = DEFAULT_PET_QUICK_ACTIONS[actions.length] ?? {
      id: `custom-${crypto.randomUUID().slice(0, 8)}`,
      label: "新快捷",
      icon: "★",
      kind: "web" as const,
      webUrl: "https://",
      exePath: "",
      builtin: null,
      enabled: true,
    };
    onChange([...actions, { ...seed, id: `custom-${crypto.randomUUID().slice(0, 8)}` }]);
  };

  const removeSlot = (id: string): void => {
    if (actions.length <= 1) return;
    onChange(actions.filter((a) => a.id !== id));
  };

  return (
    <div className="pet-quick-actions-settings">
      <h4>右键快捷按钮</h4>
      <p className="pet-quick-actions-hint">
        右击悬浮宠物时，在宠物右侧弹出圆形按钮（最多 {PET_QUICK_ACTIONS_MAX} 个）。exe
        路径留空则打开网页。
      </p>

      <ul className="pet-quick-actions-list">
        {actions.map((action) => (
          <li key={action.id} className="pet-quick-action-row">
            <label className="pet-quick-action-enable">
              <input
                type="checkbox"
                checked={action.enabled}
                onChange={(e) => patch(action.id, { enabled: e.target.checked })}
              />
              <span>启用</span>
            </label>

            <div className="pet-quick-action-fields">
              <div className="pet-quick-action-top">
                <input
                  className="pet-quick-icon-input"
                  value={action.icon}
                  maxLength={2}
                  title="图标（1～2 个字符）"
                  onChange={(e) => patch(action.id, { icon: e.target.value })}
                />
                <input
                  value={action.label}
                  placeholder="显示名称"
                  onChange={(e) => patch(action.id, { label: e.target.value })}
                />
                <select
                  value={action.kind}
                  onChange={(e) => {
                    const kind = e.target.value as PetQuickActionKind;
                    patch(action.id, {
                      kind,
                      builtin: kind === "builtin" ? action.builtin ?? "main" : null,
                    });
                  }}
                >
                  <option value="web">网页</option>
                  <option value="exe">桌面程序</option>
                  <option value="builtin">内置</option>
                </select>
              </div>

              {action.kind === "web" ? (
                <input
                  value={action.webUrl}
                  placeholder="https://..."
                  onChange={(e) => patch(action.id, { webUrl: e.target.value })}
                />
              ) : null}

              {action.kind === "exe" ? (
                <>
                  <input
                    value={action.exePath}
                    placeholder="exe 完整路径，如 C:\Program Files\...\app.exe"
                    onChange={(e) => patch(action.id, { exePath: e.target.value })}
                  />
                  <input
                    value={action.webUrl}
                    placeholder="无 exe 时打开的网页（可选）"
                    onChange={(e) => patch(action.id, { webUrl: e.target.value })}
                  />
                </>
              ) : null}

              {action.kind === "builtin" ? (
                <select
                  value={action.builtin ?? "main"}
                  onChange={(e) =>
                    patch(action.id, {
                      builtin: e.target.value as PetQuickAction["builtin"],
                    })
                  }
                >
                  <option value="main">打开主界面</option>
                  <option value="hide">隐藏悬浮宠物</option>
                </select>
              ) : null}
            </div>

            <button
              type="button"
              className="pet-quick-action-remove"
              disabled={actions.length <= 1}
              onClick={() => removeSlot(action.id)}
              title="删除此按钮"
            >
              删
            </button>
          </li>
        ))}
      </ul>

      <div className="pet-quick-actions-footer">
        <button type="button" disabled={actions.length >= PET_QUICK_ACTIONS_MAX} onClick={addSlot}>
          添加快捷钮
        </button>
        <button
          type="button"
          onClick={() => onChange(savePetQuickActions(DEFAULT_PET_QUICK_ACTIONS.map((a) => ({ ...a }))))}
        >
          恢复默认
        </button>
      </div>
    </div>
  );
}
