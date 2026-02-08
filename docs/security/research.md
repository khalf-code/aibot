# OpenClaw Skill Guard 安全校验系统设计文档

> 版本：v2.0  
> 日期：2026-02-06  
> 状态：设计阶段

---

## 1. 背景与威胁模型

### 1.1 问题陈述

OpenClaw 的 Skill 系统允许通过目录（含 `SKILL.md` + 任意附带文件）扩展 Agent 能力。Skill 目录会被完整加载并注入到 Agent 运行时。目前已发现 **600+ 恶意 Skill**，攻击手段涵盖：

| 攻击类型 | 手段 | 载体文件示例 |
|----------|------|-------------|
| 命令执行 | 通过 child_process 执行系统命令 | `.js`, `.sh` |
| 访问凭据 | 读取环境变量/配置文件中的密钥 | `.py`, `.js` |
| 代码混淆 | hex 编码 / base64 payload 隐藏恶意逻辑 | `.js`, `.min.js` |
| 提示词注入 | 在 SKILL.md 中嵌入覆盖 Agent 行为的指令 | `SKILL.md` |
| 下载执行 | 下载远程 payload 并执行 | `.sh`, `.py` |
| 数据外泄 | 读取敏感文件后通过网络发送 | `.py`, `.js` |

### 1.2 Skill 目录结构

一个 Skill 是一个完整目录，可能包含以下文件类型：

```
skills/
  some-skill/
    SKILL.md              ← 必须存在，定义 Skill 元数据和 prompt
    scripts/
      run.py              ← Python 脚本
      helper.sh           ← Shell 脚本
    src/
      main.js             ← JavaScript 模块
      utils.ts            ← TypeScript 模块
    bin/
      tool                ← 二进制可执行文件
    config.json           ← 配置文件
    references/
      guide.md            ← 参考文档
    pyproject.toml        ← Python 项目配置
    license.txt           ← 许可证
```

### 1.3 攻击面

1. **Skill 加载阶段**：`loadSkillEntries()` 读取 `SKILL.md` 内容并注入 Agent system prompt
2. **Skill 同步阶段**：`syncSkillsToWorkspace()` 使用 `fs.cp(recursive: true)` 复制整个目录
3. **Skill 安装阶段**：`installSkill()` 下载并解压 tar/zip 包到本地目录
4. **Agent 运行阶段**：Agent 可能被指示执行 Skill 目录中的脚本文件

### 1.4 安全目标

- **完整性**：Skill 目录中的每一个文件都必须与商店发布版本一致
- **不可篡改**：任何文件被修改、添加或删除都应被检测到
- **可控性**：云端可以随时启用/关闭校验，可以紧急阻断特定 Skill
- **可用性**：校验失败不能导致整个系统不可用，必须有降级策略

---

## 2. 总体架构

### 2.1 系统组成

```
┌─────────────────────────────────────────────────────────┐
│                      云端服务                            │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │            Skill Guard API (3 个接口)              │   │
│  │                                                    │   │
│  │  GET  /manifest      ← 全量同步（配置+hash+阻断） │   │
│  │  GET  /skills/:name  ← 单个 Skill 查询            │   │
│  │  GET  /skills/:name/download  ← 下载 Skill 包     │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS
                       ▼
┌──────────────────────────────────────────────────────────┐
│                    OpenClaw 客户端                        │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │          Extension: skill-guard (即插即用)           │  │
│  │                                                     │  │
│  │  CloudClient ──→ HashCache ──→ VerifyEngine         │  │
│  │                                    │                │  │
│  │                               AuditLogger           │  │
│  └───────────────────┬─────────────────────────────────┘  │
│                      │ registerSkillLoadGuard()           │
│                      ▼                                   │
│  ┌────────────────────────────────┐                      │
│  │  load-guard.ts (核心补丁，~25行) │                      │
│  └───────────────┬────────────────┘                      │
│                  ▼                                       │
│  ┌────────────────────────────────┐                      │
│  │  loadSkillEntries() (现有代码)  │                      │
│  └────────────────────────────────┘                      │
└──────────────────────────────────────────────────────────┘
```

### 2.2 核心设计原则

| 原则 | 说明 |
|------|------|
| **全目录校验** | 对 Skill 目录中的每一个文件计算 SHA256，不遗漏任何脚本或二进制 |
| **双向检测** | 既检测文件被篡改（hash 不匹配），也检测文件被注入（多出未知文件） |
| **解耦实现** | 以 Extension 形式开发，对核心代码仅 1 处极小改动 |
| **云端可控** | 校验开关、策略、阻断列表全部由云端下发 |
| **安全降级** | 云端不可用时使用本地缓存，无缓存时按策略决定是否放行 |

---

## 3. 云端 API 设计

### 3.1 接口总览

| # | 方法 | 路径 | 用途 | 调用频率 |
|---|------|------|------|----------|
| 1 | GET | `/api/v1/skill-guard/manifest` | 全量同步 | 启动 + 定期 |
| 2 | GET | `/api/v1/skill-guard/skills/:name` | 单个 Skill 查询 | 偶发 |
| 3 | GET | `/api/v1/skill-guard/skills/:name/download` | 下载 Skill 包 | 用户触发 |

### 3.2 接口 1：全量同步 (Manifest)

**职责：** 客户端启动时和定期同步时调用，一次拿到校验所需的全部数据。

```
GET /api/v1/skill-guard/manifest

请求头：
  Authorization: Bearer <apiKey>      # 可选，用于认证
  If-None-Match: "v2026020601"        # 可选，条件请求避免重复传输

成功响应 200：
{
  "verification": {
    "enabled": true,                  // [必须] 校验总开关
    "policy": "strict"                // [必须] strict | permissive | audit-only
  },
  "version": "2026020601",           // [必须] 数据版本号（同时用作 ETag）
  "syncIntervalSeconds": 300,        // [必须] 建议的客户端定期同步间隔（秒）
  "blocklist": [                     // [必须] 紧急阻断名单（可为空数组）
    "malicious-skill-a",
    "crypto-miner-disguised"
  ],
  "skills": {                        // [必须] 全量 Skill Hash 清单
    "web-search": {
      "version": "1.2.0",
      "fileCount": 3,
      "files": {
        "SKILL.md": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
        "scripts/search.py": "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3",
        "config.json": "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"
      }
    },
    "tmux": {
      "version": "1.0.0",
      "fileCount": 3,
      "files": {
        "SKILL.md": "d4e5f6a1b2c3...",
        "scripts/find-sessions.sh": "e5f6a1b2c3d4...",
        "scripts/wait-for-text.sh": "f6a1b2c3d4e5..."
      }
    }
  }
}

数据未变化响应 304：
  (无 Body，客户端继续使用本地缓存)
```

**字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `verification.enabled` | boolean | 校验总开关，false 时客户端跳过所有校验 |
| `verification.policy` | string | 校验策略，决定 hash 不匹配或 skill 不在商店时的行为 |
| `version` | string | 数据版本号，客户端用 `If-None-Match` 头发送此值做条件请求 |
| `syncIntervalSeconds` | number | 云端建议的同步间隔，客户端据此设置定时器 |
| `blocklist` | string[] | 需紧急阻断的 Skill 名称列表，无论 hash 是否匹配都阻断 |
| `skills` | object | key 为 Skill 名称，value 为该 Skill 的文件清单和 hash |
| `skills[name].version` | string | Skill 版本号 |
| `skills[name].fileCount` | number | 文件总数，用于快速检测文件增减 |
| `skills[name].files` | object | key 为相对路径（相对于 Skill 根目录），value 为该文件的 SHA256 hex |

**files 中的路径规范：**
- 使用正斜杠 `/` 作为路径分隔符（跨平台统一）
- 相对于 Skill 根目录，如 `SKILL.md`, `scripts/run.py`, `src/main.js`
- 不包含 Skill 目录名本身
- 包含该目录下的所有文件（递归）

**policy 行为矩阵：**

| 场景 | strict | permissive | audit-only |
|------|--------|------------|------------|
| Skill 在 blocklist 中 | 阻断 | 阻断 | 记录日志 |
| 文件 hash 不匹配 | 阻断 | 阻断 | 记录日志 |
| 发现多出的未知文件 | 阻断 | 记录警告 | 记录日志 |
| 发现缺失文件 | 阻断 | 记录警告 | 记录日志 |
| Skill 不在商店记录中 | 阻断 | 放行 | 记录日志 |

**响应体大小估算：**
- 100 个 Skill × 平均 5 个文件 × 约 150 字节/条目 ≈ 75 KB
- 1000 个 Skill × 平均 5 个文件 × 约 150 字节/条目 ≈ 750 KB
- 配合 gzip 压缩（JSON 压缩率约 85%）：1000 个 Skill ≈ 110 KB
- 配合 ETag 304：定期同步时通常为 0 传输

### 3.3 接口 2：单个 Skill 查询

**职责：** 当客户端发现一个不在本地 manifest 缓存中的 Skill 时，单独查询其校验信息。

```
GET /api/v1/skill-guard/skills/{skillName}

请求头：
  Authorization: Bearer <apiKey>      # 可选

成功响应 200：
{
  "name": "web-search",
  "version": "1.2.0",
  "fileCount": 3,
  "files": {
    "SKILL.md": "a1b2c3d4e5f6...",
    "scripts/search.py": "b2c3d4e5f6a1...",
    "config.json": "c3d4e5f6a1b2..."
  },
  "publisher": "openclaw",
  "downloadUrl": "https://cdn.openclaw.com/skills/web-search-1.2.0.tar.gz"
}

Skill 不在商店中 404：
{
  "error": "skill_not_found"
}
```

**调用场景：**
- 两次 manifest 同步之间新安装了一个 Skill
- manifest 缓存中缺少某个 Skill 的记录
- 客户端判断：不在缓存中 → 先调这个接口查一下 → 还是 404 → 按 policy 处理

### 3.4 接口 3：下载 Skill 包

**职责：** Skill 商店的安装功能使用，校验守卫本身不调用此接口。

```
GET /api/v1/skill-guard/skills/{skillName}/download

成功响应 302：
  Location: https://cdn.openclaw.com/skills/web-search-1.2.0.tar.gz
  (重定向到 CDN)

或直接返回 200：
  Content-Type: application/gzip
  Content-Length: 12345
  (二进制内容)
```

### 3.5 云端接口实现要点

**对后端团队的要求：**

1. manifest 接口必须支持 `ETag` / `If-None-Match` 条件请求
2. skills 下的 `files` 字段必须包含该 Skill 目录中的 **所有文件**（递归遍历）
3. 文件路径必须使用正斜杠 `/`，相对于 Skill 根目录
4. SHA256 值为 hex 编码（小写，64 字符）
5. `blocklist` 更新后，`version` 必须递增（确保客户端能通过条件请求拉到新数据）
6. 建议 manifest 接口开启 gzip/brotli 压缩

---

## 4. 客户端架构设计

### 4.1 核心代码补丁

**对主分支的全部改动：1 个新文件 + 1 处插入。**

#### 4.1.1 新文件：`src/agents/skills/load-guard.ts`

```typescript
/**
 * Skill 加载守卫注册点。
 *
 * Extension 通过 registerSkillLoadGuard() 注入校验逻辑，
 * 核心代码在 loadSkillEntries() 中调用 guard.evaluate()。
 *
 * 这个文件是 Extension 与核心代码的唯一耦合点。
 */

import type { Skill } from "@mariozechner/pi-coding-agent";
import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("skills/guard");

export type SkillLoadGuardVerdict = {
  /** 应被阻断的 skill 名称列表 */
  blocked: string[];
  /** 可选的警告信息（不阻断，仅记录日志） */
  warnings?: Array<{ name: string; message: string }>;
};

export type SkillLoadGuard = {
  /**
   * 同步评估一批 skill。
   * 返回裁决结果：哪些应阻断、哪些需警告。
   */
  evaluate(skills: Map<string, Skill>): SkillLoadGuardVerdict;
};

let _guard: SkillLoadGuard | null = null;

/** Extension 调用此函数注册守卫。返回取消注册的函数。 */
export function registerSkillLoadGuard(guard: SkillLoadGuard): () => void {
  _guard = guard;
  log.info("skill load guard registered");
  return () => {
    _guard = null;
    log.info("skill load guard unregistered");
  };
}

/** 核心代码调用此函数获取守卫实例。 */
export function getSkillLoadGuard(): SkillLoadGuard | null {
  return _guard;
}
```

#### 4.1.2 修改：`src/agents/skills/workspace.ts`

在 `loadSkillEntries()` 函数中，Map 合并完成后（约第 171 行）、构建 `SkillEntry[]` 之前（第 173 行），插入以下代码：

```typescript
// 文件顶部新增 import
import { getSkillLoadGuard } from "./load-guard.js";

// 在第 171 行和第 173 行之间插入：
const guard = getSkillLoadGuard();
if (guard) {
  const verdict = guard.evaluate(merged);
  for (const name of verdict.blocked) {
    skillsLogger.warn(`skill blocked by guard: ${name}`);
    merged.delete(name);
  }
  if (verdict.warnings) {
    for (const w of verdict.warnings) {
      skillsLogger.info(`skill guard warning [${w.name}]: ${w.message}`);
    }
  }
}
```

**改动总量：1 个新文件（约 30 行）+ 1 处插入（约 15 行）+ 1 行 import。**

### 4.2 Extension 文件结构

```
extensions/
  skill-guard/
    openclaw.plugin.json        # 插件清单（声明 id、configSchema）
    package.json                # 无外部依赖
    src/
      index.ts                  # 插件入口，注册 guard + service + hook
      types.ts                  # 类型定义
      cloud-client.ts           # 云端 API 客户端（3 个接口）
      hash-cache.ts             # 本地缓存（内存 + 文件持久化）
      verify-engine.ts          # 校验引擎（全目录 SHA256 校验）
      audit-logger.ts           # 审计日志（JSONL 追加写）
```

**共 7 个文件，预计总代码量约 900 行。零外部依赖。**

### 4.3 全目录校验引擎 (`verify-engine.ts`)

这是整个方案的核心。校验逻辑如下：

```
对每一个 Skill：
  │
  ├─ 步骤 1：blocklist 检查
  │   └─ 在阻断名单中？ → 直接阻断
  │
  ├─ 步骤 2：manifest 存在性检查
  │   └─ 不在 manifest 中？ → 按 policy 处理
  │
  ├─ 步骤 3：文件数量检查（快速路径）
  │   ├─ 递归遍历 Skill 目录，统计实际文件数
  │   └─ 实际文件数 ≠ manifest 声明的 fileCount？ → 文件被添加或删除
  │
  ├─ 步骤 4：多余文件检测
  │   ├─ 遍历 Skill 目录中的所有文件
  │   └─ 存在 manifest 中未记录的文件？ → 可能被注入了恶意文件
  │
  ├─ 步骤 5：缺失文件检测
  │   ├─ 遍历 manifest 中声明的所有文件
  │   └─ 磁盘上找不到？ → 文件被删除（可能是被替换攻击的痕迹）
  │
  └─ 步骤 6：逐文件 SHA256 校验
      ├─ 对 manifest 中声明的每个文件：
      │   ├─ 读取文件内容
      │   ├─ 计算 SHA256
      │   └─ 与 manifest 中的 hash 比对
      └─ 任何一个不匹配 → 文件被篡改
```

**关键设计点：**

- **步骤 3 是快速路径**：文件数量不匹配可以立即判定，无需逐文件算 hash。600+ 恶意 Skill 中"注入额外脚本文件"是常见手段，这一步能快速捕获。
- **步骤 4 检测注入**：攻击者在合法 Skill 目录中添加了 `payload.js`，即使原有文件 hash 全部正确，这一步也能发现。
- **步骤 6 是同步操作**：因为 `loadSkillEntries()` 本身是同步函数，hash 计算也必须同步。Node.js `crypto.createHash().update(fs.readFileSync(...))` 在处理 KB 级文件时速度极快，100 个 Skill × 5 个文件 ≈ 数十毫秒。

**verify-engine.ts 核心伪代码：**

```typescript
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

type Verdict = "pass" | "blocked";
type VerdictDetail = {
  verdict: Verdict;
  reason?: string;
};

/**
 * 递归列出目录中的所有文件，返回相对路径列表。
 * 路径使用正斜杠分隔（与云端一致）。
 */
function listAllFiles(baseDir: string): string[] {
  const results: string[] = [];
  const walk = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;    // 跳过隐藏文件
      if (entry.name === "node_modules") continue; // 跳过 node_modules
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        const rel = path.relative(baseDir, full).split(path.sep).join("/");
        results.push(rel);
      }
    }
  };
  walk(baseDir);
  return results;
}

/**
 * 计算单个文件的 SHA256。
 */
function sha256File(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * 校验单个 Skill 的完整性。
 */
function verifySkill(
  skill: { name: string; baseDir: string },
  expected: { fileCount: number; files: Record<string, string> },
): VerdictDetail {
  // 步骤 3：文件数量快速检查
  const actualFiles = listAllFiles(skill.baseDir);
  if (actualFiles.length !== expected.fileCount) {
    return {
      verdict: "blocked",
      reason: `file count mismatch: expected ${expected.fileCount}, found ${actualFiles.length}`,
    };
  }

  // 步骤 4：检测多余文件（注入检测）
  const expectedSet = new Set(Object.keys(expected.files));
  const actualSet = new Set(actualFiles);
  for (const file of actualFiles) {
    if (!expectedSet.has(file)) {
      return {
        verdict: "blocked",
        reason: `unexpected file: ${file}`,
      };
    }
  }

  // 步骤 5：检测缺失文件
  for (const file of expectedSet) {
    if (!actualSet.has(file)) {
      return {
        verdict: "blocked",
        reason: `missing file: ${file}`,
      };
    }
  }

  // 步骤 6：逐文件 SHA256 校验
  for (const [relPath, expectedHash] of Object.entries(expected.files)) {
    const fullPath = path.join(skill.baseDir, ...relPath.split("/"));
    try {
      const actualHash = sha256File(fullPath);
      if (actualHash !== expectedHash) {
        return {
          verdict: "blocked",
          reason: `hash mismatch: ${relPath}`,
        };
      }
    } catch {
      return {
        verdict: "blocked",
        reason: `file unreadable: ${relPath}`,
      };
    }
  }

  return { verdict: "pass" };
}
```

### 4.4 Hash 缓存 (`hash-cache.ts`)

```
内存 Map（运行时读写，O(1)）
  │
  │  进程启动时
  │  ← loadFromDisk()
  │
  │  云端同步后
  │  → persistToDisk()（异步，不阻塞）
  │
  ▼
文件 ~/.openclaw/security/hash-cache.json（离线降级用）
```

- 缓存整个 manifest 响应
- 记录 `fetchedAt` 时间戳用于过期判断
- 记录 `version` 用于 ETag 条件请求

### 4.5 审计日志 (`audit-logger.ts`)

JSONL 格式追加写入 `~/.openclaw/security/audit.jsonl`：

```jsonl
{"ts":"2026-02-06T12:00:00Z","event":"config_sync","detail":"enabled=true policy=strict"}
{"ts":"2026-02-06T12:00:00Z","event":"load_pass","skill":"web-search"}
{"ts":"2026-02-06T12:00:00Z","event":"load_pass","skill":"memory"}
{"ts":"2026-02-06T12:00:00Z","event":"blocked","skill":"crypto-miner","reason":"blocklisted"}
{"ts":"2026-02-06T12:00:01Z","event":"blocked","skill":"data-thief","reason":"hash mismatch: scripts/steal.py"}
{"ts":"2026-02-06T12:00:01Z","event":"blocked","skill":"injector","reason":"unexpected file: payload.js"}
{"ts":"2026-02-06T12:00:01Z","event":"not_in_store","skill":"my-local-skill","action":"allowed"}
```

事件类型：

| event | 含义 |
|-------|------|
| `config_sync` | 成功从云端同步配置 |
| `config_sync_failed` | 云端同步失败，降级到缓存 |
| `load_pass` | Skill 校验通过 |
| `blocked` | Skill 被阻断（附 reason） |
| `not_in_store` | Skill 不在商店记录中（附 action: allowed/blocked） |
| `verification_off` | 校验未启用 |
| `cache_fallback` | 使用本地缓存（云端不可用） |

### 4.6 插件入口 (`index.ts`)

```typescript
export default function register(api) {
  const config = api.getConfig();
  const cloud = new CloudClient({ ... });
  const cache = new HashCache("~/.openclaw/security/hash-cache.json");
  const audit = new AuditLogger("~/.openclaw/security/audit.jsonl");
  const engine = new VerifyEngine(cache, audit);

  // 1. 注册加载守卫
  registerSkillLoadGuard({
    evaluate: (skills) => engine.evaluate(skills),
  });

  // 2. 注册后台同步服务
  api.registerService({
    id: "skill-guard",
    async start(ctx) {
      audit.init();
      cache.loadFromDisk();
      try {
        const manifest = await cloud.fetchManifest();
        if (manifest) {
          engine.setManifest(manifest);
          cache.update(manifest);
          audit.record("config_sync", ...);
        }
      } catch (err) {
        audit.record("config_sync_failed", ...);
        // 使用磁盘缓存降级
      }
      // 定期同步
      setInterval(async () => {
        try {
          const manifest = await cloud.fetchManifest();
          if (manifest) {
            engine.setManifest(manifest);
            cache.update(manifest);
          }
        } catch { /* 静默失败 */ }
      }, (engine.syncInterval ?? 300) * 1000);
    },
    async stop() {
      audit.close();
    },
  });
}
```

---

## 5. 降级策略

### 5.1 完整决策树

```
进程启动
  │
  ├─ 云端可用？
  │   ├─ 是 → 拉取 manifest → 更新缓存 → 正常模式
  │   └─ 否 → 本地有缓存文件？
  │           ├─ 是 → 加载缓存 → 缓存模式（记录 cache_fallback 日志）
  │           └─ 否 → engine.manifest = null → 无数据模式
  │
  ─── Skill 加载时 ───
  │
  ├─ engine.manifest 为 null？
  │   └─ 是 → 全部放行 + 记录 verification_off → 结束
  │
  ├─ verification.enabled = false？
  │   └─ 是 → 全部放行 + 记录 verification_off → 结束
  │
  └─ 对每个 Skill：
      ├─ 在 blocklist 中？
      │   ├─ strict/permissive → 阻断
      │   └─ audit-only → 记录日志，放行
      │
      ├─ 不在 manifest.skills 中？
      │   ├─ strict → 阻断
      │   ├─ permissive → 放行 + 记录 not_in_store
      │   └─ audit-only → 放行 + 记录 not_in_store
      │
      └─ 在 manifest.skills 中？
          └─ 执行全目录校验（步骤 3-6）
              ├─ 通过 → 放行
              └─ 失败 →
                  ├─ strict/permissive → 阻断
                  └─ audit-only → 放行 + 记录日志
```

### 5.2 设计保证

> **任何情况下进程都能正常启动。**
> 最坏情况是"降级为无校验模式"，而非"启动失败"。

---

## 6. 配置

用户在 `openclaw.json` 中添加：

```json5
{
  "plugins": {
    "entries": {
      "skill-guard": {
        "enabled": true,    // 启用此 Extension
        "config": {
          "storeApiUrl": "https://store-api.openclaw.com",
          "storeApiKey": "sg_xxx"    // 可选
        }
      }
    }
  }
}
```

所有校验策略（policy、blocklist 等）由云端 manifest 接口下发，不在客户端配置。
这确保了云端对所有客户端的统一控制能力。

---

## 7. 性能评估

| 操作 | 耗时估算 | 说明 |
|------|----------|------|
| manifest 请求（首次） | 200-500ms | ~100KB 数据（gzip 后约 15KB） |
| manifest 请求（304） | 50-100ms | 无 body 传输 |
| 单个文件 SHA256 | < 1ms | 普通 SKILL.md 约 2-5KB |
| 单个 Skill 全目录校验（5 文件） | < 5ms | 递归列目录 + 5 次 hash |
| 100 个 Skill 全量校验 | < 500ms | 仅在首次加载时 |
| 文件列表缓存持久化 | < 10ms | 异步写 JSON 文件 |

**结论：对启动时间的影响 < 1 秒，对运行时无影响。**

---

## 8. 开发计划

| 步骤 | 交付物 | 工时 | 对核心代码的改动 |
|------|--------|------|-----------------|
| 1 | `load-guard.ts` + `workspace.ts` 补丁 | 0.5 天 | 新增 1 文件 + 修改 1 处 |
| 2 | `types.ts` + `cloud-client.ts` | 1 天 | 无 |
| 3 | `hash-cache.ts` + `audit-logger.ts` | 0.5 天 | 无 |
| 4 | `verify-engine.ts`（全目录校验引擎） | 1.5 天 | 无 |
| 5 | `index.ts` + `openclaw.plugin.json` | 0.5 天 | 无 |
| 6 | 集成测试 + 联调 | 1 天 | 无 |
| **合计** | | **5 天** | **仅步骤 1** |

---

## 9. 后续迭代方向（非本期范围）

以下功能不在本期实现，但架构已预留扩展空间：

| 迭代项 | 说明 | 前提 |
|--------|------|------|
| Ed25519 签名验证 | manifest 本身的签名，防止中间人篡改 | 需要密钥管理基础设施 |
| 增量同步 | 只传输变化的 Skill hash，减少带宽 | 商店 Skill 数量超过 1000 |
| Skill 权限声明 | 在 frontmatter 中声明权限，运行时通过 before_tool_call 执行 | 商店生态成熟后 |
| 安全事件上报 | 客户端将阻断事件上报云端，用于威胁情报 | 需新增 POST 接口 |
| 自动更新 | 检测到 hash 不匹配时自动从商店下载正确版本 | 需接口 3 配合 |
