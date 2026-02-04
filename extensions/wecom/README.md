# OpenClaw WeCom (WeChat Work) Channel Plugin

企业微信智能机器人回调插件，通过公网 HTTPS 回调接收消息。

## 原始项目信息

- **原项目**: [moltbot-china](https://github.com/BytePioneer-AI/moltbot-china)
- **版本**: 0.1.3
- **许可证**: MIT

## 功能特性

- 文本消息收发
- Markdown 消息支持
- 流式响应 (stream 回调)
- 图片/文件接收
- 语音消息接收 (语音转文本)
- 私聊和群聊支持
- 多账户支持
- HTTPS 回调模式

## 注意事项

- 企业微信仅支持被动回复模式，不支持主动发送消息
- `webhookPath` 必须为公网 HTTPS 可访问路径
- `encodingAESKey` 必须为 43 位字符

## 配置

```bash
openclaw config set channels.wecom '{
  "enabled": true,
  "webhookPath": "/wecom",
  "token": "your-token",
  "encodingAESKey": "your-43-char-encoding-aes-key"
}' --json
```

## 配置项说明

| 配置项           | 类型    | 说明                              |
| ---------------- | ------- | --------------------------------- |
| `enabled`        | boolean | 是否启用                          |
| `webhookPath`    | string  | Webhook 路径                      |
| `token`          | string  | 企业微信 Token                    |
| `encodingAESKey` | string  | 企业微信 EncodingAESKey (43位)    |
| `dmPolicy`       | string  | 私聊策略: open/pairing/allowlist  |
| `groupPolicy`    | string  | 群聊策略: open/allowlist/disabled |

## 使用说明

1. 登录 [企业微信管理后台](https://work.weixin.qq.com/)
2. 创建自建应用或机器人
3. 配置回调 URL、Token 和 EncodingAESKey
4. 配置 OpenClaw 并重启网关

## License

MIT
