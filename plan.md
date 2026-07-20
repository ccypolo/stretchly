# 方案 1：托盘/菜单改用 emoji 图 Plan

## 需求（已确认）
- 托盘图标、右键菜单图标：emoji 栅格化位图（同源）
- 悬停 tooltip：继续 emoji 文字
- 渲染优先运行时 canvas（Segoe UI Emoji）；失败回退 OWM PNG → 手绘
- OWM 官方 PNG 暂保留作回退

## BDD
1. Given icon=`10d`，When 看托盘/菜单/悬停，Then 均为雨类 emoji 语义且一致
2. Given emoji 渲染失败，When 更新托盘，Then 回退且托盘不消失
3. Given trayIconStyle=time，When 天气启用，Then emoji 底图 + 分钟角标仍可读

## 步骤
### 1. [已完成] emoji→PNG 渲染工具 + 单测（`weatherEmoji.js`）
### 2. [已完成] 托盘天气模式改用 emoji 图（`renderWeatherBuffer` 优先 emoji）
### 3. [已完成] 右键菜单改用同一套 emoji 图（`weatherMenuNativeIcon`）
### 4. [已完成] 打包 Portable 验收
- 已生成 `dist/Stretchly Portable 1.21.0.exe`
- 请用户确认：托盘 / 右键 / 悬停均为同一套 emoji 语义
