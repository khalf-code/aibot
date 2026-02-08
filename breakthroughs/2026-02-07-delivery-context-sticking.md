# Eureka: deliveryContext Sticking (Phase B 분석)

**날짜**: 2026-02-07 ~ 2026-02-08
**카테고리**: A2A / 라우팅 / 코어
**상태**: 2/8에 최종 수정 확인

---

## 문제 발견

sessions_send로 봇 A → 봇 B 호출 시:
- 봇 B가 응답을 생성함
- 응답이 `channel=webchat`으로 라우팅됨
- 텔레그램 그룹에는 안 나옴

핵심: `deliveryContext`에 `webchat`이 붙으면 이후 모든 announce 시도가 스킵됨.

---

## 시행착오 기록

### 시도 1: Phase A — label resolution 수정 (2/6)
`sessions_send(label="sena")` 호출 시 라벨을 못 찾는 문제 수정.
→ agentId로 자동 추론하도록 변경.

**결과**: ⚠️ 1:1 통신은 성공, 그룹 announce는 여전히 실패

---

### 시도 2: SOUL.md JSON 응답 금지 (2/7)
봇들이 `{"v":1, "data": ...}` 형태로 JSON 응답 → 시스템이 내부 통신으로 간주하여 ANNOUNCE_SKIP.

SOUL.md에 추가:
```markdown
- JSON 프로토콜 사용 금지
- 자연어(Plain Text)로만 응답
- telegram_send 도구 직접 사용 금지
```

**결과**: ⚠️ JSON 응답은 줄었지만 announce 문제는 별개 원인

---

### 시도 3: force announce per turn (2/7 16:12)
**커밋**: `08b1029ed`
매 턴마다 announce를 강제 실행.

**결과**: ⚠️ 부분 성공 — 일부 메시지는 나오지만 불안정

---

### 시도 4: Phase B — unify resolveAgentIdFromSessionKey (2/7 22:16)
**커밋**: `d1248f1db`
```
fix(a2a): Phase B — unify resolveAgentIdFromSessionKey, add gateway startup log, worktree isolation rule
```

중복된 agentId 추론 로직을 통합.

**결과**: ⚠️ 코드 정리됐지만 근본 원인 미해결

---

### 시도 5: requester context 우선 (2/8)
**커밋**: `673796857`
```
fix(phase-2): prioritize requester context for delivery target (solve context sticking)
```

**결과**: ⚠️ 부분 개선

---

### 시도 6: originating channel 전달 (2/8 최종)
**커밋**: `2dfca9ee4`
```
fix(a2a): pass originating channel to nested agent steps — prevent deliveryContext webchat sticking
```

**핵심 수정**: nested agent step에 원래 요청의 채널 정보를 전달.
webchat이 아닌 실제 요청 채널(telegram)을 유지.

**결과**: ✅ 근본 해결

---

## 근본 원인 (최종 분석)

```
sessions-send-tool.ts:266-275

const agentChannel = INTERNAL_MESSAGE_CHANNEL  // = "webchat"
```

sessions_send가 내부적으로 webchat 채널을 사용하기 때문에,
호출된 봇의 응답도 webchat 컨텍스트로 처리됨.

`resolveAnnounceTarget()`에서 `isInternalMessageChannel("webchat")` 체크 시
true를 반환 → announce 스킵.

---

## 교훈

| 항목 | 내용 |
|------|------|
| 증상 | 봇 응답이 텔레그램에 안 나옴 |
| 원인 | agentChannel이 webchat으로 고정 → announce 스킵 |
| 시도 횟수 | 6번 (2/6~2/8, 3일간) |
| 해결 | originating channel을 nested step에 전달 |
| 교훈 | 증상(announce skip) 수정이 아니라 원인(channel 고정) 수정이 정답 |

---

## 시시포스 패턴

이 문제는 전형적인 "시시포스" 패턴:
1. 증상 관찰 → 2. 증상 수정 → 3. 다른 증상 발생 → 4. 반복

근본 원인을 찾기까지 3일, 6번의 시도가 필요했다.
매번 "이번엔 해결됐겠지" 했지만 증상만 다르게 나타남.

---

## 관련 파일

- `src/agents/tools/sessions-send-tool.ts` (agentChannel 고정 지점)
- `src/agents/tools/sessions-announce-target.ts` (스킵 로직)
- `src/agents/tools/sessions-send-tool.a2a.ts` (A2A 실행)
