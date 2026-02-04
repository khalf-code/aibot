# OpenClaw DingTalk Channel Plugin

钉钉消息渠道插件，支持私聊、群聊消息，支持 AI Card 流式输出。

## 原始项目信息

- **原项目**: [moltbot-china](https://github.com/BytePioneer-AI/moltbot-china)
- **版本**: 0.1.14
- **许可证**: MIT

## 功能特性

- 文本消息收发
- Markdown 消息支持
- 流式响应 (AI Card)
- 图片/文件收发
- 语音消息支持
- 私聊和群聊支持
- @机器人检测
- Stream 长连接模式

## 配置

```bash
openclaw config set channels.dingtalk '{
  "enabled": true,
  "clientId": "dingxxxxxx",
  "clientSecret": "your-app-secret",
  "enableAICard": true
}' --json
```

## 配置项说明

| 配置项           | 类型    | 说明                               |
| ---------------- | ------- | ---------------------------------- |
| `enabled`        | boolean | 是否启用                           |
| `clientId`       | string  | 钉钉应用 Client ID (AppKey)        |
| `clientSecret`   | string  | 钉钉应用 Client Secret (AppSecret) |
| `enableAICard`   | boolean | 是否启用 AI Card 流式输出          |
| `dmPolicy`       | string  | 私聊策略: open/pairing/allowlist   |
| `groupPolicy`    | string  | 群聊策略: open/allowlist/disabled  |
| `requireMention` | boolean | 群聊中是否需要 @机器人             |
| `maxFileSizeMB`  | number  | 媒体文件大小限制 (MB)              |

## 使用说明

1. 访问 [钉钉开放平台](https://open.dingtalk.com/) 创建企业内应用
2. 获取 Client ID 和 Client Secret
3. 配置机器人权限
4. 配置 OpenClaw 并重启网关

## License

MIT
