# Phase 2: 코드 수정 (A2A 안정화) — Hybrid 전략 반영

## blocked_by: Phase 0 + Phase 1
## 전략: sessions_send (내부) + message tool (외부 Telegram 표시)

## 참고 자료
- 시시포스 브랜치: `feature/phase-2-context-fix` (sujin worktree)
- 예린 커밋: cs/yuri `f31f98556` (reply 제거), `7685c669d` (internal channel 필터)
- 민서 리서치: `minseo-a2a-rootcause-top5.md`, `minseo-a2a-alternative-result.md`
- breakthroughs: `breakthroughs/INDEX.md` (12개 시행착오 문서)

## 핵심 변경: Hybrid A2A 전략

### 왜 Hybrid인가
| 방법 | 장점 | 단점 |
|------|------|------|
| sessions_send 단독 | 세션 히스토리 유지, 내부 맥락 보존 | announce가 webchat에 sticking → 그룹 표시 불가 |
| message tool 단독 | 채널 어댑터 직접 호출 → 확실한 전달 | 세션 히스토리 없음, 단방향 |
| **Hybrid** | **내부는 sessions_send, 외부 표시는 message tool** | 구현 복잡도 약간 증가 |

### 구현 방식
1. `sessions_send`로 봇 간 내부 통신 (세션 맥락 유지)
2. 응답 수신 후, **message tool로 Telegram 그룹에 결과 표시**
3. message tool 코드 경로: `src/agents/tools/message-tool.ts:326-403`
   - `message(action='send', channel='telegram', to='chatId')` → channel adapter 직접 호출
   - agentChannel 결정 로직을 우회 → webchat sticking 없음

## 작업

### 1. 시시포스 코드 cherry-pick
`feature/phase-2-context-fix` 브랜치에서 유용한 변경분을 `cs/hana`로 가져오기:
- `system-prompt.ts` Identity Guard 추가분
- 나머지는 코드 검토 후 판단

### 2. 예린 코드 머지
cs/yuri에서 cs/hana로:
- `7685c669d`: `isInternalMessageChannel()` 체크 + `requesterSessionKey` 폴백
- `f31f98556`: reply 필드 제거
- 테스트 파일 포함

### 3. Self-Response Loop Guard 추가
위치: `src/telegram/bot-handlers.ts`
로직: `from.id === bot.id`이면 무시

### 4. Persona Confusion 방지
위치: `src/agents/pi-embedded-subscribe.handlers.messages.ts`
로직: 수신 메시지의 target이 자기 agentId가 아니면 무시

### 5. sessions_send 실패 시 message tool fallback
위치: `src/agents/tools/sessions-send-tool.a2a.ts`
로직:
- sessions_send announce 실패 감지
- catch 블록에서 message tool로 Telegram 그룹에 결과 직접 전달
- 코드 참고: `message-tool.ts:326-403`

### 6. SOUL.md에 Hybrid 전략 반영
각 에이전트 SOUL.md에 추가:
```markdown
## A2A Communication
- 내부 통신: sessions_send 사용
- 결과 표시: message(action='send', channel='telegram', to='{groupChatId}') 사용
- announce 실패 시 message tool로 직접 전달
```

### 7. 빌드 + 게이트웨이 재시작
```bash
pnpm build && pnpm openclaw gateway run --force
```

## 완료 기준
- `pnpm build` PASS
- 게이트웨이 로그에 에러 없음
- Identity Guard 문자열이 dist/에 존재 확인
- 테스트: "세나 미루 토론해봐" → 텔레그램 그룹에 결과 표시 확인
