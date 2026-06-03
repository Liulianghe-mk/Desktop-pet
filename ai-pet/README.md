# AI Desktop Pet (Windows MVP)

Windows 优先的 AI 桌面宠物实现，核心是自然语言任务自动化（规划 -> 风险判定 -> 确认 -> 执行 -> 审计）。

## Features

- 桌宠壳层：悬浮窗口、托盘菜单、宠物状态机（待机/思考/执行/完成/异常）
- Agent 闭环：`/plan`, `/execute`, `/status`, `/stop`, `/history`
- 工具集（MVP）：`launch_app`, `organize_downloads`, `browser_search`, `health_check`
- 安全护栏：risk 分级、allowlist/denylist、高风险确认、紧急停止
- 可观测性：SQLite 任务记录、执行耗时、结果证据
- 语音增强：语音输入（Web Speech API）与 TTS 播报开关

## Run (Windows 推荐)

**先进入项目目录**：`cd ai-pet`（不要在上一级 `ai桌面` 里直接跑 npm）

若 PowerShell 报「禁止运行脚本」，请用 **cmd** 或双击下面的 `.bat`，不要用 `npm`，改用 `npm.cmd`。

1. 双击 `install-deps.bat`（安装依赖，只需一次）
2. 双击 `start-agent.bat`（保持窗口开着；若提示端口占用，说明 Agent 已在运行，或用 `restart-agent.bat` 重启）
3. 二选一：
   - 桌面端：双击 `start-desktop.bat`（需已安装 [Rust](https://www.rust-lang.org/tools/install)）
   - 浏览器预览：双击 `start-web.bat`

命令行方式（cmd）：

```bat
cd /d C:\Users\liu\Desktop\ai桌面\ai-pet
npm.cmd install
python -m pip install -r backend\requirements.txt
start cmd /k start-agent.bat
npm.cmd run tauri dev
```

## 悬浮 GIF 桌宠

启动桌面端后会自动出现**透明悬浮小窗**（`yarni-pet.gif` 轻量循环动画）：

- **拖动**：按住宠物左键拖动（使用系统级拖拽）
- **戳一戳**：轻点宠物会说话（由 **DeepSeek** 生成多样化台词，未配置密钥时用本地文案）；连点多次会越来越不耐烦；台词含「躲起来」等词会躲到屏幕角落
- **无聊自主行动**：主界面右侧可开关「游走 / 捣乱」及触发间隔；长时间不互动时悬浮宠物会自己挪动并说话
- **拖文件**：从桌面/资源管理器把文件拖到悬浮宠物上，松开后写下诉求，由 **DeepSeek** 阅读文件内容并回答（需已启动 Agent 并配置 `DEEPSEEK_API_KEY`）
  - 支持 **PDF**、**Word（.docx）**、常见文本代码文件；老版 **.doc** 需本机安装 Word
  - **扫描版 PDF**（图片）无法直接识别文字，需先 OCR 或转成可选中文本的 PDF
- **双击**：打开主界面
- **右键**：菜单 →「关闭悬浮宠物」或「打开主界面」
- **托盘菜单**：「显示/隐藏悬浮宠物」

资源文件：

- `public/chongwu.gif` — 悬浮窗动画（当前使用）
- `public/yarni-pet.png` — 静态备用图
- **GIF 轮播**：主界面「悬浮宠物」里可开关自动轮播；列表中有 2 个以上 GIF 时按间隔依次切换（默认 30 秒）

## AI 对话（DeepSeek）

1. 在 [DeepSeek 开放平台](https://platform.deepseek.com/) 创建 API Key
2. 复制 `backend/.env.example` 为 `backend/.env`（或项目根目录 `.env`）
3. 填入密钥：

```env
DEEPSEEK_API_KEY=sk-xxxxxxxx
DEEPSEEK_MODEL=deepseek-chat
```

4. 安装/更新 Python 依赖并重启 Agent：

```bat
python -m pip install -r backend\requirements.txt
start-agent.bat
```

5. 首页点击 **对话**，标题栏会显示 `DeepSeek 对话` 表示已接入大模型；未配置密钥时使用本地规则回复。

可选环境变量：`DEEPSEEK_BASE_URL`、`DEEPSEEK_TEMPERATURE`、`DEEPSEEK_MAX_TOKENS`、`DEEPSEEK_TIMEOUT`。

## Notes

- 高风险任务默认要求确认，且支持托盘或界面触发紧急停止。
- `organize_downloads` 会整理 `Downloads` 目录，建议先在测试环境运行。
- **请勿将 `.env` 或 API Key 提交到 Git。**
