# DeepSeek 大模型配置指南

本文档说明如何在 OpenClaw 中配置 DeepSeek API。

## 获取 API 密钥
1. 访问 [DeepSeek 开放平台](https://platform.deepseek.com/)
2. 注册并登录您的账户
3. 在 API Keys 页面创建新的 API 密钥

## 配置步骤

### 方式一：环境变量
在您的环境中设置 `DEEPSEEK_API_KEY`：

```bash
export DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxx
```

### 方式二：配置文件
在 `~/.openclaw/openclaw.json` 中添加以下配置：

```json
{
  "models": {
    "providers": {
      "deepseek": {
        "baseUrl": "https://api.deepseek.com/v1",
        "apiKey": "sk-xxxxxxxxxxxxxxxxxx",
        "api": "openai-responses",
        "models": [
          {
            "id": "deepseek-chat",
            "name": "DeepSeek Chat (V3.2)",
            "contextWindow": 64000,
            "maxTokens": 8000
          },
          {
            "id": "deepseek-reasoner",
            "name": "DeepSeek Reasoner (V3.2 思考模式)",
            "reasoning": true,
            "contextWindow": 64000,
            "maxTokens": 8000
          }
        ]
      }
    }
  }
}
```

## 使用模型

配置完成后，您可以在 OpenClaw 中使用以下模型标识符：

- `deepseek/deepseek-chat` - 标准对话模型（无思考模式）
- `deepseek/deepseek-reasoner` - 推理模型（启用思考模式）

示例：

```bash
openclaw chat --model deepseek/deepseek-chat "你好，请介绍一下自己"
```

## 定价说明

DeepSeek V3.2 定价（以每百万 tokens 计）：

**deepseek-chat** (非思考模式):
- 输入：$0.14/M tokens
- 输出：$0.28/M tokens  
- 缓存读取：$0.014/M tokens
- 缓存写入：$0.14/M tokens

**deepseek-reasoner** (思考模式):
- 输入：$0.55/M tokens
- 输出：$2.19/M tokens

## 注意事项

1. DeepSeek API 完全兼容 OpenAI API 格式
2. 推荐使用 `deepseek-chat` 进行日常对话
3. 对于复杂推理任务，使用 `deepseek-reasoner`

## 故障排查

如果遇到问题，请检查：
1. API 密钥是否正确设置
2. 网络是否能访问 `api.deepseek.com`
3. 配置文件 JSON 格式是否正确

更多信息请访问 [DeepSeek API 文档](https://platform.deepseek.com/docs)。
