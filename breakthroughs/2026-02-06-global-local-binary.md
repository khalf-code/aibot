# Eureka: 글로벌 vs 로컬 바이너리 혼동

**날짜**: 2026-02-04 발견, 2026-02-06 재발
**카테고리**: 개발 환경 / 빌드
**상태**: 해결됨 (Phase 0에서 글로벌 제거)

---

## 문제 발견

코드를 수정했는데 게이트웨이에 반영이 안 됨.

```bash
$ which openclaw
/opt/homebrew/bin/openclaw  # ← 글로벌 설치 (2026.2.3-1)
```

로컬 worktree에서 수정한 코드는 `dist/`에 빌드되지만,
`openclaw gateway run` 명령은 글로벌 패키지를 실행.

---

## 시행착오 기록

### 시도 1: npm link (2/4)
```bash
cd ~/Desktop/개발/.../03. 오픈클로
pnpm build
npm link
```

**결과**: ⚠️ 일시적 해결 — 심볼릭 링크로 로컬 연결

**문제**:
- Homebrew 업데이트 시 링크 덮어씌워짐
- 다른 터미널에서 실수로 `npm install -g openclaw` 하면 원복

---

### 시도 2: pnpm openclaw 사용 강제 (2/6)
```bash
pnpm openclaw gateway run  # 로컬 빌드 실행
```

**결과**: ✅ 성공 — 항상 로컬 코드 실행

**단점**: 매번 `pnpm` 접두사 필요

---

### 시도 3: 글로벌 바이너리 완전 제거 (2/8 Phase 0)
```bash
sudo rm /opt/homebrew/bin/openclaw
npm uninstall -g openclaw
```

**결과**: ✅ 근본 해결 — 글로벌 경로에 바이너리 없으면 혼동 불가

---

## 교훈

| 항목 | 내용 |
|------|------|
| 증상 | 코드 수정이 반영 안 됨 |
| 원인 | 글로벌(`/opt/homebrew/bin/openclaw`)과 로컬(`worktree/dist/`) 이중 존재 |
| 해결 | 글로벌 제거 + `pnpm openclaw` 사용 |
| 예방 | 절대 `npm install -g openclaw` 하지 말 것 |

---

## 체크리스트 (코드 수정 후)

- [ ] `pnpm build` 실행
- [ ] `pnpm openclaw gateway run` 사용 (글로벌 아님)
- [ ] 의심스러우면 `which openclaw` 확인

---

## 관련 커밋

- `5b5300fd8` (2/7): version mismatch warning을 CRITICAL로 업그레이드
- `560805f49` (2/7): global install detection 수정
