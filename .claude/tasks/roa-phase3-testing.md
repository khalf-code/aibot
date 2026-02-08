# Phase 3: 통합 테스트

## blocked_by: Phase 2

## 참고 자료
- 민서 체크리스트: `~/.openclaw/worktrees/minseo/.claude/tasks/minseo-a2a-checklist.md`
- 계획서: `~/.openclaw/worktrees/sujin/.claude/plans/2026-02-08-a2a-multiagent-persona.md`

## 테스트 항목

### 실험 1: 페르소나 DM 확인
각 봇에게 DM으로 자기소개 요청 → 말투/역할 확인.

| 봇 | 기대 말투 | 확인 |
|----|----------|------|
| 소율 | 존댓말, "영진님", 짧고 부드럽게 | [ ] |
| 세나 | "영진씨", 빠른 템포, 실행 중심 | [ ] |
| 유리 | 쿨, 근거→결론, "영진" | [ ] |
| 미루 | 발랄, 감탄, "영진~" | [ ] |
| 하나 | 존댓말, 체크리스트, "영진님" | [ ] |

### 실험 2: sessions_send 단건 호출
그룹에서 `@세나 유리에게 물어봐: OO 뭐야?` → 세나가 sessions_send로 유리 호출 → 결과 announce.

확인 사항:
- [ ] 세나가 sessions_send 사용했는지 (게이트웨이 로그)
- [ ] 유리가 자기 말투로 응답했는지
- [ ] 세나가 결과를 그룹에 announce했는지
- [ ] 세나가 유리 말투를 흉내내지 않았는지 (Identity Guard)

### 실험 3: 토론 1회전
그룹에서 `@세나 이 주제 토론해줘: [주제]` → 세나가 유리→미루→하나 순차 호출 → 결과 종합 announce.

확인 사항:
- [ ] 유리/미루/하나 순차 호출 확인 (게이트웨이 로그)
- [ ] 각 봇이 자기 말투로 응답
- [ ] 세나가 결과를 종합하여 그룹에 announce
- [ ] 소율 제외 4인 의견 포함 (소율은 게이트키퍼라 토론 미참여도 OK)

### 실험 4: 전체 워크플로우
`@소율 이거 어떻게 하면 좋을까: [주제]` → 소율이 정리 → 세나에게 전달 → 세나가 순차 호출 → 종합 announce.

확인 사항:
- [ ] 소율 → 세나 sessions_send 확인
- [ ] 세나 → 유리/미루/하나 순차 호출
- [ ] 최종 announce에 전원 의견 포함

### 실험 5: 실패 케이스
존재하지 않는 에이전트 호출 시 안내 메시지 확인.

- [ ] 세나가 "호출이 안 됐어요" 메시지 표시
- [ ] 에러로 인한 루프/크래시 없음

## 로그 확인 방법
```bash
# 게이트웨이 로그 실시간 확인
tail -f /tmp/openclaw-gateway.log

# sessions_send 호출 확인
grep "sessions_send\|sessions.send" /tmp/openclaw-gateway.log | tail -20

# announce 확인
grep "announce\|tryAnnounce" /tmp/openclaw-gateway.log | tail -20
```

## 보고 형식
각 실험별 PASS/FAIL + 스크린샷(가능하면) → BOARD.md에 보고.

## 완료 기준
- 실험 1~4 전체 PASS
- 실험 5 안내 메시지 정상 동작
- Identity Guard 위반 0건
