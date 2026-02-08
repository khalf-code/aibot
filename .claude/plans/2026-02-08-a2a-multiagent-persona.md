# A2A 멀티에이전트 + 5인 페르소나 체제 — 스펙 & 계획서

## 개요

- **목표**: 텔레그램 그룹에서 5인 에이전트(소율/세나/유리/미루/하나)가 각자 페르소나를 유지하며, 사용자 요청에 대해 A2A(sessions_send)로 협업/토론하는 시스템 구축
- **배경**: 민서 리서치(60건 사례 + 5인 역할극)에서 3계층 구조적 갭 확인. 시시포스 세션에서 Phase 3-4 시도했으나 글로벌 바이너리 문제로 미반영.

## 요구사항

### 기능 요구사항

- [ ] 5인 각각 고유 페르소나(말투/역할/금지사항) 유지
- [ ] 사용자 → 소율(게이트키퍼) → 세나(dispatcher) → 유리/미루/하나 워크플로우
- [ ] 토론/협업 시 5인 전원 참여 (세나가 순차 호출)
- [ ] sessions_send 실패 시 사용자에게 안내 메시지
- [ ] 토론 결과를 세나가 종합하여 그룹에 announce
- [ ] Rule A: 지시/분배는 세나만 수행

### 비기능 요구사항

- [ ] 글로벌 바이너리 제거, 로컬 빌드만 사용
- [ ] 각 봇이 남의 페르소나를 흉내내지 않음 (Identity Guard)
- [ ] 자기 메시지에 자기가 응답하는 루프 방지
- [ ] deliveryContext가 webchat으로 고착되지 않음

## 입출력 정의

### 입력
- **채널**: 텔레그램 그룹 (@mention)
- **진입점**: @소율 또는 @세나에게 메시지
- **토론 트리거**: "토론해줘", "의견 모아줘", "이거 어떻게 생각해" 등

### 출력
- **개별 응답**: 각 봇이 자기 페르소나 말투로 그룹에 메시지
- **토론 결과**: 세나가 5인 의견을 종합하여 announce
- **실패 안내**: "호출 실패했어요" 메시지 (세나가 전달)

## 제약조건

- OpenClaw 플랫폼 (gateway 기반)
- Telegram Bot API (봇끼리 직접 메시지 교환 불가 → sessions_send 필수)
- 글로벌 바이너리 제거 후 로컬 빌드만 사용
- 민서 리서치 결론 우선: A2A 관련 기술 결정은 리서치 기반

## 엣지케이스

| 상황 | 대응 |
|------|------|
| sessions_send 타임아웃 | 세나가 "응답 없음" 안내 후 나머지 결과만 종합 |
| 한 봇이 다른 봇 흉내 | Identity Guard가 차단 + 로그 기록 |
| 동시 5인 호출 시 큐 병목 | maxConcurrent=4, 세나가 순차 호출 (동시 아닌 순차) |
| DM에서 토론 요청 | "그룹에서 요청해주세요" 안내 |
| deliveryContext webchat 고착 | requesterOrigin 폴백 (예린 커밋 반영) |

## 성공 기준

| 기준 | 검증 방법 |
|------|----------|
| 5인 각자 말투 유지 | 각 봇에게 DM → 페르소나 말투 확인 |
| 토론 1회전 성공 | 그룹에서 "@세나 토론해줘" → 5인 전원 호출 → 결과 announce |
| 전체 워크플로우 | 소율 정리 → 세나 분배 → 유리/미루/하나 작업 → 세나 종합 → announce |
| 실패 안내 동작 | sessions_send 실패 시 그룹에 안내 메시지 표시 |
| Identity Guard | 세나가 유리/미루 흉내 안 냄 |

---

## 구현 계획서

### Phase 0: 인프라 정리 (블로커 해결)
- [ ] 글로벌 openclaw 삭제 (`npm uninstall -g openclaw` 또는 `brew uninstall openclaw`)
- [ ] `which openclaw` → 결과 없음 확인
- [ ] 하윤 워크트리에서 `pnpm build` → PASS 확인
- [ ] `pnpm openclaw gateway run --force` → 게이트웨이 시작 확인
- [ ] 담당: 하윤 / 검증: 로아

### Phase 1: SOUL.md 5인 개별 배포
- [ ] 소율 SOUL.md 작성 (페르소나 + A2A 규칙 + Rule A)
- [ ] 세나 SOUL.md 작성 (페르소나 + sessions_send 트리거 예시 + dispatcher 규칙)
- [ ] 유리 SOUL.md 작성 (페르소나 + 결과 보고 규칙)
- [ ] 미루 SOUL.md 작성 (페르소나 + 3안 보고 규칙)
- [ ] 하나 SOUL.md 작성 (페르소나 + 체크리스트 보고 규칙)
- [ ] 각 에이전트 2경로 동기화 (workspace/ + agent/)
- [ ] 담당: 하윤 / 리뷰: 예린

#### 세나 SOUL.md sessions_send 트리거 (민서 리서치 #4 권장)
```
## A2A 통신 규칙

### 토론/협업 요청 시 (필수 sessions_send 사용)
트리거 키워드: "토론", "의견", "상의", "물어봐", "협업"
절차:
1. sessions_send({target: "agent:yuri:main", message: "[주제] 리서치해줘"})
2. 유리 응답 수신
3. sessions_send({target: "agent:miru:main", message: "[주제] 아이디어 내봐. 유리 의견: ..."})
4. 미루 응답 수신
5. sessions_send({target: "agent:hana:main", message: "[주제] 실행 계획 만들어줘. 결과: ..."})
6. 하나 응답 수신
7. 전체 결과 종합하여 그룹에 announce

### 실패 시
sessions_send 호출이 실패하면:
- 재시도 1회
- 그래도 실패 시 "영진씨, [에이전트명] 호출이 안 됐어요" 안내
```

### Phase 2: 코드 수정
- [ ] Identity Guard 머지 (시시포스 feature/phase-2-context-fix → cs/hana)
- [ ] Self-Response Loop Guard 추가 (bot-handlers.ts)
- [ ] Persona Confusion 방지 (대상 불일치 시 무시)
- [ ] 예린 deliveryContext 수정 머지 (cs/yuri → cs/hana)
- [ ] sessions_send 실패 시 사용자 안내 메시지 추가
- [ ] 빌드 + 게이트웨이 재시작
- [ ] 담당: 하윤 / 리뷰: 예린

### Phase 3: 테스트
- [ ] 실험 1: 각 봇 DM 페르소나 확인 (말투/역할)
- [ ] 실험 2: @세나 직접 sessions_send 호출 ("유리에게 물어봐")
- [ ] 실험 3: 토론 1회전 ("@세나 이 주제 토론해줘")
- [ ] 실험 4: 전체 워크플로우 (소율→세나→전원→종합)
- [ ] 실험 5: 실패 케이스 (없는 봇 호출 시 안내 메시지)
- [ ] 각 실험 로그 기반 검증 (민서 체크리스트 활용)
- [ ] 담당: 로아 / 검증: 예린

### Phase 4: 토론 모드 고도화 (중기, Phase 3 완료 후)
- [ ] "토론 모드" 키워드 자동 감지 → sessions_send 파이프라인 트리거 (민서 권장조치 #7)
- [ ] 세나 orchestration: 순차 호출 + 결과 종합 자동화
- [ ] announce 품질: 토론 결과를 구조화된 형태로 그룹 전달
- [ ] 담당: 하윤

## 참고 자료

| 자료 | 위치 |
|------|------|
| 민서 A2A 리서치 요약 | `~/.openclaw/worktrees/minseo/.claude/tasks/minseo-a2a-audit-summary.md` |
| 민서 Root Cause Top 5 | `~/.openclaw/worktrees/minseo/.claude/tasks/minseo-a2a-rootcause-top5.md` |
| 민서 체크리스트 | `~/.openclaw/worktrees/minseo/.claude/tasks/minseo-a2a-checklist.md` |
| jangwook 멀티에이전트 | https://jangwook.net/en/blog/en/openclaw-advanced-usage/ |
| jangwook E2E 테스트 | https://jangwook.net/ko/blog/ko/openclaw-e2e-test-automation-guide/ |
| 시시포스 커밋 | `feature/phase-2-context-fix` 브랜치 (sujin worktree) |
| 예린 A2A 수정 | cs/yuri `f31f98556`, `7685c669d` |

## 5인 페르소나 카드 (참조)

### 소율 — 감독관/비서
- 말투: 존댓말, 짧게, 부드럽게
- "영진님, 목표를 한 문장으로 확정할까요?"
- 역할: 요청 정리 → 세나에게 전달

### 세나 — 팀장/dispatcher (유일한 지시권자)
- 말투: "영진씨" + 존댓말, 빠른 템포
- "영진씨, A/B 중 하나만 고르시면 제가 나머지 굴릴게요."
- 역할: sessions_send로 타 에이전트 호출, 결과 종합

### 유리 — 리서치
- 말투: 짧고 쿨, 근거→결론
- "영진, 선택지는 2개. 비용/리스크 기준으로 보면 B."
- 역할: 리서치 결과를 세나에게 보고

### 미루 — 아이디어
- 말투: 발랄, 감탄, 3안 정리
- "영진~ 3안 가져왔어! (안1/안2/안3)"
- 역할: 아이디어를 세나에게 보고

### 하나 — 실행/QA
- 말투: 존댓말, 할일/담당/기한/완료조건
- "영진님, 완료조건을 1줄로 정해주시면 제가 자동화로 묶겠습니다."
- 역할: 실행 계획을 세나에게 보고
