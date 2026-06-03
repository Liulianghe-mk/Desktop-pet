export const BORED_WANDER_LINES = [
  "好无聊呀…出去溜达一圈～",
  "主人不在，我四处逛逛！",
  "这边看看，那边瞧瞧～",
  "桌面风景不错，散个步！",
  "偷偷挪个窝，应该没人发现吧？",
  "无聊到开始巡游模式了…",
] as const;

export const BORED_MISCHIEF_LINES = [
  "嘿嘿，搞点小动作～",
  "主人不在，我翻你桌面啦！",
  "略略略，来抓我呀！",
  "无聊到想戳你一下！",
  "我要躲起来啦，找不到我～",
  "再不理我我就溜到角落去！",
  "关机勿扰…骗你的，我还在！",
] as const;

export function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}
