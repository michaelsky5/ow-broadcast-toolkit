OWBT｜守望先锋社区赛事通用导播工具设计说明
1. 项目定位

OWBT，全称 OW Community Broadcast Toolkit，是一个专门服务《守望先锋》社区赛事的网页端导播视觉工具。

它的目标不是做一个完整的赛事后台，也不是做报名系统、裁判系统、数据统计平台，而是解决社区赛事最常见的直播包装问题：

如何让一个普通 OW 社区赛，在没有专业电视台资源的情况下，也能快速拥有稳定、好看、可自定义的导播画面。

它继承薯条杯导播工具的核心经验：控制台负责控制，Overlay 负责播出，OBS 负责最终捕获与推流。旧工具 README 中也明确将系统分为 Console Workspace、Overlay Scene 和 State Bus 三层，其中控制台负责编辑和切场，Overlay 只负责接收状态并渲染干净的 16:9 画面。

2. 设计目的

OWBT 的设计目的可以概括为四句话：

1. 降低 OW 社区赛导播门槛。
2. 提供一套可复用的赛事视觉包装系统。
3. 让导播工具从“薯条杯专用”变成“任意 OW 社区赛可套用”。
4. 保留薯条杯式高质感电竞视觉风格，但移除薯条杯固定内容。

也就是说，OWBT 不是简单把薯条杯导播工具换个颜色，而是要把旧工具中已经验证过的工作流抽象出来：

控制台操作
↓
项目状态保存
↓
Overlay 实时渲染
↓
OBS Browser Source 捕获
↓
直播画面输出
3. 目标用户

OWBT 的核心用户不是职业赛事导播团队，而是：

OW 社区赛事主办方
校园赛组织者
民间杯赛导播
小型线上赛制作组
拥有基础 OBS 使用能力的赛事志愿者

这些用户的共同特点是：

1. 可能没有复杂技术背景。
2. 需要快速搭建直播包装。
3. 赛事视觉预算有限。
4. 大多数比赛没有完整数据系统。
5. 更需要稳定、直观、可手动控制的工具。

所以 OWBT 第一版必须优先保证：

稳定
简单
好看
容易配置
不需要改代码
OBS 接入清晰

而不是优先追求复杂数据自动化。

4. 产品边界

OWBT 只做这些：

1. OW 社区赛事导播控制台
2. OBS Overlay 画面输出
3. 单场比赛对阵设置
4. 队伍、选手、解说数据库
5. 比分、地图、FT 赛制显示
6. 场景切换
7. 主题色、Logo、背景等视觉自定义
8. 项目本地保存、导入、导出
9. 内置 OW 英雄、地图、职责、模式数据

OWBT 第一版不做这些：

1. 报名系统
2. 裁判系统
3. 赛事规则合法性判断
4. 自动赛程管理
5. 自动积分榜
6. 自动数据统计
7. OBS WebSocket 深度控制
8. 远程 Broadcast Room
9. 云端同步
10. 视频 / 高光 / 封面 / 数据图文完整系统

这些功能不是永远不能做，而是不能进入 v0.1 的核心范围。旧薯条杯工具确实包含 Stats、Data Graphics、Video、Broadcast Cover、Shortcuts 等完整模块，但这些属于更完整的赛事工作站能力，不应该一开始全部迁移进 OWBT。

5. 设计方向

OWBT 的设计方向不是“泛电竞导播工具”，而是：

守望先锋社区赛事专用导播视觉系统

这意味着：

1. 不兼容 LOL、无畏契约、Dota、格斗游戏。
2. 不做抽象化到所有项目的比赛模型。
3. 直接内置 OW 英雄、地图、职责、模式。
4. 优先适配 OW 社区赛事的真实导播流程。

守望先锋相关数据应该作为内置数据层存在，例如：

英雄：坦克 / 输出 / 支援
地图：控制 / 运载 / 混合 / 推进 / 闪点 / 冲突
比赛：FT1 / FT2 / FT3 / FT4
显示：当前地图、比分、攻防方、首发五人

旧工具的资源规范里也已经形成了英雄头像、阵容英雄图、地图背景等按 OW 数据分类存放的方式，这个方向可以延续，但 OWBT 应该采用更干净的路径和数据结构。

6. 核心架构方向

OWBT 应该保留三层架构：

Console App
Overlay App
Project State Bus
Console App

负责：

编辑项目
设置主题
管理队伍
管理选手
设置当前比赛
切换场景
控制比分
控制地图
导出项目
Overlay App

负责：

读取当前项目状态
渲染当前 activeScene
保持 1920×1080 或 3840×2160 输出比例
给 OBS Browser Source 捕获
不显示控制 UI
不承担编辑逻辑
Project State Bus

负责：

本地保存
跨窗口同步
刷新恢复
项目导入导出
未来可扩展远程同步

第一版 State Bus 不需要复杂远程房间系统，但必须保证：

控制台修改后，#overlay 不刷新也能同步。

这是导播工具的基础能力。

7. 数据结构方向

旧薯条杯工具大量使用扁平字段，例如：

teamA
teamB
scoreA
scoreB
globalScene
mapLineup
rosterPlayersA
rosterPlayersB

OWBT 不应该继续使用这种结构。OWBT 应该使用更适合开源和通用配置的嵌套项目结构：

project
├─ meta
├─ event
├─ theme
├─ overwatch
├─ teams
├─ players
├─ casters
├─ currentMatch
├─ scenes
└─ output

这样做的好处是：

1. 赛事信息、视觉信息、队伍数据、当前比赛数据互不污染。
2. 后续导入导出项目更清晰。
3. 未来可以做版本迁移。
4. Codex 或其他开发者更容易理解数据边界。
8. 场景系统方向

OWBT 不做固定赛事模板。
不同社区赛流程差异很大，所以应该做：

Scene Library 场景库

用户可以自己决定启用哪些场景，而不是选择“学院赛模板”“决赛模板”。

v0.1 优先场景：

OpeningScene        开场动画
MatchupScene        对阵页
StartingFiveScene   首发五人
CurrentMapScene     当前地图
LiveHudScene        实时比分 HUD
PauseScene          暂停提示
ResultScene         赛后比分
ThanksScene         感谢观看

后续再加入：

CasterScene
MapPoolScene
RosterScene
MVPScene
ChampionScene
InterviewScene
LowerThird
Ticker
DataGraphics
BroadcastCover

旧工具已经覆盖 Live HUD、Map Pool、Roster、Caster、Countdown、Stats、Data Graphics 等大量场景能力，这些可以作为后续迁移参考，但 v0.1 只保留完成一场比赛所需的最小闭环。

9. 视觉方向

OWBT 应该保留薯条杯的视觉基因：

黑底
高对比
大字号
强主色
电竞包装感
锐利边框
光效
舞台感
紧凑但有压迫力的信息布局

但必须去除薯条杯固定内容：

FRIES CUP 固定文案
固定黄色
固定队伍
固定 Logo
固定赛事阶段
固定宣传语

所有视觉相关内容都应该走主题系统：

theme.primary
theme.background
theme.panel
theme.text
theme.mutedText
theme.primaryGlow
theme.primaryBorder
theme.backgroundImage

用户应该只设置一个主色，系统自动生成衍生颜色。这样其他社区赛可以快速拥有自己的赛事识别，而不是看起来像“薯条杯换皮”。

10. v0.1 开发优先级

第一阶段只追求一个目标：

可以完整导播一场 OW 社区赛。

v0.1 必须完成：

1. 项目初始化
2. 项目自动保存
3. 项目导入 / 导出
4. Console / Overlay 实时同步
5. 主题色设置
6. 队伍数据库
7. 选手数据库
8. 当前比赛设置
9. FT1 / FT2 / FT3 / FT4
10. 比分控制
11. 当前地图选择
12. 场景注册系统
13. 基础场景渲染
14. OBS Overlay 地址

v0.1 暂缓：

1. Pro Mode / Basic Mode
2. Broadcast Room
3. OBS WebSocket
4. 快捷键
5. Undo / Snapshot
6. 数据图文
7. 视频系统
8. 高光系统
9. 封面生成
10. 多语言完整支持

旧工具已经包含自动保存、Undo、Snapshot、Import / Export、Blob 清理等数据安全机制，这些对 OWBT 很有价值，但可以分阶段迁移，不应该在同步稳定前全部引入。

11. 给 Codex 的开发原则

你可以直接把这一段放进 docs/OWBT_DEV_NOTES.md：

# OWBT Development Principles

OWBT is an Overwatch community broadcast toolkit.

## Core Scope

- Only for Overwatch community tournaments.
- Single-match broadcast workflow first.
- Keep reusable team/player/caster database.
- Do not implement registration, referee logic, tournament rules, schedule management, or automatic stats in v0.1.

## Architecture

- Console route: /
- Overlay route: /#overlay
- Console edits project state.
- Overlay renders the active scene.
- OBS captures Overlay with Browser Source.
- State must persist in localStorage.
- Overlay must sync without refresh.

## Data Model

Keep the nested project structure:

- project.meta
- project.event
- project.theme
- project.overwatch
- project.teams
- project.players
- project.casters
- project.currentMatch
- project.scenes
- project.output

Do not revert to the old Fries Cup flat data structure.

## Visual Direction

Keep the Fries Cup-inspired esports broadcast style:
- dark background
- strong accent color
- high contrast
- large typography
- glow and border effects
- 16:9 broadcast layout

But remove all fixed Fries Cup branding.

## v0.1 Priorities

1. Stable Console / Overlay sync.
2. Project localStorage persistence.
3. Project import/export.
4. Scene registry.
5. Theme tokens.
6. OpeningScene.
7. MatchupScene.
8. StartingFiveScene.
9. CurrentMapScene.
10. LiveHudScene.

## Do Not Add Yet

- OBS WebSocket
- Broadcast Room
- Pro Mode / Basic Mode
- Stats system
- Video system
- Highlight system
- Cover generator
- Data graphics
- Full shortcut system
- Full i18n
- Remote sync server
12. 一句话总结

OWBT 的方向应该是：

把薯条杯导播工具中最有价值的“赛事视觉包装与导播工作流”抽离出来，重新做成一个更干净、更稳定、更容易配置的守望先锋社区赛事通用导播工具。

不是做一个更大的薯条杯工具，也不是做一个泛电竞平台。
它应该先成为一个 稳定、漂亮、可自定义、OBS 友好、任何 OW 社区赛都能快速套用 的导播视觉系统。
