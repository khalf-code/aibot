# OpenClaw Feishu/Lark Channel Plugin

飞书/Lark 消息渠道插件，支持私聊、群聊消息。

## 原始项目信息

- **原项目**: [moltbot-china](https://github.com/BytePioneer-AI/moltbot-china)
- **版本**: 0.1.5
- **许可证**: MIT

## 功能特性

- 文本消息收发
- Markdown 消息支持
- 图片/文件接收
- 私聊和群聊支持
- @机器人检测
- WebSocket 长连接模式

## 配置

```bash
openclaw config set channels.feishu '{
  "enabled": true,
  "appId": "cli_xxxxxx",
  "appSecret": "your-app-secret",
  "sendMarkdownAsCard": true
}' --json
```

## 配置项说明

| 配置项               | 类型    | 说明                              |
| -------------------- | ------- | --------------------------------- |
| `enabled`            | boolean | 是否启用                          |
| `appId`              | string  | 飞书应用 App ID                   |
| `appSecret`          | string  | 飞书应用 App Secret               |
| `sendMarkdownAsCard` | boolean | 是否将 Markdown 作为卡片发送      |
| `dmPolicy`           | string  | 私聊策略: open/pairing/allowlist  |
| `groupPolicy`        | string  | 群聊策略: open/allowlist/disabled |
| `requireMention`     | boolean | 群聊中是否需要 @机器人            |

## 使用说明

1. 访问 [飞书开放平台](https://open.feishu.cn/) 创建应用
2. 开启机器人能力，使用「长连接接收消息」模式
3. 获取 App ID 和 App Secret
4. 配置 OpenClaw 并重启网关

## License

MIT
