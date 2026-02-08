# 현재 작업 계획 (2026-02-08)

## 완료

- [x] Phase 0: 글로벌 바이너리 제거 (하윤)
- [x] Phase 1: SOUL.md 5인 배포 (하윤)
- [x] 세션 캐시 초기화 (하윤)
- [x] eureka 문서 12개 작성 (수진) — `breakthroughs/INDEX.md`
- [x] hayun-phase2 태스크 hybrid 전략 반영 (수진)
- [x] 민서 리서치 3건 완료: Vertex AI, A2A deep, A2A alternative, jangwook 분석

## 다음 작업 (우선순위순)

### 1. 하윤 — Phase 2 코드 수정 (hybrid A2A)
- 태스크: `.claude/tasks/hayun-phase2-code-fixes.md`
- 핵심: sessions_send + message tool fallback
- Identity Guard cherry-pick, Loop Guard, Persona Confusion 방지

### 2. 하윤 — Vertex AI 설정
- 환경변수 3개: GOOGLE_APPLICATION_CREDENTIALS, GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION
- 키파일: `gen-lang-client-0980326098-02820d37af39.json`
- 리전: us-central1

### 3. 하윤 — 즉시 적용 설정 (민서 리서치 기반)
- [ ] dmPolicy: pairing (외부 사용자 차단)
- [ ] Opus 4.6 fallback 체인 추가
- [ ] contextWindow/contextTokens 정렬
- [ ] Certainty level SOUL.md 전원 적용

### 4. 예린 — Phase 1+2 검증
- 태스크: `.claude/tasks/yerin-verify-phase1-2.md`
- SOUL.md sync 확인, 코드 변경 리뷰

### 5. 예린 — 인프라 경로 감사
- 태스크: `.claude/tasks/yerin-infra-path-audit.md`
- 키파일 scatter, project ID, env var 충돌 확인

### 6. 로아 — Phase 3 테스트
- 태스크: `.claude/tasks/roa-phase3-testing.md`
- 5개 실험: DM, sessions_send, 토론, 전체 워크플로우, 실패 케이스
- Phase 2 완료 후 시작

### 7. 지우 — BOARD/TASKS 정리
- BOARD.md 아카이브 (오래된 항목)
- TASKS.md 갱신

## 메모

- hybrid 전략: sessions_send(내부 맥락) + message tool(외부 표시)
- message tool 코드: `src/agents/tools/message-tool.ts:326-403`
- 민서 jangwook 분석 결과: `minseo-jangwook-full-analysis-result.md` (18항목)
