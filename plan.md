# IP 定位设为天气选区 Plan

## 需求（已确认）
设置页增加「使用 IP 定位」：用 IP 得到 lat/lon（及城市名），写入当前已选区域，之后按坐标查天气。

## BDD
1. Given 天气设置页，When 点击「使用 IP 定位」且成功，Then 保存 weatherLat/Lon/LocationName，界面显示已选区域
2. Given IP 定位失败，When 点击按钮，Then 显示错误提示，不覆盖已有有效选区
3. Given 已用 IP 设好坐标，When 拉取天气，Then `_getLocation` 使用该坐标（与搜索选区同一优先级）

## 步骤
### 1. [已完成] weatherManager 暴露 locateByIp 公共方法 + 单测/整理
### 2. [已完成] IPC + 偏好页按钮/文案（en/zh-CN）
### 3. [已完成] 验证 + 打包 Portable
