# 예린 감사: 경로/인증 전수조사

## 배경
- Vertex AI 키 파일 project_id가 2개 발견됨 (`0980326098` vs `0967556941`)
- SOUL.md 2경로, 글로벌/로컬 바이너리 등 경로 혼동 이력 다수
- 전수조사로 불일치 전부 찾아서 정리

## 조사 항목

### 1. 키 파일/인증 파일 산재 확인
아래 위치에 서비스 계정 키, API 키 등이 흩어져 있는지 전수 조사:
```bash
# 서비스 계정 키 파일 찾기
find ~/.openclaw/credentials/ -name "*.json" -ls
find ~/Downloads/ -name "gen-lang-client*" -ls
find ~/Desktop/ -name "*.json" | head -20

# gcloud ADC
ls -la ~/.config/gcloud/application_default_credentials.json 2>/dev/null

# 환경변수에서 참조하는 파일 경로가 실제 존재하는지
grep -r "GOOGLE_APPLICATION_CREDENTIALS" ~/.openclaw/openclaw.json ~/.profile ~/.zshrc 2>/dev/null
```

체크리스트:
- [ ] `~/.openclaw/credentials/` 내 키 파일 목록
- [ ] `~/Downloads/`에 잔존하는 키 파일
- [ ] 각 키 파일 내부 `project_id` 확인 → 일치 여부
- [ ] 환경변수가 가리키는 파일이 실제 존재하는지

### 2. Project ID 불일치 추적
현재 알려진 2개:
- `gen-lang-client-0980326098` (최신, Downloads 키 파일)
- `gen-lang-client-0967556941` (기존, credentials 키 파일)

확인:
- [ ] `openclaw.json`의 `env.vars.GOOGLE_CLOUD_PROJECT` 값
- [ ] 각 키 파일 내 `project_id` 필드
- [ ] GCP 콘솔에서 둘 다 유효한 프로젝트인지 (가능하면)
- [ ] 어느 쪽이 Vertex AI API 활성화되어 있는지

### 3. 환경변수 충돌 확인
```bash
# 셸 설정에서 GOOGLE_ 관련 변수
grep -n "GOOGLE_" ~/.profile ~/.zshrc ~/.bash_profile 2>/dev/null

# openclaw.json env.vars
cat ~/.openclaw/openclaw.json | grep -A 10 '"env"'
```

- [ ] 셸 설정 vs openclaw.json env.vars 사이 중복/충돌 없는지
- [ ] 우선순위: openclaw.json env.vars → 셸 환경변수 (어느 쪽이 이기는지 확인)

### 4. openclaw.json 내 경로 참조 검증
config 내 모든 파일 경로가 실제 존재하는지:
```bash
# config에서 파일 경로 추출
grep -oE '"/[^"]+\.(json|pem|key|cert)"' ~/.openclaw/openclaw.json
# 각 경로 존재 여부 확인
```

- [ ] 참조된 모든 경로가 실제 존재
- [ ] 경로에 오타/오래된 경로 없음

### 5. 게이트웨이 실행 경로 재확인
```bash
pgrep -f openclaw-gateway
ps aux | grep openclaw-gateway | grep -v grep
# /opt/homebrew/ 경로면 글로벌 → 위반
```

- [ ] 로컬 빌드 경로에서 실행 중 확인
- [ ] 글로벌 바이너리 잔재 없음 (`which openclaw` → NOT FOUND)

### 6. SOUL.md 2경로 동기화 (Phase 1 검증과 겹치지만 여기서도 확인)
```bash
for name in soyul sena yuri miru hana; do
  echo "=== $name ==="
  diff ~/.openclaw/agents/$name/agent/SOUL.md ~/.openclaw/agents/$name/workspace/SOUL.md
done
```

- [ ] 5인 모두 두 경로 파일 동일

## 보고 형식

| # | 검사 항목 | PASS/FAIL | 상세 |
|:-:|----------|:---------:|------|
| 1 | 키 파일 산재 | | |
| 2 | Project ID 일치 | | |
| 3 | 환경변수 충돌 | | |
| 4 | 경로 참조 유효성 | | |
| 5 | 게이트웨이 경로 | | |
| 6 | SOUL.md 동기화 | | |

FAIL 항목 있으면 → 구체적 수정 방안 포함해서 BOARD.md에 보고.

## 완료 기준
- 6개 항목 전부 조사 완료
- 불일치 목록 + 수정 방안 정리
- BOARD.md에 보고
