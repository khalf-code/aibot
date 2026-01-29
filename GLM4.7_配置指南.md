# GLM-4.7 模型配置指南

## 📋 配置总览

**模型选择**: GLM-4.7 (Z.AI)
**优势**: 性价比最高、工具调用优秀、编程能力强
**Provider**: zai
**API端点**: https://api.z.ai/v1

---

## 🔑 步骤1: 获取 Z.AI API 密钥

### 注册和获取密钥

1. 访问 **https://www.z.ai/**
2. 注册账号（支持手机号或邮箱）
3. 进入控制台/Dashboard
4. 创建 API 密钥
5. 复制密钥（格式类似：`sk-...`）

### 价格参考（Z.AI GLM-4.7）
- 输入: ¥0.015/千tokens
- 输出: ¥0.06/千tokens
- 上下文窗口: 200K tokens

**性价比对比**:
- Claude Sonnet 4.5: ¥0.03/千tokens (输入)，约 **2倍贵**
- GPT-4: ¥0.3/千tokens (输入)，约 **20倍贵**

---

## 🔧 步骤2: 配置环境变量

### 方法1: 通过配置向导（推荐）

运行配置向导时会自动生成环境变量文件，您只需要编辑：

```bash
./setup-whatsapp-config.sh
# 完成后编辑生成的环境变量文件
nano ~/.clawdbot/env.sh
```

在文件中找到这一行：
```bash
export ZAI_API_KEY="your-zai-api-key-here"
```

替换为您的实际密钥：
```bash
export ZAI_API_KEY="sk-your-actual-key-from-zai"
```

### 方法2: 手动设置（临时）

```bash
export ZAI_API_KEY="sk-your-actual-key-from-zai"
```

### 方法3: 添加到 .bashrc（永久）

```bash
echo 'export ZAI_API_KEY="sk-your-actual-key-from-zai"' >> ~/.bashrc
source ~/.bashrc
```

---

## ✅ 步骤3: 验证配置

### 检查环境变量是否设置

```bash
echo $ZAI_API_KEY
# 应该显示您的API密钥
```

### 检查配置文件

```bash
cat ~/.clawdbot/clawdbot.json | grep model
# 应该显示: "model": "zai/glm-4.7"
```

---

## 🚀 步骤4: 启动服务

### 首次启动（需要扫描二维码）

```bash
./start-jarvis-whatsapp.sh
```

### 预期输出

```
╔════════════════════════════════════════════╗
║                                            ║
║   🦞 贾维斯 Bot (Jarvis Bot)              ║
║   WhatsApp 安全启动                        ║
║                                            ║
╚════════════════════════════════════════════╝

基于 Moltbot 安全加固版本
单用户模式 | 网络白名单 | 审计日志

...

⚠ 首次启动说明：
1. 启动后会显示一个二维码
2. 打开手机WhatsApp
3. 进入 设置 > 已连接的设备 > 连接设备
4. 扫描终端中显示的二维码
5. 连接成功后即可开始使用
```

---

## 📊 模型能力说明

### GLM-4.7 核心能力

| 功能 | 支持度 | 说明 |
|------|--------|------|
| 文本对话 | ⭐⭐⭐⭐⭐ | 中英文双语，中文表现优秀 |
| 工具调用 | ⭐⭐⭐⭐⭐ | Function calling 支持完善 |
| 代码生成 | ⭐⭐⭐⭐⭐ | 编程能力强，适合开发任务 |
| 长上下文 | ⭐⭐⭐⭐ | 200K tokens 上下文窗口 |
| 图像理解 | ❌ | 不支持（需要使用 GLM-4V） |
| 推理模式 | ❌ | 标准模型，无思考链 |

### 如需图像理解

如果需要处理图片，可以配置 fallback 到支持图像的模型：

```json5
{
  "agents": {
    "defaults": {
      "model": "zai/glm-4.7",
      "imageModel": {
        "primary": "zai/glm-4v-plus"
      }
    }
  }
}
```

---

## 🔄 切换其他模型（可选）

### 在聊天中临时切换

```
/model list                    # 查看可用模型
/model moonshot/kimi-k2.5      # 切换到 Kimi K2
/model status                  # 查看当前模型状态
```

### 永久修改配置文件

编辑 `~/.clawdbot/clawdbot.json`：

```json5
{
  "agents": {
    "defaults": {
      "model": "moonshot/kimi-k2.5"  // 改为其他模型
    }
  },
  "models": {
    "providers": {
      "moonshot": {
        "baseUrl": "https://api.moonshot.ai/v1",
        "apiKey": "${MOONSHOT_API_KEY}",
        "api": "openai-completions",
        "models": [{"id": "kimi-k2.5", "name": "Kimi K2.5"}]
      }
    }
  }
}
```

---

## ⚠️ 常见问题

### Q1: API密钥无效

**错误信息**: `401 Unauthorized` 或 `Invalid API key`

**解决方法**:
1. 检查环境变量是否正确设置: `echo $ZAI_API_KEY`
2. 确认密钥没有多余的空格或引号
3. 在 Z.AI 控制台重新生成密钥

### Q2: 模型不可用

**错误信息**: `Model "zai/glm-4.7" is not allowed`

**解决方法**:
1. 检查配置文件中 model 字段是否正确
2. 运行 `moltbot models list` 查看可用模型
3. 确认 ZAI_API_KEY 已设置

### Q3: 网络连接失败

**错误信息**: `ECONNREFUSED` 或 `ETIMEDOUT`

**解决方法**:
1. 检查网络连接
2. 确认可以访问 https://api.z.ai
3. 检查防火墙设置

---

## 📈 性能优化建议

### 成本控制

1. **使用 GLM-4.7 而非 GLM-4-Plus**
   - GLM-4.7: 标准价格
   - GLM-4-Plus: 价格更高，性能提升有限

2. **合理设置上下文长度**
   ```json5
   {
     "agents": {
       "defaults": {
         "model": "zai/glm-4.7",
         "maxTokens": 4096  // 降低输出长度减少成本
       }
     }
   }
   ```

3. **启用 Fallback 机制**
   ```json5
   {
     "agents": {
       "defaults": {
         "model": {
           "primary": "zai/glm-4.7",
           "fallbacks": ["zai/glm-4.6"]  // 备用模型
         }
       }
     }
   }
   ```

---

## 🔒 安全提示

1. **保护 API 密钥**
   - 不要提交到 Git
   - 不要分享给他人
   - 定期轮换密钥

2. **网络白名单已配置**
   - 系统已启用网络白名单
   - 只允许访问 api.z.ai 等安全域名
   - 所有网络请求都有审计日志

3. **单用户模式**
   - 仅您的 WhatsApp 手机号可以控制 Bot
   - 其他号码的消息会被自动拒绝
   - 审计日志位置: `~/.clawdbot/security-audit.log`

---

## 📚 相关文档

- [Z.AI 官方文档](https://www.z.ai/docs)
- [Moltbot 模型配置](docs/concepts/models.md)
- [用户手册](JARVIS_USER_MANUAL.md)
- [测试报告](TEST_REPORT.md)

---

**配置时间**: 2026-01-28
**系统版本**: Moltbot 2026.1.27-beta.1
**安全等级**: 企业级（5层防护）
