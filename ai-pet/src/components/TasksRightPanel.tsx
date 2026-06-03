import { FormEvent, useMemo, useState } from "react";
import { suggestTasks, type SuggestedTask } from "../api/taskSuggestions";
import {
  DAILY_TASK_GOAL,
  EFFORT_LABELS,
  WEEKLY_TASK_GOAL,
  type EffortLevel,
  type UserTask,
} from "../data/userTasks";
import "./TasksPage.css";

type TasksRightPanelProps = {
  tasks: UserTask[];
  weeklyCompleted: number;
  petGifSrc: string;
  personalityIds: string[];
  onCreateTask: (title: string, effort: EffortLevel, subtitle?: string) => void;
};

const TASK_TEMPLATES: Array<{ title: string; effort: EffortLevel; label: string }> = [
  { title: "专注 25 分钟", effort: "medium", label: "专注" },
  { title: "起来活动 5 分钟", effort: "low", label: "健康" },
  { title: "完成一个最难的小步骤", effort: "high", label: "挑战" },
];

export function TasksRightPanel({
  tasks,
  weeklyCompleted,
  petGifSrc,
  personalityIds,
  onCreateTask,
}: TasksRightPanelProps) {
  const [title, setTitle] = useState("");
  const [effort, setEffort] = useState<EffortLevel>("medium");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiReply, setAiReply] = useState("");
  const [aiProvider, setAiProvider] = useState<"deepseek" | "local" | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<SuggestedTask[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const completedCount = useMemo(() => tasks.filter((task) => task.completed).length, [tasks]);
  const activeCount = tasks.length - completedCount;
  const dailyPercent = Math.min(100, Math.round((completedCount / DAILY_TASK_GOAL) * 100));
  const mood = dailyPercent >= 100 ? "闪闪发光" : dailyPercent >= 50 ? "很有干劲" : "陪你开工";
  const moodLine =
    dailyPercent >= 100
      ? "今天的宝箱已经亮起来啦，剩下的任务可以慢慢收尾。"
      : activeCount > 0
        ? `还有 ${activeCount} 个任务在等你，先挑一个最小的开始吧。`
        : "任务清空啦，可以给自己安排一个轻松的小目标。";

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const normalized = title.trim();
    if (!normalized) return;
    onCreateTask(normalized, effort);
    setTitle("");
  };

  const requestAiSuggestions = async (): Promise<void> => {
    const normalized = aiPrompt.trim();
    if (!normalized || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await suggestTasks(normalized, tasks, personalityIds);
      setAiReply(result.reply);
      setAiProvider(result.provider);
      setAiSuggestions(result.tasks);
      if (result.tasks.length === 0) {
        setAiError("Yarni 暂时没拆出可用任务，换个说法试试。");
      }
    } catch {
      setAiError("任务建议失败，请确认本地 Agent 已启动。");
      setAiReply("");
      setAiProvider(null);
      setAiSuggestions([]);
    } finally {
      setAiLoading(false);
    }
  };

  const addSuggestedTask = (task: SuggestedTask): void => {
    onCreateTask(task.title, task.effort, task.subtitle);
    setAiSuggestions((prev) => prev.filter((item) => item !== task));
  };

  const addAllSuggestedTasks = (): void => {
    aiSuggestions.forEach((task) => onCreateTask(task.title, task.effort, task.subtitle));
    setAiSuggestions([]);
  };

  return (
    <>
      <section className="tasks-mood-card">
        <div className="tasks-pet-visual">
          <img src={petGifSrc} alt="Yarni" draggable={false} />
          <strong>{dailyPercent}%</strong>
        </div>
        <h3>Yarni 的心情</h3>
        <div className="mood-tags">
          <span>{mood}</span>
          <span>{completedCount}/{DAILY_TASK_GOAL}</span>
        </div>
        <blockquote>
          “{moodLine}”
        </blockquote>
      </section>

      <section className="tasks-quick-add-card">
        <h3>快速添加</h3>
        <form onSubmit={onSubmit}>
          <label className="quick-input-wrap">
            <span aria-hidden>✏️</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
              placeholder="我想要..."
            />
          </label>

          <div className="effort-block">
            <span className="effort-label">努力程度</span>
            <div className="effort-slider-row">
              {(Object.keys(EFFORT_LABELS) as EffortLevel[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  className={effort === level ? "active" : ""}
                  onClick={() => setEffort(level)}
                >
                  {EFFORT_LABELS[level]}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="create-task-btn">
            <span aria-hidden>＋</span> 创建任务
          </button>
        </form>
      </section>

      <section className="tasks-ai-card">
        <div className="tasks-ai-head">
          <h3>AI 拆成任务</h3>
          {aiProvider ? (
            <span>{aiProvider === "deepseek" ? "DeepSeek" : "本地兜底"}</span>
          ) : null}
        </div>
        <label className="tasks-ai-input">
          <textarea
            value={aiPrompt}
            onChange={(event) => setAiPrompt(event.currentTarget.value)}
            placeholder="例如：今天要准备汇报、整理桌面、看完论文"
            rows={3}
            disabled={aiLoading}
          />
        </label>
        <button
          type="button"
          className="tasks-ai-submit"
          disabled={aiLoading || !aiPrompt.trim()}
          onClick={() => void requestAiSuggestions()}
        >
          {aiLoading ? "Yarni 思考中…" : "让 Yarni 拆一下"}
        </button>

        {aiError ? <p className="tasks-ai-error">{aiError}</p> : null}
        {aiReply ? <p className="tasks-ai-reply">{aiReply}</p> : null}

        {aiSuggestions.length > 0 ? (
          <div className="tasks-ai-suggestions">
            <div className="tasks-ai-suggestions-head">
              <span>建议任务</span>
              <button type="button" onClick={addAllSuggestedTasks}>
                全部添加
              </button>
            </div>
            {aiSuggestions.map((task, index) => (
              <div className="tasks-ai-suggestion" key={`${task.title}-${index}`}>
                <div>
                  <strong>{task.title}</strong>
                  <p>{task.subtitle}</p>
                  <span>
                    努力 {EFFORT_LABELS[task.effort]}
                    {task.reason ? ` · ${task.reason}` : ""}
                  </span>
                </div>
                <button type="button" onClick={() => addSuggestedTask(task)}>
                  添加
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="task-template-card">
        <h3>推荐小任务</h3>
        <div className="task-template-list">
          {TASK_TEMPLATES.map((template) => (
            <button
              key={template.title}
              type="button"
              onClick={() => onCreateTask(template.title, template.effort)}
            >
              <span>{template.label}</span>
              <strong>{template.title}</strong>
              <em>努力 {EFFORT_LABELS[template.effort]}</em>
            </button>
          ))}
        </div>
      </section>

      <section className="weekly-goal-card">
        <h3>每周目标</h3>
        <p>完成 {WEEKLY_TASK_GOAL} 个任务以获得金色毛线套装。</p>
        <div className="weekly-progress">
          <span>
            {weeklyCompleted} / {WEEKLY_TASK_GOAL}
          </span>
          <span className="weekly-icons" aria-hidden>
            🔥 ✨
          </span>
        </div>
      </section>
    </>
  );
}
