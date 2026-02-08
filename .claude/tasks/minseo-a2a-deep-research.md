# 민서 심층 리서치: A2A 근본 문제점 + 해결책

## 목적
현재 A2A(sessions_send) 시스템의 근본적인 문제점을 코드 레벨까지 파악하고, 실제 성공/실패 사례 기반으로 해결책 도출.

## 리서치 도구
- `/get-code-context-exa` (Exa MCP) — 코드 스니펫, GitHub 이슈, 기술 문서 검색
- WebFetch — jangwook.net 심층 분석
- 로컬 코드 탐색 — `~/.openclaw/worktrees/hayun/src/` 소스코드

## 조사 항목

### 1. Exa 코드 검색: A2A 성공/실패 사례
검색 키워드 예시 (조합해서 여러 번):
- `openclaw sessions_send telegram bot`
- `openclaw agent-to-agent announce`
- `openclaw multi-agent telegram group`
- `openclaw A2A deliveryContext`
- `openclaw bot self-response loop`
- `openclaw identity guard system prompt`

찾을 것:
- [ ] 다른 사용자가 sessions_send 성공시킨 설정/코드
- [ ] A2A 실패 사례 + 해결 방법 (GitHub issues, discussions)
- [ ] announce가 안 되는 원인/해결 패턴
- [ ] multi-agent 그룹 채팅 성공 사례
- [ ] 봇끼리 루프 방지한 실제 구현 예시

### 2. jangwook.net 심층 분석
URL: https://jangwook.net/ko/blog/ko/openclaw-e2e-test-automation-guide/
추가: https://jangwook.net/en/blog/en/openclaw-advanced-usage/

분석 관점:
- [ ] E2E 테스트 자동화 — 우리 Phase 3 테스트에 바로 적용 가능한 패턴
- [ ] `--session isolated` 패턴 상세 (세션 격리 방법)
- [ ] multi-agent 설정 (bindings, allowAgents, maxConcurrent)
- [ ] announce/sessions_send 실제 동작 흐름
- [ ] 에러 처리 패턴

### 3. 현재 우리 상황 근본 문제 분석
우리가 겪고 있는 구체적 증상:

| 증상 | 관련 코드 |
|------|----------|
| SOUL.md 바꿔도 페르소나 안 바뀜 | 세션 캐시 (`agents/*/sessions/`) |
| 소율이 직접 유리/미루에게 sessions_send (Rule A 위반) | SOUL.md 규칙이 LLM에 반영 안 됨 |
| sessions_send 후 응답 없음 | announce target 해석, deliveryContext |
| 유리가 "비평가/품질 관리자"로 자기소개 | 이전 페르소나 잔존 or SOUL.md 내용 부실 |
| 글로벌/로컬 바이너리 혼동 | 인프라 경로 관리 |

각 증상의 **근본 원인** (코드 레벨)과 **해결 방법** (코드 변경 or 설정 변경) 정리.

### 4. 해결책 제안 (코드 레벨)
각 문제에 대해:
- 원인 코드 위치 (파일명:라인)
- 수정 방향
- 우선순위 (P0/P1/P2)
- 난이도 (easy/medium/hard)

## 결과물 형식

```markdown
# A2A 심층 리서치 결과

## 1. 외부 사례 (Exa 검색)
### 성공 사례
- [출처]: 설정/코드/결과
### 실패 사례 + 해결
- [출처]: 증상 → 원인 → 해결

## 2. jangwook.net 적용 포인트
| 패턴 | 우리 적용 | 우선순위 |

## 3. 근본 원인 분석
| 증상 | 근본 원인 | 코드 위치 | 해결 방향 |

## 4. 권장 조치 (우선순위순)
| # | 조치 | 파일 | 난이도 | 담당 |
```

## 보고
결과물을 `~/.openclaw/worktrees/minseo/.claude/tasks/minseo-a2a-deep-research-result.md`에 저장.
BOARD.md에 요약 보고.
