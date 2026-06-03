# Yarni AI · AI 桌面宠物

Windows 优先的 AI 桌面伴侣。以透明悬浮桌宠为交互入口，支持自然语言任务自动化、流式对话、拖拽文件问答，以及成长/任务/商店等陪伴式玩法。

> 核心链路：**规划 → 风险判定 → 用户确认 → 执行 → 审计**


![Platform](https://img.shields.io/badge/platform-Windows-blue)
![Stack](https://img.shields.io/badge/stack-Tauri%20%7C%20React%20%7C%20FastAPI-green)
![Version](https://img.shields.io/badge/version-0.1.0-lightgrey)
<img width="924" height="647" alt="首页" src="https://github.com/user-attachments/assets/aae83553-7911-4d60-847f-65630f694f7a" />
<img width="924" height="647" alt="成长7" src="https://github.com/user-attachments/assets/c2d623ca-7b89-45c8-82f2-a0ae80936709" />
<img width="924" height="647" alt="任务0" src="https://github.com/user-attachments/assets/f04b380d-0330-4f00-9d83-2e95986bc96b" />
<img width="924" height="647" alt="商店9" src="https://github.com/user-attachments/assets/25a49be6-db31-4085-a306-4365d0188995" />
<img width="300" height="300" alt="可爱8" src="https://github.com/user-attachments/assets/0454931d-7dcf-4dba-88a6-6f257ca51684" />

---

## 目录

- [功能概览](#功能概览)
- [技术架构](#技术架构)
- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [配置 DeepSeek](#配置-deepseek)
- [使用说明](#使用说明)
- [Agent API](#agent-api)
- [项目结构](#项目结构)
- [开发与构建](#开发与构建)
- [安全说明](#安全说明)
- [常见问题](#常见问题)

---

## 功能概览

### 悬浮桌宠

- 透明置顶小窗，系统级拖拽，托盘菜单控制显示/隐藏
- **戳一戳**：DeepSeek 生成多样化台词；连点会不耐烦；特定台词触发「躲起来」
- **拖文件问答**：将 PDF / Word / 文本拖到宠物上，描述诉求后由大模型阅读并回答
- **自主行为**：可配置游走、捣乱及触发间隔；支持 GIF 轮播与尺寸调节
- 双击打开主界面，右键快捷菜单

### AI 对话

- 接入 [DeepSeek](https://platform.deepseek.com/) 流式对话（SSE）
- 多种陪伴模式：鼓励、监督、摸鱼、规划、专注、安静等
- 可装备不同「性格」影响回复风格
- 未配置 API Key 时自动降级为本地规则回复

### 任务 Agent

- 自然语言描述需求，自动识别工具并生成执行计划
- 风险分级（低 / 中 / 高），中高风险需用户确认
- 支持紧急停止（托盘或界面触发）
- SQLite 持久化任务历史、耗时与执行证据

### 内置工具

| 工具 | 说明 |
|------|------|
| `launch_app` | 启动白名单内应用（VS Code、记事本、资源管理器等） |
| `organize_downloads` | 按类型整理「下载」文件夹 |
| `clean_desktop` | 清理桌面文件 |
| `browser_search` | 在浏览器中搜索 |
| `open_folder` | 打开指定文件夹 |
| `create_reminder` | 创建提醒 |
| `run_quick_action` | 执行用户自定义快捷动作 |
| `health_check` | 检查 Agent 与系统状态 |

### 陪伴玩法

- **任务**：待办管理、AI 任务建议、完成奖励
- **成长**：经验值、技能解锁
- **商店 / 背包**：装扮、性格、Buff 等虚拟物品（本地状态）

### 其他

- 语音输入（Web Speech API）与 TTS 播报开关
- 浏览器预览模式（无需 Rust，仅 Web UI）

---

## 技术架构

```
┌─────────────────────────────────────────────────────────┐
│  Tauri 2 (Rust)                                         │
│  ├─ 主窗口 (React)     对话 / 任务 / 成长 / 商店         │
│  └─ 悬浮窗 (React)     透明桌宠 / 拖拽 / 文件投放        │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTP (127.0.0.1:8765)
┌──────────────────────────▼──────────────────────────────┐
│  Python FastAPI Agent                                   │
│  ├─ 任务规划与执行                                       │
│  ├─ DeepSeek 流式对话 / 文件问答                         │
│  └─ SQLite 任务审计                                      │
└─────────────────────────────────────────────────────────┘
```

| 层级 | 技术 |
|------|------|
| 桌面壳层 | Tauri 2、Rust |
| 前端 | React 19、TypeScript、Vite 7 |
| 后端 | Python 3、FastAPI、Uvicorn |
| AI | DeepSeek API（OpenAI 兼容） |
| 存储 | SQLite（任务记录）、localStorage（宠物状态） |
| 文档解析 | pypdf、python-docx、pywin32（.doc） |

---

## 环境要求

| 依赖 | 版本建议 | 用途 |
|------|----------|------|
| Windows | 10 / 11 | 主要目标平台 |
| Node.js | 18+ | 前端构建 |
| Python | 3.10+ | Agent 后端 |
| Rust | 最新 stable | 桌面端（`tauri dev` / 打包） |

> 仅体验 Web UI 时可不安装 Rust，使用 `start-web.bat` 即可。

---

## 快速开始

> **注意**：请在 `ai-pet` 目录内操作，不要在上一级 `ai桌面` 目录直接运行 `npm`。

若 PowerShell 提示「禁止运行脚本」，请使用 **cmd** 或双击 `.bat` 文件；命令行中请用 `npm.cmd` 代替 `npm`。

### 方式一：双击启动（推荐）

1. **`install-deps.bat`** — 安装 Node 与 Python 依赖（首次运行）
2. **`start-agent.bat`** — 启动本地 Agent（保持窗口打开，默认 `http://127.0.0.1:8765`）
3. 二选一：
   - **`start-desktop.bat`** — Tauri 桌面端（含悬浮桌宠）
   - **`start-web.bat`** — 浏览器预览

### 方式二：命令行

```bat
cd /d 你的路径\ai-pet
npm.cmd install
python -m pip install -r backend\requirements.txt
start cmd /k start-agent.bat
npm.cmd run tauri dev
```

### 辅助脚本

| 脚本 | 说明 |
|------|------|
| `restart-agent.bat` | 重启 Agent（加载新 `.env`） |
| `kill-port-8765.bat` | 释放 Agent 端口 |
| `kill-port-1420.bat` | 释放 Vite 开发端口 |
| `kill-ai-pet.bat` | 结束相关进程 |
| `verify-env.bat` | 检查环境 |

---

## 配置 DeepSeek

1. 在 [DeepSeek 开放平台](https://platform.deepseek.com/) 创建 API Key
2. 复制环境变量模板：

```bat
copy backend\.env.example backend\.env
```

3. 编辑 `backend/.env`：

```env
DEEPSEEK_API_KEY=sk-your-key-here
DEEPSEEK_MODEL=deepseek-chat
```

4. 重启 Agent：`restart-agent.bat` 或重新运行 `start-agent.bat`

### 可选环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | API 地址 |
| `DEEPSEEK_TEMPERATURE` | `0.7` | 采样温度 |
| `DEEPSEEK_MAX_TOKENS` | `1024` | 最大输出 token |
| `DEEPSEEK_TIMEOUT` | `60` | 请求超时（秒） |
| `AI_PET_PORT` | `8765` | Agent 监听端口 |
| `FILE_CHAT_MAX_BYTES` | `80000` | 文件上下文最大字符 |
| `FILE_CHAT_MAX_PDF_PAGES` | `40` | PDF 最大解析页数 |

主界面进入 **对话** 后，标题显示 `DeepSeek 对话` 表示大模型已接入。

---

## 使用说明

### 悬浮桌宠操作

| 操作 | 效果 |
|------|------|
| 左键拖动 | 移动宠物（系统级拖拽） |
| 单击 | 戳一戳，宠物说话 |
| 双击 | 打开主界面 |
| 右键 | 关闭悬浮窗 / 打开主界面 |
| 拖入文件 | 弹出诉求输入，AI 阅读文件并回答 |
| 托盘图标 | 显示/隐藏悬浮窗、打开主界面、紧急停止 |

### 文件问答支持格式

- **PDF**（`.pdf`）— 文本型 PDF；扫描版需先 OCR
- **Word**（`.docx`）— 原生支持；老版 `.doc` 需本机安装 Microsoft Word
- **文本 / 代码** — `.txt`、`.md`、`.json`、`.py` 等常见格式

### 自然语言任务示例

```
帮我打开 VS Code
整理下载文件夹
搜索 React 最佳实践
检查一下 Agent 状态
```

中高风险任务（如整理下载目录）会弹出确认；可随时通过托盘 **紧急停止** 中断执行。

### 宠物资源

- 默认 GIF 放在 `public/` 目录（如 `chongwu.gif`）
- 主界面 **悬浮宠物** 面板可：调节大小、管理 GIF 列表、开启轮播（默认 30 秒切换）
- 运行 `npm run pet:gif` 可从视频生成轻量 GIF

---

## Agent API

Base URL：`http://127.0.0.1:8765`

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/status` | Agent 状态、运行中任务、对话提供商 |
| `POST` | `/plan` | 解析指令，返回任务计划与风险等级 |
| `POST` | `/execute` | 执行任务（高风险需 `approved: true`） |
| `POST` | `/stop` | 紧急停止 |
| `GET` | `/history` | 任务历史（`?limit=20`） |
| `POST` | `/chat` | 非流式对话 |
| `POST` | `/chat/stream` | SSE 流式对话 |
| `POST` | `/chat/file/stream` | 带文件上下文的流式对话 |
| `POST` | `/pet/poke` | 戳一戳台词生成 |
| `POST` | `/pet/bubble` | 宠物气泡文案 |
| `POST` | `/tasks/suggest` | AI 任务建议 |

### 示例：规划并执行任务

```bash
# 1. 规划
curl -X POST http://127.0.0.1:8765/plan \
  -H "Content-Type: application/json" \
  -d "{\"command\": \"打开记事本\"}"

# 2. 执行（低风险任务可直接 approved）
curl -X POST http://127.0.0.1:8765/execute \
  -H "Content-Type: application/json" \
  -d "{\"task_id\": \"<返回的 task_id>\", \"approved\": true}"
```

---

## 项目结构

```
ai-pet/
├── src/                    # React 前端
│   ├── App.tsx             # 主界面（首页 / 商店 / 成长 / 任务）
│   ├── FloatingPet.tsx     # 悬浮桌宠窗口
│   ├── components/         # 页面与设置组件
│   ├── api/                # Agent HTTP 客户端
│   └── data/               # 本地状态与游戏化数据
├── src-tauri/              # Tauri 桌面壳（Rust）
│   └── src/lib.rs          # 窗口、托盘、拖拽、紧急停止
├── backend/                # Python Agent
│   ├── main.py             # FastAPI 入口与工具执行
│   ├── deepseek.py         # DeepSeek 客户端
│   ├── document_extract.py # PDF / Word / 文本解析
│   ├── file_context.py     # 文件上下文组装
│   └── pet_poke.py         # 戳一戳台词
├── public/                 # 静态资源（GIF、图片）
├── scripts/                # 辅助脚本
├── *.bat                   # Windows 一键启动脚本
├── index.html              # 主窗口入口
└── pet.html                # 悬浮窗入口
```

---

## 开发与构建

```bat
# 仅前端开发（浏览器，端口 1420）
npm.cmd run dev

# 仅 Agent
npm.cmd run dev:agent

# Tauri 开发（前端 + 桌面壳 + 悬浮窗）
npm.cmd run tauri dev

# 生产构建
npm.cmd run build
npm.cmd run tauri build
```

前端开发服务器固定端口 **1420**，Agent 固定端口 **8765**。

---

## 安全说明

- **白名单**：仅允许启动预设应用；浏览器搜索限定常用域名
- **敏感词拦截**：命中 `password`、`wallet`、`payment`、`bank` 等关键词的任务标记为高风险
- **确认机制**：中 / 高风险任务必须用户显式批准后才执行
- **紧急停止**：随时可通过托盘或 Tauri 事件中断执行
- **本地优先**：Agent 仅监听 `127.0.0.1`，不对外暴露
- **密钥安全**：切勿将 `.env` 或 API Key 提交到 Git

> `organize_downloads` 会移动「下载」目录中的文件，建议先在测试环境验证。

---

## 常见问题

**Q：Agent 启动提示端口占用？**  
A：说明 Agent 已在运行。需要重载配置时用 `restart-agent.bat`，或先 `kill-port-8765.bat` 再启动。

**Q：对话没有走 DeepSeek？**  
A：检查 `backend/.env` 是否配置 `DEEPSEEK_API_KEY`，并重启 Agent。首页对话标题应显示 `DeepSeek 对话`。

**Q：拖 PDF 进去没有内容？**  
A：可能是扫描版 PDF（图片），需 OCR 或转为可选中文本的 PDF。

**Q：PowerShell 无法运行 npm？**  
A：使用 cmd，或将 `npm` 改为 `npm.cmd`；也可直接双击项目内的 `.bat` 脚本。

**Q：桌面端启动失败？**  
A：确认已安装 [Rust 工具链](https://www.rust-lang.org/tools/install)。若只需看 UI，先用 `start-web.bat`。

---

## License

本项目为个人学习 / 演示用途。如需开源许可证，请自行添加 `LICENSE` 文件。
