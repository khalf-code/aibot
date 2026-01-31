# Feishu (Lark)

[Feishu](https://www.feishu.cn/) (international name: Lark) is an enterprise collaboration platform. OpenClaw integrates with Feishu via the **Custom App (Bot)** mechanism.

> **Note**: This integration supports both Feishu (China) and Lark (International).

## 🚀 Quick Start

### 1. Create a Feishu App

1. Go to [Feishu Developer Console](https://open.feishu.cn/app).
2. Click **"Create Custom App"** (创建企业自建应用).
3. Fill in the name (e.g., "OpenClaw Bot") and description.
4. Go to **"Features" > "Bot"** (添加应用能力 > 机器人) and click **"Add Bot"**.

### 2. Configure Permissions

In **"Permissions & Scopes"** (权限管理), search and add the following permissions:

| Permission Name | Key | Reason |
| :--- | :--- | :--- |
| **Messaging** | `im:message` | Send messages |
| **Read DMs** | `im:message.p2p_msg:readonly` | Receive direct messages |
| **Group Info** | `im:chat` | Read group names/info |
| **Group Members** | `im:chat.members:read` | Read group member list |
| **User Info** | `contact:user.base:readonly` | Resolve sender names |
| **Resources** | `im:resource` | Upload images/files |

> ⚠️ **Important**: After adding permissions, you MUST go to **"Version Management & Release"** (版本管理与发布) and **create/release a new version** for changes to take effect.

### 3. Configure Events

1. Go to **"Events & Callbacks"** (事件与回调).
2. **Encryption Strategy**: 
   - Recommended: Leave Encrypt Key empty for simplicity initially.
   - If you set it, you must configure `encryptKey` in OpenClaw.
3. **Verification Token**: Copy this value.
4. **Event Subscription**: Click "Add Event" and select:
   - `im.message.receive_v1` (Receive messages)

> **Connection Mode**: 
> OpenClaw supports **Long Connection** (WebSocket), which requires NO public IP/Webhook URL. This is recommended for local/intranet deployment.

### 4. Configure OpenClaw

Run the setup wizard:

```bash
openclaw onboard
```

Or edit `~/.openclaw/openclaw.json` manually:

```json
{
  "channels": {
    "feishu": {
      "enabled": true,
      "accounts": {
        "my_bot": {
          "appId": "cli_a...",
          "appSecret": "...",
          "useLongConnection": true
        }
      }
    }
  }
}
```

## Running

```bash
# Start the gateway
openclaw gateway run
```

## Troubleshooting

- **Error 99991672 (Permission Denied)**: You missed adding a permission or didn't release the app version.
- **WebSocket Disconnects**: Ensure only ONE instance of the bot is running (Long connection limit).
