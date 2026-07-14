# 天气功能实现计划

## 需求概述
为 Stretchly 添加实时天气功能：
1. IP 自动定位获取用户位置
2. 通过 OpenWeatherMap API 查询实时天气
3. 在系统托盘菜单和休息窗口中显示天气
4. 工作日下午下班时间（可设置），若下雨则弹窗提醒带伞
5. 其他时间若有恶劣天气（降水/大风/极端温度/雾霾沙尘）及时提醒

## BDD 验收条件

### 场景1：自动定位
- Given 天气功能已启用且未设置城市
- When 应用启动
- Then 通过 IP 地理定位服务获取用户位置坐标
- And 坐标保存到设置中，后续天气查询使用此坐标

### 场景2：手动设置城市覆盖
- Given 天气功能已启用
- When 用户在偏好设置中输入城市名
- Then 使用用户指定的城市查询天气，而非自动定位结果

### 场景3：托盘菜单显示天气
- Given 天气功能已启用
- When 用户点击系统托盘图标打开菜单
- Then 菜单顶部显示当前天气图标+温度+描述（如 "🌧 26°C 小雨"）

### 场景4：休息窗口显示天气
- Given 天气功能已启用
- When 休息窗口（微休息/长休息）弹出
- Then 窗口中显示当前天气信息

### 场景5：下班下雨提醒
- Given 天气功能已启用，下班时间设为 17:30，工作日为周一至周五
- When 到达工作日下班时间
- And 当前天气为降雨（小雨及以上）
- Then 弹出系统通知："外面在下雨，记得带伞！"

### 场景6：恶劣天气及时提醒
- Given 天气功能已启用
- When 天气查询检测到恶劣条件（暴雨/大雪/冰雹/6级以上大风/35°C以上或-10°C以下/雾霾沙尘暴）
- Then 在下一次天气刷新后（≤30分钟内）弹出系统通知提醒

### 场景7：离线处理
- Given 天气功能已启用
- When 网络不可用
- Then 天气信息显示为"无法获取"，不弹窗报错，下次网络恢复后自动恢复

## 技术方案

### 天气数据源
- **API**: OpenWeatherMap（免费版，1000次/天，60次/分钟）
- **定位**: ip-api.com（免费，无需 Key，45次/分钟，精确到城市级）
- **刷新频率**: 每 10 分钟查询一次（约 144次/天，远低于限额）
- **离线缓存**: 保存最近一次成功获取的天气数据，离线时显示缓存+时间戳

### 恶劣天气判断标准（基于 OpenWeatherMap weather condition codes）
- **降水**: ID 2xx（雷暴）、3xx（毛毛雨除外 300-302）、5xx（雨）、6xx（雪）
- **大风**: wind.speed > 10.8 m/s（6级）
- **极端温度**: temp > 35°C 或 temp < -10°C
- **雾霾沙尘**: ID 7xx（除 701 薄雾、721 霭）

### 新增设置项（defaultSettings）
```
weatherEnabled: false          // 天气功能开关，默认关闭
weatherApiKey: ''              // OpenWeatherMap API Key
weatherCity: ''                // 手动指定城市（为空则自动定位）
weatherOffWorkTime: '17:30'    // 下班时间（HH:mm）
weatherWorkdays: [1,2,3,4,5]   // 工作日（1=周一...7=周日）
weatherAlertTypes: {           // 提醒类型开关
  precipitation: true,
  wind: true,
  extremeTemp: true,
  fogDust: true
}
```

### 新增文件
| 文件 | 用途 |
|------|------|
| `app/utils/weatherManager.js` | 天气管理器：定位、查询、缓存、提醒判断 |

### 修改文件
| 文件 | 修改内容 |
|------|----------|
| `app/utils/defaultSettings.js` | 添加天气相关设置项 |
| `app/main.js` | 集成 WeatherManager，更新托盘菜单，添加 IPC 处理 |
| `app/tray.js` | 托盘菜单添加天气显示行 |
| `app/preferences.html` | 偏好设置页添加天气设置区域 |
| `app/preferences-renderer.js` | 处理天气设置 UI 交互 |
| `app/break.html` | 休息窗口添加天气显示区域 |
| `app/microbreak.html` | 微休息窗口添加天气显示区域 |
| `app/breaksPlanner.js` | 下班时间提醒调度 |
| `locales/en.json` | 英文翻译 |
| `locales/zh-CN.json` | 中文翻译 |

## 实施步骤

### 步骤1：创建 weatherManager.js 核心模块 `[已完成]`
- 实现 IP 定位（ip-api.com）
- 实现 OpenWeatherMap API 调用
- 实现天气数据缓存
- 实现恶劣天气判断逻辑
- 实现下班下雨提醒判断逻辑
- 编写单元测试
- **验证**: 单元测试通过

### 步骤2：添加天气相关设置项 `[已完成]`
- 修改 defaultSettings.js 添加新设置项
- **验证**: 现有测试不受影响

### 步骤3：集成 WeatherManager 到 main.js `[已完成]`
- 初始化 WeatherManager
- 添加 IPC 通道供渲染进程查询天气
- 实现定时刷新和提醒调度
- **验证**: 应用可正常启动，无报错

### 步骤4：系统托盘菜单显示天气 `[已完成]`
- 修改托盘菜单逻辑，顶部添加天气信息行
- 天气不可用时显示占位文本
- **验证**: 托盘菜单正确显示天气信息

### 步骤5：休息窗口显示天气 `[已完成]`
- 在 break.html 和 microbreak.html 中添加天气显示区域
- 通过 IPC 从主进程获取天气数据
- **验证**: 休息窗口正确显示天气

### 步骤6：下班下雨提醒 `[已完成]`
- 在 WeatherManager 中实现下班时间检查
- 到达下班时间且下雨时弹出系统通知
- **验证**: 模拟场景下正确触发提醒

### 步骤7：恶劣天气及时提醒 `[已完成]`
- 每次天气刷新时检查恶劣条件
- 条件满足时弹出系统通知
- 同一恶劣条件不重复提醒（状态变化才重新提醒）
- **验证**: 模拟场景下正确触发提醒

### 步骤8：偏好设置 UI `[已完成]`
- 在偏好设置页添加天气设置区域
- 包括：开关、API Key、城市、下班时间、工作日、提醒类型
- **验证**: 所有设置可正常保存和加载

### 步骤9：国际化翻译 `[已完成]`
- en.json 和 zh-CN.json 添加天气相关翻译
- **验证**: 中英文切换正常

### 步骤10：Lint 和测试通过 `[已完成]`
- 运行 lint 确保零警告
- 所有测试（含新增）通过
- **验证**: lint 0 warnings, 270 tests pass (7 Electron-dependent tests skipped due to environment)

## 风险与注意事项
1. **API Key 安全**: OpenWeatherMap API Key 存储在本地 electron-store 中，不上传至任何服务
2. **隐私**: IP 定位仅获取粗略坐标，不收集用户精确位置
3. **网络依赖**: 天气功能需要网络，离线时优雅降级
4. **API 限额**: 30分钟刷新频率下，每天约 48 次调用，远低于免费限额
5. **新增依赖**: 不引入新 npm 包，使用 Node.js 内置 fetch API（Electron 环境支持）
