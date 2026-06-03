import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { StorePage } from "./components/StorePage";
import { InventoryPage } from "./components/InventoryPage";
import { GrowthPage } from "./components/GrowthPage";
import { ChatPage } from "./components/ChatPage";
import { TasksPage } from "./components/TasksPage";
import { TasksRightPanel } from "./components/TasksRightPanel";
import { getStoreProduct, STORE_CATEGORIES, type StoreCategory } from "./data/storeProducts";
import {
  EFFORT_LABELS,
  WEEKLY_TASK_GOAL,
  loadUserTasks,
  rewardForTask,
  saveUserTasks,
  type EffortLevel,
  type UserTask,
} from "./data/userTasks";
import "./App.css";
import "./components/StorePage.css";
import "./components/TasksPage.css";
import "./components/GrowthPage.css";
import "./components/InventoryPage.css";
import "./components/ChatPage.css";
import {
  loadCurrentPetGif,
  loadPetGifNameMap,
  loadPetGifList,
  normalizeGifPath,
  PET_GIF_FALLBACK,
  saveCurrentPetGif,
  savePetGifNameMap,
  savePetGifList,
} from "./petGif";
import {
  loadPetScale,
  PET_SIZE_MAX,
  PET_SIZE_MIN,
  savePetScale,
} from "./petSize";
import {
  loadPetBehaviorSettings,
  savePetBehaviorSettings,
  type PetBehaviorSettings,
} from "./data/petBehaviorSettings";
import { PetBehaviorSettingsCard } from "./components/PetBehaviorSettings";
import { PetQuickActionsSettingsCard } from "./components/PetQuickActionsSettings";
import { PetGifRotationSettings as PetGifRotationCard } from "./components/PetGifRotationSettings";
import {
  loadPetQuickActions,
  savePetQuickActions,
  type PetQuickAction,
} from "./data/petQuickActions";
import {
  loadPetGifRotationSettings,
  savePetGifRotationSettings,
  type PetGifRotationSettings,
} from "./data/petGifRotation";

import { getHomePetStatus, type PetMood } from "./petHomeStatus";
import {
  addOwnedProduct,
  getBuffCoinBonus,
  getEquippedCornerProduct,
  getEquippedHeadProduct,
  getEquippedPersonalityIds,
  isProcrastinationActive,
  loadPetInventory,
  ownsProduct,
  PET_INVENTORY_CHANGED_EVENT,
  PET_INVENTORY_STORAGE_KEY,
  effectHintForProduct,
  type PetInventoryState,
} from "./data/petInventory";
import {
  addPetGrowthXp,
  isSkillUnlocked,
  loadPetGrowth,
  unlockSkillEarly,
} from "./data/petGrowth";
import type { GrowthSkillId } from "./data/growth";

type TaskRecord = {
  id: string;
  command: string;
  mood: PetMood;
  message: string;
  timestamp: string;
  risk?: string;
};

type HomeMode = "encourage" | "supervise" | "slack" | "plan" | "focus" | "quiet";

const HOME_MODE_CARDS: Array<{
  id: HomeMode;
  label: string;
  icon: string;
  description: string;
}> = [
  { id: "encourage", label: "鼓励我", icon: "🌷", description: "给一点温柔能量" },
  { id: "supervise", label: "监督我", icon: "🗯", description: "挑一个小任务开始" },
  { id: "slack", label: "陪我摸鱼", icon: "🍵", description: "休息一下但不失控" },
  { id: "plan", label: "帮我规划", icon: "📋", description: "把想法拆成任务" },
  { id: "focus", label: "进入专注", icon: "⏱", description: "25 分钟安静陪伴" },
  { id: "quiet", label: "安静陪伴", icon: "🕯", description: "我在，但不打扰" },
];

const COMPANION_LINES: Record<string, string[]> = {
  gentle_companion: [
    "慢慢来，主人。今天不用一下子变好，先照顾好这一分钟。",
    "你已经撑了很久啦，先喝口水，再做一个很小的动作就好。",
    "我在这里陪你，不催你。能往前一点点，就已经很棒。",
  ],
  sharp_supervisor: [
    "别和任务深情对视了，先动五分钟，动完再继续焦虑。",
    "你的计划很宏伟，但鼠标还没开始动。来，先做最小一步。",
    "摸鱼可以，别把鱼养成鲸鱼。现在回去捞一个小任务。",
  ],
  efficiency_coach: [
    "行动提示：选一个任务，设 10 分钟计时，只做开头。",
    "下一步：关掉一个干扰源，把任务拆到能立刻开始。",
    "现在只需要完成三件事：确定目标、做第一步、记录结果。",
  ],
  zen_slacker: [
    "能做一点是一点，今天先保住最低进度。",
    "别急着和世界比赛，先把手边这一步做轻一点。",
    "休息不是失败，休息完回来做一个小动作就行。",
  ],
  corporate_poet: [
    "我们先拉齐一下颗粒度：今天的目标不是完美，是形成一个小闭环。",
    "当前建议：先把最小可交付推进一下，后续再同步优化。",
    "收到，先不扩大范围，聚焦一个动作完成闭环。",
  ],
  calm_butler: [
    "已了解。请先保持节奏，选择一个明确且可完成的小目标。",
    "建议先处理最不费力的一项，让系统恢复运转。",
    "请放心，我在。现在适合稳定推进，而不是临时加码。",
  ],
  cat_cute: [
    "喵～主人已经很努力啦，先摸摸毛线球，再做一点点。",
    "喵呜，不许说自己没用！你只是需要充一下电。",
    "主人，先做五分钟嘛，做完我在这里等你喵。",
  ],
  default: [
    "今天也不用一口气完成所有事，先完成一个小小的开始。",
    "你已经回到这里了，这就是重新开始的证据。",
    "先把任务变小，再把自己放轻一点。",
  ],
};

function App() {
  const apiBase = "http://127.0.0.1:8765";
  const [currentMood, setCurrentMood] = useState<PetMood>("idle");
  const [petMessage, setPetMessage] = useState("主人你好，我可以帮你做电脑任务。");
  const [records, setRecords] = useState<TaskRecord[]>([]);
  const [agentOnline, setAgentOnline] = useState(false);
  const [voiceEnabled] = useState(false);
  const [activeNav, setActiveNav] = useState("首页");
  const [homeView, setHomeView] = useState<"main" | "chat">("main");
  const [homeMode, setHomeMode] = useState<HomeMode | null>(null);
  const [yarnCoins, setYarnCoins] = useState(1240);
  const [storeCategory, setStoreCategory] = useState<StoreCategory>("all");
  const [petInventory, setPetInventory] = useState<PetInventoryState>(loadPetInventory);
  const [storeView, setStoreView] = useState<"shop" | "inventory">("shop");

  const navItems = ["首页", "商店", "成长", "任务"] as const;
  const isStore = activeNav === "商店";
  const isTasks = activeNav === "任务";
  const isGrowth = activeNav === "成长";
  const isHome = activeNav === "首页";
  const isHomeChat = isHome && homeView === "chat";
  const [userTasks, setUserTasks] = useState<UserTask[]>(loadUserTasks);
  const [weeklyTaskCount, setWeeklyTaskCount] = useState(28);
  const [petFloatScale, setPetFloatScale] = useState(loadPetScale);
  const [petFloatVisible, setPetFloatVisible] = useState(true);
  const [petGifInput, setPetGifInput] = useState("");
  const [petGifNameInput, setPetGifNameInput] = useState("");
  const [petGifCurrentNameInput, setPetGifCurrentNameInput] = useState("");
  const [petGifCurrent, setPetGifCurrent] = useState(loadCurrentPetGif);
  const [petGifList, setPetGifList] = useState<string[]>(loadPetGifList);
  const [petGifNameMap, setPetGifNameMap] = useState<Record<string, string>>(loadPetGifNameMap);
  const [petBehavior, setPetBehavior] = useState<PetBehaviorSettings>(loadPetBehaviorSettings);
  const [petQuickActions, setPetQuickActions] = useState<PetQuickAction[]>(loadPetQuickActions);
  const [petGifRotation, setPetGifRotation] = useState<PetGifRotationSettings>(
    loadPetGifRotationSettings,
  );
  const [idlePhraseIndex, setIdlePhraseIndex] = useState(0);

  const homePetStatus = useMemo(
    () => getHomePetStatus(currentMood, agentOnline, idlePhraseIndex),
    [currentMood, agentOnline, idlePhraseIndex],
  );

  const equippedHead = useMemo(
    () => getEquippedHeadProduct(petInventory),
    [petInventory],
  );
  const equippedCorner = useMemo(
    () => getEquippedCornerProduct(petInventory),
    [petInventory],
  );
  const buffCoinBonus = useMemo(() => getBuffCoinBonus(petInventory), [petInventory]);
  const personalityIds = useMemo(() => getEquippedPersonalityIds(petInventory), [petInventory]);

  useEffect(() => {
    const reload = (): void => setPetInventory(loadPetInventory());
    window.addEventListener(PET_INVENTORY_CHANGED_EVENT, reload);
    const onStorage = (event: StorageEvent): void => {
      if (event.key === PET_INVENTORY_STORAGE_KEY) reload();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(PET_INVENTORY_CHANGED_EVENT, reload);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const completedCount = useMemo(
    () => records.filter((item) => item.mood === "done").length,
    [records],
  );

  const appendRecord = (record: TaskRecord): void => {
    setRecords((prev) => [record, ...prev].slice(0, 8));
  };

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`${apiBase}/status`);
        setAgentOnline(response.ok);
      } catch {
        setAgentOnline(false);
      }
    }, 2000);

    const unlistenPromise = listen("emergency-stop", async () => {
      await emergencyStop();
    });
    return () => {
      clearInterval(timer);
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    if (activeNav !== "首页") {
      setHomeView("main");
    }
  }, [activeNav]);

  useEffect(() => {
    if (currentMood !== "idle") return;
    const timer = window.setInterval(() => {
      setIdlePhraseIndex((prev) => prev + 1);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [currentMood]);

  useEffect(() => {
    const saved = loadPetScale();
    setPetFloatScale(saved);
    void invoke("set_pet_size", { scale: saved }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const current = loadCurrentPetGif();
    const list = savePetGifList(loadPetGifList());
    const nameMap = savePetGifNameMap(loadPetGifNameMap());
    setPetGifCurrent(current);
    setPetGifList(list);
    setPetGifNameMap(nameMap);
    setPetGifCurrentNameInput(nameMap[current] ?? "");
    void invoke("set_pet_gif", { gifPath: current }).catch(() => undefined);

    const unlistenGifPromise = listen<string>("pet-gif-changed", (event) => {
      const next = saveCurrentPetGif(event.payload);
      setPetGifCurrent(next);
    });
    return () => {
      void unlistenGifPromise.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    setPetGifCurrentNameInput(petGifNameMap[petGifCurrent] ?? "");
  }, [petGifCurrent, petGifNameMap]);

  const applyPetFloatScale = async (value: number): Promise<void> => {
    const next = savePetScale(value);
    setPetFloatScale(next);
    try {
      await invoke("set_pet_size", { scale: next });
    } catch {
      /* browser preview fallback */
    }
  };

  const toggleFloatPet = async (): Promise<void> => {
    try {
      const visible = await invoke<boolean>("toggle_float_pet");
      setPetFloatVisible(visible);
    } catch {
      setPetFloatVisible((prev) => !prev);
    }
  };

  const applyPetGif = async (path: string): Promise<void> => {
    const normalized = normalizeGifPath(path);
    if (!normalized) return;
    const nextCurrent = saveCurrentPetGif(normalized);
    setPetGifCurrent(nextCurrent);
    setPetGifList((prev) => savePetGifList([nextCurrent, ...prev]));
    try {
      await invoke("set_pet_gif", { gifPath: nextCurrent });
    } catch {
      /* browser preview fallback */
    }
  };

  const addPetGif = async (): Promise<void> => {
    if (!petGifInput.trim()) return;
    const normalized = normalizeGifPath(petGifInput);
    const customName = petGifNameInput.trim();
    await applyPetGif(petGifInput);
    if (normalized && customName) {
      setPetGifNameMap((prev) => savePetGifNameMap({ ...prev, [normalized]: customName }));
    }
    setPetGifInput("");
    setPetGifNameInput("");
  };

  const removePetGif = (path: string): void => {
    const nextList = savePetGifList(petGifList.filter((item) => item !== path));
    setPetGifList(nextList);
    setPetGifNameMap((prev) => {
      const { [path]: _, ...rest } = prev;
      return savePetGifNameMap(rest);
    });
    if (path === petGifCurrent) {
      const fallback = nextList[0];
      setPetGifCurrent(saveCurrentPetGif(fallback));
      void invoke("set_pet_gif", { gifPath: fallback }).catch(() => undefined);
    }
  };

  const saveCurrentPetGifName = (): void => {
    const name = petGifCurrentNameInput.trim();
    setPetGifNameMap((prev) => {
      const next = { ...prev };
      if (name) {
        next[petGifCurrent] = name;
      } else {
        delete next[petGifCurrent];
      }
      return savePetGifNameMap(next);
    });
  };

  const speak = (text: string): void => {
    if (!voiceEnabled || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const drawCompanionLine = (): void => {
    const activePersonality = personalityIds.find((id) => COMPANION_LINES[id]);
    const pool = COMPANION_LINES[activePersonality ?? "default"] ?? COMPANION_LINES.default;
    const line = pool[Math.floor(Math.random() * pool.length)];
    setHomeMode("encourage");
    setCurrentMood("idle");
    setPetMessage(line);
  };

  const requestPlan = async (command: string): Promise<{
    task_id: string;
    risk_level: string;
    requires_confirmation: boolean;
    reason: string;
  }> => {
    const response = await fetch(`${apiBase}/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command }),
    });
    if (!response.ok) {
      throw new Error("计划请求失败");
    }
    return response.json();
  };

  const executeTask = async (taskId: string, approved: boolean): Promise<string> => {
    const response = await fetch(`${apiBase}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: taskId, approved }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "执行失败");
    }
    const data = await response.json();
    return data.result as string;
  };

  const runCommand = async (command: string): Promise<void> => {
    const now = () => new Date().toLocaleTimeString();
    const localId = crypto.randomUUID();
    setCurrentMood("thinking");
    setPetMessage("正在规划步骤...");
    speak("正在规划步骤");
    appendRecord({
      id: `${localId}-thinking`,
      command,
      mood: "thinking",
      message: "任务规划中",
      timestamp: now(),
    });

    const plan = await requestPlan(command);
    let approved = true;
    if (plan.requires_confirmation) {
      approved = window.confirm(
        `该任务为 ${plan.risk_level.toUpperCase()} 风险。\n原因：${plan.reason}\n确认继续执行吗？`,
      );
    }
    if (!approved) {
      setCurrentMood("idle");
      setPetMessage("任务已取消。");
      appendRecord({
        id: `${localId}-cancel`,
        command,
        mood: "error",
        message: "用户取消执行",
        timestamp: now(),
        risk: plan.risk_level,
      });
      return;
    }

    setCurrentMood("executing");
    setPetMessage("开始执行任务，请稍候。");
    speak("开始执行任务");
    appendRecord({
      id: `${localId}-executing`,
      command,
      mood: "executing",
      message: "执行中",
      timestamp: now(),
      risk: plan.risk_level,
    });

    const result = await executeTask(plan.task_id, approved);
    setCurrentMood("done");
    setPetMessage(result);
    speak("任务已完成");
    appendRecord({
      id: `${localId}-done`,
      command,
      mood: "done",
      message: result,
      timestamp: now(),
      risk: plan.risk_level,
    });
  };

  const emergencyStop = async (): Promise<void> => {
    await fetch(`${apiBase}/stop`, { method: "POST" });
    setCurrentMood("error");
    setPetMessage("已触发紧急停止。");
    appendRecord({
      id: crypto.randomUUID(),
      command: "-",
      mood: "error",
      message: "紧急停止触发",
      timestamp: new Date().toLocaleTimeString(),
    });
    speak("已停止当前任务");
  };

  const claimCoins = (): void => {
    setYarnCoins((prev) => prev + 50);
    setPetMessage("领取成功！获得 50 毛线币。");
  };

  const toggleUserTask = (taskId: string): void => {
    setUserTasks((prev) => {
      const next = prev.map((task) => {
        if (task.id !== taskId) return task;
        const nextCompleted = !task.completed;
        if (nextCompleted) {
          if (!isProcrastinationActive(petInventory)) {
            setWeeklyTaskCount((w) => Math.min(WEEKLY_TASK_GOAL, w + 1));
          }
          const reward = rewardForTask(task);
          const coinGain = reward.coins + buffCoinBonus;
          if (coinGain > 0) {
            setYarnCoins((c) => c + coinGain);
          }
          const growth = loadPetGrowth();
          const xpGain = reward.xp;
          const xpResult = addPetGrowthXp(growth, xpGain);
          if (xpResult.leveledUp) {
            const unlockNames = xpResult.newlyUnlocked.map((s) => s.name).join("、");
            if (unlockNames) {
              setPetMessage(
                `升级啦！Lv.${xpResult.newLevel}，解锁：${unlockNames}（+${xpGain} XP）。去「成长」开关技能。`,
              );
            } else {
              setPetMessage(`升级啦！Lv.${xpResult.newLevel}（+${xpGain} XP）`);
            }
          } else if (buffCoinBonus > 0) {
            setPetMessage(
              `太棒了！已完成「${task.title}」，+${xpGain} XP、+${reward.coins} 毛线币。Buff 额外 +${buffCoinBonus} 毛线币！`,
            );
          } else {
            setPetMessage(`太棒了！已完成「${task.title}」，+${xpGain} XP、+${reward.coins} 毛线币。`);
          }
        } else {
          setWeeklyTaskCount((w) => Math.max(0, w - 1));
        }
        return { ...task, completed: nextCompleted };
      });
      saveUserTasks(next);
      return next;
    });
  };

  const createUserTask = (title: string, effort: EffortLevel, subtitle?: string): void => {
    const tag = `努力 ${EFFORT_LABELS[effort]}`;
    const newTask: UserTask = {
      id: crypto.randomUUID(),
      title,
      subtitle: subtitle?.trim() || "自定义任务 · 由你创建",
      icon: "✨",
      tag,
      effort,
      completed: false,
    };
    setUserTasks((prev) => {
      const next = [newTask, ...prev];
      saveUserTasks(next);
      return next;
    });
    setPetMessage(`已创建任务「${title}」。`);
  };

  const updateUserTask = (
    taskId: string,
    changes: Pick<UserTask, "title" | "subtitle" | "effort">,
  ): void => {
    setUserTasks((prev) => {
      const next = prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              title: changes.title,
              subtitle: changes.subtitle,
              effort: changes.effort,
              tag: `努力 ${EFFORT_LABELS[changes.effort ?? "medium"]}`,
            }
          : task,
      );
      saveUserTasks(next);
      return next;
    });
    setPetMessage(`已更新任务「${changes.title}」。`);
  };

  const deleteUserTask = (taskId: string): void => {
    setUserTasks((prev) => {
      const task = prev.find((item) => item.id === taskId);
      const next = prev.filter((item) => item.id !== taskId);
      saveUserTasks(next);
      if (task) {
        setPetMessage(`已删除任务「${task.title}」。`);
      }
      return next;
    });
  };

  const handleBuy = (productId: string, price: number, name: string): boolean => {
    const product = getStoreProduct(productId);
    if (ownsProduct(petInventory, productId)) {
      setPetMessage(`你已经拥有「${name}」啦，去「我的物品」看看。`);
      return false;
    }
    if (yarnCoins < price) {
      if (product?.category === "personality") {
        setPetMessage("毛线币不够…先完成任务攒币，再来给 Yarni 装新人格吧。");
      } else if (product?.category === "curiosity" && price >= 500) {
        setPetMessage("毛线币不够…奇物太贵，先去完成任务攒点钱吧。");
      } else {
        setPetMessage("毛线币不够哦，完成任务或领取金币后再来看看。");
      }
      return false;
    }
    setYarnCoins((prev) => prev - price);
    const nextInv = addOwnedProduct(petInventory, productId);
    setPetInventory(nextInv);
    const hint = effectHintForProduct(productId);
    if (product?.purchaseLine) {
      setPetMessage(`${product.purchaseLine} ${hint ? `（${hint}）` : ""} 已放入背包。`);
    } else {
      setPetMessage(`购买成功！「${name}」已放入背包。${hint ? hint : ""}`);
    }
    return true;
  };

  const handleEarlyUnlockSkill = (skillId: GrowthSkillId, cost: number, name: string): boolean => {
    const growth = loadPetGrowth();
    if (isSkillUnlocked(growth, skillId)) {
      setPetMessage(`「${name}」已经解锁了。`);
      return false;
    }
    if (yarnCoins < cost) {
      setPetMessage(`毛线币不够，解锁「${name}」还差 ${cost - yarnCoins}。`);
      return false;
    }
    unlockSkillEarly(growth, skillId);
    setYarnCoins((prev) => prev - cost);
    setPetMessage(`已花费 ${cost} 毛线币，提前解锁「${name}」！`);
    return true;
  };

  const hasPersonality = (id: string): boolean => personalityIds.includes(id);

  const handleHomeMode = (mode: HomeMode): void => {
    setHomeMode(mode);
    setCurrentMood("idle");
    setActiveNav("首页");
    setHomeView("main");

    switch (mode) {
      case "encourage":
        setPetMessage(
          hasPersonality("cat_cute")
            ? "喵～主人已经很努力啦，先深呼吸一下，我陪你慢慢来。"
            : hasPersonality("calm_butler")
              ? "我在。请先稳定节奏，我们只处理下一件事。"
              : "你不是没进展，只是有点累。先从一个很小的动作开始就好。",
        );
        break;
      case "supervise":
        setPetMessage(
          hasPersonality("sharp_supervisor")
            ? "别和任务深情对视了，去任务页挑一个最小的，五分钟也算开工。"
            : "我来监督你：先选一个最小任务，完成它就够。",
        );
        setActiveNav("任务");
        break;
      case "slack":
        setPetMessage(
          hasPersonality("zen_slacker")
            ? "摸鱼也要有边界。休息 5 分钟，回来做最低可行动作。"
            : "可以休息一下。我会 5 分钟后提醒你回来。",
        );
        void runCommand("5分钟后提醒我回来继续任务").catch(() => undefined);
        break;
      case "plan":
        setPetMessage(
          hasPersonality("efficiency_coach")
            ? "进入规划模式：目标、步骤、开始。去任务页把想法拆开。"
            : "把脑子里的事倒出来，我帮你拆成可以完成的小任务。",
        );
        setActiveNav("任务");
        break;
      case "focus":
        setPetMessage("专注陪伴开始。25 分钟内我尽量不打扰你，结束后提醒休息。");
        void runCommand("25分钟后提醒我休息").catch(() => undefined);
        break;
      case "quiet":
        setPetMessage(
          hasPersonality("gentle_companion")
            ? "我在这里，安静陪着你。你不用立刻变好。"
            : "安静陪伴模式开启。我在，不打扰你。",
        );
        break;
      default:
        break;
    }
  };

  return (
    <main
      className={`desktop-shell${isStore ? " store-mode" : ""}${isGrowth ? " growth-mode" : ""}${isHomeChat ? " chat-mode" : ""}`}
    >
      <aside className="left-sidebar">
        <div className="brand">
          <span className="brand-icon">Y</span>
          <div>
            <strong>Yarni AI</strong>
            <p>Your Desktop Companion</p>
          </div>
        </div>
        <nav className="side-nav">
          {navItems.map((item) => (
            <button
              key={item}
              type="button"
              className={activeNav === item ? "active" : ""}
              onClick={() => {
                setActiveNav(item);
                if (item === "首页") setHomeView("main");
              }}
            >
              {item}
            </button>
          ))}
        </nav>
        {isStore ? (
          <>
            <nav className="category-nav" aria-label="商店导航">
              <h4>商店</h4>
              <button
                type="button"
                className={storeView === "shop" ? "active" : ""}
                onClick={() => setStoreView("shop")}
              >
                心情小铺
              </button>
              <button
                type="button"
                className={storeView === "inventory" ? "active" : ""}
                onClick={() => setStoreView("inventory")}
              >
                我的物品
              </button>
            </nav>
            {storeView === "shop" ? (
              <nav className="category-nav" aria-label="商品分类">
                <h4>分类</h4>
                {STORE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={storeCategory === cat.id ? "active" : ""}
                    onClick={() => setStoreCategory(cat.id)}
                  >
                    {cat.label}
                  </button>
                ))}
              </nav>
            ) : null}
          </>
        ) : null}
        <button className="credit-pill" type="button" onClick={claimCoins}>
          🐷 领取金币
        </button>
      </aside>

      <section className="center-stage">
        <header className="top-tabs">
          {navItems.map((item) => (
            <button
              key={item}
              type="button"
              className={activeNav === item ? "active" : ""}
              onClick={() => {
                setActiveNav(item);
                if (item === "首页") setHomeView("main");
              }}
            >
              {item}
            </button>
          ))}
        </header>

        {isStore ? (
          storeView === "inventory" ? (
            <InventoryPage
              inventory={petInventory}
              onChange={setPetInventory}
              onNotify={setPetMessage}
            />
          ) : (
            <StorePage
              yarnCoins={yarnCoins}
              activeCategory={storeCategory}
              inventory={petInventory}
              onBuy={handleBuy}
              onOpenInventory={() => setStoreView("inventory")}
            />
          )
        ) : isTasks ? (
          <TasksPage
            tasks={userTasks}
            onToggleTask={toggleUserTask}
            onUpdateTask={updateUserTask}
            onDeleteTask={deleteUserTask}
          />
        ) : isGrowth ? (
          <GrowthPage
            yarnCoins={yarnCoins}
            petGifSrc={petGifCurrent}
            petGifName={petGifNameMap[petGifCurrent]}
            onEarlyUnlockSkill={handleEarlyUnlockSkill}
          />
        ) : isHomeChat ? (
          <ChatPage
            apiBase={apiBase}
            agentOnline={agentOnline}
            petGifSrc={petGifCurrent}
            petGifName={petGifNameMap[petGifCurrent]}
            personalityIds={personalityIds}
            onBack={() => setHomeView("main")}
            onExecuteTask={runCommand}
          />
        ) : (
          <>
            <article className="speech-bubble">
              "{petMessage || "太好了，你回来啦！准备一起搞定任务了吗？"}"
            </article>

            <div
              className={`pet-hero${equippedCorner ? " has-corner-scene" : ""}`}
              style={
                equippedCorner
                  ? ({ ["--corner-tint" as string]: equippedCorner.gradient } as CSSProperties)
                  : undefined
              }
            >
              {equippedCorner ? (
                <span className="pet-corner-deco" aria-hidden>
                  {equippedCorner.emoji}
                </span>
              ) : null}
              <button
                className="pet-avatar"
                type="button"
                onClick={() => setHomeView("chat")}
                aria-label="和 Yarni 对话"
              >
                <span className={`mood-indicator ${homePetStatus.indicator}`}></span>
                {equippedHead ? (
                  <span className="pet-head-cosmetic" aria-hidden title={equippedHead.name}>
                    {equippedHead.emoji}
                  </span>
                ) : null}
                <img
                  className="pet-hero-gif"
                  src={petGifCurrent}
                  alt={petGifNameMap[petGifCurrent] || "Yarni 桌宠"}
                  draggable={false}
                  onError={(e) => {
                    const img = e.currentTarget;
                    if (img.src.includes(PET_GIF_FALLBACK)) return;
                    img.src = PET_GIF_FALLBACK;
                  }}
                />
                <div className="pet-status-chip" key={homePetStatus.label}>
                  <strong>{homePetStatus.label}</strong>
                  <span>{homePetStatus.sublabel}</span>
                </div>
              </button>
            </div>

            <div className="hero-actions">
              <button
                type="button"
                className={isHomeChat ? "active" : ""}
                onClick={() => {
                  setActiveNav("首页");
                  setHomeView("chat");
                }}
              >
                对话
              </button>
              <button type="button" onClick={drawCompanionLine}>
                抽一句话
              </button>
            </div>

            <section className="home-mode-panel" aria-label="Yarni 心情模式">
              <div className="home-mode-header">
                <span>今天需要 Yarni 怎么陪你？</span>
                {homeMode ? (
                  <strong>{HOME_MODE_CARDS.find((mode) => mode.id === homeMode)?.label}</strong>
                ) : null}
              </div>
              <div className="home-mode-grid">
                {HOME_MODE_CARDS.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    className={homeMode === mode.id ? "active" : ""}
                    onClick={() => handleHomeMode(mode.id)}
                  >
                    <span aria-hidden>{mode.icon}</span>
                    <strong>{mode.label}</strong>
                    <em>{mode.description}</em>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
      </section>

      {!isStore && !isGrowth && !isHomeChat ? (
      <aside className={`right-panel${isTasks ? " tasks-panel" : ""}`}>
        {isTasks ? (
            <TasksRightPanel
              tasks={userTasks}
              weeklyCompleted={weeklyTaskCount}
              petGifSrc={petGifCurrent}
              personalityIds={personalityIds}
              onCreateTask={createUserTask}
            />
        ) : (
          <>
            <section className="status-card realtime-status-card">
              <h3>悬浮宠物</h3>
              <div className="metric-row">
                <span>显示状态</span>
                <strong>{petFloatVisible ? "显示中" : "已隐藏"}</strong>
              </div>
              <div className="pet-size-control">
                <div className="metric-row">
                  <span>大小</span>
                  <strong>{petFloatScale}%</strong>
                </div>
                <input
                  type="range"
                  min={PET_SIZE_MIN}
                  max={PET_SIZE_MAX}
                  step={5}
                  value={petFloatScale}
                  onChange={(e) => void applyPetFloatScale(Number(e.currentTarget.value))}
                />
                <div className="pet-size-presets">
                  <button type="button" onClick={() => void applyPetFloatScale(70)}>
                    小
                  </button>
                  <button type="button" onClick={() => void applyPetFloatScale(100)}>
                    中
                  </button>
                  <button type="button" onClick={() => void applyPetFloatScale(140)}>
                    大
                  </button>
                </div>
              </div>
              <PetBehaviorSettingsCard
                settings={petBehavior}
                onChange={(next) => setPetBehavior(savePetBehaviorSettings(next))}
              />
              <PetQuickActionsSettingsCard
                actions={petQuickActions}
                onChange={(next) => setPetQuickActions(savePetQuickActions(next))}
              />
              <button type="button" className="float-pet-toggle-btn" onClick={() => void toggleFloatPet()}>
                {petFloatVisible ? "隐藏悬浮宠物" : "显示悬浮宠物"}
              </button>
              <div className="pet-gif-manager">
                <div className="metric-row">
                  <span>当前 GIF</span>
                </div>
                <p className="pet-gif-current">
                  {petGifNameMap[petGifCurrent] || "未命名"} · {petGifCurrent}
                </p>
                <div className="pet-gif-rename">
                  <input
                    value={petGifCurrentNameInput}
                    onChange={(e) => setPetGifCurrentNameInput(e.currentTarget.value)}
                    placeholder="给当前 GIF 起名，如：听音乐"
                  />
                  <button type="button" onClick={saveCurrentPetGifName}>
                    保存名称
                  </button>
                </div>
                <div className="pet-gif-add">
                  <input
                    value={petGifInput}
                    onChange={(e) => setPetGifInput(e.currentTarget.value)}
                    placeholder="例如 /chongwu.gif"
                  />
                  <input
                    value={petGifNameInput}
                    onChange={(e) => setPetGifNameInput(e.currentTarget.value)}
                    placeholder="可选名称，如：自讨苦吃"
                  />
                  <button type="button" onClick={() => void addPetGif()}>
                    添加
                  </button>
                </div>
                <PetGifRotationCard
                  settings={petGifRotation}
                  gifCount={petGifList.length}
                  onChange={(next) => setPetGifRotation(savePetGifRotationSettings(next))}
                />
                <ul className="pet-gif-list">
                  {petGifList.map((item) => (
                    <li key={item}>
                      <button type="button" onClick={() => void applyPetGif(item)}>
                        使用
                      </button>
                      <span>{petGifNameMap[item] ? `${petGifNameMap[item]} · ${item}` : item}</span>
                      <button
                        type="button"
                        onClick={() => removePetGif(item)}
                        disabled={petGifList.length <= 1}
                      >
                        删除
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="status-card">
              <h3>实时状态</h3>
              <div className="metric-row">
                <span>在线状态</span>
                <strong>{agentOnline ? "98%" : "0%"}</strong>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: agentOnline ? "98%" : "6%" }}></div>
              </div>
              <div className="metric-row">
                <span>任务执行力</span>
                <strong>{Math.min(99, completedCount * 15 + 20)}%</strong>
              </div>
            </section>
          </>
        )}
      </aside>
      ) : null}
    </main>
  );
}

export default App;
