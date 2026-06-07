# Design System — Novel Crawler Console

## Product Context
- **What this is:** 后台管理 web 平台，给开发者管理小说爬虫任务（书库/任务/日志/章节）
- **Who it's for:** 1 人开发者 + 偶有协作；技术用户，重效率，不重好看
- **Space/industry:** 内部工具 / DevTool / CLI 控制台
- **Project type:** Admin Dashboard（单页 web app）

## Aesthetic Direction
- **Direction:** "Operator Console" — 终端机风，数据密度高，单色为主，靠状态色传递信息
- **Decoration level:** minimal
- **Mood:** 像 htop / k8s dashboard / Vercel Logs — 紧凑、即时、可信
- **Reference sites:** Vercel Observability, Linear, Grafana, lazygit, btop

## Typography
- **Display/Hero:** `Inter` 600 — UI 默认无衬线
- **Body:** `Inter` 400/500 — 通用文本
- **UI/Labels:** `Inter` 500 — 按钮 / 标签
- **Data/Tables:** `JetBrains Mono` 400 — 数字 / 路径 / 日志（tabular-nums）
- **Code:** `JetBrains Mono` 400 — 内联代码块
- **Loading:** Google Fonts CDN: `Inter` + `JetBrains Mono`
- **Scale:** 11(footnote) 12(caption) 13(body-sm) 14(body) 16(h3) 20(h2) 24(h1) 32(hero)
- **Line-height:** body 1.5, mono 1.45, headings 1.2

## Color
- **Approach:** restrained — 1 个主色 + 状态色 + 中性灰阶
- **Primary:** `#7C5CFF` (electric violet) — 选中 / 主操作 / 链接
- **Secondary:** `#22D3EE` (cyan) — 信息高亮 / URL
- **Neutrals (dark mode 主):**
  - bg-0 `#0B0D12` 页面底
  - bg-1 `#11141B` 卡片
  - bg-2 `#171B25` 悬浮 / 行交替
  - border `#222836`
  - text-hi `#E6E9F2`
  - text-mid `#A6ADC0`
  - text-lo `#5B6377`
- **Neutrals (light mode 备用):**
  - bg-0 `#F7F8FA` / bg-1 `#FFFFFF` / border `#E4E7EE`
  - text-hi `#0B0D12` / mid `#4A5160` / lo `#8A92A2`
- **Semantic:**
  - success `#34D399` (绿)
  - warning `#FBBF24` (琥珀)
  - error   `#F87171` (红)
  - info    `#60A5FA` (蓝)
  - queued  `#5B6377` (灰)
  - running `#7C5CFF` (紫)
- **Dark mode:** 主推。token 全部以 CSS 变量定义，`:root[data-theme="dark"]` 默认 / `light` 切。

## Spacing
- **Base unit:** 4px
- **Density:** compact（后台场景）
- **Scale:** 1(4) 2(8) 3(12) 4(16) 5(20) 6(24) 8(32) 10(40) 12(48) 16(64)
- **行高:** 表格行 32px，控件 28px，卡片内边距 16px

## Layout
- **Approach:** grid-disciplined — 固定侧栏 + 主内容
- **Grid:**
  - 侧栏 224px 固定（折叠 56px）
  - 主内容 max-width 不限（数据表铺满）
  - 表格列宽 `auto + 1fr + 固定数字列`
- **Border radius:** 2 (badge) / 4 (input) / 6 (card) / 8 (modal) — 小而克制

## Motion
- **Approach:** minimal-functional — 仅状态变化
- **Easing:** `ease-out` (enter) / `ease-in` (exit) / `linear` (进度条)
- **Duration:** micro 80ms (hover) / short 160ms (modal/drawer) / medium 240ms (页面切换)
- **不用 spring/overshoot**

## Components (项目内必用)
- **Topbar:** logo + 主题切换 + 状态指示（运行中 N）
- **Sidebar:** 导航 (Dashboard / Books / Tasks / Logs / Settings)
- **Table:** zebra rows, sticky header, 行 hover 切 bg-2, 行内 monospace 数字右对齐
- **Status badge:** 圆点 + 文字，5 状态颜色映射
- **Button:** primary / ghost / danger 三态，loading 时变 spinner
- **Input:** 单线 1px border，focus ring 用 primary @ 30% alpha
- **Toast:** 右上角堆叠，3s 自动消失
- **Log stream:** 全宽 console，monospace，自动滚到底，新行高亮 1.5s 后褪色

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-02 | 用 `design-consultation` 流程作骨架 | 用户指定 `front-desgin-3` 不存在；最接近替代 |
| 2026-06-02 | 默认 dark mode | 后台/控制台用户更习惯暗色 |
| 2026-06-02 | 数据/路径用 JetBrains Mono | 等宽对齐，长路径不换行难看 |
| 2026-06-02 | 全部用 CSS 变量 + CSS Modules | 便于 DESIGN token 化，不引 Tailwind |
