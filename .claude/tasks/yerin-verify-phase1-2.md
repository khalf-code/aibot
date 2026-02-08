# 예린 검증: Phase 1 + Phase 2 리뷰

## blocked_by: Phase 1, Phase 2

## 검증 대상

### Phase 1: SOUL.md 5인 배포 검증

#### 1. 동기화 확인 (5인 x 2경로 = 10파일)
```bash
# 각 에이전트별 workspace/agent 동기화 확인
for name in soyul sena yuri miru hana; do
  echo "=== $name ==="
  diff ~/.openclaw/agents/$name/agent/SOUL.md ~/.openclaw/agents/$name/workspace/SOUL.md
done
```
- [ ] 5인 모두 두 경로 동일

#### 2. 필수 요소 포함 확인
각 SOUL.md에 아래 3가지 포함 여부:

| 에이전트 | [A] 페르소나 | [B] A2A 규칙 | [C] Rule A |
|---------|:-----------:|:-----------:|:----------:|
| 소율 | [ ] | [ ] | [ ] |
| 세나 | [ ] | [ ] | [ ] |
| 유리 | [ ] | [ ] | [ ] |
| 미루 | [ ] | [ ] | [ ] |
| 하나 | [ ] | [ ] | [ ] |

#### 3. Identity Guard 확인
각 SOUL.md 상단에 Identity Guard 문구 존재:
```
너는 {이름}이다. 다른 에이전트의 말투나 역할을 흉내내지 마라.
```
- [ ] 5인 모두 포함

#### 4. 세나 sessions_send 트리거 확인
세나 SOUL.md에 아래 포함:
- [ ] 트리거 키워드 목록 ("토론", "의견", "상의", "물어봐", "협업")
- [ ] sessions_send JSON 예시
- [ ] 실패 시 재시도 + 안내 로직
- [ ] 호출 순서: 유리 → 미루 → 하나

### Phase 2: 코드 수정 검증

#### 1. Identity Guard (system-prompt.ts)
- [ ] Identity Guard 문자열이 `dist/`에 존재 (`grep -r "Identity" dist/`)
- [ ] 시시포스 커밋에서 가져온 변경이 정확한지 확인

#### 2. 예린 커밋 머지 확인
- [ ] `isInternalMessageChannel()` 체크 반영됨 (sessions-announce-target.ts)
- [ ] `requesterSessionKey` 폴백 로직 반영됨
- [ ] reply 필드 제거됨 (sessions-send-tool.ts)
- [ ] 테스트 3건 포함 (sessions-announce-target.test.ts)

#### 3. Self-Response Loop Guard
- [ ] bot-handlers.ts에 자기 메시지 무시 로직 존재
- [ ] `from.id === bot.id` 체크

#### 4. Persona Confusion 방지
- [ ] 수신 메시지 target ≠ 자기 agentId → 무시 로직

#### 5. sessions_send 실패 안내
- [ ] catch 블록에서 announce 실패 메시지 전달

#### 6. 빌드 확인
```bash
cd ~/.openclaw/worktrees/hayun
pnpm build  # PASS 확인
```
- [ ] 빌드 PASS
- [ ] 타입 에러 0건

## 보고 형식
| 항목 | PASS/FAIL | 비고 |
|------|:---------:|------|
| ... | | |

Critical/Major 이슈 있으면 하윤에게 직접 피드백 + 수진에게 보고.

## 완료 기준
- Phase 1: 10파일 동기화 + 필수 요소 전부 포함
- Phase 2: 빌드 PASS + 5개 코드 변경 확인
- Critical 이슈 0건
