import { useMemo, useState } from "react";
import {
  DAILY_TASK_GOAL,
  EFFORT_LABELS,
  effortForTask,
  rewardForTask,
  type EffortLevel,
  type UserTask,
} from "../data/userTasks";
import "./TasksPage.css";

type TaskListTab = "active" | "done";
type TaskEditDraft = Pick<UserTask, "title" | "subtitle" | "effort">;

type TasksPageProps = {
  tasks: UserTask[];
  onToggleTask: (taskId: string) => void;
  onUpdateTask: (taskId: string, changes: TaskEditDraft) => void;
  onDeleteTask: (taskId: string) => void;
};

export function TasksPage({ tasks, onToggleTask, onUpdateTask, onDeleteTask }: TasksPageProps) {
  const [listTab, setListTab] = useState<TaskListTab>("active");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<TaskEditDraft>({
    title: "",
    subtitle: "",
    effort: "medium",
  });

  const completedCount = useMemo(() => tasks.filter((t) => t.completed).length, [tasks]);
  const activeCount = tasks.length - completedCount;
  const dailyPercent = Math.min(100, Math.round((completedCount / DAILY_TASK_GOAL) * 100));
  const remainingCount = Math.max(0, DAILY_TASK_GOAL - completedCount);
  const completedRewards = useMemo(
    () =>
      tasks.filter((task) => task.completed).reduce(
        (total, task) => {
          const reward = rewardForTask(task);
          return { xp: total.xp + reward.xp, coins: total.coins + reward.coins };
        },
        { xp: 0, coins: 0 },
      ),
    [tasks],
  );
  const activeRewards = useMemo(
    () =>
      tasks.filter((task) => !task.completed).reduce(
        (total, task) => {
          const reward = rewardForTask(task);
          return { xp: total.xp + reward.xp, coins: total.coins + reward.coins };
        },
        { xp: 0, coins: 0 },
      ),
    [tasks],
  );

  const visibleTasks = useMemo(() => {
    return tasks.filter((task) => (listTab === "active" ? !task.completed : task.completed));
  }, [tasks, listTab]);

  const startEditTask = (task: UserTask): void => {
    setEditingTaskId(task.id);
    setEditDraft({
      title: task.title,
      subtitle: task.subtitle,
      effort: effortForTask(task),
    });
  };

  const cancelEditTask = (): void => {
    setEditingTaskId(null);
    setEditDraft({ title: "", subtitle: "", effort: "medium" });
  };

  const saveEditTask = (taskId: string): void => {
    const title = editDraft.title.trim();
    const subtitle = editDraft.subtitle.trim();
    if (!title) return;
    onUpdateTask(taskId, {
      title,
      subtitle: subtitle || "自定义任务 · 由你创建",
      effort: editDraft.effort,
    });
    cancelEditTask();
  };

  const deleteTask = (task: UserTask): void => {
    if (editingTaskId === task.id) {
      cancelEditTask();
    }
    onDeleteTask(task.id);
  };

  return (
    <div className="tasks-page">
      <section className={`daily-chest-card${dailyPercent >= 100 ? " is-ready" : ""}`}>
        <div className="daily-chest-content">
          <div className="daily-chest-main">
            <span className="daily-kicker">今日任务</span>
            <h2>{dailyPercent >= 100 ? "宝箱已准备好" : `还差 ${remainingCount} 个任务`}</h2>
            <p>
              已完成 {completedCount}/{DAILY_TASK_GOAL} 项。今天已累计获得 {completedRewards.xp} XP
              和 {completedRewards.coins} 毛线币。
            </p>
          </div>
          <div
            className="daily-progress-orb"
            aria-label={`今日完成进度 ${dailyPercent}%`}
            style={{ ["--daily-progress" as string]: `${dailyPercent}%` }}
          >
            <strong>{dailyPercent}%</strong>
            <span>完成</span>
          </div>
        </div>

        <div className="daily-progress-track">
          <div className="daily-progress-fill" style={{ width: `${dailyPercent}%` }} />
        </div>

        <div className="daily-chest-footer">
          <span>{dailyPercent >= 100 ? "今日奖励已解锁" : `完成剩余任务可继续获得奖励`}</span>
          <strong>
            待领取潜力 +{activeRewards.xp} XP · +{activeRewards.coins} 毛线币
          </strong>
        </div>
      </section>

      <section className="task-list-section">
        <header className="task-list-header">
          <div>
            <h2>你的任务</h2>
            <p>
              {activeCount} 个进行中 · {completedCount} 个已完成
            </p>
          </div>
          <div className="task-list-tabs">
            <button
              type="button"
              className={listTab === "active" ? "active" : ""}
              onClick={() => setListTab("active")}
            >
              进行中
            </button>
            <button
              type="button"
              className={listTab === "done" ? "active" : ""}
              onClick={() => setListTab("done")}
            >
              已完成
            </button>
          </div>
        </header>

        <ul className="task-card-list">
          {visibleTasks.length > 0 ? (
            visibleTasks.map((task) => {
              const effort = effortForTask(task);
              const reward = rewardForTask(task);
              const isEditing = editingTaskId === task.id;
              return (
              <li
                key={task.id}
                className={`task-card task-card--${effort}${task.completed ? " is-completed" : ""}${
                  isEditing ? " is-editing" : ""
                }`}
              >
                {isEditing ? (
                  <div className="task-edit-form">
                    <label>
                      <span>任务标题</span>
                      <input
                        value={editDraft.title}
                        onChange={(event) =>
                          setEditDraft((draft) => ({ ...draft, title: event.currentTarget.value }))
                        }
                        maxLength={40}
                      />
                    </label>
                    <label>
                      <span>详情说明</span>
                      <textarea
                        value={editDraft.subtitle}
                        onChange={(event) =>
                          setEditDraft((draft) => ({
                            ...draft,
                            subtitle: event.currentTarget.value,
                          }))
                        }
                        rows={2}
                        maxLength={80}
                      />
                    </label>
                    <div className="task-edit-effort">
                      <span>努力程度</span>
                      <div>
                        {(Object.keys(EFFORT_LABELS) as EffortLevel[]).map((level) => (
                          <button
                            key={level}
                            type="button"
                            className={editDraft.effort === level ? "active" : ""}
                            onClick={() =>
                              setEditDraft((draft) => ({ ...draft, effort: level }))
                            }
                          >
                            {EFFORT_LABELS[level]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="task-edit-actions">
                      <button type="button" className="secondary" onClick={cancelEditTask}>
                        取消
                      </button>
                      <button
                        type="button"
                        className="primary"
                        disabled={!editDraft.title.trim()}
                        onClick={() => saveEditTask(task.id)}
                      >
                        保存
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="task-card-icon" aria-hidden>{task.icon}</div>
                    <div className="task-card-body">
                      <div className="task-card-title-row">
                        <h3>{task.title}</h3>
                        <span className={`task-effort task-effort--${effort}`}>
                          努力 {EFFORT_LABELS[effort]}
                        </span>
                      </div>
                      <p>{task.subtitle}</p>
                      <div className="task-reward-row">
                        <span>+{reward.xp} XP</span>
                        <span>+{reward.coins} 毛线币</span>
                      </div>
                    </div>
                    <div className="task-card-actions">
                      <span className="task-tag">{task.tag}</span>
                      <button
                        type="button"
                        className="task-edit-btn"
                        onClick={() => startEditTask(task)}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className="task-delete-btn"
                        onClick={() => deleteTask(task)}
                      >
                        删除
                      </button>
                      <button
                        type="button"
                        className={`task-check ${task.completed ? "checked" : ""}`}
                        aria-label={task.completed ? "标记未完成" : "标记完成"}
                        onClick={() => onToggleTask(task.id)}
                      >
                        {task.completed ? "✓" : ""}
                      </button>
                    </div>
                  </>
                )}
              </li>
              );
            })
          ) : (
            <li className="task-empty">
              {listTab === "active" ? "暂无进行中的任务，右侧快速添加一个吧。" : "还没有已完成的任务。"}
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
