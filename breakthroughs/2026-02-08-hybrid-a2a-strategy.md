# 하이브리드 A2A 전략: sessions_send + message 도구 병행

**Date**: 2026-02-08
**Tags**: #a2a #strategy #hybrid #sessions-send #message-tool #architecture

## One-Line Summary

sessions_send(내부 통신) + message 도구(외부 표시)를 병행하여 A2A의 구조적 한계를 우회하는 아키텍처.

## The Problem

순수 sessions_send 방식:
- agentChannel webchat 고착 → announce 실패
- Telegram Bot API 제약 → 봇 간 직접 통신 불가
- 외부 성공 사례 0건 → 검증된 패턴 없음
- 미해결 GitHub 이슈 다수 (#727, #5531, #4173, #5806)

순수 message 도구 방식:
- 세션 히스토리 미기록 → 맥락 유실
- A2A 정책 체크 우회 → 보안 취약
- 에이전트 간 데이터 교환 불가

### 시도 이력 (전체)

| # | 시도 | 결과 | 교훈 |
|---|------|------|------|
| 1 | 시시포스: Identity Guard + system-prompt 수정 | 글로벌 바이너리로 미반영, 빌드 반복 실패 | 인프라 문제 먼저 해결 필수 |
| 2 | 하윤: deliveryContext webchat 부분 수정 | originChannel 전달 추가, 완전 해결 아님 | 근본 원인이 더 깊음 |
| 3 | 예린: isInternalMessageChannel 필터 | 방어적 처리, 근본 원인 미해결 | 필터링으로는 한계 |
| 4 | 하윤: SOUL.md 5인 배포 | 세션 캐시로 미반영 | 세션 히스토리 > 시스템 프롬프트 |
| 5 | 하윤: 세션 캐시 수동 삭제 | 페르소나 반영 가능 | 매번 수동 → 자동화 필요 |
| 6 | 민서: 외부 성공 사례 검색 | 0건 | sessions_send 자체가 미성숙 |
| 7 | 민서: Telegram Bot API 제약 확인 | 봇 간 메시지 감지 불가 | 플랫폼 제약은 우회 불가 |
| 8 | 민서: message 도구 대안 발견 | webchat 고착 우회 가능 | 내부/외부 분리 전략 |
| 9 | 전략 결정: 하이브리드 채택 | sessions_send + message 도구 병행 | 최종 아키텍처 |

## The Insight

**내부 통신과 외부 표시를 분리**하면 각각의 문제를 독립적으로 해결할 수 있다.

```
[하이브리드 아키텍처]

사용자 → @소율 "이거 토론해줘"
  → 소율 → sessions_send(세나) [내부: 세나에게 토론 요청]
  → 세나 → sessions_send(유리) [내부: 리서치 요청]
  → 유리 → sessions_send(세나) [내부: 결과 보고]
  → 세나 → sessions_send(미루) [내부: 아이디어 요청]
  → 미루 → sessions_send(세나) [내부: 결과 보고]
  → 세나 → sessions_send(하나) [내부: 실행 계획 요청]
  → 하나 → sessions_send(세나) [내부: 결과 보고]
  → 세나 → message(telegram, groupId, "종합 결과: ...") [외부: 그룹 전달]
```

## Implementation

### Phase 2 구현 항목

1. **sessions_send agentChannel 수정** (P0)
   - `requesterChannel` 계승으로 webchat 고착 해소
   - 이걸로 sessions_send 자체 안정화

2. **message 도구 폴백** (P0)
   - sessions_send announce 실패 시 message 도구로 그룹 전달
   - SOUL.md에 message 도구 사용 규칙 추가

3. **세션 캐시 자동 클리어** (P1)
   - SOUL.md 해시 비교 → 변경 시 히스토리 리셋

4. **Rule A 런타임 강제** (P1)
   - sessions_send 도구에 caller agentId 체크

### SOUL.md 하이브리드 규칙 (세나용)

```markdown
## A2A 통신 규칙

### 다른 에이전트 호출
sessions_send 사용:
sessions_send({target: "agent:yuri:main", message: "..."})

### 그룹에 결과 전달
message 도구 사용 (announce 실패 시 폴백):
message(action='send', channel='telegram', to='-1003708523054', message='...')

### 토론 순서
1. sessions_send → 유리 (리서치)
2. sessions_send → 미루 (아이디어)
3. sessions_send → 하나 (실행 계획)
4. message → 그룹 (종합 결과)
```

## Impact

- sessions_send 단독: announce 성공률 ~0%
- message 도구 단독: 세션 히스토리 미기록
- **하이브리드**: 내부 통신 + 외부 표시 분리 → 두 문제 모두 해결

## Reusable Pattern

**When to use this approach:**
- A2A 시스템에서 내부 통신과 외부 채널 표시가 분리되어야 할 때
- 단일 경로가 구조적 문제를 가질 때 폴백 경로가 필요한 경우
- 플랫폼 API 제약으로 직접 통신이 불가능한 환경

**Core principle:**
내부 데이터 흐름(sessions_send)과 외부 사용자 표시(message 도구)를 분리하면, 각 경로의 문제를 독립적으로 해결할 수 있고 폴백도 가능하다. 단일 경로에 의존하지 마라.

## Related Resources

- 계획서: `.claude/plans/2026-02-08-a2a-multiagent-persona.md`
- 민서 심층 리서치: `minseo-a2a-deep-research-result.md`
- 민서 대안 리서치: `minseo-a2a-alternative-result.md`
- 하윤 Phase 2 태스크: `.claude/tasks/hayun-phase2-code-fixes.md`
- GitHub Issues: #727, #5531, #4173, #5806, #4385, #8695, #698
