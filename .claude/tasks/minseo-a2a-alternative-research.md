# 민서 리서치: sessions_send 우회 — 텔레그램 A2A 대안 패턴

## 배경
- sessions_send 외부 성공 사례 0건 (이전 리서치 확인)
- 구조적 문제: agentChannel webchat 고정, announce 스킵, 미해결 이슈 다수
- "텔레그램에서 A2A를 sessions_send 없이 구현하는 편법이 있다"는 정보

## 조사 도구
- `/get-code-context-exa` (Exa MCP) — 핵심 도구
- WebSearch — 커뮤니티 논의, 블로그
- GitHub 검색 — openclaw discussions, issues

## 검색 키워드 (Exa)
순서대로 검색. 각 키워드 결과 기록.

### 그룹 1: 텔레그램 봇 간 통신 대안
- `openclaw telegram multi-agent without sessions_send`
- `openclaw telegram bot to bot communication alternative`
- `openclaw telegram group multi bot workaround`
- `openclaw cron message between agents`

### 그룹 2: announce / message 직접 사용
- `openclaw announce tool telegram group`
- `openclaw message send between agents telegram`
- `openclaw deliver channel telegram agent`
- `openclaw tryAnnounce multi-agent`

### 그룹 3: 스킬/훅 기반 우회
- `openclaw skill proxy agent message`
- `openclaw hook before tool agent forward`
- `openclaw custom tool agent communication`
- `openclaw webhook relay telegram bot`

### 그룹 4: 다른 플랫폼 성공 사례 (적용 가능성)
- `openclaw discord multi-agent success`
- `openclaw slack multi-agent communication`
- `multi-agent chatbot telegram group implementation`

### 그룹 5: 텔레그램 자체 기능 활용
- `telegram bot api forward message between bots`
- `telegram bot group chat multi bot coordination`
- `telegram bot reply chain automation`

## 분석 관점

각 대안에 대해:
1. **동작 원리**: 어떻게 봇 간 메시지를 전달하는가
2. **장점**: sessions_send 대비 뭐가 나은가
3. **단점/제약**: 어떤 제한이 있는가
4. **구현 난이도**: 코드 변경 범위
5. **우리 상황 적합도**: 5인 페르소나 + 그룹 토론에 맞는가

## 기대하는 대안 유형

| 유형 | 설명 |
|------|------|
| Telegram Bot API 직접 | 봇이 직접 sendMessage로 그룹에 메시지 → 다른 봇이 @mention 감지 |
| cron + message | 크론으로 주기적 메시지 교환 |
| announce 직접 호출 | sessions_send 없이 announce만으로 그룹 전달 |
| 스킬/도구 커스텀 | 커스텀 도구로 HTTP 호출 → 다른 봇 트리거 |
| 웹훅 체인 | 봇A → 웹훅 → 봇B 세션 트리거 |
| 외부 큐 | Redis/파일 기반 메시지 큐로 봇 간 통신 |

## 결과물 형식

```markdown
# A2A 대안 패턴 리서치 결과

## 발견된 대안 목록
| # | 패턴명 | 동작 원리 | 장점 | 단점 | 난이도 | 적합도 |

## 추천 TOP 3 (우리 상황 기준)
| # | 패턴 | 이유 | 구현 방향 |

## sessions_send vs 대안 비교
| 항목 | sessions_send | 대안 1 | 대안 2 |
```

## 보고
- 결과물: `~/.openclaw/worktrees/minseo/.claude/tasks/minseo-a2a-alternative-result.md`
- BOARD.md에 요약 보고
