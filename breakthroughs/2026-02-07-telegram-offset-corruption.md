# Eureka: 텔레그램 Offset 오염

**날짜**: 2026-02-07
**카테고리**: Telegram / Polling
**상태**: 해결됨 (복구 절차 확립)

---

## 문제 발견

YURI 봇이 텔레그램에서 완전히 무반응.
- 메시지 전송해도 응답 없음
- 게이트웨이 로그에 메시지 수신 기록 없음

---

## 시행착오 기록

### 시도 1: 봇 토큰 확인
MEuGINI_bot → yuri_ocw_bot으로 교체한 상태.
토큰 자체는 정상.

**결과**: ❌ 토큰 문제 아님

---

### 시도 2: getUpdates API 직접 호출 (실수)
```bash
curl "https://api.telegram.org/bot{TOKEN}/getUpdates"
```

**결과**: ❌ 치명적 실수!

게이트웨이가 long-polling 중인데 getUpdates를 직접 호출하면:
- 두 polling이 충돌
- offset이 꼬임
- 메시지 유실 또는 중복 처리

---

### 시도 3: offset 파일 확인
```bash
cat ~/.openclaw/telegram/update-offset-yuri.json
# {"version":1,"lastUpdateId":123456}  ← 이전 봇(MEuGINI)의 offset!
```

**발견**: 봇 토큰을 교체했는데 offset 파일에 이전 봇의 update_id가 남아있음.
새 봇의 update_id는 완전히 다른 숫자대.

**결과**: 원인 발견!

---

### 시도 4: offset 리셋 시도 (잘못된 방법)
```bash
echo '{"version":1,"lastUpdateId":null}' > ~/.openclaw/telegram/update-offset-yuri.json
```

**결과**: ❌ 실패 — `null`은 유효한 offset이 아님. polling 자체가 안 됨.

---

### 시도 5: 올바른 offset 복구 (정답)
```bash
# 1. 게이트웨이 중지 (필수!)
pkill -9 -f openclaw-gateway

# 2. 최신 update_id 획득 (게이트웨이 꺼진 상태에서만!)
curl -s "https://api.telegram.org/bot{TOKEN}/getUpdates?offset=-1&limit=1" | jq '.result[-1].update_id'
# 출력: 789012

# 3. offset 파일 설정
echo '{"version":1,"lastUpdateId":789012}' > ~/.openclaw/telegram/update-offset-yuri.json

# 4. 게이트웨이 재시작
pnpm openclaw gateway run
```

**결과**: ✅ 정상 복구!

---

## 교훈

| 항목 | 내용 |
|------|------|
| 증상 | 봇이 메시지를 전혀 수신 못함 |
| 원인 | offset 파일에 이전 봇의 update_id 잔존 |
| 악화 원인 | getUpdates API 직접 호출로 polling 충돌 |
| 해결 | 게이트웨이 중지 → 최신 offset 획득 → 파일 설정 → 재시작 |

---

## 절대 하지 말 것

1. **게이트웨이 실행 중 `getUpdates` API 직접 호출 금지**
   - gateway polling과 충돌 → offset 꼬임

2. **offset을 `null`로 설정 금지**
   - polling 실패. 반드시 유효한 update_id 필요

3. **봇 토큰 교체 후 offset 파일 확인 필수**
   - 이전 봇의 offset이 남아있으면 새 봇이 작동 안 함

---

## 복구 스크립트

```bash
#!/bin/bash
# fix-telegram-offset.sh
BOT_TOKEN="$1"
AGENT_ID="$2"

if [ -z "$BOT_TOKEN" ] || [ -z "$AGENT_ID" ]; then
  echo "Usage: $0 <bot_token> <agent_id>"
  exit 1
fi

# 게이트웨이 중지
pkill -9 -f openclaw-gateway || true
sleep 2

# 최신 offset 획득
OFFSET=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=-1&limit=1" | jq '.result[-1].update_id')

if [ "$OFFSET" != "null" ] && [ -n "$OFFSET" ]; then
  echo "{\"version\":1,\"lastUpdateId\":${OFFSET}}" > ~/.openclaw/telegram/update-offset-${AGENT_ID}.json
  echo "Offset set to: $OFFSET"
else
  echo "No updates found. Creating empty offset file."
  echo '{"version":1,"lastUpdateId":0}' > ~/.openclaw/telegram/update-offset-${AGENT_ID}.json
fi

echo "Done. Restart gateway with: pnpm openclaw gateway run"
```
