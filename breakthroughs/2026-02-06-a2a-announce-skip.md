# Eureka: A2A Announce Skip 현상 발견

**날짜**: 2026-02-06
**카테고리**: A2A / Telegram / 디버깅
**상태**: 부분 해결 → 2/7~2/8 추가 수정 필요

---

## 문제 발견

텔레그램 그룹에서 "세나랑 미루 토론해봐" 요청 시:
- 봇들이 내부적으로 대화함 (`channel=webchat`)
- 텔레그램 그룹에는 아무것도 안 뜸
- 로그에 `ANNOUNCE_SKIP` 다수 관찰

---

## 시행착오 기록

### 시도 1: webchat 채널 스킵 로직 추가 (16:15)
**커밋**: `893063a7e`
```
fix(a2a): skip internal webchat channel in announce target + remove reply from sessions_send
```

**변경 내용**:
- `sessions-announce-target.ts`: webchat 채널이면 announce 스킵하도록 조건 추가
- `sessions-send-tool.ts`: reply 파라미터 제거

**결과**: ❌ 실패 — 스킵 조건이 너무 광범위해서 정상 announce까지 차단

---

### 시도 2: SOUL.md 페르소나 강화 (17:10)
**커밋**: `c6d3f090e`
```
feat(agents): strengthen SOUL.md persona enforcement and 429 retry limits
```

**변경 내용**:
- system-prompt.ts: SOUL.md에 "absolute precedence" 조항 추가
- 429 에러 시 최소 60초 대기 강제

**결과**: ⚠️ 부분 성공 — 페르소나는 강화됐지만 announce 문제는 별개

---

### 시도 3: Safety 섹션 복구 + AbortController (17:27)
**커밋**: `be9630007`
```
fix(agents): restore Safety section, AbortController for proactive-memory, SOUL.md Safety exception
```

**변경 내용**:
- 브랜치 분기 중 손실된 safetySection 복구
- proactive-memory에서 Promise.race → AbortController로 리소스 누수 방지

**결과**: ✅ Safety 관련 수정 완료 (announce와 무관)

---

### 시도 4: requesterSessionKey 전달 (23:46)
**커밋**: `478319a04`
```
fix(a2a): pass requesterSessionKey to resolveAnnounceTarget for webchat fallback
```

**변경 내용**:
- `sessions-send-tool.a2a.ts`: 1줄 추가
  ```typescript
  requesterSessionKey: params.requesterSessionKey
  ```

**결과**: ⚠️ 부분 성공 — webchat fallback은 되지만 근본 해결 아님

---

## 교훈

| 항목 | 내용 |
|------|------|
| 근본 원인 | `agentChannel`이 webchat으로 고정되면 `isInternalMessageChannel()` 체크에서 announce 스킵 |
| 착각 | announce 조건만 수정하면 될 줄 알았음 |
| 실제 | `sessions-send-tool.ts:266-275`에서 agentChannel 자체가 webchat으로 고정됨 |
| 다음 단계 | 2/7에 ping-pong 비활성화 + identity theft 수정으로 이어짐 |

---

## 관련 파일

- `src/agents/tools/sessions-announce-target.ts`
- `src/agents/tools/sessions-send-tool.ts`
- `src/agents/tools/sessions-send-tool.a2a.ts`
- `src/agents/system-prompt.ts`
