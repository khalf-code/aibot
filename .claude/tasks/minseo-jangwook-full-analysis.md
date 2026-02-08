# 민서 리서치: jangwook.net 전체 블로그 심층 분석

## 목적
https://jangwook.net/ko/ 블로그에서 A2A, E2E, 멀티에이전트 설정 등 우리 프로젝트에 도움되는 내용 15가지를 추출.

## 조사 도구
- WebFetch — 블로그 페이지 전체 탐색
- `/get-code-context-exa` — 추가 컨텍스트 필요 시

## 조사 방법

### 1. 블로그 인덱스 탐색
https://jangwook.net/ko/ 메인 페이지에서 블로그 글 목록 확인.
각 글 URL을 WebFetch로 읽고 분석.

이미 확인한 글:
- https://jangwook.net/ko/blog/ko/openclaw-e2e-test-automation-guide/ (E2E 테스트)
- https://jangwook.net/en/blog/en/openclaw-advanced-usage/ (고급 사용법)

아직 안 본 글도 전부 확인할 것.

### 2. 분석 범위
A2A 관련만이 아니라 **프로젝트 전반**에 도움되는 내용 포함:
- A2A 세팅 / sessions_send 패턴
- E2E 테스트 자동화
- 멀티에이전트 설정 (bindings, allowAgents)
- 게이트웨이 운영 팁
- SOUL.md / 페르소나 관리
- 크론/스케줄링
- 서브에이전트 관리
- 채널 설정 (텔레그램, 디스코드 등)
- 보안/권한 관리
- 성능 최적화
- 디버깅 / 트러블슈팅
- config 관리
- 세션 관리
- 기타 운영 노하우

## 결과물 형식

정확히 15개 항목. 각 항목:

```markdown
### [번호]. [제목]

**출처**: [URL 또는 페이지명]

[설명 — 5줄 이내, 이해하기 쉽게]
- 뭔지
- 왜 유용한지
- 우리 상황에서 어떻게 쓸 수 있는지
- 설정 방법 (간단히)
- 주의사항 (있으면)
```

## 선정 기준
1. 우리 프로젝트에 **즉시 적용 가능**한 것 우선
2. 이미 알고 있는 기본 내용 제외 (새로운 발견 위주)
3. A2A에만 치우치지 말고 **프로젝트 전반** 커버
4. 실제 설정/코드 예시가 있는 것 우선

## 보고
- 결과물: `~/.openclaw/worktrees/minseo/.claude/tasks/minseo-jangwook-full-analysis-result.md`
- BOARD.md에 요약 보고 (15개 제목 리스트만)
