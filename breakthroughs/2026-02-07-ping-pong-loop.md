# Eureka: A2A Ping-Pong 무한 루프

**날짜**: 2026-02-07
**카테고리**: A2A / 안정성
**상태**: 해결됨

---

## 문제 발견

sessions_send로 봇 간 통신 시, 봇 A가 봇 B에게 보내면 봇 B가 다시 봇 A에게 응답,
봇 A가 또 응답... 무한 루프 발생.

---

## 시행착오 기록

### 시도 1: maxTurns 제한 확인
기존 설정: `maxPingPong: 5`

**결과**: ❌ 5턴이나 왔다갔다 → 텔레그램 그룹에 스팸 폭탄

---

### 시도 2: ping-pong 기본값 0으로 변경 (09:24)
**커밋**: `0c8e69b7c`
```
fix(a2a): disable ping-pong default (5→0) and add announceEnabled config
```

**변경 내용**:
- `sessions-send-helpers.ts`: 기본 maxPingPong 5 → 0
- `sessions-send-tool.a2a.ts`: announceEnabled config 추가
- `config/schema.ts` + `types.base.ts`: announceEnabled 스키마 추가

**결과**: ✅ 기본적으로 ping-pong 차단

---

### 시도 3: announceEnabled config 분리 (동시)
그룹 announce를 별도로 on/off 할 수 있도록 config 추가.

```json
{
  "agents": {
    "defaults": {
      "announceEnabled": true
    }
  }
}
```

**결과**: ✅ 세밀한 제어 가능

---

## 교훈

| 항목 | 내용 |
|------|------|
| 증상 | 봇들이 서로 끊임없이 응답 → 그룹 스팸 |
| 원인 | maxPingPong 기본값 5가 너무 높음 |
| 해결 | 기본값 0 (단방향 전달만), 필요시 수동 설정 |
| 원칙 | A2A는 기본 "fire-and-forget", 양방향은 명시적 opt-in |

---

## 관련 파일

- `src/agents/tools/sessions-send-helpers.ts`
- `src/agents/tools/sessions-send-tool.a2a.ts`
- `src/config/schema.ts`
- `src/config/types.base.ts`
