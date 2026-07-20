# 托盘图标不可见修复 Plan

## 现象
启用天气后运行 Portable，托盘图标完全看不到。日志有 weather updated，无显式 tray 错误；`showTrayIcon: true`。

## 根因（待验证修复）
1. `trayIconRenderer` 用 `@napi-rs/canvas` `loadImage(asar文件路径)` 加载 OWM PNG；原生加载不走 Electron asar 虚拟 FS，天气到达后 `trayIconImage()` 抛错 → `updateTray` 失败 → 托盘未创建或未更新
2. `getTrayMenuTemplate` 含 `NativeImage` 后 `JSON.stringify` 可能抛错/异常，进一步打断 `updateTray`
3. `updateTray` 无 try/catch，失败时日志不明显

## BDD
**Given** 天气已启用且图标在 asar 内  
**When** 启动应用并完成天气刷新  
**Then** 系统托盘始终可见，且显示 OWM 天气图（或安全回退到 canvas 天气图）

**Given** OWM PNG 加载失败  
**When** 渲染托盘  
**Then** 回退 canvas，不导致托盘消失

## 步骤
### 1. [已完成] 修复 OWM 图标加载（readFileSync→Buffer→loadImage）+ 回退 + updateTray 容错
### 2. [已完成] 菜单模板比较不再 JSON.stringify NativeImage
### 3. [已完成] 本地验证并重打包 Portable
- 已重打包 `dist/Stretchly Portable 1.21.0.exe`
- weather-icons 已 asarUnpack；图标经 Buffer 加载
- 请用户重启 Portable 确认托盘可见
