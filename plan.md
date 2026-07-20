# 官方 OWM 图标统一方案 Plan

## 需求（待确认 BDD）

**Given** 天气已启用且拿到当前天气 icon code（如 `10d`）  
**When** 查看系统托盘图标与托盘弹出菜单中的当前天气行  
**Then** 两边使用**同一份** OpenWeatherMap 官方图标资源（同一 `icon` → 同一 PNG），视觉一致（菜单行带该图标，托盘图标也是该图）

**Given** 天气为晴朗 / 多云 / 下雨等不同 code  
**When** 天气切换  
**Then** 托盘图标与菜单图标同步切换为对应 OWM 图

**Given** 本地缺少某个 icon 文件或加载失败  
**When** 渲染托盘/菜单  
**Then** 回退到现有 canvas/emoji 行为，不崩溃

**Given** 托盘样式为 time/progress  
**When** 天气启用  
**Then** 仍以 OWM 图标为底，叠加数字/进度（与现逻辑一致）

## 方案要点（推荐）

1. **本地打包官方图标**（不每次联网拉 CDN）  
   - 路径：`app/images/weather-icons/{code}.png`（及可选 `@2x`）  
   - URL 来源规范：`https://openweathermap.org/img/wn/{code}@2x.png`  
   - 覆盖 `01d/01n` … `50d/50n` 共 18 张
2. **托盘**：`trayIconRenderer` 天气模式改为加载上述 PNG，不再用手绘天气符号作为主图
3. **弹出菜单**：当前天气 `MenuItem` 设置 `icon: NativeImage`（同源文件），文案去掉 emoji，仅保留温度与描述  
4. **缓存**：按 icon code 缓存 NativeImage；`weatherUpdated` 时刷新托盘与菜单

## 不在本次范围

- 不做独立 BrowserWindow 天气弹窗（除非你明确要求）
- 预报摘要行仍可用文字/emoji（系统菜单每行仅一个 icon，优先保证「当前天气」与托盘一致）

## 步骤

### 1. [已完成] 引入 OWM 图标资源与加载工具
- 下载并纳入 `app/images/weather-icons/`（18 张 `@2x` PNG）
- 实现 `owmIconPath(code)` / `isValidOwmIconCode` 等
- TDD：路径解析、非法 code、文件存在性
- 验证：`test/owmIcons.js` 6 项通过

### 2. [未开始] 托盘改为使用 OWM 图标
- `renderTrayIcon` 天气分支改用官方 PNG（可叠加 time/progress）
- 保留非法/缺失时的回退
- 验证：单测 + 本地看托盘图为 OWM 风格

### 3. [未开始] 菜单与托盘同源图标
- `getTrayMenuTemplate` 当前天气项设置 `icon`，去掉 emoji
- `weatherUpdated` 刷新链路确认
- 验证：菜单图标与托盘为同一资源

### 4. [未开始] 打包 Portable 并目视验收
- 构建 `Stretchly Portable`，对比托盘与菜单
- 验证：晴/多云/雨切换时两者一致

## 待你确认

1. BDD / 步骤是否按上面执行？  
2. 弹出菜单是否接受 **系统菜单 + MenuItem.icon**（不做独立小窗口）？  
3. 图标是否同意 **本地打包**（推荐），而不是运行时从 openweathermap.org 拉取？
