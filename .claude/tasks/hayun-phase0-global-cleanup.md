# Phase 0: 글로벌 바이너리 삭제 + 로컬 빌드 고정

## 목표
글로벌 openclaw (2026.2.3-1) 제거. 이후 모든 게이트웨이 실행은 로컬 빌드만 사용.

## 작업

### 1. 글로벌 삭제
```bash
npm uninstall -g openclaw
# 또는 brew로 설치된 경우:
brew uninstall openclaw
```

### 2. 확인
```bash
which openclaw  # 결과 없어야 함
```

### 3. 로컬 빌드 확인
```bash
cd ~/.openclaw/worktrees/hayun
pnpm build  # PASS 확인
```

### 4. 게이트웨이 시작 (로컬)
```bash
cd ~/.openclaw/worktrees/hayun
pkill -9 -f openclaw-gateway || true
pnpm openclaw gateway run --bind loopback --port 18789 --force
```

### 5. 버전 확인
게이트웨이 로그에서 `2026.2.6` 확인. `2026.2.3` 나오면 실패.

## 완료 기준
- `which openclaw` → 결과 없음
- 게이트웨이 로그에 버전 불일치 경고 없음
- 5개 봇 정상 시작
