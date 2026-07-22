# 手动指定经纬度 Plan

## 需求（已确认 A+C）
设置页增加纬度/经度输入框 +「应用坐标」；成功后写入选区并清空搜索结果列表。

## BDD
1. Given 填入合法 lat/lon，When 点「应用坐标」，Then 保存 weatherLat/Lon，名称用 `lat, lon`，显示已选区域，清空搜索结果
2. Given 坐标非法，When 点应用，Then 提示错误，不覆盖已有有效选区
3. Given 已用手填坐标，When 拉天气，Then `_getLocation` 使用该坐标（与搜索/IP 同优先级）

## 步骤
### 1. [已完成] 偏好页 lat/lon 输入 + 应用按钮 + 校验/文案（en/zh-CN）
### 2. [进行中] 验证 + 打包 Portable
