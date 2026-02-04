# OpenClaw QQ Bot Channel Plugin

QQ 开放平台官方机器人 API 的 OpenClaw 渠道插件，支持 C2C 私聊、群聊 @消息、频道消息。

## 原始项目信息

- **原项目**: [qqbot](https://github.com/sliverp/qqbot)
- **版本**: 1.2.3
- **许可证**: MIT

## 功能特性

- **多场景支持**：C2C 单聊、QQ 群 @消息、频道公开消息、频道私信
- **自动重连**：WebSocket 断连后自动重连，支持 Session Resume
- **消息去重**：自动管理 `msg_seq`，支持对同一消息多次回复
- **系统提示词**：可配置自定义系统提示词注入到 AI 请求
- **错误提示**：AI 无响应时自动提示用户检查配置

## 支持的消息类型

| 事件类型                  | 说明             | Intent    |
| ------------------------- | ---------------- | --------- |
| `C2C_MESSAGE_CREATE`      | C2C 单聊消息     | `1 << 25` |
| `GROUP_AT_MESSAGE_CREATE` | 群聊 @机器人消息 | `1 << 25` |
| `AT_MESSAGE_CREATE`       | 频道 @机器人消息 | `1 << 30` |
| `DIRECT_MESSAGE_CREATE`   | 频道私信         | `1 << 12` |

## 配置

### 获取 QQ 机器人凭证

1. 访问 [QQ 开放平台](https://q.qq.com/)
2. 创建机器人应用
3. 获取 `AppID` 和 `AppSecret`

### 配置方式

```bash
openclaw channels add --channel qqbot --token "AppID:AppSecret"
```

或手动编辑 `~/.openclaw/openclaw.json`：

```json
{
  "channels": {
    "qqbot": {
      "enabled": true,
      "appId": "你的AppID",
      "clientSecret": "你的AppSecret",
      "systemPrompt": "你是一个友好的助手"
    }
  }
}
```

## 配置项说明

| 配置项             | 类型    | 必填 | 说明                                    |
| ------------------ | ------- | ---- | --------------------------------------- |
| `appId`            | string  | 是   | QQ 机器人 AppID                         |
| `clientSecret`     | string  | 是\* | AppSecret，与 `clientSecretFile` 二选一 |
| `clientSecretFile` | string  | 是\* | AppSecret 文件路径                      |
| `enabled`          | boolean | 否   | 是否启用，默认 `true`                   |
| `name`             | string  | 否   | 账户显示名称                            |
| `systemPrompt`     | string  | 否   | 自定义系统提示词                        |

## 注意事项

1. **群消息**：需要在群内 @机器人 才能触发回复
2. **沙箱模式**：新创建的机器人默认在沙箱模式，需要添加测试用户

## 相关链接

- [QQ 机器人官方文档](https://bot.q.qq.com/wiki/)
- [QQ 开放平台](https://q.qq.com/)
- [API v2 文档](https://bot.q.qq.com/wiki/develop/api-v2/)

## License

MIT
