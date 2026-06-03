import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useRef, useState } from "react";
import { checkAgentOnline, streamFileChat, type FileChatHistoryItem } from "./api/fileChatStream";
import { fetchPetBubble, type PetBubbleKind } from "./api/petBubble";
import {
  loadPetGifRotationSettings,
  PET_GIF_ROTATION_CHANGED_EVENT,
  PET_GIF_ROTATION_STORAGE_KEY,
  pickNextGif,
  type PetGifRotationSettings,
} from "./data/petGifRotation";
import {
  loadCurrentPetGif,
  loadPetGifList,
  PET_GIF_FALLBACK,
  PET_GIF_LIST_STORAGE_KEY,
  saveCurrentPetGif,
} from "./petGif";
import { fetchPetPokeLine } from "./api/petPoke";
import { shouldPetFlee } from "./petFlee";
import { PET_POKE_BUBBLE_MS, PET_POKE_RESET_MS, pokeLineForClick } from "./petPokeLines";
import { BORED_MISCHIEF_LINES, BORED_WANDER_LINES, pickRandom } from "./data/petBoredLines";
import {
  loadPetBehaviorSettings,
  PET_BEHAVIOR_CHANGED_EVENT,
  PET_BEHAVIOR_STORAGE_KEY,
  type PetBehaviorSettings,
} from "./data/petBehaviorSettings";
import {
  getEnabledQuickActions,
  loadPetQuickActions,
  PET_QUICK_ACTIONS_CHANGED_EVENT,
  PET_QUICK_ACTIONS_STORAGE_KEY,
  PET_QUICK_RAIL_WIDTH,
  type PetQuickAction,
} from "./data/petQuickActions";
import {
  getEquippedHeadProduct,
  getEquippedPersonalityIds,
  isMondayMoodActive,
  loadPetInventory,
  PET_INVENTORY_CHANGED_EVENT,
  PET_INVENTORY_STORAGE_KEY,
} from "./data/petInventory";
import {
  isSkillActive,
  loadPetGrowth,
  PET_GROWTH_CHANGED_EVENT,
  PET_GROWTH_STORAGE_KEY,
  type PetGrowthState,
} from "./data/petGrowth";
import {
  lineForSkillBroadcast,
  pickBoredSkillLine,
  shouldSuppressWanderForFocus,
  SKILL_BROADCAST_INTERVAL_MS,
  type SkillBroadcastKind,
} from "./data/petSkillBroadcast";
import { loadUserTasks } from "./data/userTasks";
import { loadPetScale, petImageSizePx, petWindowSize, savePetScale } from "./petSize";
import "./FloatingPet.css";

type FileChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
};

const BUBBLE_SKILL_KIND: Record<SkillBroadcastKind, PetBubbleKind> = {
  music: "music",
  weather: "weather",
  schedule: "schedule",
  focus: "focus",
  dream: "dream",
};

function pendingTasksForBubble(growthState: PetGrowthState, kind: PetBubbleKind): number {
  if (kind !== "schedule" && !isSkillActive(growthState, "schedule")) return 0;
  return loadUserTasks().filter((task) => !task.completed).length;
}

const PANEL_WINDOW = { width: 360, height: 560 };
const DRAG_THRESHOLD_PX = 12;
const POKE_BUBBLE_MAX_CHARS = 18;

function truncateTextByChars(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const chars = Array.from(text);
  if (chars.length <= maxChars) return text;
  // Reserve one char for the ellipsis to keep total length within maxChars.
  return chars.slice(0, Math.max(1, maxChars - 1)).join("") + "…";
}

type PointerTrack = {
  x: number;
  y: number;
  dragging: boolean;
  dragStarted: boolean;
};

function fileLabel(paths: string[]): string {
  if (paths.length === 1) {
    const parts = paths[0].replace(/\\/g, "/").split("/");
    return parts[parts.length - 1] || paths[0];
  }
  return `${paths.length} 个文件`;
}

function normalizeExecutablePath(path: string): string {
  return path.trim().replace(/^["']|["']$/g, "");
}

export function FloatingPet() {
  const [src, setSrc] = useState(loadCurrentPetGif);
  const [scale, setScale] = useState(loadPetScale);
  const [quickRailOpen, setQuickRailOpen] = useState(false);
  const [quickActions, setQuickActions] = useState<PetQuickAction[]>(loadPetQuickActions);
  const quickRailOpenRef = useRef(false);
  const [dragOver, setDragOver] = useState(false);
  const [droppedPaths, setDroppedPaths] = useState<string[] | null>(null);
  const [requestText, setRequestText] = useState("");
  const [fileMessages, setFileMessages] = useState<FileChatMessage[]>([]);
  const [fileChatLoading, setFileChatLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [provider, setProvider] = useState<"deepseek" | "local" | null>(null);
  const [pokeBubble, setPokeBubble] = useState<string | null>(null);
  const [pokeMood, setPokeMood] = useState<"normal" | "annoyed">("normal");
  const [isFleeing, setIsFleeing] = useState(false);
  const [isWandering, setIsWandering] = useState(false);
  const [behavior, setBehavior] = useState<PetBehaviorSettings>(loadPetBehaviorSettings);
  const [gifRotation, setGifRotation] = useState<PetGifRotationSettings>(loadPetGifRotationSettings);
  const [equippedHead, setEquippedHead] = useState(() => getEquippedHeadProduct(loadPetInventory()));
  const [personalityIds, setPersonalityIds] = useState(() => getEquippedPersonalityIds(loadPetInventory()));
  const [growth, setGrowth] = useState<PetGrowthState>(loadPetGrowth);
  const rootRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pointerTrackRef = useRef<PointerTrack | null>(null);
  const pokeCountRef = useRef(0);
  const recentPokeLinesRef = useRef<string[]>([]);
  const pokeRequestIdRef = useRef(0);
  const pokeHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pokeResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef(Date.now());
  const boredBusyRef = useRef(false);
  const skillBroadcastAtRef = useRef<Partial<Record<SkillBroadcastKind, number>>>({});
  const weatherPreviewShownRef = useRef(false);

  const applySource = (candidate: string): void => {
    fetch(candidate, { method: "HEAD" })
      .then((res) => {
        if (!res.ok) {
          setSrc(PET_GIF_FALLBACK);
        } else {
          const next = saveCurrentPetGif(candidate);
          setSrc(next);
        }
      })
      .catch(() => setSrc(PET_GIF_FALLBACK));
  };

  const applyPetWindowSize = useCallback(
    async (withRail?: boolean): Promise<void> => {
      if (droppedPaths) return;
      const rail = withRail ?? quickRailOpenRef.current;
      const { width, height } = petWindowSize(scale, rail ? PET_QUICK_RAIL_WIDTH : 0);
      await invoke("set_pet_window_size", { width, height });
    },
    [scale, droppedPaths],
  );

  const restorePetWindow = useCallback(async () => {
    await applyPetWindowSize();
  }, [applyPetWindowSize]);

  const expandPetWindow = useCallback(async () => {
    await invoke("set_pet_window_size", {
      width: PANEL_WINDOW.width,
      height: PANEL_WINDOW.height,
    });
  }, []);

  const restorePetPosition = useCallback(async (): Promise<void> => {
    setIsFleeing(false);
    await invoke("pet_restore_position");
  }, []);

  const closeFilePanel = useCallback(async () => {
    setDroppedPaths(null);
    setRequestText("");
    setFileMessages([]);
    setFileChatLoading(false);
    setErrorText(null);
    setProvider(null);
    setDragOver(false);
    setQuickRailOpen(false);
    await restorePetPosition();
    await restorePetWindow();
  }, [restorePetWindow, restorePetPosition]);

  const noteActivity = useCallback((): void => {
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    const reloadBehavior = (): void => {
      setBehavior(loadPetBehaviorSettings());
    };
    const reloadGifRotation = (): void => {
      setGifRotation(loadPetGifRotationSettings());
    };
    const reloadQuickActions = (): void => {
      setQuickActions(loadPetQuickActions());
    };
    window.addEventListener(PET_BEHAVIOR_CHANGED_EVENT, reloadBehavior);
    window.addEventListener(PET_GIF_ROTATION_CHANGED_EVENT, reloadGifRotation);
    window.addEventListener(PET_QUICK_ACTIONS_CHANGED_EVENT, reloadQuickActions);
    const onStorage = (event: StorageEvent): void => {
      if (event.key === PET_BEHAVIOR_STORAGE_KEY) reloadBehavior();
      if (event.key === PET_QUICK_ACTIONS_STORAGE_KEY) reloadQuickActions();
      if (
        event.key === PET_GIF_ROTATION_STORAGE_KEY ||
        event.key === PET_GIF_LIST_STORAGE_KEY
      ) {
        reloadGifRotation();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(PET_BEHAVIOR_CHANGED_EVENT, reloadBehavior);
      window.removeEventListener(PET_GIF_ROTATION_CHANGED_EVENT, reloadGifRotation);
      window.removeEventListener(PET_QUICK_ACTIONS_CHANGED_EVENT, reloadQuickActions);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    quickRailOpenRef.current = quickRailOpen;
  }, [quickRailOpen]);

  useEffect(() => {
    if (droppedPaths) return;
    void applyPetWindowSize(quickRailOpen);
  }, [quickRailOpen, droppedPaths, applyPetWindowSize, scale]);

  const rotateToNextGif = useCallback(async (): Promise<void> => {
    const list = loadPetGifList();
    if (list.length <= 1) return;
    const current = loadCurrentPetGif();
    const next = pickNextGif(current, list);
    if (next === current) return;
    saveCurrentPetGif(next);
    applySource(next);
    try {
      await invoke("set_pet_gif", { gifPath: next });
    } catch {
      /* browser preview */
    }
  }, []);

  useEffect(() => {
    if (!gifRotation.enabled) return;
    const list = loadPetGifList();
    if (list.length <= 1) return;

    const timer = window.setInterval(() => {
      void rotateToNextGif();
    }, gifRotation.intervalSec * 1000);

    return () => window.clearInterval(timer);
  }, [gifRotation, rotateToNextGif]);

  useEffect(() => {
    const reloadGrowth = (): void => {
      setGrowth(loadPetGrowth());
    };
    window.addEventListener(PET_GROWTH_CHANGED_EVENT, reloadGrowth);
    const onStorage = (event: StorageEvent): void => {
      if (event.key === PET_GROWTH_STORAGE_KEY) reloadGrowth();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(PET_GROWTH_CHANGED_EVENT, reloadGrowth);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    applySource(loadCurrentPetGif());
  }, []);

  useEffect(() => {
    const reloadHead = (): void => {
      const inventory = loadPetInventory();
      setEquippedHead(getEquippedHeadProduct(inventory));
      setPersonalityIds(getEquippedPersonalityIds(inventory));
    };
    window.addEventListener(PET_INVENTORY_CHANGED_EVENT, reloadHead);
    const onStorage = (event: StorageEvent): void => {
      if (event.key === PET_INVENTORY_STORAGE_KEY) reloadHead();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(PET_INVENTORY_CHANGED_EVENT, reloadHead);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    const initial = loadPetScale();
    setScale(initial);
    void invoke("set_pet_size", { scale: initial });
  }, []);

  useEffect(() => {
    const unlistenPromise = listen<number>("pet-size-changed", (event) => {
      const next = savePetScale(event.payload);
      setScale(next);
      if (!droppedPaths) {
        const { width, height } = petWindowSize(
          next,
          quickRailOpenRef.current ? PET_QUICK_RAIL_WIDTH : 0,
        );
        void invoke("set_pet_window_size", { width, height });
      }
    });
    const unlistenGifPromise = listen<string>("pet-gif-changed", (event) => {
      applySource(event.payload);
    });
    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
      void unlistenGifPromise.then((unlisten) => unlisten());
    };
  }, [droppedPaths]);

  useEffect(() => {
    if (!quickRailOpen) return;
    const closeRail = (event: MouseEvent): void => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest(".float-pet-quick-rail")) return;
      setQuickRailOpen(false);
    };
    const timer = window.setTimeout(() => {
      window.addEventListener("mousedown", closeRail);
    }, 120);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("mousedown", closeRail);
    };
  }, [quickRailOpen]);

  useEffect(() => {
    const webview = getCurrentWebviewWindow();
    const unlistenPromise = webview.onDragDropEvent((event) => {
      const payload = event.payload;
      if (payload.type === "enter" || payload.type === "over") {
        setDragOver(true);
        return;
      }
      if (payload.type === "leave") {
        setDragOver(false);
        return;
      }
      if (payload.type === "drop") {
        setDragOver(false);
        if (payload.paths.length === 0) return;
        noteActivity();
        void (async () => {
          await expandPetWindow();
          setDroppedPaths(payload.paths);
          setFileMessages([]);
          setFileChatLoading(false);
          setErrorText(null);
          setRequestText("");
          setProvider(null);
          setQuickRailOpen(false);
        })();
      }
    });
    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [expandPetWindow]);

  useEffect(() => {
    if (droppedPaths && !fileChatLoading) {
      requestRef.current?.focus();
    }
  }, [droppedPaths, fileChatLoading, fileMessages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [fileMessages, fileChatLoading]);

  const openMain = async (): Promise<void> => {
    setQuickRailOpen(false);
    await invoke("show_main_window");
  };

  const closePet = async (): Promise<void> => {
    setQuickRailOpen(false);
    await getCurrentWindow().hide();
  };

  const runQuickAction = async (action: PetQuickAction): Promise<void> => {
    setQuickRailOpen(false);
    try {
      if (action.kind === "builtin") {
        if (action.builtin === "hide") {
          await closePet();
        } else {
          await openMain();
        }
        return;
      }
      if (action.kind === "exe") {
        const exe = normalizeExecutablePath(action.exePath);
        if (exe) {
          try {
            await invoke("launch_exe_path", { exePath: exe });
            return;
          } catch (error) {
            console.warn("failed to launch exe quick action", error);
            setPokeBubble("程序没打开，检查路径");
          }
        }
        const fallback = action.webUrl.trim();
        if (fallback) {
          await openUrl(fallback);
        }
        return;
      }
      const url = action.webUrl.trim();
      if (url) {
        await openUrl(url);
      }
    } catch {
      /* ignore opener errors */
    }
  };

  const startWindowDrag = (event: React.PointerEvent): void => {
    if (dragOver) return;
    if (event.button !== 0) return;
    if (quickRailOpen) {
      setQuickRailOpen(false);
      return;
    }
    event.preventDefault();
    void getCurrentWindow().startDragging();
  };

  const clearPokeTimers = (): void => {
    if (pokeHideTimerRef.current) {
      clearTimeout(pokeHideTimerRef.current);
      pokeHideTimerRef.current = null;
    }
    if (pokeResetTimerRef.current) {
      clearTimeout(pokeResetTimerRef.current);
      pokeResetTimerRef.current = null;
    }
  };

  const schedulePokeReset = (): void => {
    if (pokeResetTimerRef.current) {
      clearTimeout(pokeResetTimerRef.current);
    }
    pokeResetTimerRef.current = setTimeout(() => {
      pokeCountRef.current = 0;
      recentPokeLinesRef.current = [];
      setPokeMood("normal");
      void restorePetPosition();
    }, PET_POKE_RESET_MS);
  };

  const maybeFleeFromLine = (line: string): void => {
    if (!shouldPetFlee(line)) return;
    setIsFleeing(true);
    void invoke("pet_flee_to_corner");
  };

  const showIdleBubble = useCallback(
    (line: string, annoyed = false): void => {
      setPokeMood(annoyed ? "annoyed" : "normal");
      setPokeBubble(truncateTextByChars(line, POKE_BUBBLE_MAX_CHARS));
      maybeFleeFromLine(line);
      clearPokeTimers();
      pokeHideTimerRef.current = setTimeout(() => {
        setPokeBubble(null);
        void restorePetPosition();
      }, PET_POKE_BUBBLE_MS);
    },
    [restorePetPosition],
  );

  const performBoredAction = useCallback(async (): Promise<void> => {
    if (boredBusyRef.current || droppedPaths || fileChatLoading) return;
    if (pokeBubble === "…") return;
    if (!behavior.autonomyEnabled) return;

    const growthState = loadPetGrowth();
    const skillLine = pickBoredSkillLine(growthState);
    if (skillLine) {
      boredBusyRef.current = true;
      lastActivityRef.current = Date.now();
      const skillKind: PetBubbleKind =
        isSkillActive(growthState, "dream") ? "dream" : "focus";
      try {
        const result = await fetchPetBubble({
          kind: skillKind,
          personalityIds,
          pendingTasks: pendingTasksForBubble(growthState, skillKind),
          recentLines: recentPokeLinesRef.current,
        });
        showIdleBubble(result.line, result.mood === "annoyed");
      } catch {
        showIdleBubble(skillLine, false);
      }
      window.setTimeout(() => {
        boredBusyRef.current = false;
      }, 800);
      return;
    }

    const actions: Array<"wander" | "mischief"> = [];
    if (behavior.wanderWhenBored && !shouldSuppressWanderForFocus(growthState)) {
      actions.push("wander");
    }
    if (behavior.mischiefWhenBored) actions.push("mischief");
    if (!actions.length) return;

    boredBusyRef.current = true;
    lastActivityRef.current = Date.now();

    const kind = pickRandom(actions);
    const fallbackLine =
      kind === "mischief" ? pickRandom(BORED_MISCHIEF_LINES) : pickRandom(BORED_WANDER_LINES);
    const fallbackAnnoyed = kind === "mischief" && fallbackLine.includes("躲");
    let line: string = fallbackLine;
    let annoyed = fallbackAnnoyed;

    try {
      const result = await fetchPetBubble({
        kind: kind === "mischief" ? "emotion" : "idle",
        personalityIds,
        pendingTasks: pendingTasksForBubble(
          growthState,
          kind === "mischief" ? "emotion" : "idle",
        ),
        recentLines: recentPokeLinesRef.current,
      });
      line = result.line;
      annoyed = result.mood === "annoyed";
    } catch {
      line = fallbackLine;
      annoyed = fallbackAnnoyed;
    }

    try {
      if (
        behavior.wanderWhenBored &&
        !shouldSuppressWanderForFocus(growthState) &&
        (kind === "wander" || Math.random() < 0.45)
      ) {
        setIsWandering(true);
        await invoke("pet_wander_random");
      }
      showIdleBubble(line, annoyed);
    } catch {
      showIdleBubble(line, annoyed);
    } finally {
      window.setTimeout(() => {
        boredBusyRef.current = false;
        setIsWandering(false);
      }, 800);
    }
  }, [behavior, droppedPaths, fileChatLoading, personalityIds, pokeBubble, showIdleBubble]);

  useEffect(() => {
    if (!behavior.autonomyEnabled) return;
    const timer = window.setInterval(() => {
      if (droppedPaths || fileChatLoading || boredBusyRef.current) return;
      if (pokeBubble) return;
      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs < behavior.boredomIntervalSec * 1000) return;
      void performBoredAction();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [behavior, droppedPaths, fileChatLoading, pokeBubble, performBoredAction]);

  useEffect(() => {
    if (!behavior.autonomyEnabled) return;
    const kinds = Object.keys(SKILL_BROADCAST_INTERVAL_MS) as SkillBroadcastKind[];
    const timer = window.setInterval(() => {
      if (droppedPaths || fileChatLoading || boredBusyRef.current || pokeBubble) return;
      const growthState = loadPetGrowth();
      const now = Date.now();
      for (const kind of kinds) {
        if (!isSkillActive(growthState, kind)) continue;
        const last = skillBroadcastAtRef.current[kind] ?? 0;
        if (now - last < SKILL_BROADCAST_INTERVAL_MS[kind]) continue;
        skillBroadcastAtRef.current[kind] = now;
        void (async () => {
          let line: string | null = null;
          try {
            const result = await fetchPetBubble({
              kind: BUBBLE_SKILL_KIND[kind],
              personalityIds,
              pendingTasks: pendingTasksForBubble(growthState, BUBBLE_SKILL_KIND[kind]),
              recentLines: recentPokeLinesRef.current,
            });
            line = result.line;
          } catch {
            line = await lineForSkillBroadcast(kind);
          }
          if (!line || pokeBubble) return;
          noteActivity();
          showIdleBubble(line, false);
        })();
        break;
      }
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [
    behavior.autonomyEnabled,
    droppedPaths,
    fileChatLoading,
    pokeBubble,
    showIdleBubble,
    noteActivity,
    growth,
    personalityIds,
  ]);

  useEffect(() => {
    const growthState = loadPetGrowth();
    if (!behavior.autonomyEnabled || !isSkillActive(growthState, "weather")) {
      weatherPreviewShownRef.current = false;
      return;
    }
    if (weatherPreviewShownRef.current || droppedPaths || fileChatLoading || pokeBubble) return;

    weatherPreviewShownRef.current = true;
    const timer = window.setTimeout(() => {
      if (droppedPaths || fileChatLoading || boredBusyRef.current || pokeBubble) return;
      skillBroadcastAtRef.current.weather = Date.now();
      void (async () => {
        let line: string | null = null;
        try {
          const result = await fetchPetBubble({
            kind: "weather",
            personalityIds,
            pendingTasks: 0,
            recentLines: recentPokeLinesRef.current,
          });
          line = result.line;
        } catch {
          line = await lineForSkillBroadcast("weather");
        }
        if (!line || pokeBubble) return;
        noteActivity();
        showIdleBubble(line, false);
      })();
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [
    behavior.autonomyEnabled,
    droppedPaths,
    fileChatLoading,
    growth,
    noteActivity,
    personalityIds,
    pokeBubble,
    showIdleBubble,
  ]);

  const showPokeBubble = (): void => {
    noteActivity();
    const index = pokeCountRef.current;
    pokeCountRef.current += 1;
    const requestId = ++pokeRequestIdRef.current;

    void restorePetPosition();

    const mondayMood = isMondayMoodActive(loadPetInventory());
    setPokeMood(mondayMood || index >= 4 ? "annoyed" : "normal");
    setPokeBubble("…");
    clearPokeTimers();

    const reveal = (line: string, mood: "normal" | "annoyed"): void => {
      if (requestId !== pokeRequestIdRef.current) return;
      const finalMood = mondayMood ? "annoyed" : mood;
      setPokeMood(finalMood);
      setPokeBubble(truncateTextByChars(line, POKE_BUBBLE_MAX_CHARS));
      recentPokeLinesRef.current = [...recentPokeLinesRef.current, line].slice(-5);
      maybeFleeFromLine(line);
      pokeHideTimerRef.current = setTimeout(() => {
        setPokeBubble(null);
        void restorePetPosition();
      }, PET_POKE_BUBBLE_MS);
      schedulePokeReset();
    };

    void (async () => {
      try {
        const growthState = loadPetGrowth();
        const useEmotion = isSkillActive(growthState, "emotion");
        if (!useEmotion) {
          reveal(pokeLineForClick(index), mondayMood || index >= 4 ? "annoyed" : "normal");
          return;
        }
        const online = await checkAgentOnline();
        if (!online) {
          reveal(pokeLineForClick(index), mondayMood || index >= 4 ? "annoyed" : "normal");
          return;
        }
        const result = await fetchPetPokeLine(index, recentPokeLinesRef.current);
        reveal(result.line, result.mood);
      } catch {
        reveal(pokeLineForClick(index), mondayMood || index >= 4 ? "annoyed" : "normal");
      }
    })();
  };

  const onPetPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (dragOver || event.button !== 0) return;
    noteActivity();
    if (quickRailOpen) {
      setQuickRailOpen(false);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerTrackRef.current = {
      x: event.clientX,
      y: event.clientY,
      dragging: false,
      dragStarted: false,
    };
  };

  const onPetPointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const track = pointerTrackRef.current;
    if (!track || track.dragStarted) return;

    const dx = event.clientX - track.x;
    const dy = event.clientY - track.y;
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;

    track.dragging = true;
    track.dragStarted = true;
    noteActivity();
    event.preventDefault();
    void getCurrentWindow().startDragging();
  };

  const onPetPointerUp = (event: React.PointerEvent<HTMLDivElement>): void => {
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
    const track = pointerTrackRef.current;
    pointerTrackRef.current = null;
    if (!track || event.button !== 0) return;
    if (track.dragging || track.dragStarted) return;
    showPokeBubble();
  };

  useEffect(() => () => clearPokeTimers(), []);

  const onContextMenu = (event: React.MouseEvent): void => {
    event.preventDefault();
    if (droppedPaths) return;
    const target = event.target as HTMLElement;
    if (target.closest(".float-pet-quick-rail")) return;
    setQuickRailOpen((open) => !open);
  };

  const submitFileRequest = async (): Promise<void> => {
    if (!droppedPaths?.length || fileChatLoading) return;
    const message = requestText.trim();
    if (!message) {
      setErrorText(
        fileMessages.length === 0
          ? "请先写下你的诉求，例如：总结要点、检查错别字。"
          : "请输入要继续追问的内容。",
      );
      return;
    }

    const online = await checkAgentOnline();
    if (!online) {
      setErrorText("本地 Agent 未启动。请先运行 start-agent.bat。");
      return;
    }

    const history: FileChatHistoryItem[] = fileMessages
      .filter((m) => !m.streaming && m.content.trim())
      .map((m) => ({ role: m.role, content: m.content }));

    const userId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();

    setErrorText(null);
    setRequestText("");
    setFileChatLoading(true);
    setFileMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: message },
      { id: assistantId, role: "assistant", content: "", streaming: true },
    ]);

    try {
      await streamFileChat(
        droppedPaths,
        message,
        history,
        personalityIds,
        (chunk) => {
          setFileMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + chunk } : m,
            ),
          );
        },
        (done) => {
          setProvider(done.provider ?? null);
          setFileMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, streaming: false } : m,
            ),
          );
          setFileChatLoading(false);
        },
      );
    } catch {
      setErrorText("请求失败，请确认 Agent 已启动且已配置 DeepSeek。");
      setFileMessages((prev) => prev.filter((m) => m.id !== userId && m.id !== assistantId));
      setFileChatLoading(false);
    }
  };

  const imageSize = petImageSizePx(scale);
  const showPanel = Boolean(droppedPaths);
  const hasConversation = fileMessages.length > 0;
  const enabledQuickActions = getEnabledQuickActions(quickActions);

  return (
    <div
      className={`float-pet-root${dragOver ? " is-drag-over" : ""}${showPanel ? " has-panel" : ""}${isWandering ? " is-wandering" : ""}${quickRailOpen ? " has-quick-rail" : ""}`}
      ref={rootRef}
      onContextMenu={onContextMenu}
    >
      <div className="float-pet-layout">
        <div className="float-pet-stage">
      {dragOver && !showPanel ? (
        <div className="float-pet-drop-hint">松开即可交给 Yarni 分析</div>
      ) : null}

      {pokeBubble ? (
        <div
          className={`float-pet-poke-bubble${pokeMood === "annoyed" ? " is-annoyed" : ""}${
            pokeBubble === "…" ? " is-loading" : ""
          }`}
          role="status"
          aria-live="polite"
          style={{
            ["--pet-image-size" as any]: `${imageSize}px`,
            // Pet GIF height is not exactly the same as its width, so use a conservative fraction
            // to keep the bubble fully visible while still minimizing overlap.
            ["--pet-bubble-anchor" as any]: `${Math.round(imageSize * 0.66)}px`,
          }}
        >
          {pokeBubble}
        </div>
      ) : null}

      {showPanel ? (
        <div className="float-pet-panel" onPointerDown={(e) => e.stopPropagation()}>
          <div
            className="float-pet-panel-head"
            onPointerDown={startWindowDrag}
            title="按住此处可拖动桌宠"
          >
            <span className="float-pet-panel-title">📎 {fileLabel(droppedPaths!)}</span>
            <button
              type="button"
              className="float-pet-panel-close"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => void closeFilePanel()}
            >
              ✕
            </button>
          </div>

          <div className="float-pet-chat-thread">
            {!hasConversation ? (
              <p className="float-pet-chat-empty">拖入文件后，写下第一个问题开始对话</p>
            ) : null}
            {fileMessages.map((msg) => (
              <div
                key={msg.id}
                className={`float-pet-chat-bubble float-pet-chat-bubble--${msg.role}${
                  msg.streaming ? " is-streaming" : ""
                }`}
              >
                {msg.content || (msg.streaming ? "…" : "")}
              </div>
            ))}
            {fileChatLoading ? (
              <div className="float-pet-panel-loading float-pet-panel-loading--inline">
                <span className="float-pet-spinner" />
                Yarni 思考中…
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>

          {provider && hasConversation && !fileChatLoading ? (
            <p className="float-pet-panel-meta">
              {provider === "deepseek" ? "DeepSeek · 可多轮追问" : "本地提示（未配置 API Key）"}
            </p>
          ) : null}

          <label className="float-pet-panel-label" htmlFor="pet-file-request">
            {hasConversation ? "继续提问" : "告诉宠物你的诉求"}
          </label>
          <textarea
            id="pet-file-request"
            ref={requestRef}
            className="float-pet-panel-input"
            placeholder={
              hasConversation
                ? "基于上文和文件继续问…"
                : "例如：总结要点 / 检查错别字 / 解释代码"
            }
            value={requestText}
            onChange={(e) => setRequestText(e.target.value)}
            rows={3}
            disabled={fileChatLoading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void submitFileRequest();
              }
            }}
          />
          {errorText ? <p className="float-pet-panel-error">{errorText}</p> : null}
          <div className="float-pet-panel-actions">
            <button type="button" className="secondary" onClick={() => void closeFilePanel()}>
              结束
            </button>
            <button
              type="button"
              className="primary"
              disabled={fileChatLoading}
              onClick={() => void submitFileRequest()}
            >
              {fileChatLoading ? "回复中…" : hasConversation ? "发送" : "开始对话"}
            </button>
          </div>
          <p className="float-pet-panel-tip">
            支持 PDF、Word（.docx）、文本 · Ctrl+Enter 发送
          </p>
        </div>
      ) : null}

      <div
        className={`float-pet-drag${equippedHead ? " has-head-cosmetic" : ""}`}
        onPointerDown={onPetPointerDown}
        onPointerMove={onPetPointerMove}
        onPointerUp={onPetPointerUp}
        onPointerCancel={() => {
          pointerTrackRef.current = null;
        }}
        onDoubleClick={() => void openMain()}
      >
        {equippedHead ? (
          <span className="float-pet-head-cosmetic" aria-hidden title={equippedHead.name}>
            {equippedHead.emoji}
          </span>
        ) : null}
        <img
          className={`float-pet-img${isFleeing ? " is-fleeing" : ""}${isWandering ? " is-wandering" : ""}`}
          src={src}
          alt="Yarni 桌宠"
          draggable={false}
          style={{ width: imageSize, height: "auto" }}
        />
      </div>
        </div>

        {quickRailOpen && !showPanel && enabledQuickActions.length > 0 ? (
          <aside
            className="float-pet-quick-rail"
            onContextMenu={(e) => e.preventDefault()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {enabledQuickActions.map((action, index) => (
              <button
                key={action.id}
                type="button"
                className={`float-pet-quick-btn float-pet-quick-btn--${action.kind} float-pet-quick-btn--id-${action.id}`}
                style={{ ["--quick-btn-i" as string]: String(index) }}
                title={action.label}
                aria-label={action.label}
                onClick={() => void runQuickAction(action)}
              >
                <span className="float-pet-quick-btn-ring" aria-hidden />
                <span className="float-pet-quick-btn-icon" aria-hidden>
                  {action.icon}
                </span>
              </button>
            ))}
          </aside>
        ) : null}
      </div>
    </div>
  );
}