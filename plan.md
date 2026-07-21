# Geocoding 选区功能 Plan

## 需求（待确认）
广州等大城市用城市名查询太粗。支持搜索区/镇/地标，选中后用坐标查天气。

## BDD（已草案）
1. **Given** 已填 API Key，输入「广州天河」并点搜索  
   **When** Geocoding 返回候选  
   **Then** 列表展示名称 + 大致位置（国家/州），可选中一项

2. **Given** 选中某候选  
   **When** 保存设置  
   **Then** 写入 `weatherLocationName`、`weatherLat`、`weatherLon`；后续天气/预报用 lat/lon 查询

3. **Given** 已保存坐标  
   **When** `_getLocation`  
   **Then** 坐标优先于城市名字符串；清空选区后回退城市名 → 旧 pos → IP

4. **Given** 搜索无结果或 API 失败  
   **When** 展示错误/空状态  
   **Then** 不崩溃，不覆盖已有有效坐标

## 方案要点
- OWM Geocoding：`/geo/1.0/direct?q=...&limit=5&appid=...`
- 新设置：`weatherLat`、`weatherLon`、`weatherLocationName`（显示用）
- 设置页：城市输入 +「搜索」按钮 + 候选列表；显示当前选中区域
- `weatherManager._getLocation`：有有效 lat/lon 则 `{ lat, lon }`，否则沿用现逻辑
- IPC：`weather-geocode-search(query)` 主进程代理请求（密钥不进渲染层明文以外的新暴露面；沿用已有 key）

## 不在本次范围
- 地图点选
- 系统 GPS 精定位（可后续加）
- 删除 `weatherCity` 字段（保留作搜索关键词/兼容）

## 步骤
### 1. [已完成] weatherManager：Geocoding API + 坐标优先定位 + 单测
### 2. [已完成] 设置项 defaultSettings + IPC 搜索接口
### 3. [进行中] 偏好页 UI（搜索/候选/当前选区）+ i18n（en/zh-CN）
### 4. [未开始] 本地验证 + 打包 Portable

## 请确认
1. BDD / 步骤是否按上面执行？  
2. 坐标与城市名冲突时：**已选坐标优先**（推荐）可以吗？
