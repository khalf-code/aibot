# SOUL.md 변경 후 페르소나 미반영: 세션 캐시 문제

**Date**: 2026-02-08
**Tags**: #soul-md #session-cache #persona #gateway

## One-Line Summary

SOUL.md를 수정해도 기존 세션 히스토리에 이전 페르소나 응답이 남아있어 LLM이 새 페르소나를 무시한다.

## The Problem

Phase 1에서 5인 SOUL.md를 전부 업데이트하고 게이트웨이를 재시작했으나, 텔레그램에서 봇들이 여전히 이전 페르소나로 자기소개:
- 유리: "비평가/품질 관리자" (리서치여야 함)
- 하나: "빌더" (실행/QA여야 함)
- 미루: "데이터 찾기" (아이디어여야 함)

### 시도 이력

| # | 시도 | 결과 | 날짜 |
|---|------|------|------|
| 1 | 시시포스: `rm -rf ~/.openclaw/agents/*/sessions/*` | 성공 — 세션 삭제 후 새 페르소나 적용 | 02-07 |
| 2 | 하윤 Phase 1: SOUL.md 수정 + 게이트웨이 재시작 (세션 미삭제) | 실패 — 이전 페르소나 유지 | 02-08 |
| 3 | 하윤: 세션 캐시 수동 초기화 | 성공 — 세션 전삭 후 새 페르소나 적용 대기 중 | 02-08 |

## The Insight

`loadWorkspaceBootstrapFiles()` (`workspace.ts:237-284`)는 SOUL.md를 매번 읽는다. 하지만 세션 히스토리에 이전 페르소나의 응답 ("나는 유리야! 비평가/품질 관리자!")이 남아있으면, LLM은 시스템 프롬프트(새 SOUL.md)보다 히스토리 내 자기 발화를 더 신뢰한다.

```
[시스템 프롬프트] "너는 유리. 리서치 담당." (새 SOUL.md)
[히스토리] 유리: "나는 비평가/품질 관리자야!" (이전 발화)
[LLM 판단] → 히스토리가 더 구체적 → 이전 페르소나 유지
```

## Implementation

현재 해결: 수동 세션 삭제
```bash
pkill -9 -f openclaw-gateway
rm -rf ~/.openclaw/agents/*/sessions/*
pnpm openclaw gateway run --bind loopback --port 18789 --force
```

근본 해결 (미구현):
- SOUL.md 파일 해시 저장 → 변경 감지 → 세션 히스토리 자동 클리어
- 또는 SOUL.md에 version 필드 추가 → 버전 불일치 시 세션 리셋

## Impact

- Before: SOUL.md 수정 후에도 100% 이전 페르소나 유지
- After (수동 삭제): 새 페르소나 적용
- 문제: 매번 수동 삭제 필요 → 운영 부담

## Reusable Pattern

**When to use this approach:**
- 에이전트 설정(SOUL.md, 시스템 프롬프트) 변경 후 동작이 안 바뀔 때
- LLM이 새 지시를 무시하는 것처럼 보일 때

**Core principle:**
LLM은 시스템 프롬프트보다 대화 히스토리 내 자기 발화를 더 신뢰한다. 페르소나 변경 시 반드시 기존 세션 히스토리를 클리어해야 한다.

## Related Resources

- 코드: `src/agents/workspace.ts:237-284` (SOUL.md 로딩)
- 코드: `src/gateway/server-methods/agent.ts:240-264` (세션 관리)
- 세션 저장 위치: `~/.openclaw/agents/*/sessions/`
- GitHub #5806: 무한루프 세션 손상 (관련 — 세션 상태 문제)
