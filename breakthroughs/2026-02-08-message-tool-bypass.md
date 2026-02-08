# message 도구 우회: sessions_send의 webchat 고착 회피

**Date**: 2026-02-08
**Tags**: #a2a #message-tool #workaround #telegram #announce

## One-Line Summary

sessions_send 대신 message 도구(`message(action='send', channel='telegram')`)를 사용하면 agentChannel webchat 고착 문제를 완전히 우회할 수 있다.

## The Problem

sessions_send 경로에서 agentChannel이 "webchat"으로 고정되어 텔레그램 announce가 스킵되는 문제. 코드 수정으로 고칠 수 있지만, 상위 이슈(#727, #5531, #4173)가 전부 미해결이라 근본 수정의 안정성이 불확실.

### 시도 이력

| # | 시도 | 결과 | 날짜 |
|---|------|------|------|
| 1 | sessions_send agentChannel 수정 시도 | 부분 성공 — originChannel 전달 추가, 완전 해결 아님 | 02-08 |
| 2 | 민서 Exa 리서치: 대안 패턴 검색 | message 도구, Cron, TG API 직접 등 4개 대안 발견 | 02-08 |
| 3 | message 도구 경로 분석 | 코드 확인 — agentChannel 결정 로직 우회 가능 확인 | 02-08 |

## The Insight

message 도구는 `agentChannel` 결정 로직을 거치지 않고 **직접 채널 어댑터를 호출**한다.

```
[sessions_send 경로 — 실패]
에이전트 → sessions_send(agentId)
  → agentChannel = "webchat" (고정!)
  → announce → isInternalMessageChannel("webchat") → 스킵!

[message 도구 경로 — 성공]
에이전트 → message(action='send', channel='telegram', to='-100xxxx')
  → runMessageAction()
  → dispatchChannelMessageAction()
  → sendMessageTelegram()
  → Telegram Bot API 직접 호출 → 성공!
```

코드 위치: `src/agents/tools/message-tool.ts:326-403`

## Implementation

### SOUL.md에 message 도구 사용 지시
```markdown
## 그룹 메시지 전송
텔레그램 그룹에 메시지를 보낼 때:
message(action='send', channel='telegram', to='-1003708523054', message='[내용]')
```

### 하이브리드 전략 (채택)
```
[내부 통신] sessions_send — 에이전트 간 데이터 교환 (세션 히스토리 기록)
[외부 표시] message 도구 — 텔레그램 그룹에 결과 표시 (announce 우회)
```

세나의 토론 플로우:
1. sessions_send로 유리/미루/하나 호출 (내부)
2. 각 응답 수신
3. message 도구로 종합 결과를 텔레그램 그룹에 전송 (외부)

## Impact

- Before: sessions_send 후 텔레그램 응답 표시 불가
- After: message 도구로 직접 전송 → 100% 표시
- Trade-off: 세션 히스토리에 message 도구 호출만 기록, 상대방 응답은 미기록

## Reusable Pattern

**When to use this approach:**
- A2A 결과를 외부 채널(텔레그램, 디스코드 등)에 표시해야 할 때
- announce 경로가 불안정하거나 실패할 때
- 채널 어댑터를 직접 호출해야 할 때

**Core principle:**
A2A 내부 통신과 외부 표시를 분리하면 각각의 문제를 독립적으로 해결할 수 있다. sessions_send는 내부 데이터 교환에, message 도구는 외부 채널 전달에 사용.

## Related Resources

- 민서 리서치: `minseo-a2a-alternative-result.md` (대안 패턴 상세)
- 코드: `src/agents/tools/message-tool.ts:326-403`
- 코드: `src/telegram/send.ts:178-433`
- 오픈클로 그룹 Chat ID: `-1003708523054`
