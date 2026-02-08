# Skill Guard 增强方案 — 设计文档 v1.1

> **文档版本**: 1.1  
> **基线 Tag**: v2026.2.6  
> **分支**: feature/skill-guard-enhancement  
> **最后更新**: 2026-02-07  
> **状态**: 设计阶段 → 待实施

---

## 目录

1. [执行摘要](#1-执行摘要)
2. [现状分析 — 源码审计](#2-现状分析--源码审计)
3. [差距分析与优化空间](#3-差距分析与优化空间)
4. [增强方案设计](#4-增强方案设计)
5. [落地实施计划](#5-落地实施计划)
6. [商业化解决方案](#6-商业化解决方案)
7. [风险评估与缓解](#7-风险评估与缓解)
8. [附录](#8-附录)

---

## 1. 执行摘要

### 1.1 背景

OpenClaw 是一个多渠道 AI 代理网关（WhatsApp / Telegram / Discord / Slack 等），支持丰富的 Skill 插件系统。当前版本（v2026.2.6）已具备基础的安全审计框架，包括：

- **静态代码扫描**（`src/security/skill-scanner.ts`）
- **安全审计管线**（`src/security/audit.ts` + `audit-extra.ts`）
- **SSRF 防护**（`src/infra/net/fetch-guard.ts`）
- **执行审批**（`src/infra/exec-approvals.ts`）
- **Skill 白名单**（`src/agents/skills/config.ts`）

但目前 **缺乏统一的 "Skill Guard" 层**，安全检查分散在多个模块中，没有：
- 运行时行为沙箱
- 资源用量限制（CPU / 内存 / 网络）
- 动态行为检测与异常告警
- 签名验证与信任链
- 商业化许可证与配额体系

### 1.2 目标

构建一套 **完整的 Skill Guard 框架**，统一管理 Skill 的安装前检查、安装后验证、运行时保护和事后审计，并提供可商业化的许可证与配额管理能力。

---

## 2. 现状分析 — 源码审计

### 2.1 安全模块架构总览

```
src/security/
├── audit.ts              # 安全审计主入口 (runSecurityAudit)
├── audit-extra.ts        # 扩展审计检查 (Skill/Plugin 代码安全)
├── audit-fs.ts           # 文件系统权限检查
├── skill-scanner.ts      # Skill 静态代码扫描器
├── skill-scanner.test.ts # 单元测试
├── external-content.ts   # 外部内容验证
├── fix.ts                # 安全修复工具
└── windows-acl.test.ts   # Windows ACL 检查

src/infra/
├── runtime-guard.ts      # Node.js 运行时版本检查
├── exec-approvals.ts     # 执行审批系统
└── net/
    ├── fetch-guard.ts    # SSRF 防护 fetch
    └── ssrf.ts           # DNS pinning 与策略

src/agents/
├── skills.ts             # Skill 核心管理
├── skills-install.ts     # Skill 安装（含安全检查）
├── skills-status.ts      # Skill 状态（含白名单阻断）
├── skills/config.ts      # Skill 配置与白名单逻辑
├── session-tool-result-guard.ts  # 工具结果防护
└── context-window-guard.ts       # 上下文窗口限制
```

### 2.2 核心组件详细分析

#### 2.2.1 静态代码扫描器（skill-scanner.ts）

**当前能力**：

| 规则ID | 严重级别 | 检测内容 |
|--------|---------|---------|
| `dangerous-exec` | critical | `child_process.exec/spawn` 调用 |
| `dynamic-code-execution` | critical | `eval()` / `new Function()` |
| `crypto-mining` | critical | 挖矿协议引用 (stratum+tcp/ssl, coinhive 等) |
| `suspicious-network` | warn | WebSocket 连接到非标准端口 |
| `potential-exfiltration` | warn | 文件读取 + 网络发送组合 |
| `obfuscated-code` | warn | 十六进制编码串 / 大型 Base64 负载 |
| `env-harvesting` | critical | 环境变量访问 + 网络发送组合 |

**扫描流程**：
1. 按扩展名过滤可扫描文件（.js/.ts/.mjs/.cjs/.jsx/.tsx）
2. 逐行匹配 `LINE_RULES` — 每规则每文件只报第一个匹配
3. 全源匹配 `SOURCE_RULES` — 支持上下文依赖（requiresContext）
4. 汇总统计 critical/warn/info 计数

**评估**：
- ✅ 覆盖了主要的高危模式
- ✅ 支持上下文相关检测（如 exec 需要 child_process 上下文）
- ✅ 有 maxFiles/maxFileBytes 限制防止 DoS
- ⚠️ 仅支持 JavaScript/TypeScript 文件，不支持 Python/Shell 等
- ⚠️ 正则匹配容易被绕过（变量重命名、间接引用）
- ❌ 无 AST 级别的语义分析
- ❌ 无依赖链分析（npm audit 集成）
- ❌ 无签名验证机制

#### 2.2.2 安装时安全检查（skills-install.ts）

**当前流程**：
```
installSkill()
  ├─ loadWorkspaceSkillEntries()      # 加载 Skill 元数据
  ├─ findInstallSpec()                 # 解析安装规范
  ├─ collectSkillInstallScanWarnings() # 执行静态扫描
  │   └─ scanDirectoryWithSummary()    # 调用 skill-scanner
  ├─ buildInstallCommand()             # 构建安装命令
  └─ runCommandWithTimeout()           # 执行安装
```

**评估**：
- ✅ 安装前执行代码扫描
- ✅ 扫描结果作为 warnings 返回
- ✅ 下载使用 SSRF 防护的 fetch（fetchWithSsrFGuard）
- ⚠️ 扫描告警不阻止安装（仅 warning，不 block）
- ❌ 无安装后校验（安装完成后不再验证）
- ❌ 无版本锁定与完整性校验（hash/签名）
- ❌ 无安装来源验证（registry 白名单）

#### 2.2.3 SSRF 防护（fetch-guard.ts）

**当前能力**：
- DNS Pinning 防止 TOCTOU 攻击
- 手动重定向处理（限制跳转次数）
- 协议限制（仅 http/https）
- 支持自定义策略（SsrFPolicy）

**评估**：
- ✅ 设计完善，防御 SSRF 攻击
- ✅ 支持策略配置（允许私有网络、主机白名单）
- ✅ 正确处理资源释放（release 回调）
- ⚠️ 无请求频率限制
- ⚠️ 无响应大小限制

#### 2.2.4 执行审批系统（exec-approvals.ts）

**当前能力**：
- 安全级别: `deny | allowlist | full`
- 询问模式: `off | on-miss | always`
- 安全二进制白名单（jq, grep 等）
- Skill 自动允许（autoAllowSkills）
- 分段解析与路径解析

**评估**：
- ✅ 灵活的执行控制策略
- ✅ 支持 Skill 二进制自动白名单
- ⚠️ autoAllowSkills 可能过度授权
- ❌ 无执行审计日志

#### 2.2.5 安全审计管线（audit.ts + audit-extra.ts）

**当前审计项**：

| 类别 | 检查项 |
|------|--------|
| 文件系统 | 状态目录权限、配置文件权限、凭据目录权限 |
| 网关 | 绑定范围、认证配置、Tailscale 暴露 |
| 通道 | DM 策略、群组策略、命令权限 |
| 模型 | 遗留模型检测、弱模型风险 |
| 插件 | 代码安全扫描、路径遍历检测 |
| Skill | 已安装 Skill 代码安全扫描 |
| 其他 | 日志脱敏、Hooks 加固、密钥泄露 |

**评估**：
- ✅ 覆盖面广，从文件系统到通道安全
- ✅ 支持 deep 模式（深度扫描 + 网关探测）
- ✅ 统一的 finding 格式和严重级别
- ⚠️ 仅支持 on-demand 审计，无持续监控
- ❌ 无审计报告持久化
- ❌ 无审计趋势分析

### 2.3 Skill 白名单与访问控制

```typescript
// src/agents/skills/config.ts
isBundledSkillAllowed(entry, allowlist?)  // 内置 Skill 白名单过滤
resolveSkillKey(skill, entry)              // Skill 唯一标识解析

// src/agents/skills-status.ts
blockedByAllowlist = !isBundledSkillAllowed(entry, allowBundled)

// src/infra/exec-approvals.ts
autoAllowSkills + skillBins  // Skill 二进制自动授权
```

**评估**：
- ✅ 支持全局和 per-agent 白名单
- ✅ Skill 状态报告包含阻断标记
- ⚠️ 仅限内置 Skill，第三方 Skill 无白名单
- ❌ 无基于角色的 Skill 权限（RBAC）
- ❌ 无 Skill 之间的隔离机制

---

## 3. 差距分析与优化空间

### 3.1 关键差距矩阵

| 维度 | 当前状态 | 目标状态 | 差距级别 |
|------|---------|---------|---------|
| 静态分析 | 正则匹配 | AST + 正则 + 依赖审计 | 高 |
| 运行时保护 | 无 | 进程沙箱 + 资源限制 | 严重 |
| 签名验证 | 无 | Ed25519 + 信任链 | 高 |
| 行为监控 | 无 | 运行时行为审计 + 异常检测 | 高 |
| 审计持久化 | 无 | 时序数据库 + 报告归档 | 中 |
| 商业化支撑 | 无 | 许可证 + 配额 + 多租户 | 高 |
| 多语言扫描 | JS/TS only | +Python/Shell/Go | 中 |
| 安装验证 | 仅 warning | 可配置阻断 + 签名校验 | 高 |

### 3.2 优化机会（按优先级排序）

#### P0 — 必须 (v1.1 核心)

1. **统一 Skill Guard 门面层**
   - 创建 `src/security/skill-guard.ts` 作为统一入口
   - 聚合静态扫描、白名单、签名验证为一个 pipeline

2. **安装阻断策略**
   - 将 `collectSkillInstallScanWarnings` 从 warning 升级为可配置阻断
   - 新增 `skills.installPolicy: "warn" | "block-critical" | "block-all"`

3. **签名验证框架**
   - Ed25519 签名生成与验证
   - 内置 Skill 和官方 Skill 的签名预置
   - 离线验证（无需网络请求）

#### P1 — 重要 (v1.2 增强)

4. **AST 级静态分析**
   - 集成 oxc_parser（已有 oxlint 依赖）进行 AST 分析
   - 检测间接调用、变量别名等绕过手法

5. **运行时资源限制**
   - 基于 Node.js `worker_threads` 的 CPU/内存限制
   - 网络请求频率限制
   - 文件系统访问范围限制

6. **依赖链审计**
   - npm audit 集成
   - 已知漏洞数据库比对
   - 供应链攻击检测

#### P2 — 增值 (v2.0 商业化)

7. **行为审计与异常检测**
   - 运行时 API 调用追踪
   - 基于统计的异常行为识别
   - 实时告警通知

8. **许可证与配额管理**
   - Skill Marketplace 许可证验证
   - 按使用量计费的配额系统
   - 多租户隔离

---

## 4. 增强方案设计

### 4.1 架构总览

```
┌─────────────────────────────────────────────────────────┐
│                    Skill Guard 框架                       │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ 安装守卫  │  │ 静态分析  │  │ 运行时守卫│  │ 审计引擎 │ │
│  │ Install  │  │ Static   │  │ Runtime  │  │ Audit    │ │
│  │ Guard    │  │ Analyzer │  │ Guard    │  │ Engine   │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │
│       │              │              │              │       │
│  ┌────▼──────────────▼──────────────▼──────────────▼────┐ │
│  │              Skill Guard Core Pipeline                │ │
│  │  (签名验证 → 静态扫描 → 白名单检查 → 策略决策)       │ │
│  └──────────────────────┬───────────────────────────────┘ │
│                          │                                 │
│  ┌──────────────────────▼───────────────────────────────┐ │
│  │              Policy Engine (策略引擎)                  │ │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │ │
│  │  │ 签名   │ │ 白名单 │ │ 资源   │ │ 许可证 │        │ │
│  │  │ Policy │ │ Policy │ │ Policy │ │ Policy │        │ │
│  │  └────────┘ └────────┘ └────────┘ └────────┘        │ │
│  └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 4.2 核心组件设计

#### 4.2.1 Skill Guard Core — 统一门面

```typescript
// src/security/skill-guard.ts (新增)

export type SkillGuardVerdict = {
  allowed: boolean;
  reason: string;
  findings: SkillScanFinding[];
  signatureValid: boolean | null;  // null = 未签名
  policyViolations: PolicyViolation[];
};

export type SkillGuardConfig = {
  /** 安装策略: warn=仅告警, block-critical=阻止critical, block-all=阻止所有 */
  installPolicy: "warn" | "block-critical" | "block-all";
  /** 是否要求签名 */
  requireSignature: boolean;
  /** 签名信任公钥列表 */
  trustedPublicKeys: string[];
  /** 允许的 Skill 来源 */
  allowedSources: ("openclaw-bundled" | "openclaw-official" | "community" | "local")[];
  /** 自定义扫描规则 */
  customRules?: LineRule[];
  /** 资源限制 */
  resourceLimits?: SkillResourceLimits;
};

export type SkillResourceLimits = {
  maxMemoryMB: number;      // 默认 256MB
  maxCpuTimeMs: number;     // 默认 30000ms
  maxNetworkReqPerMin: number; // 默认 60
  maxFileSizeMB: number;    // 默认 10MB
  allowedNetworkHosts?: string[]; // 网络白名单
  allowedFsPaths?: string[];     // 文件系统白名单
};

export async function evaluateSkill(params: {
  entry: SkillEntry;
  config: SkillGuardConfig;
  mode: "install" | "runtime" | "audit";
}): Promise<SkillGuardVerdict> {
  // 1. 签名验证
  // 2. 来源检查
  // 3. 白名单检查
  // 4. 静态代码扫描
  // 5. 依赖审计（可选）
  // 6. 策略引擎决策
}
```

#### 4.2.2 增强静态分析器

```typescript
// src/security/skill-scanner-enhanced.ts (新增)

/** 扩展规则：覆盖更多攻击面 */
const ENHANCED_LINE_RULES: LineRule[] = [
  // 原有规则保留...

  // 新增：文件系统危险操作
  {
    ruleId: "dangerous-fs-write",
    severity: "warn",
    message: "Write to system-critical path detected",
    pattern: /writeFile(?:Sync)?\s*\(\s*["'`](?:\/etc|\/usr|\/bin|\/var|\/tmp|C:\\Windows)/,
  },
  // 新增：网络监听
  {
    ruleId: "network-listen",
    severity: "warn",
    message: "Network server creation detected",
    pattern: /\.listen\s*\(\s*\d+|createServer\s*\(/,
  },
  // 新增：原生模块加载
  {
    ruleId: "native-addon-load",
    severity: "critical",
    message: "Native addon loading detected",
    pattern: /\.node['"]|dlopen|require\s*\(\s*["'].*\.node["']\)/,
  },
  // 新增：权限提升
  {
    ruleId: "privilege-escalation",
    severity: "critical",
    message: "Potential privilege escalation detected",
    pattern: /sudo\s|setuid|setgid|chmod\s+[47]|chown\s+root/,
  },
  // 新增：Shell 注入
  {
    ruleId: "shell-injection",
    severity: "critical",
    message: "Potential shell injection via template literal",
    pattern: /exec(?:Sync)?\s*\(\s*`[^`]*\$\{/,
    requiresContext: /child_process/,
  },
];

/** Python/Shell 扫描规则 */
const POLYGLOT_RULES: LineRule[] = [
  {
    ruleId: "python-exec",
    severity: "critical",
    message: "Python exec/eval detected",
    pattern: /\b(?:exec|eval|compile)\s*\(/,
  },
  {
    ruleId: "python-subprocess",
    severity: "critical",
    message: "Python subprocess execution detected",
    pattern: /subprocess\.(?:call|run|Popen|check_output)\s*\(/,
  },
  {
    ruleId: "shell-dangerous",
    severity: "critical",
    message: "Dangerous shell command detected",
    pattern: /\brm\s+-rf\s+\/|curl\s+.*\|\s*(?:bash|sh)|wget\s+.*\|\s*(?:bash|sh)/,
  },
];
```

#### 4.2.3 签名验证模块

```typescript
// src/security/skill-signature.ts (新增)

import { createPublicKey, verify } from "node:crypto";

export type SkillSignature = {
  algorithm: "Ed25519";
  publicKey: string;     // Base64 编码的公钥
  signature: string;     // Base64 编码的签名
  timestamp: number;     // 签名时间戳
  contentHash: string;   // SHA-256 内容哈希
};

export type SignatureVerifyResult = {
  valid: boolean;
  trusted: boolean;      // 公钥在信任列表中
  expired: boolean;      // 签名是否过期
  error?: string;
};

/**
 * 验证 Skill 的签名
 * 签名文件约定为 skill 根目录下的 .skill-signature.json
 */
export async function verifySkillSignature(params: {
  skillDir: string;
  trustedPublicKeys: string[];
  maxAgeMs?: number; // 签名最大有效期，默认 365 天
}): Promise<SignatureVerifyResult> {
  // 1. 读取 .skill-signature.json
  // 2. 计算目录内容哈希
  // 3. 验证签名
  // 4. 检查公钥信任列表
  // 5. 检查时间有效性
}

/**
 * 对 Skill 目录生成签名（发布工具使用）
 */
export async function signSkillDirectory(params: {
  skillDir: string;
  privateKeyPath: string;
}): Promise<SkillSignature> {
  // 1. 遍历目录生成内容哈希
  // 2. 使用 Ed25519 私钥签名
  // 3. 写入 .skill-signature.json
}
```

#### 4.2.4 运行时资源守卫

```typescript
// src/security/skill-runtime-guard.ts (新增)

export type RuntimeGuardOptions = {
  limits: SkillResourceLimits;
  onViolation: (violation: ResourceViolation) => void;
  killOnCritical: boolean;
};

export type ResourceViolation = {
  type: "memory" | "cpu" | "network" | "fs";
  severity: "warn" | "critical";
  detail: string;
  skillName: string;
  timestamp: number;
};

/**
 * 包装 Skill 执行，注入资源限制
 * 基于 Node.js worker_threads 实现隔离
 */
export class SkillRuntimeGuard {
  private monitors: Map<string, NodeJS.Timeout> = new Map();

  constructor(private options: RuntimeGuardOptions) {}

  /** 启动对特定 Skill 进程的资源监控 */
  async monitorProcess(params: {
    skillName: string;
    pid: number;
  }): Promise<void> {
    // 周期性检查 /proc/{pid}/status 获取资源使用
    // 超限时触发 onViolation 回调
  }

  /** 包装网络请求以实施频率限制 */
  wrapFetch(skillName: string): typeof fetch {
    // 使用令牌桶算法限制请求频率
    // 限制目标主机白名单
  }

  /** 释放所有监控资源 */
  async dispose(): Promise<void> {
    for (const [, timeout] of this.monitors) {
      clearTimeout(timeout);
    }
    this.monitors.clear();
  }
}
```

#### 4.2.5 审计引擎增强

```typescript
// src/security/skill-audit-engine.ts (新增)

export type SkillAuditEvent = {
  id: string;
  timestamp: number;
  skillName: string;
  eventType: "install" | "uninstall" | "execute" | "violation" | "scan";
  severity: SkillScanSeverity;
  detail: Record<string, unknown>;
};

export type AuditReport = {
  generatedAt: number;
  period: { from: number; to: number };
  summary: {
    totalEvents: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    topViolatingSkills: Array<{ name: string; count: number }>;
  };
  events: SkillAuditEvent[];
};

export class SkillAuditEngine {
  constructor(private storagePath: string) {}

  /** 记录审计事件 */
  async logEvent(event: Omit<SkillAuditEvent, "id" | "timestamp">): Promise<void> {
    // 追加写入 JSONL 审计日志
  }

  /** 生成审计报告 */
  async generateReport(params: {
    from: number;
    to: number;
    skillFilter?: string[];
  }): Promise<AuditReport> {
    // 读取日志并聚合分析
  }

  /** 导出合规报告（PDF/HTML） */
  async exportComplianceReport(params: {
    format: "json" | "html";
    report: AuditReport;
  }): Promise<string> {
    // 生成格式化报告
  }
}
```

### 4.3 配置模型

```jsonc
// openclaw.json 新增配置段
{
  "security": {
    "skillGuard": {
      // 安装策略
      "installPolicy": "block-critical",  // "warn" | "block-critical" | "block-all"

      // 签名验证
      "requireSignature": false,           // 生产环境建议 true
      "trustedPublicKeys": [
        "openclaw-official-2026"           // 内置官方公钥别名
      ],

      // 来源控制
      "allowedSources": [
        "openclaw-bundled",
        "openclaw-official",
        "community"
      ],

      // 资源限制
      "resourceLimits": {
        "maxMemoryMB": 256,
        "maxCpuTimeMs": 30000,
        "maxNetworkReqPerMin": 60,
        "maxFileSizeMB": 10
      },

      // 自定义规则文件路径
      "customRulesPath": null,

      // 审计日志
      "audit": {
        "enabled": true,
        "retentionDays": 90,
        "logPath": "${OPENCLAW_STATE_DIR}/audit/skill-guard.jsonl"
      }
    }
  }
}
```

### 4.4 CLI 接口扩展

```bash
# Skill Guard 命令
openclaw skill-guard status                    # 查看 Skill Guard 状态
openclaw skill-guard scan <skill-name>         # 手动扫描指定 Skill
openclaw skill-guard scan --all                # 扫描所有已安装 Skill
openclaw skill-guard verify <skill-name>       # 验证 Skill 签名
openclaw skill-guard audit                     # 查看审计日志
openclaw skill-guard audit --export html       # 导出审计报告
openclaw skill-guard policy show               # 显示当前策略
openclaw skill-guard policy set <key> <value>  # 设置策略

# 发布工具（Skill 开发者使用）
openclaw skill sign <skill-dir> --key <path>   # 签名 Skill
openclaw skill verify <skill-dir>              # 验证签名
```

---

## 5. 落地实施计划

### 5.1 阶段规划

#### Phase 1: 基础增强 (2 周)

**目标**: 统一门面 + 安装阻断 + 增强规则

| 任务 | 文件 | 工作量 |
|------|------|--------|
| 创建 `skill-guard.ts` 统一门面 | `src/security/skill-guard.ts` | 2d |
| 增强 `skill-scanner.ts` 规则集 | `src/security/skill-scanner.ts` | 1d |
| 修改 `skills-install.ts` 支持阻断策略 | `src/agents/skills-install.ts` | 1d |
| 新增 SkillGuard 配置类型 | `src/config/types.security.ts` | 0.5d |
| 集成到 `audit.ts` 审计管线 | `src/security/audit.ts` | 1d |
| 单元测试 + 集成测试 | `src/security/*.test.ts` | 2d |
| CLI 命令 `skill-guard status/scan` | `src/cli/skill-guard-cli.ts` | 1.5d |
| 文档更新 | `docs/security/skill-guard.md` | 1d |

**交付物**：
- 统一的 Skill Guard API
- 可配置的安装阻断策略
- 增强的静态扫描规则（+5 条规则）
- CLI 基本命令

#### Phase 2: 签名与验证 (2 周)

**目标**: 签名验证 + 依赖审计

| 任务 | 文件 | 工作量 |
|------|------|--------|
| Ed25519 签名验证模块 | `src/security/skill-signature.ts` | 2d |
| 签名生成工具 | `src/security/skill-signer.ts` | 1d |
| 签名集成到安装流程 | `src/agents/skills-install.ts` | 1d |
| npm audit 集成 | `src/security/dep-audit.ts` | 1.5d |
| 签名 CLI 命令 | `src/cli/skill-guard-cli.ts` | 1d |
| 测试 | `src/security/*.test.ts` | 2d |
| 官方 Skill 签名预置 | `skills/*/` | 1.5d |

**交付物**：
- Skill 签名与验证框架
- 依赖审计能力
- 官方 Skill 签名

#### Phase 3: 运行时保护 (3 周)

**目标**: 资源限制 + 行为监控

| 任务 | 文件 | 工作量 |
|------|------|--------|
| 运行时资源守卫 | `src/security/skill-runtime-guard.ts` | 3d |
| 网络请求限流 | `src/security/skill-network-limiter.ts` | 2d |
| 文件系统访问控制 | `src/security/skill-fs-guard.ts` | 2d |
| 审计引擎 | `src/security/skill-audit-engine.ts` | 2d |
| 集成到 Skill 执行流程 | `src/agents/skills.ts` | 2d |
| 测试 | `src/security/*.test.ts` | 3d |
| 文档 | `docs/security/` | 1d |

**交付物**：
- 运行时资源限制
- 行为审计日志
- 审计报告生成

#### Phase 4: 商业化 (4 周)

详见第 6 节。

### 5.2 分支策略

```
main (v2026.2.6)
  │
  ├─ feature/skill-guard-enhancement (当前分支)
  │    │
  │    ├─ feature/skill-guard-phase1  ← Phase 1 开发
  │    ├─ feature/skill-guard-phase2  ← Phase 2 开发
  │    └─ feature/skill-guard-phase3  ← Phase 3 开发
  │
  └─ (最终合并回 main)
```

### 5.3 测试策略

| 层级 | 覆盖目标 | 工具 |
|------|---------|------|
| 单元测试 | 每个函数/方法 | vitest |
| 集成测试 | 完整扫描流程 | vitest + 临时文件系统 |
| 端到端测试 | CLI 命令 + 安装流程 | vitest + mock skills |
| 安全测试 | 规则绕过测试 | 自定义恶意样本库 |
| 性能测试 | 大目录扫描 (<5s/1000 files) | vitest bench |

---

## 6. 商业化解决方案

### 6.1 产品分层

```
┌─────────────────────────────────────────────────────┐
│                  Enterprise Edition                   │
│  ┌────────────────────────────────────────────────┐  │
│  │ • 高级行为分析 & ML 异常检测                   │  │
│  │ • 多租户隔离                                    │  │
│  │ • SIEM 集成 (Splunk/Elastic)                   │  │
│  │ • 合规报告 (SOC2/ISO27001)                     │  │
│  │ • 专属支持 & SLA                               │  │
│  │ • 自定义规则引擎                               │  │
│  └────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────┤
│                  Professional Edition                  │
│  ┌────────────────────────────────────────────────┐  │
│  │ • 签名验证 & 信任链                            │  │
│  │ • 运行时资源限制                               │  │
│  │ • 审计日志 & 报告导出                          │  │
│  │ • 依赖链审计                                    │  │
│  │ • Skill Marketplace 接入                        │  │
│  │ • 优先更新规则库                               │  │
│  └────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────┤
│                  Community Edition (开源)              │
│  ┌────────────────────────────────────────────────┐  │
│  │ • 基础静态扫描 (当前 + 增强规则)              │  │
│  │ • 安装阻断策略                                  │  │
│  │ • 白名单管理                                    │  │
│  │ • CLI 工具                                      │  │
│  │ • 基础审计日志                                  │  │
│  └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 6.2 定价策略

| 版本 | 月费 | 年费 | 目标客户 |
|------|------|------|---------|
| Community | 免费 | 免费 | 个人开发者、开源项目 |
| Professional | $49/月 | $468/年 (-20%) | 中小企业、开发团队 |
| Enterprise | $299/月 | $2,868/年 (-20%) | 大型企业、合规要求 |
| Custom | 联系销售 | 联系销售 | 定制需求 |

### 6.3 Skill Marketplace 生态

```
┌──────────────────────────────────────────────────┐
│              Skill Marketplace                     │
│                                                    │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  │
│  │ 官方 Skill  │  │ 认证 Skill  │  │ 社区 Skill  │ │
│  │ (Free)     │  │ (Verified) │  │ (Review)   │  │
│  └────────────┘  └────────────┘  └────────────┘  │
│                                                    │
│  Skill 发布流程:                                   │
│  提交 → 自动扫描 → 人工审核 → 签名 → 发布         │
│                                                    │
│  收入分成: 开发者 70% / 平台 30%                   │
└──────────────────────────────────────────────────┘
```

### 6.4 许可证管理

```typescript
// src/security/license.ts (新增 - Professional/Enterprise)

export type LicenseInfo = {
  tier: "community" | "professional" | "enterprise";
  organizationId: string;
  maxSkills: number;        // Skill 数量限制
  maxAgents: number;        // Agent 数量限制
  features: string[];       // 启用的功能列表
  expiresAt: number;        // 过期时间
  signature: string;        // 许可证签名
};

export async function validateLicense(params: {
  licensePath: string;
  publicKey: string;
}): Promise<LicenseInfo | null> {
  // 离线验证许可证签名
  // 检查过期时间
  // 返回许可证信息
}

export function isFeatureAvailable(
  license: LicenseInfo | null,
  feature: string
): boolean {
  if (!license) return false;
  return license.features.includes(feature);
}
```

### 6.5 关键商业指标 (KPI)

| 指标 | 目标 (6个月) | 目标 (12个月) |
|------|-------------|--------------|
| Community 用户数 | 1,000+ | 5,000+ |
| Professional 付费用户 | 50+ | 200+ |
| Enterprise 客户 | 5+ | 20+ |
| Marketplace Skill 数量 | 100+ | 500+ |
| MRR (月经常性收入) | $5,000+ | $30,000+ |
| NPS 分数 | 40+ | 50+ |

---

## 7. 风险评估与缓解

### 7.1 技术风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| 正则扫描被绕过 | 高 | 中 | Phase 2 引入 AST 分析 |
| 运行时守卫性能开销 | 中 | 中 | 可配置开关 + 采样监控 |
| 签名私钥泄露 | 极高 | 低 | HSM 硬件密钥 + 密钥轮换 |
| 兼容性问题 | 中 | 中 | 渐进式推出 + 回退策略 |
| Node.js 沙箱逃逸 | 高 | 低 | 多层防御 + 外部沙箱 (gVisor) |

### 7.2 业务风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| 开源社区抵触付费 | 高 | 中 | Community 版功能足够强 |
| 竞品跟进 | 中 | 高 | 先发优势 + 深度集成 |
| 规则库维护成本 | 中 | 高 | 社区贡献 + AI 辅助 |
| Marketplace 冷启动 | 高 | 中 | 官方 Skill 先行 + 激励计划 |

---

## 8. 附录

### 8.1 当前规则覆盖率评估

| 攻击类型 | 当前覆盖 | 增强后覆盖 |
|---------|---------|-----------|
| 命令注入 | ✅ 基础 | ✅ 深度（含间接调用） |
| 代码注入 | ✅ eval/Function | ✅ +原生模块、模板字符串 |
| 数据窃取 | ✅ 组合检测 | ✅ +多模式匹配 |
| 挖矿 | ✅ 协议特征 | ✅ +行为特征 |
| SSRF | ✅ fetch-guard | ✅ +Skill 网络白名单 |
| 供应链攻击 | ❌ | ✅ 签名 + 依赖审计 |
| 权限提升 | ❌ | ✅ 新增规则 |
| 资源耗尽 | ❌ | ✅ 运行时限制 |

### 8.2 文件变更清单（预估）

**新增文件**:
- `src/security/skill-guard.ts` — 统一门面
- `src/security/skill-scanner-enhanced.ts` — 增强扫描器
- `src/security/skill-signature.ts` — 签名验证
- `src/security/skill-runtime-guard.ts` — 运行时守卫
- `src/security/skill-audit-engine.ts` — 审计引擎
- `src/security/skill-network-limiter.ts` — 网络限流
- `src/security/skill-fs-guard.ts` — 文件系统守卫
- `src/security/license.ts` — 许可证管理
- `src/config/types.security.ts` — 安全配置类型
- `src/cli/skill-guard-cli.ts` — CLI 命令

**修改文件**:
- `src/security/skill-scanner.ts` — 增加规则 + 多语言支持
- `src/security/audit.ts` — 集成 Skill Guard
- `src/security/audit-extra.ts` — 使用新的扫描 API
- `src/agents/skills-install.ts` — 安装阻断 + 签名验证
- `src/agents/skills.ts` — 运行时守卫集成
- `src/config/config.ts` — 新增 security.skillGuard 配置
- `src/cli/security-cli.ts` — 扩展 CLI

### 8.3 依赖项

| 依赖 | 用途 | 是否新增 |
|------|------|---------|
| `oxc_parser` | AST 分析 | 新增 (已有 oxlint) |
| Node.js crypto | Ed25519 签名 | 内置 |
| Node.js worker_threads | 进程隔离 | 内置 |

### 8.4 参考资料

- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- [Supply Chain Security Best Practices](https://slsa.dev/)
- [Node.js Security Checklist](https://nodejs.org/en/docs/guides/security)
- OpenClaw 现有安全文档: `SECURITY.md`, `docs/cli/security.md`

---

> **下一步**: 完成设计评审后，在 `feature/skill-guard-enhancement` 分支上基于 v2026.2.6 Tag 开始 Phase 1 开发。
