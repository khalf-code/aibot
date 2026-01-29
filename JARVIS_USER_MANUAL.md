# 🦞 贾维斯 Bot (Jarvis Bot) 用户手册

**版本**: v1.0
**生成日期**: 2026年1月28日
**基于项目**: Moltbot 安全加固版

---

## 📖 目录

1. [快速开始](#快速开始)
2. [日常使用](#日常使用)
3. [安全功能说明](#安全功能说明)
4. [常用命令示例](#常用命令示例)
5. [日志查看方法](#日志查看方法)
6. [故障排查](#故障排查)
7. [配置参考](#配置参考)
8. [高级功能](#高级功能)

---

## 🚀 快速开始

### 首次部署（一次性配置）

#### 步骤1: 安装依赖

```bash
cd D:\项目库\MOLTBOT助理
pnpm install  # 或 npm install
```

**预计时间**: 5-10分钟（取决于网络速度）

---

#### 步骤2: 创建 Telegram Bot

1. 打开 Telegram 应用
2. 搜索 **@BotFather**
3. 发送 `/newbot`
4. 按提示设置：
   - Bot 名称（如：贾维斯助理）
   - Bot 用户名（如：MyJarvisBot）
5. 复制获得的 **Bot Token**（格式：`123456789:ABCdefGHI...`）

---

#### 步骤3: 获取您的 Telegram ID

1. 在 Telegram 搜索 **@userinfobot**
2. 发送任意消息
3. 复制您的 **数字ID**（如：`123456789`）

---

#### 步骤4: 运行配置向导

```bash
./setup-telegram-config.sh
```

按照提示输入：
- Bot Token
- 您的 Telegram ID

配置向导将自动：
- ✅ 计算安全哈希
- ✅ 生成配置文件
- ✅ 设置权限
- ✅ 创建环境变量

---

#### 步骤5: 启动服务

```bash
./start-jarvis-safe.sh
```

**预期输出**：
```
========================================
  🦞 贾维斯 Bot (Jarvis Bot) 安全启动
========================================

步骤1: 加载环境变量
✓ 找到环境变量文件: /home/user/.clawdbot/env.sh

...

正在启动服务...
Gateway listening on ws://127.0.0.1:18789
Telegram channel connected
```

---

#### 步骤6: 与 Bot 对话

1. 打开 Telegram
2. 搜索您创建的 Bot
3. 发送 `/start`
4. 发送 `你好`

**预期响应**: Bot 应该回复您！

---

### 日常启动（已配置后）

每次使用只需一条命令：

```bash
cd D:\项目库\MOLTBOT助理
./start-jarvis-safe.sh
```

---

### 停止服务

在运行窗口按 **Ctrl+C** 即可安全停止。

---

## 💬 日常使用

### 基本对话

直接在 Telegram 与 Bot 对话即可，支持：

- ✅ **自然语言问答**
  ```
  你: 今天天气怎么样？
  Bot: [AI响应]
  ```

- ✅ **代码编写**
  ```
  你: 用Python写一个计算斐波那契数列的函数
  Bot: [生成代码]
  ```

- ✅ **数据分析**
  ```
  你: 分析这段文本的情感倾向
  Bot: [分析结果]
  ```

---

### 本地电脑控制

贾维斯 Bot 可以控制您的本地电脑执行任务：

#### 文件操作

```
你: 创建一个名为 test.txt 的文件
你: 读取 D:\文档\报告.txt 的内容
你: 列出桌面上的所有文件
```

#### 应用程序控制

```
你: 打开记事本
你: 打开浏览器访问 https://www.baidu.com
你: 关闭记事本
```

#### 系统信息

```
你: 显示系统信息
你: 检查磁盘空间
你: 查看正在运行的进程
```

#### 数据处理

```
你: 将CSV文件转换为Excel格式
你: 批量重命名文件夹中的图片
你: 压缩这个文件夹
```

---

### 命令格式规范

对于需要明确路径的操作，建议使用完整路径：

```
✅ 推荐: 打开 D:\项目\代码\main.py
❌ 不推荐: 打开主文件（可能造成歧义）
```

---

## 🔒 安全功能说明

### 1. 单用户授权（最重要！）

**功能**: 仅允许您本人控制 Bot，其他人无法使用。

**工作原理**:
1. 您的 Telegram ID 经过 SHA-256 哈希加密
2. 每条消息的发送者 ID 都会验证
3. 如果哈希不匹配，消息被静默拒绝（不回复）

**安全级别**: ⭐⭐⭐⭐⭐

**示例**:
```
您发送: 打开记事本
Bot: [执行操作]

朋友发送: 打开记事本
Bot: [无响应，静默拒绝]
```

**日志记录**:
```json
{
  "type": "unauthorized_user",
  "userId": "sha256:abc...",
  "timestamp": "2026-01-28T13:30:00.000Z"
}
```

---

### 2. 网络白名单

**功能**: 限制 Bot 只能访问指定的网络域名。

**默认白名单**:
- `api.anthropic.com` - Claude AI 服务
- `*.whatsapp.net` - WhatsApp 服务（如果使用）
- `api.telegram.org` - Telegram 服务

**工作模式**:

| 模式 | 行为 | 环境变量 |
|------|------|---------|
| **审计模式** | 记录但不拦截 | `MOLTBOT_HARDENING_NETWORK_ENFORCE=0` |
| **强制模式** | 拦截非白名单请求 | `MOLTBOT_HARDENING_NETWORK_ENFORCE=1` |

**推荐设置**: 强制模式（`=1`）

**添加自定义域名**:

编辑 `~/.clawdbot/clawdbot.json`:

```json
{
  "security": {
    "hardening": {
      "network": {
        "extraAllowedDomains": ["api.openai.com"],
        "extraAllowedSuffixes": [".github.com"]
      }
    }
  }
}
```

---

### 3. 文件系统监控

**功能**: 监控对敏感文件的访问，记录到审计日志。

**默认敏感路径**:
- `~/.ssh` - SSH 密钥
- `~/.aws` - AWS 凭证
- `~/.gnupg` - GPG 密钥
- `~/.clawdbot/credentials` - Bot 凭证

**工作模式**:

| 模式 | 行为 | 环境变量 |
|------|------|---------|
| **审计模式** | 记录但不拦截 | `MOLTBOT_HARDENING_FS_ENFORCE=0` |
| **强制模式** | 拦截敏感文件访问 | `MOLTBOT_HARDENING_FS_ENFORCE=1` |

**推荐设置**: 审计模式（`=0`），避免误拦截合法操作。

**添加自定义敏感路径**:

编辑 `~/.clawdbot/clawdbot.json`:

```json
{
  "security": {
    "hardening": {
      "filesystem": {
        "extraSensitivePaths": [
          "~/Documents/机密",
          "D:\\重要文件"
        ]
      }
    }
  }
}
```

---

### 4. 审计日志

**功能**: 记录所有安全相关事件。

**日志文件**: `~/.clawdbot/security-audit.log`

**记录的事件类型**:
- `hardening_init` - 系统启动
- `unauthorized_user` - 未授权用户尝试访问
- `network_block` - 网络请求被拦截
- `fs_access` - 敏感文件访问
- `hardening_error` - 安全系统错误

**日志格式**: 结构化 JSON，每行一条记录

**日志轮转**: 超过 10MB 自动轮转为 `.log.1`

---

## 💡 常用命令示例

### 文件管理

```
# 创建文件
创建一个名为 TODO.md 的Markdown文件，内容是今天的待办事项

# 读取文件
读取 D:\项目\README.md 的内容

# 编辑文件
将 test.txt 中的所有 "旧文本" 替换为 "新文本"

# 搜索文件
在 D:\项目 目录下搜索包含 "TODO" 的所有文件

# 复制/移动
将 backup.zip 复制到 D:\备份 目录
将 temp.txt 移动到回收站
```

---

### 应用程序控制

```
# 打开应用
打开记事本
打开浏览器访问 https://github.com
打开 VSCode

# 关闭应用
关闭记事本
关闭所有浏览器窗口

# 系统操作
锁定屏幕
清空回收站
```

---

### 数据处理

```
# 文本处理
将这段文本翻译成英文
总结这篇文章的要点
检查这段代码的语法错误

# 文件格式转换
将 data.csv 转换为 Excel 格式
将 image.png 转换为 JPG 格式

# 批量操作
批量重命名文件夹中的图片，格式为 photo_001.jpg
压缩 D:\项目 文件夹为 ZIP 文件
```

---

### 系统监控

```
# 系统信息
显示CPU和内存使用率
检查磁盘空间
查看网络连接状态

# 进程管理
列出所有正在运行的进程
结束名为 notepad.exe 的进程
```

---

### 代码辅助

```
# 代码生成
用Python写一个HTTP服务器
生成一个React组件示例

# 代码审查
检查这段代码的安全问题
优化这个SQL查询的性能

# 调试帮助
解释这个错误信息
建议如何修复这个bug
```

---

## 📊 日志查看方法

### 查看审计日志

#### 查看完整日志

```bash
cat ~/.clawdbot/security-audit.log
```

#### 查看最近 20 条

```bash
tail -20 ~/.clawdbot/security-audit.log
```

#### 实时查看（服务运行时）

```bash
tail -f ~/.clawdbot/security-audit.log
```

#### 过滤特定事件

```bash
# 查看所有未授权用户事件
grep "unauthorized_user" ~/.clawdbot/security-audit.log

# 查看所有网络拦截事件
grep "network_block" ~/.clawdbot/security-audit.log

# 查看所有文件访问事件
grep "fs_access" ~/.clawdbot/security-audit.log
```

#### 美化 JSON 输出

```bash
# 安装 jq（如果未安装）
# Windows Git Bash: choco install jq
# Linux: sudo apt install jq

# 美化最近一条日志
tail -1 ~/.clawdbot/security-audit.log | jq .

# 美化所有日志
cat ~/.clawdbot/security-audit.log | jq .
```

---

### 查看系统日志

#### Gateway 日志

```bash
# 如果使用 start-jarvis-safe.sh 启动
# 日志会直接输出到终端

# 如果后台启动，日志可能在：
tail -f /tmp/moltbot-gateway.log  # Linux/macOS
tail -f %TEMP%\moltbot-gateway.log  # Windows
```

---

### 日志分析技巧

#### 统计事件类型

```bash
# 统计每种事件的数量
cat ~/.clawdbot/security-audit.log | jq -r '.type' | sort | uniq -c
```

#### 查找特定时间段

```bash
# 查找2026年1月28日的事件
grep "2026-01-28" ~/.clawdbot/security-audit.log
```

#### 提取特定字段

```bash
# 提取所有被拦截的域名
grep "network_block" ~/.clawdbot/security-audit.log | jq -r '.detail.domain'
```

---

## 🔧 故障排查

### 问题1: 启动脚本报错 "环境变量未配置"

**症状**:
```
✗ MOLTBOT_HARDENING_ENABLED 未设置
```

**原因**: 环境变量文件不存在或未加载

**解决方法**:

```bash
# 方法1: 重新运行配置向导
./setup-telegram-config.sh

# 方法2: 手动加载环境变量
source ~/.clawdbot/env.sh

# 方法3: 检查文件是否存在
ls -lh ~/.clawdbot/env.sh

# 方法4: 手动导出环境变量
export MOLTBOT_HARDENING_ENABLED=1
export MOLTBOT_AUTHORIZED_USER_HASH="your_hash"
export TELEGRAM_BOT_TOKEN="your_token"
```

---

### 问题2: Bot 无响应

**症状**: 在 Telegram 发送消息，Bot 没有任何回复

**可能原因**:

#### 原因A: Bot Token 错误

**验证**:
```bash
# 检查 Token 是否正确
echo $TELEGRAM_BOT_TOKEN

# 测试 Token（需要 curl）
curl -s https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe
```

**解决**: 重新运行 `./setup-telegram-config.sh` 输入正确的 Token

---

#### 原因B: 您的 Telegram ID 未授权

**症状**: 其他人可能可以使用 Bot，但您不能

**验证**:
```bash
# 检查授权哈希
echo $MOLTBOT_AUTHORIZED_USER_HASH

# 重新计算您的哈希
YOUR_ID=123456789  # 替换为您的实际ID
echo -n "$YOUR_ID" | sha256sum

# 对比两个哈希是否一致
```

**解决**: 确保授权哈希是根据**您的 Telegram ID**计算的

---

#### 原因C: Gateway 未启动

**验证**:
```bash
# 检查 Gateway 进程
ps aux | grep moltbot

# 检查端口占用
netstat -ano | findstr 18789  # Windows
ss -ltnp | grep 18789  # Linux
```

**解决**: 运行 `./start-jarvis-safe.sh` 启动服务

---

#### 原因D: Telegram 连接失败

**症状**: 启动日志显示 Telegram 连接错误

**验证**:
```bash
# 查看启动日志中是否有错误
# 搜索 "telegram" 或 "error"
```

**解决**:
1. 检查网络连接
2. 确认 Bot Token 正确
3. 尝试重启服务

---

### 问题3: 网络请求被误拦截

**症状**: Bot 无法访问某些合法的网站/API

**原因**: 域名不在白名单中

**解决方法**:

#### 方法1: 临时禁用网络强制

```bash
# 修改环境变量
export MOLTBOT_HARDENING_NETWORK_ENFORCE=0

# 重启服务
./start-jarvis-safe.sh
```

#### 方法2: 添加域名到白名单

编辑 `~/.clawdbot/clawdbot.json`:

```json
{
  "security": {
    "hardening": {
      "network": {
        "enforce": true,
        "extraAllowedDomains": [
          "api.example.com",  // 添加您需要的域名
          "cdn.example.com"
        ]
      }
    }
  }
}
```

重启服务。

---

### 问题4: 文件操作被拦截

**症状**: Bot 无法读取/写入某些文件

**原因**: 文件路径被识别为敏感路径

**解决方法**:

#### 方法1: 切换到审计模式

```bash
# 修改环境变量
export MOLTBOT_HARDENING_FS_ENFORCE=0

# 重启服务
./start-jarvis-safe.sh
```

#### 方法2: 从敏感路径列表中移除

编辑 `src/security/fs-monitor.ts`（不推荐，除非您了解风险）

---

### 问题5: 依赖安装失败

**症状**: `pnpm install` 或 `npm install` 报错

**常见错误**:

#### 错误A: 网络超时

**解决**:
```bash
# 使用淘宝镜像
npm config set registry https://registry.npmmirror.com

# 或使用 pnpm
pnpm config set registry https://registry.npmmirror.com

# 重新安装
pnpm install
```

#### 错误B: Python 未安装（Windows）

某些依赖需要 Python 编译。

**解决**:
```bash
# 安装 windows-build-tools
npm install --global windows-build-tools

# 或手动安装 Python 3.x
# https://www.python.org/downloads/
```

---

### 问题6: 审计日志过大

**症状**: `security-audit.log` 文件很大（> 10MB）

**原因**: 日志轮转未自动触发，或事件过多

**解决方法**:

#### 方法1: 手动归档

```bash
# 备份旧日志
mv ~/.clawdbot/security-audit.log ~/.clawdbot/security-audit.$(date +%Y%m%d).log

# 创建新日志（服务会自动创建）
# 重启服务
```

#### 方法2: 定期清理

```bash
# 只保留最近7天的日志
find ~/.clawdbot -name "security-audit.*.log" -mtime +7 -delete
```

---

### 通用调试步骤

当遇到未知问题时，按照以下步骤诊断：

1. **检查服务状态**
   ```bash
   ps aux | grep moltbot
   ss -ltnp | grep 18789
   ```

2. **查看审计日志**
   ```bash
   tail -50 ~/.clawdbot/security-audit.log
   ```

3. **检查环境变量**
   ```bash
   source ~/.clawdbot/env.sh
   env | grep MOLTBOT
   env | grep TELEGRAM
   ```

4. **验证配置文件**
   ```bash
   cat ~/.clawdbot/clawdbot.json | jq .
   ```

5. **重启服务**
   ```bash
   # Ctrl+C 停止
   ./start-jarvis-safe.sh  # 重新启动
   ```

---

## ⚙️ 配置参考

### 环境变量完整列表

| 变量名 | 说明 | 必需 | 默认值 |
|--------|------|------|--------|
| `MOLTBOT_HARDENING_ENABLED` | 启用安全加固 | ✅ | 无 |
| `MOLTBOT_AUTHORIZED_USER_HASH` | 授权用户SHA-256哈希 | ✅ | 无 |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token | ✅ | 无 |
| `MOLTBOT_HARDENING_NETWORK_ENFORCE` | 网络白名单强制模式 | ❌ | `0` |
| `MOLTBOT_HARDENING_FS_ENFORCE` | 文件系统监控强制模式 | ❌ | `0` |
| `MOLTBOT_HARDENING_LOG_FILE` | 审计日志文件路径 | ❌ | `~/.clawdbot/security-audit.log` |
| `ANTHROPIC_API_KEY` | Claude API密钥（可选）| ❌ | 无 |

---

### 配置文件结构

#### 主配置文件 `~/.clawdbot/clawdbot.json`

```json
{
  "gateway": {
    "mode": "local",           // 本地模式（推荐）
    "bind": "loopback",        // 仅本地访问（安全）
    "port": 18789,             // Gateway端口
    "auth": {
      "mode": "none"           // 本地无需认证
    }
  },
  "security": {
    "hardening": {
      "enabled": true,         // 启用安全加固
      "authorizedUserHash": "abc...",  // 授权哈希
      "network": {
        "enforce": true,       // 网络强制模式
        "extraAllowedDomains": [],     // 额外白名单域名
        "extraAllowedSuffixes": [],    // 额外白名单后缀
        "logAllowed": false    // 不记录允许的请求
      },
      "filesystem": {
        "enforce": false,      // 文件系统审计模式
        "extraSensitivePaths": []      // 额外敏感路径
      }
    }
  },
  "channels": {
    "telegram": {
      "enabled": true,         // 启用Telegram通道
      "botToken": "...",       // Bot Token
      "dmPolicy": "allowlist", // 白名单模式
      "allowFrom": ["123456789"]  // 允许的用户ID
    }
  },
  "agents": {
    "defaults": {
      "model": "claude-3-7-sonnet-20250219",  // AI模型
      "thinkingLevel": "normal"  // 思考级别
    }
  }
}
```

---

### 推荐的安全配置

#### 高安全模式（推荐）

```bash
# 环境变量
export MOLTBOT_HARDENING_ENABLED=1
export MOLTBOT_HARDENING_NETWORK_ENFORCE=1  # 强制网络白名单
export MOLTBOT_HARDENING_FS_ENFORCE=0       # 审计文件访问
```

#### 平衡模式

```bash
# 环境变量
export MOLTBOT_HARDENING_ENABLED=1
export MOLTBOT_HARDENING_NETWORK_ENFORCE=0  # 审计网络请求
export MOLTBOT_HARDENING_FS_ENFORCE=0       # 审计文件访问
```

#### 调试模式（仅用于测试）

```bash
# 环境变量
export MOLTBOT_HARDENING_ENABLED=0  # 禁用安全加固
# 不推荐在生产环境使用！
```

---

## 🚀 高级功能

### 自定义 AI 模型

编辑 `~/.clawdbot/clawdbot.json`:

```json
{
  "agents": {
    "defaults": {
      "model": "claude-3-opus-20240229",  // 更强大的模型
      "thinkingLevel": "high"  // 更深入的思考
    }
  }
}
```

支持的模型：
- `claude-3-7-sonnet-20250219` - 平衡（推荐）
- `claude-3-opus-20240229` - 最强（较慢）
- `claude-3-haiku-20240307` - 快速（较弱）

---

### 定时任务

您可以让 Bot 定期执行某些任务（需要自行实现，Moltbot 支持 Cron 功能）。

示例：每天早上9点发送天气预报。

---

### 多通道支持

除了 Telegram，还可以配置：
- WhatsApp
- Discord
- Slack
- Signal

配置方法参考官方文档：https://docs.molt.bot

---

### 远程访问（高级）

如果需要从外网访问 Bot（**不推荐，有安全风险**）：

1. 修改 Gateway 绑定地址
2. 配置防火墙
3. 启用 Gateway 认证（`auth.mode: "password"`）
4. 使用 HTTPS/WSS

**警告**: 除非您完全了解风险，否则不要公网暴露 Gateway！

---

## 📞 获取帮助

### 查看文档

- **测试报告**: `TEST_REPORT.md`
- **架构分析**: `MOLTBOT项目深度分析报告.md`
- **速查表**: `架构分析速查表.md`

### 检查日志

```bash
# 审计日志
tail -50 ~/.clawdbot/security-audit.log

# 系统日志（如果有）
tail -50 /tmp/moltbot-gateway.log
```

### 重新配置

```bash
# 删除旧配置
rm -rf ~/.clawdbot

# 重新运行向导
./setup-telegram-config.sh
```

---

## 📝 附录

### 常用路径

```
配置目录:     ~/.clawdbot/
主配置文件:   ~/.clawdbot/clawdbot.json
环境变量:     ~/.clawdbot/env.sh
审计日志:     ~/.clawdbot/security-audit.log
项目目录:     D:\项目库\MOLTBOT助理\
启动脚本:     D:\项目库\MOLTBOT助理\start-jarvis-safe.sh
配置向导:     D:\项目库\MOLTBOT助理\setup-telegram-config.sh
```

---

### 快速参考命令

```bash
# 启动服务
./start-jarvis-safe.sh

# 停止服务
Ctrl+C

# 查看日志
tail -f ~/.clawdbot/security-audit.log

# 重新配置
./setup-telegram-config.sh

# 安装依赖
pnpm install

# 运行测试
pnpm test -- src/security/hardening.test.ts
```

---

**手册版本**: v1.0
**最后更新**: 2026年1月28日
**维护者**: CMAF技术助理
**反馈**: 请通过 GitHub Issues 报告问题
