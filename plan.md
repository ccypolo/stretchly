# 彩云天气可选数据源 Plan

## 需求（已确认）
设置可切换 OpenWeatherMap / 彩云；彩云用 v2.6 Token + 综合 weather 接口；必须有效坐标。

## BDD
1. Given 数据源=彩云且 Token+坐标有效，When 刷新，Then 托盘/菜单显示彩云实况与预报
2. Given 彩云缺 Token 或坐标，When 刷新，Then 不乱请求，可理解失败
3. Given 数据源=OWM，When 照旧配置，Then 行为不变
4. Given 切换数据源或保存彩云 Token，When 保存，Then 触发刷新

## 步骤
### 1. [已完成] 设置项 + 偏好页：数据源下拉、彩云 Token
### 2. [已完成] weatherManager 彩云拉取/解析/skycon 映射 + 单测
### 3. [已完成] 验证 + 打包 Portable
