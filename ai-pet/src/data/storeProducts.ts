export type StoreCategory = "all" | "personality" | "head" | "accessory" | "furniture" | "curiosity";
export type StoreFilter = "new" | "limited" | "seasonal" | "fun";

export type StoreEffectType = "cosmetic" | "buff" | "scene" | "consumable" | "personality";

export type ConsumableEffectId = "procrastination" | "monday_mood" | "corporate_speak";
export type PersonalityId =
  | "gentle_companion"
  | "sharp_supervisor"
  | "efficiency_coach"
  | "zen_slacker"
  | "corporate_poet"
  | "calm_butler"
  | "cat_cute";

export type StoreProduct = {
  id: string;
  name: string;
  price: number;
  category: StoreCategory;
  filter: StoreFilter;
  emoji: string;
  gradient: string;
  /** 商品趣味说明 */
  tagline: string;
  /** 购买成功时 Yarni 的吐槽（可选，默认自动生成） */
  purchaseLine?: string;
  effectType?: StoreEffectType;
  /** Buff：完成任务额外毛线币 */
  buffCoinBonus?: number;
  consumableId?: ConsumableEffectId;
  personalityId?: PersonalityId;
  personalityPrompt?: string;
  /** 购买时赠送的使用次数 */
  usesOnPurchase?: number;
};

const PRODUCT_EFFECT_OVERRIDES: Record<string, Partial<StoreProduct>> = {
  "buff-mood-pin": { effectType: "buff", buffCoinBonus: 5 },
  "procrastination-card": {
    effectType: "consumable",
    consumableId: "procrastination",
    usesOnPurchase: 1,
  },
  "monday-mood": {
    effectType: "consumable",
    consumableId: "monday_mood",
    usesOnPurchase: 1,
  },
  "corporate-speak-pack": {
    effectType: "consumable",
    consumableId: "corporate_speak",
    usesOnPurchase: 1,
  },
};

function inferEffectType(category: StoreCategory): StoreEffectType {
  switch (category) {
    case "head":
      return "cosmetic";
    case "personality":
      return "personality";
    case "accessory":
      return "buff";
    case "furniture":
      return "scene";
    case "curiosity":
      return "cosmetic";
    default:
      return "cosmetic";
  }
}

export function resolveStoreProduct(product: StoreProduct): StoreProduct {
  const overrides = PRODUCT_EFFECT_OVERRIDES[product.id] ?? {};
  return {
    ...product,
    ...overrides,
    effectType: overrides.effectType ?? product.effectType ?? inferEffectType(product.category),
  };
}

export const STORE_CATEGORIES: { id: StoreCategory; label: string }[] = [
  { id: "all", label: "所有商品" },
  { id: "personality", label: "性格插件" },
  { id: "accessory", label: "任务 Buff" },
];

export const STORE_FILTERS: { id: StoreFilter; label: string }[] = [
  { id: "new", label: "新品推荐" },
  { id: "fun", label: "脑洞专区" },
  { id: "limited", label: "限量版本" },
  { id: "seasonal", label: "季节限定" },
];

export const STORE_PRODUCTS: StoreProduct[] = [
  {
    id: "persona-gentle-companion",
    name: "温柔陪伴人格",
    price: 120,
    category: "personality",
    filter: "new",
    emoji: "🌷",
    gradient: "linear-gradient(145deg, #fff1f5, #f8bbd0)",
    tagline: "说话更柔软，提醒不施压，适合低能量时打开。",
    purchaseLine: "温柔陪伴人格已入库。今天也可以慢慢来。",
    effectType: "personality",
    personalityId: "gentle_companion",
    personalityPrompt: "语气温柔、接纳、低压力，多鼓励用户慢慢来；避免催促和责备。",
  },
  {
    id: "persona-sharp-supervisor",
    name: "毒舌监督人格",
    price: 160,
    category: "personality",
    filter: "fun",
    emoji: "🗯️",
    gradient: "linear-gradient(145deg, #ffebee, #ef9a9a)",
    tagline: "会轻微吐槽拖延，但不攻击主人。",
    purchaseLine: "毒舌监督人格已上线：别看了，先做五分钟。",
    effectType: "personality",
    personalityId: "sharp_supervisor",
    personalityPrompt: "语气可以轻微毒舌和吐槽拖延，但必须友善，不羞辱用户；结尾给一个具体下一步。",
  },
  {
    id: "persona-efficiency-coach",
    name: "效率教练人格",
    price: 180,
    category: "personality",
    filter: "new",
    emoji: "📋",
    gradient: "linear-gradient(145deg, #e3f2fd, #90caf9)",
    tagline: "少废话，直接拆步骤、排优先级。",
    purchaseLine: "效率教练人格已安装：目标、步骤、开始。",
    effectType: "personality",
    personalityId: "efficiency_coach",
    personalityPrompt: "回答简洁、行动导向，优先给 1-3 个下一步；少寒暄，适合任务规划。",
  },
  {
    id: "persona-zen-slacker",
    name: "佛系摸鱼人格",
    price: 88,
    category: "personality",
    filter: "seasonal",
    emoji: "🍵",
    gradient: "linear-gradient(145deg, #f1f8e9, #aed581)",
    tagline: "不卷，但会帮你保住最低进度。",
    purchaseLine: "佛系摸鱼人格已激活：能做一点是一点。",
    effectType: "personality",
    personalityId: "zen_slacker",
    personalityPrompt: "语气佛系、松弛，帮助用户把任务缩小到最低可行动作；允许休息，但不逃避现实。",
  },
  {
    id: "persona-corporate-poet",
    name: "打工人废话文学人格",
    price: 66,
    category: "personality",
    filter: "fun",
    emoji: "💼",
    gradient: "linear-gradient(145deg, #e8eaf6, #9fa8da)",
    tagline: "自动拉齐颗粒度，形成回复闭环。",
    purchaseLine: "废话文学人格已同步：我们先对齐一下。",
    effectType: "personality",
    personalityId: "corporate_poet",
    personalityPrompt: "适度使用职场黑话和打工人幽默，如拉齐、闭环、颗粒度；不要影响信息清晰度。",
  },
  {
    id: "persona-calm-butler",
    name: "冷静管家人格",
    price: 150,
    category: "personality",
    filter: "limited",
    emoji: "🕯️",
    gradient: "linear-gradient(145deg, #eceff1, #b0bec5)",
    tagline: "克制、稳重、少卖萌。",
    purchaseLine: "冷静管家人格已就位。请吩咐。",
    effectType: "personality",
    personalityId: "calm_butler",
    personalityPrompt: "语气稳重、礼貌、理性，少卖萌，优先给清晰判断和风险提醒。",
  },
  {
    id: "persona-cat-cute",
    name: "猫猫撒娇人格",
    price: 99,
    category: "personality",
    filter: "new",
    emoji: "🐾",
    gradient: "linear-gradient(145deg, #fff8e1, #ffe082)",
    tagline: "更可爱，会撒娇，但不会忘记正事。",
    purchaseLine: "猫猫撒娇人格已装备候选：喵，主人看我！",
    effectType: "personality",
    personalityId: "cat_cute",
    personalityPrompt: "语气可爱、轻微撒娇，可偶尔使用“喵”；仍保持回答有用，不要过度卖萌。",
  },
  // —— 方案 A：精神装扮（打工人心情） ——
  {
    id: "dark-circle-sticker",
    name: "熬夜黑眼圈贴纸（半永久）",
    price: 68,
    category: "head",
    filter: "new",
    emoji: "🌑",
    gradient: "linear-gradient(145deg, #eceff1, #b0bec5)",
    tagline: "不是困，是正在渲染人生。",
    purchaseLine: "装备成功！黑眼圈已上线，咖啡请自备。",
  },
  {
    id: "zen-halo",
    name: "佛系光环（体验版）",
    price: 128,
    category: "head",
    filter: "seasonal",
    emoji: "😇",
    gradient: "linear-gradient(145deg, #fffde7, #fff59d)",
    tagline: "脾气变钝，截止日不变。",
  },
  {
    id: "wifi-inspiration-band",
    name: "灵感 Wi-Fi 发箍",
    price: 156,
    category: "head",
    filter: "fun",
    emoji: "📶",
    gradient: "linear-gradient(145deg, #e3f2fd, #90caf9)",
    tagline: "信号满格，内容为空。",
    purchaseLine: "连接成功！0 KB/s，但看起来很忙。",
  },
  {
    id: "slacking-earmuff",
    name: "摸鱼降噪耳罩",
    price: 220,
    category: "head",
    filter: "limited",
    emoji: "🎧",
    gradient: "linear-gradient(145deg, #f5efe6, #d4c4a8)",
    tagline: "听不见 @，听得见心跳。",
  },
  {
    id: "monday-horn",
    name: "周一怨念角（可拆卸）",
    price: 99,
    category: "head",
    filter: "new",
    emoji: "👿",
    gradient: "linear-gradient(145deg, #ffebee, #ef9a9a)",
    tagline: "角越大，咖啡越浓。",
  },
  // —— 方案 B：被动道具（游戏化 Buff） ——
  {
    id: "buff-effort-zero",
    name: "努力护符 · 经验 +0%",
    price: 88,
    category: "accessory",
    filter: "new",
    emoji: "🛡️",
    gradient: "linear-gradient(145deg, #e8eaf6, #9fa8da)",
    tagline: "被动：看起来很努力，数值纹丝不动。",
    purchaseLine: "装备成功！经验 +0%，心态 +1。",
  },
  {
    id: "buff-slacking-crit",
    name: "摸鱼手套 · 暴击率 UP",
    price: 166,
    category: "accessory",
    filter: "fun",
    emoji: "🧤",
    gradient: "linear-gradient(145deg, #e0f7fa, #80deea)",
    tagline: "被动：关键时刻触发「稍后再说」。",
    purchaseLine: "装备成功！暴击率提升，指摸鱼暴击。",
  },
  {
    id: "buff-delay-hourglass",
    name: "拖延沙漏 · 冷却 -24h",
    price: 142,
    category: "accessory",
    filter: "limited",
    emoji: "⏳",
    gradient: "linear-gradient(145deg, #fff8e1, #ffe082)",
    tagline: "被动：任务倒计时自动顺延一天。",
    purchaseLine: "装备成功！冷却 -24h， guilt +∞。",
  },
  {
    id: "buff-mood-pin",
    name: "心态 +1 胸针",
    price: 55,
    category: "accessory",
    filter: "new",
    emoji: "📌",
    gradient: "linear-gradient(145deg, #f3e5f5, #ce93d8)",
    tagline: "被动：攻击力不变，摆烂更从容。",
  },
  {
    id: "title-ssr-nopunch",
    name: "称号：SSR·连续打卡 0 天",
    price: 520,
    category: "accessory",
    filter: "limited",
    emoji: "🏅",
    gradient: "linear-gradient(145deg, #fff3e0, #ffb74d)",
    tagline: "装备后全服可见你的诚实。",
    purchaseLine: "称号已佩戴！【SSR·连续打卡 0 天】闪耀登场。",
  },
  // —— 方案 C：安心角落（治愈系） ——
  {
    id: "cozy-blanket-corner",
    name: "软软毯角",
    price: 280,
    category: "furniture",
    filter: "new",
    emoji: "🧸",
    gradient: "linear-gradient(145deg, #fce4ec, #f8bbd9)",
    tagline: "盖住腿，就盖住一半烦恼。",
    purchaseLine: "购买成功！毯角已铺开，世界安静了一点点。",
  },
  {
    id: "cozy-night-light",
    name: "小夜灯 · 暖黄",
    price: 198,
    category: "furniture",
    filter: "seasonal",
    emoji: "🌙",
    gradient: "linear-gradient(145deg, #fff8e1, #ffcc80)",
    tagline: "不刺眼，只够照亮发呆。",
  },
  {
    id: "cozy-miss-you-pillow",
    name: "「有人在想你」抱枕",
    price: 240,
    category: "furniture",
    filter: "new",
    emoji: "💭",
    gradient: "linear-gradient(145deg, #e8f5e9, #a5d6a7)",
    tagline: "不一定真有，但抱着很踏实。",
  },
  {
    id: "cozy-cocoa-cup",
    name: "一杯热可可（蒸汽版）",
    price: 120,
    category: "furniture",
    filter: "seasonal",
    emoji: "☕",
    gradient: "linear-gradient(145deg, #d7ccc8, #a1887f)",
    tagline: "不能喝，但看着就很暖。",
  },
  {
    id: "cozy-window-cushion",
    name: "靠窗发呆垫",
    price: 360,
    category: "furniture",
    filter: "limited",
    emoji: "🪟",
    gradient: "linear-gradient(145deg, #e1f5fe, #81d4fa)",
    tagline: "适合什么都不做的一下午。",
    purchaseLine: "购买成功！发呆垫已就位，风景请自理。",
  },
  // —— 奇趣好物 ——
  {
    id: "brain-einstein",
    name: "爱因斯坦的大脑",
    price: 9999,
    category: "curiosity",
    filter: "fun",
    emoji: "🧠",
    gradient: "linear-gradient(145deg, #e8ecf8, #b8c4e8)",
    tagline: "暂未开封。据称仍在思考相对论，不支持退货。",
    purchaseLine: "购买成功！大脑表示：E=mc²，但你的作业还是得自己写。",
  },
  {
    id: "noodles-no-seasoning",
    name: "老板囤的方便面（无调味包）",
    price: 42,
    category: "curiosity",
    filter: "fun",
    emoji: "🍜",
    gradient: "linear-gradient(145deg, #fff3e0, #ffcc80)",
    tagline: "整箱面饼，管饱。灵魂调味请自备酱油或眼泪。",
    purchaseLine: "购买成功！面饼已到账，调味包据说还在老板路上。",
  },
  {
    id: "schrodinger-box",
    name: "薛定谔的猫盒（空盒）",
    price: 520,
    category: "curiosity",
    filter: "fun",
    emoji: "📦",
    gradient: "linear-gradient(145deg, #f3e5f5, #ce93d8)",
    tagline: "打开前：同时有猫没猫。打开后：只有盒子。",
    purchaseLine: "购买成功！盒子里的猫既存在又不存在——反正你没看见。",
  },
  {
    id: "monday-mood",
    name: "周一早上的起床气",
    price: 88,
    category: "curiosity",
    filter: "new",
    emoji: "😤",
    gradient: "linear-gradient(145deg, #ffebee, #ef9a9a)",
    tagline: "浓缩一瓶，喷一点就能对闹钟翻白眼。",
    purchaseLine: "购买成功！起床气已装备，建议配合咖啡使用。",
  },
  {
    id: "procrastination-card",
    name: "拖延症续费卡（24小时）",
    price: 66,
    category: "curiosity",
    filter: "fun",
    emoji: "⏳",
    gradient: "linear-gradient(145deg, #fff8e1, #ffe082)",
    tagline: "有效期至「明天再说」。续费入口永远在下一次。",
    purchaseLine: "购买成功！今日任务已顺延，明日自有明日的奇迹。",
  },
  {
    id: "social-cloak",
    name: "社恐隐身斗篷（体验装）",
    price: 188,
    category: "curiosity",
    filter: "limited",
    emoji: "🫥",
    gradient: "linear-gradient(145deg, #eceff1, #b0bec5)",
    tagline: "聚会戴上即可降低被点名的概率，效果因胆量而异。",
    purchaseLine: "购买成功！斗篷已穿上——其实大家还是看得见你。",
  },
  {
    id: "left-on-read-charm",
    name: "已读不回护身符",
    price: 131,
    category: "curiosity",
    filter: "fun",
    emoji: "📵",
    gradient: "linear-gradient(145deg, #e0f2f1, #80cbc4)",
    tagline: "保佑聊天框永远显示「对方正在输入…」",
    purchaseLine: "购买成功！符已生效：你已读，但灵魂还没回。",
  },
  {
    id: "corporate-speak-pack",
    name: "打工人废话文学包",
    price: 55,
    category: "curiosity",
    filter: "new",
    emoji: "💼",
    gradient: "linear-gradient(145deg, #e8eaf6, #9fa8da)",
    tagline: "内含：嗯嗯、好的、收到、我拉个对齐、先这样。",
    purchaseLine: "购买成功！已自动回复：好的收到，我们拉齐一下颗粒度。",
  },
  {
    id: "quit-smoking-day0",
    name: "戒烟第 0 天纪念章",
    price: 0,
    category: "curiosity",
    filter: "limited",
    emoji: "🚭",
    gradient: "linear-gradient(145deg, #f1f8e9, #aed581)",
    tagline: "每重启一次都算新品，限量供应你自己。",
    purchaseLine: "领取成功！第 0 天也是值得庆祝的一天（大概）。",
  },
  {
    id: "ex-post-404",
    name: "前任的朋友圈快照（404）",
    price: 77,
    category: "curiosity",
    filter: "fun",
    emoji: "🚫",
    gradient: "linear-gradient(145deg, #fafafa, #bdbdbd)",
    tagline: "页面无法访问，心态意外平和。",
    purchaseLine: "购买成功！404 已缓存：不见也好，省流量。",
  },
  {
    id: "luck-bug",
    name: "运气不佳转移贴",
    price: 108,
    category: "curiosity",
    filter: "seasonal",
    emoji: "🪲",
    gradient: "linear-gradient(145deg, #fffde7, #fff59d)",
    tagline: "贴在水逆同事工位，请勿贴自己。",
    purchaseLine: "购买成功！霉运已转出，请注意不要贴反了。",
  },
  {
    id: "inspiration-empty",
    name: "灵感空瓶（可回收）",
    price: 33,
    category: "curiosity",
    filter: "new",
    emoji: "🫙",
    gradient: "linear-gradient(145deg, #e3f2fd, #90caf9)",
    tagline: "瓶身透明，装满空气，适合摆拍。",
    purchaseLine: "购买成功！空瓶到手，灵感请自行灌装。",
  },
];

export function getStoreProduct(productId: string): StoreProduct | undefined {
  const raw = STORE_PRODUCTS.find((item) => item.id === productId);
  return raw ? resolveStoreProduct(raw) : undefined;
}

export const BEHAVIOR_STORE_PRODUCTS = STORE_PRODUCTS.map(resolveStoreProduct).filter(
  (product) => product.effectType === "personality" || product.effectType === "buff",
);
