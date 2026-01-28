# WPS365 Channel Plugin

Clawdbot 的 WPS365 开放平台频道插件，支持通过 WPS 协作机器人接收和发送消息。

## 前置要求

1. 在 [WPS 开发者后台](https://open.wps.cn/developer/home) 创建应用
2. 获取以下凭证：
   - **App ID** (client_id)
   - **App Secret** (client_secret)
   - **Company ID** (企业 ID)
3. 配置应用权限：`kso.chat_message.readwrite`（查询和管理会话消息）
4. 配置事件订阅（如需接收消息）

## 安装

```bash
# 通过 npm 安装
clawdbot extensions install @clawdbot/wps

# 或从本地安装（开发时）
clawdbot extensions install ./extensions/wps
```

## 配置

在 `~/.clawdbot/config.json` 中添加以下配置：

```json
{
  "channels": {
    "wps": {
      "enabled": true,
      "appId": "your-app-id",
      "appSecret": "your-app-secret",
      "companyId": "your-company-id",
      "baseUrl": "https://openapi.wps.cn",
      "webhook": {
        "path": "/wps/webhook",
        "port": 3000
      },
      "dmPolicy": "pairing",
      "allowFrom": [],
      "groupPolicy": "allowlist",
      "groups": {}
    }
  }
}
```

### 配置项说明

| 配置项 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `enabled` | boolean | 否 | `true` | 是否启用 WPS 频道 |
| `appId` | string | 是 | - | WPS 应用 ID (client_id) |
| `appSecret` | string | 是 | - | WPS 应用密钥 (client_secret) |
| `companyId` | string | 是 | - | WPS 企业 ID |
| `baseUrl` | string | 否 | `https://openapi.wps.cn` | WPS API 基础 URL |
| `enableEncryption` | boolean | 否 | `true` | 是否启用事件加密解密 |
| `webhook.path` | string | 否 | `/wps/webhook` | Webhook 接收路径 |
| `webhook.port` | number | 否 | `3000` | Webhook 监听端口 |
| `dmPolicy` | string | 否 | `pairing` | 私聊策略：`open`/`allowlist`/`pairing` |
| `allowFrom` | string[] | 否 | `[]` | 允许的用户 ID 列表 |
| `groupPolicy` | string | 否 | `allowlist` | 群聊策略：`open`/`allowlist` |
| `groups` | object | 否 | `{}` | 群聊配置 |

### DM 策略说明

- **`open`**：接受所有人的消息（不推荐）
- **`allowlist`**：仅接受 `allowFrom` 列表中用户的消息
- **`pairing`**：新用户需要通过配对码验证（推荐）

## 事件加密

WPS 事件订阅默认启用加密。收到的事件会经过以下处理：

1. **签名验证**: 使用 `HMAC-SHA256(appSecret, "appId:topic:nonce:time:encrypted_data")` 验证签名
2. **数据解密**: 使用 `AES-128-CBC` 解密，密钥为 `MD5(appSecret)`，IV 为 `nonce`

如果需要禁用加密验证（仅用于调试），设置 `enableEncryption: false`。

## 配置事件订阅

要接收用户消息，需要在 WPS 开发者后台配置事件订阅：

1. 进入应用管理 → 事件订阅
2. 配置回调地址：`https://your-domain.com/wps/webhook`
3. 订阅消息接收事件

### Webhook URL 格式

```
https://<your-domain>:<port><path>
```

示例：`https://bot.example.com:3000/wps/webhook`

## 运行

启动 Clawdbot Gateway 后，WPS 频道会自动启动：

```bash
clawdbot gateway run
```

检查频道状态：

```bash
clawdbot channels status
```

## 发送消息

通过 CLI 发送消息：

```bash
# 发送到会话
clawdbot message send --channel wps --target <chat_id> --message "Hello!"

# 发送到用户（需要用户 ID）
clawdbot message send --channel wps -t <user_id> -m "Hello!"
```

## API 参考

### 消息发送

- **单条消息**：`POST /v7/messages/create`
- **批量消息**：`POST /v7/messages/batch_create`

详细文档：
- [发送消息](https://open.wps.cn/documents/app-integration-dev/wps365/server/im/message/single-create-msg)
- [事件订阅](https://open.wps.cn/documents/app-integration-dev/wps365/server/im/event/receive-msg)

## 故障排除

### 凭证未配置

```
WPS credentials not configured (appId, appSecret, and companyId required)
```

确保在配置文件中正确设置了 `appId`、`appSecret` 和 `companyId`。

### Token 获取失败

```
Failed to get WPS access token: 401
```

检查 `appId` 和 `appSecret` 是否正确，以及应用是否已授权给目标企业。

### 消息发送失败

```
WPS send error (code xxx): ...
```

常见错误码：
- `403`：权限不足，检查应用权限配置
- `404`：目标用户或会话不存在
- `429`：请求频率超限

## 开发

```bash
# 安装依赖
cd extensions/wps
pnpm install

# 类型检查
pnpm build

# 在主项目中测试
cd ../..
pnpm clawdbot channels status
```