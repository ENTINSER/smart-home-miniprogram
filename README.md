# 智能监测2 · 智能家居综合管理小程序

零预算可演示版（Demo）：模拟数据驱动，无需真实硬件即可完整演示产品逻辑。

## 项目结构

```
smart-home-miniprogram/
├── miniprogram/            # 微信小程序（原生开发）
│   ├── pages/index/        # 首页：设备卡片列表，安全设备置顶红标
│   ├── pages/control/      # 设备控制页：空调滑块/窗帘开关/水量与运行状态
│   ├── components/         # alert-modal：告警全屏强打断弹窗
│   ├── utils/              # mqtt 连接层、设备模型、告警调度
│   ├── utils/wxmqtt.js     # 自研极简 MQTT 客户端（wx.connectSocket）
│   └── config/index.js     # 全局配置（Broker 地址、模板 ID 等）
├── cloudfunctions/         # 云函数（login 登录 / pushAlarm 推送预留）
└── tools/mock-devices/     # Node.js 模拟设备脚本
```

## 快速开始

### 1. 启动本机 EMQX

```bash
# 方式一：Docker（推荐）
docker run -d --name emqx -p 1883:1883 -p 8083:8083 -p 18083:18083 emqx/emqx:5

# 方式二：Homebrew
brew install emqx && emqx start
```

> EMQX 默认开启 1883（TCP）与 8083（WebSocket）。管理后台 http://localhost:18083 （默认账号 admin / public）。

### 2. 启动模拟设备脚本

```bash
cd tools/mock-devices
npm install
npm start
```

### 3. 打开小程序

微信开发者工具 → 导入本目录（已内置 AppID）→ 确认「详情 → 本地设置 → 不校验合法域名」已勾选 → 编译。

真机调试时，把 `miniprogram/config/index.js` 中 `MQTT_URL` 的 `localhost` 改成本机局域网 IP。

### 4. 触发告警演示

```bash
cd tools/mock-devices
npm run alarm:gas       # 天然气泄漏
npm run alarm:intruder  # 外人闯入
```

小程序内将弹出全屏告警（红闪 + 振动 + 提示音），同一告警 5 分钟内不重复提醒。

## 微信云开发开通步骤（首次）

1. 打开微信开发者工具，导入本项目
2. 点击工具栏「云开发」按钮 → 弹窗中点击「开通」
3. 同意协议 → 填写环境名称（如 `smart-home-dev`）→ 选择「按量付费」（有免费额度，Demo 量级不会扣费）
4. 等待约 1 分钟创建完成，进入「设置」复制**环境 ID**
5. 把环境 ID 填入 `miniprogram/config/index.js` 的 `CLOUD_ENV_ID`，并取消 `app.js` 中 `wx.cloud.init` 的注释
6. 右键 `cloudfunctions/login` → 「上传并部署：云端安装依赖」

## 订阅消息（预留）

- 模板：设备报警通知 `o5E_ThqAtqpXgOL73YI7AaaXrpM-XRnkrTpHvrxn_Uw`
- 个人主体仅支持一次性订阅：用户授权一次只能推送一条
- 正式推送链路：EMQX 规则引擎 Webhook → HTTP 触发 `pushAlarm` 云函数 → `cloud.openapi.subscribeMessage.send`

## 协议

MIT
