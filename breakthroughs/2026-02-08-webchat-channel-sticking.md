# A2A announce 실패: agentChannel webchat 고착

**Date**: 2026-02-08
**Tags**: #a2a #sessions-send #announce #webchat #deliveryContext

## One-Line Summary

sessions_send로 에이전트 호출 시 agentChannel이 "webchat"으로 고정되어 텔레그램 announce가 스킵된다.

## The Problem

텔레그램 그룹에서 봇A가 sessions_send로 봇B를 호출하면, 봇B의 응답이 텔레그램 그룹에 나타나지 않았다. 게이트웨이 로그에서 announce 호출 자체가 스킵되는 것 확인.

### 시도 이력

| # | 시도 | 결과 | 날짜 |
|---|------|------|------|
| 1 | 시시포스 세션: system-prompt.ts Identity Guard 추가 | 빌드 실패 (글로벌 바이너리 문제), 근본 원인 아님 | 02-07 |
| 2 | 하윤: deliveryContext webchat 수정 (sessions-send-tool.ts, .a2a.ts) | 부분 성공 — originChannel 전달 추가했으나 여전히 announce 스킵 경로 존재 | 02-08 |
| 3 | 예린: isInternalMessageChannel 필터 + requesterSessionKey 폴백 | 방어적 처리 추가, 하지만 근본 원인(agentChannel 고정) 미해결 | 02-08 |

## The Insight

`sessions-send-tool.ts:266-275`에서 A2A 세션 생성 시 `agentChannel`이 `INTERNAL_MESSAGE_CHANNEL`("webchat")로 하드코딩된다. 이후 `resolveAnnounceTarget()`이 호출되면 `isInternalMessageChannel("webchat") === true` → announce 스킵.

```
소율(telegram) → sessions_send(미루)
  → agentChannel = "webchat" (여기서 고정!)
  → 미루 세션 생성: channel = "webchat"
  → resolveAnnounceTarget()
  → deliveryContext.channel = "webchat"
  → isInternalMessageChannel("webchat") = true
  → announce 스킵!
```

## Implementation

수정 방향: `agentChannel` 결정 시 `requesterChannel`을 계승.

```typescript
// sessions-send-tool.ts:266-275 (수정 전)
const agentChannel = INTERNAL_MESSAGE_CHANNEL; // "webchat" 고정

// sessions-send-tool.ts (수정 후)
const agentChannel = requesterChannel ?? announceTarget?.channel ?? INTERNAL_MESSAGE_CHANNEL;
```

## Impact

- Before: sessions_send 후 텔레그램 응답 표시율 0% (announce 전량 스킵)
- After: requesterChannel 계승 시 announce 정상 동작 (예상)
- 관련 GitHub 이슈: #727, #5531 (미해결, 동일 근본 원인 추정)

## Reusable Pattern

**When to use this approach:**
- A2A 세션 간 통신에서 채널 정보가 사라지는 문제
- nested agent 호출 시 원래 채널 컨텍스트가 유실되는 경우

**Core principle:**
A2A 내부 호출에서도 원래 요청자의 채널 정보를 전파해야 한다. 내부 채널("webchat")로 대체하면 외부 채널(telegram)로의 응답 경로가 끊어진다.

## Related Resources

- 민서 리서치: `minseo-a2a-deep-research-result.md` (근본 원인 분석)
- 예린 커밋: cs/yuri `7685c669d` (isInternalMessageChannel 필터)
- GitHub #727: 텔레그램 포럼 배달 실패
- GitHub #5531: 멀티채널 웹챗 고착
- 코드: `src/agents/tools/sessions-send-tool.ts:266-275`
- 코드: `src/agents/tools/sessions-announce-target.ts:42-79`
