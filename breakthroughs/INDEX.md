# Breakthroughs Index

A2A 멀티에이전트 + 텔레그램 봇 시스템 구축 과정의 시행착오 기록.

---

## 2026-02-06

| # | 문서 | 요약 | 결과 |
|---|------|------|------|
| 1 | [global-local-binary](2026-02-06-global-local-binary.md) | 글로벌 vs 로컬 바이너리 혼동 — 코드 수정이 반영 안 됨 | 해결 |
| 2 | [a2a-announce-skip](2026-02-06-a2a-announce-skip.md) | A2A announce가 webchat 채널이라 스킵됨 (4번 시도) | 부분 해결 |

## 2026-02-07

| # | 문서 | 요약 | 결과 |
|---|------|------|------|
| 3 | [identity-routing-crisis](2026-02-07-identity-routing-crisis.md) | 소율이 "나 세나야" — bindings 누락 + DM 라우팅 | 해결 |
| 4 | [telegram-offset-corruption](2026-02-07-telegram-offset-corruption.md) | offset 오염으로 봇 무반응 (getUpdates 직접 호출 실수) | 해결 |
| 5 | [ping-pong-loop](2026-02-07-ping-pong-loop.md) | A2A 무한 루프 — maxPingPong 5→0 | 해결 |
| 6 | [soyul-hallucination](2026-02-07-soyul-hallucination.md) | 소율이 tool call 없이 "보냈어요" 환각 | 해결 |
| 7 | [delivery-context-sticking](2026-02-07-delivery-context-sticking.md) | deliveryContext webchat 고정 (3일, 6번 시도) | 해결 |

## 2026-02-08

| # | 문서 | 요약 | 결과 |
|---|------|------|------|
| 8 | [webchat-channel-sticking](2026-02-08-webchat-channel-sticking.md) | agentChannel webchat 고정 → announce 스킵 근본 원인 | 확인 |
| 9 | [session-cache-persona-stale](2026-02-08-session-cache-persona-stale.md) | SOUL.md 변경 후 세션 캐시로 페르소나 미적용 | 해결 |
| 10 | [telegram-bot-api-constraint](2026-02-08-telegram-bot-api-constraint.md) | 봇끼리 메시지 못 봄 (Telegram API 제약) | 확인 |
| 11 | [message-tool-bypass](2026-02-08-message-tool-bypass.md) | message tool로 webchat sticking 우회 | 발견 |
| 12 | [hybrid-a2a-strategy](2026-02-08-hybrid-a2a-strategy.md) | sessions_send + message tool 하이브리드 전략 | 채택 |

---

## 핵심 교훈 TOP 5

1. **증상 수정 vs 원인 수정**: announce skip 증상을 6번 수정했지만, agentChannel 고정이라는 근본 원인을 찾기까지 3일 걸림
2. **세션 관성**: SOUL.md 변경만으로는 부족. 반드시 세션 초기화 병행
3. **getUpdates 직접 호출 금지**: gateway polling과 충돌 → offset 오염
4. **bindings 완비 필수**: 그룹 + DM(accountId) 모두 설정해야 라우팅 정상
5. **Telegram Bot API 제약**: 봇끼리 메시지를 볼 수 없음 → 자동 체인 불가, message tool로 우회

---

## 타임라인 (시간순)

```
2/4  글로벌/로컬 바이너리 혼동 발견 (npm link 시도)
2/6  A2A announce skip 발견 → 4번 수정 시도 (모두 부분 해결)
     SOUL.md persona enforcement 강화
     requesterSessionKey 전달 시도
2/7  소율 "나 세나" → bindings 누락 발견
     getUpdates 직접 호출 실수 → offset 오염
     offset 복구 절차 확립
     ping-pong 무한 루프 → maxPingPong=0
     소율 환각 → 세션 리셋으로 해결
     identity theft 방지 로직
     Phase B: resolveAgentIdFromSessionKey 통합
2/8  세션 캐시 문제 재발견 → 전체 에이전트 세션 초기화
     Telegram Bot API 제약 확인 (봇↔봇 불가)
     message tool bypass 발견
     하이브리드 전략 채택 (sessions_send + message tool)
```
