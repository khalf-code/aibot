# Telegram Bot API 절대 제약: 봇 간 메시지 감지 불가

**Date**: 2026-02-08
**Tags**: #telegram #bot-api #constraint #multi-agent

## One-Line Summary

Telegram Bot API는 봇이 다른 봇의 메시지를 볼 수 없도록 설계되어 있어, 그룹 내 봇 간 자동 대화 체인이 원천 불가능하다.

## The Problem

5인 페르소나 토론을 구현하려면 봇A가 그룹에 메시지 → 봇B가 자동 감지 → 봇B 응답 하는 체인이 필요했다. 하지만 실제 테스트에서 봇들이 서로의 메시지에 반응하지 않았다.

### 시도 이력

| # | 시도 | 결과 | 날짜 |
|---|------|------|------|
| 1 | 그룹에서 봇끼리 @mention | 실패 — 봇 메시지는 다른 봇에게 전달 안 됨 | 02-08 |
| 2 | Privacy Mode OFF 설정 | 실패 — 사용자 메시지는 보이지만 봇 메시지는 여전히 안 보임 | 02-08 |
| 3 | 민서 Exa 리서치: 외부 사례 검색 | 확인 — Telegram 공식 문서에 명시된 API 제약 | 02-08 |

## The Insight

Telegram Bot FAQ 공식 문서:
> "Bots will not be able to see messages from other bots regardless of mode."

이것은 API 레벨 제약이라 어떤 설정이나 코드 변경으로도 우회할 수 없다. Discord나 Slack은 이 제약이 없어서 봇 간 통신이 가능.

| 플랫폼 | 봇 간 메시지 감지 | 멀티에이전트 가능 |
|--------|:----------------:|:----------------:|
| Discord | O | O |
| Slack | O | O |
| Telegram | **X** | **제한적** |

## Implementation

우회 전략 (게이트웨이 내부 라우팅):
- 봇 간 직접 대화 대신 **게이트웨이 내부 sessions_send** 사용
- 텔레그램 그룹에는 **각 봇이 message 도구로 직접 전송**
- 봇 간 연쇄 반응은 게이트웨이 레벨에서 처리

```
[불가능한 구조]
봇A → 텔레그램 그룹 메시지 → 봇B 자동 감지 (X)

[가능한 구조]
봇A → 게이트웨이 sessions_send → 봇B 세션
봇A → message(telegram, groupId) → 그룹에 메시지 표시
사용자 → @봇B mention → 봇B 반응
```

## Impact

- 5인 "자동" 토론 체인: 불가능 (설계 변경 필요)
- 세나 중재형 + 사용자 참여형으로 전략 수정
- sessions_send (내부) + message 도구 (외부) 하이브리드 채택

## Reusable Pattern

**When to use this approach:**
- 텔레그램에서 멀티 봇 시스템 구축 시
- 채널별 API 제약 확인이 필요한 경우

**Core principle:**
플랫폼 API 제약은 코드로 우회할 수 없다. 제약을 먼저 확인하고 아키텍처를 설계해야 한다. Telegram에서 봇 간 통신은 반드시 게이트웨이 내부 경로(sessions_send)를 사용해야 한다.

## Related Resources

- Telegram Bots FAQ: https://core.telegram.org/bots/faq
- 민서 리서치: `minseo-a2a-alternative-result.md`
- 민서 리서치: `minseo-a2a-telegram-multibot-cases.md`
- Latenode Community: https://community.latenode.com/t/18168
