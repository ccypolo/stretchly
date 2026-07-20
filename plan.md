# 托盘天气图标与菜单不一致修复 Plan

## 需求（已确认 BDD）
1. Given 天气为下雨（`09x`/`10x`），When 看托盘图标，Then 能清楚看出「云+雨」，不能像纯多云
2. Given 天气为晴朗/多云，When 看托盘图标，Then 分别显示晴朗/多云，且与托盘菜单一致
3. Given 天气从多云变为下雨（或反过来），When `weatherUpdated`，Then 托盘图标随之切换

## 步骤

### 1. [已完成] 修复雨点绘制 bug 并提升小尺寸可读性
- 修复 `_drawRainDrops` 运算符优先级（雨点被画到图标顶部）
- 加粗/改用斜线雨滴，确保 16–32px 托盘可读
- TDD：先写失败测试，再改实现
- 验证：`test/trayIconRenderer.js` 3 项通过；32px 暗色下雨图可见云+蓝斜线

### 2. [进行中] 确认天气更新后托盘图标刷新链路
- 确认 `weatherUpdated` → `clearCache` + `updateTray` + `trayIconCacheKey` 含 `weatherIcon`
- 如有缺口再补；无缺口则验证现有逻辑
- 验证：相关单测/静态检查通过

### 3. [未开始] 本地验证并重新打包 Portable
- 跑相关测试 + lint
- 重新打包 `Stretchly Portable`，用新包验证托盘图标与菜单一致
- 验证：测试绿 + 新 Portable 可用

## 根因摘要
`const y = cy + i % 2 === 0 ? 0 : w * 0.06` 因运算符优先级变成 `((cy + i%2) === 0) ? 0 : w*0.06`，雨点画在约 y=1px，视觉上只剩云。
