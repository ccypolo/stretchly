# Geocoding 选区功能 Plan

## 需求（已确认）
广州等大城市用城市名查询太粗。支持搜索区/镇/地标，选中后用坐标查天气。
已选坐标优先于城市名。

## BDD
1. Given 已填 API Key，输入地点并搜索 → 展示候选列表
2. Given 选中候选 → 保存 name/lat/lon，天气按坐标查询
3. Given 已保存坐标 → `_getLocation` 坐标优先
4. Given 搜索失败/无结果 → 不崩溃、不覆盖已有坐标

## 步骤
### 1. [已完成] weatherManager：Geocoding API + 坐标优先定位 + 单测
### 2. [已完成] 设置项 defaultSettings + IPC 搜索接口
### 3. [已完成] 偏好页 UI（搜索/候选/当前选区）+ i18n（en/zh-CN）
### 4. [已完成] 本地验证 + 打包 Portable
- 已生成 `dist/Stretchly Portable 1.21.0.exe`
- 用法：设置 → 天气 → 输入「天河」或「广州天河」→ 搜索 → 点选候选 → 看「已选区域」
