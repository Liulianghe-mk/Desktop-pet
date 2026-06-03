export type PetMood = "idle" | "thinking" | "executing" | "done" | "error";

export const IDLE_HOME_PHRASES = [
  "在线陪伴",
  "等你吩咐",
  "今天也要元气",
  "戳戳悬浮宠试试",
] as const;

export type HomePetStatus = {
  label: string;
  sublabel: string;
  indicator: PetMood | "idle-online" | "idle-offline";
};

export function getHomePetStatus(
  mood: PetMood,
  agentOnline: boolean,
  idlePhraseIndex: number,
): HomePetStatus {
  switch (mood) {
    case "thinking":
      return {
        label: "琢磨中",
        sublabel: "正在理解你的指令",
        indicator: "thinking",
      };
    case "executing":
      return {
        label: "忙碌中",
        sublabel: "任务执行进行时",
        indicator: "executing",
      };
    case "done":
      return {
        label: "搞定啦",
        sublabel: "这一单已完成",
        indicator: "done",
      };
    case "error":
      return {
        label: "需要帮忙",
        sublabel: "检查一下任务或 Agent",
        indicator: "error",
      };
    default:
      return {
        label: IDLE_HOME_PHRASES[idlePhraseIndex % IDLE_HOME_PHRASES.length],
        sublabel: agentOnline ? "Agent 已连接 · 随时可聊" : "先启动 Agent 再执行任务",
        indicator: agentOnline ? "idle-online" : "idle-offline",
      };
  }
}
