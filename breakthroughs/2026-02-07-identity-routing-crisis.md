# Eureka: 아이덴티티 라우팅 위기

**날짜**: 2026-02-07
**카테고리**: A2A / Telegram / 라우팅
**상태**: 해결됨

---

## 문제 발견

소율(Soyul)에게 DM을 보냈는데 "나 세나야"라고 자기소개함.

---

## 시행착오 기록

### 시도 1: bindings 배열 확인 (오전)

**발견**:
```json
// openclaw.json — 문제 상황
{
  "bindings": [
    { "groupId": "-100xxx", "agentId": "sena" },
    // soyul 항목 없음!
  ]
}
```

soyul이 bindings에 없어서 default agent(sena)로 라우팅됨.

**수정**:
```json
{
  "bindings": [
    { "groupId": "-100xxx", "agentId": "sena" },
    { "groupId": "-100yyy", "agentId": "soyul" },
    { "accountId": "soyul_bot", "agentId": "soyul" }  // DM용
  ]
}
```

**결과**: ⚠️ 부분 성공 — 그룹은 됐지만 DM은 여전히 문제

---

### 시도 2: account-level binding 추가 (00:00)
**커밋**: `83eed0f0a`
```
fix(routing): add account-level DM bindings + debug logs for SOUL.md loading
```

**변경 내용**:
- `agent-scope.ts`: accountId 기반 binding 지원 추가
- SOUL.md 로딩에 디버그 로그 추가

**결과**: ✅ DM 라우팅 정상화

---

### 시도 3: identity theft 방지 (16:12)
**커밋**: `08b1029ed`
```
fix(a2a): force announce per turn and fix identity theft
```

**변경 내용**:
- 매 턴마다 announce 강제
- 다른 봇 이름으로 응답하는 "identity theft" 패턴 차단

**결과**: ✅ 봇들이 자기 페르소나 유지

---

## 교훈

| 항목 | 내용 |
|------|------|
| 증상 | 봇이 다른 봇 이름으로 자기소개 |
| 원인 1 | `openclaw.json` bindings에 에이전트 누락 |
| 원인 2 | DM은 groupId가 없어서 accountId binding 필요 |
| 원인 3 | 세션 히스토리에 다른 페르소나 응답이 남아있으면 LLM이 따라함 |
| 해결 | bindings 완비 + identity theft 방지 로직 |

---

## 체크리스트 (새 에이전트 추가 시)

- [ ] `openclaw.json` agents.list에 추가
- [ ] `openclaw.json` bindings에 그룹 binding 추가
- [ ] `openclaw.json` bindings에 accountId binding 추가 (DM용)
- [ ] `openclaw.json` channels.telegram.accounts에 봇 토큰 추가
- [ ] SOUL.md 작성 (2경로: workspace/ + agent/)
