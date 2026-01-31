# KakaoMolt - LawCall 법률 상담 카카오톡 챗봇

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

카카오톡 채널을 통해 AI 법률 상담 서비스를 제공하는 Moltbot 플러그인입니다. 사용자의 법률 질문을 분석하여 적절한 전문 분야(민사, 형사, 이혼, 세무, 행정, 헌법)로 안내하고, LawCall 웹앱과 연동하여 전문 변호사 상담을 연결합니다.

## 주요 기능

### 1. AI 법률 상담
- Claude/GPT 기반의 지능형 법률 상담
- 자연어 질문 인식 및 법률 카테고리 자동 분류
- 6개 전문 분야별 맞춤 상담 연결 (민사, 형사, 이혼, 세무, 행정, 헌법)

### 2. 크레딧 기반 과금 시스템
- **무료 이용**: 사용자가 자신의 API 키를 등록하면 무료로 이용
- **크레딧 이용**: API 키가 없는 경우 크레딧으로 이용 (API 비용의 2배)
- **신규 사용자 혜택**: 1,000 크레딧 무료 제공

### 3. 토스페이먼츠 결제 연동
- 4가지 크레딧 패키지 (5,000원 ~ 50,000원)
- 대용량 패키지 보너스 크레딧 제공
- 안전한 결제 처리 및 환불 지원

### 4. 보안
- AES-256 암호화로 API 키 안전 저장
- SHA-256 해시로 사용자 ID 프라이버시 보호
- Supabase Row Level Security 적용

## 아키텍처

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   카카오톡 앱    │────▶│  Kakao i 오픈빌더  │────▶│   KakaoMolt     │
│   (사용자)       │◀────│    (웹훅 전달)     │◀────│   (Railway)     │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                        ┌─────────────────────────────────┼─────────────────────────────────┐
                        │                                 │                                 │
                        ▼                                 ▼                                 ▼
                ┌───────────────┐              ┌──────────────────┐              ┌──────────────────┐
                │   Supabase    │              │  Claude/OpenAI   │              │    LawCall       │
                │   Database    │              │      API         │              │    웹앱          │
                └───────────────┘              └──────────────────┘              └──────────────────┘
```

## 시작하기

### 사전 요구사항

1. **카카오 비즈니스 계정**
   - [카카오 비즈니스](https://business.kakao.com/)에서 채널 생성
   - [카카오 개발자](https://developers.kakao.com/)에서 앱 생성 및 Admin Key 발급

2. **Supabase 프로젝트**
   - [Supabase](https://supabase.com/)에서 프로젝트 생성
   - URL 및 Service Key 발급

3. **LLM API 키**
   - [Anthropic Console](https://console.anthropic.com/) - Claude API
   - 또는 [OpenAI Platform](https://platform.openai.com/) - GPT API

4. **토스페이먼츠 계정** (크레딧 결제 사용 시)
   - [토스페이먼츠 개발자센터](https://developers.tosspayments.com/)에서 키 발급

### 설치 및 배포

#### 1. 저장소 클론

```bash
git clone https://github.com/Kimjaechol/kakaomolt.git
cd kakaomolt
```

#### 2. Supabase 데이터베이스 설정

Supabase SQL Editor에서 `supabase-schema.sql` 실행:

```bash
# 또는 Supabase CLI 사용
supabase db push
```

#### 3. Railway 배포

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template)

**환경 변수 설정:**

```env
# 필수: LLM API
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx

# 필수: 카카오 API
KAKAO_ADMIN_KEY=your_admin_key_here

# 필수: Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 필수: LawCall 라우팅
LAWCALL_ROUTES={"민사":"https://lawcall.com/civil","형사":"https://lawcall.com/criminal","이혼":"https://lawcall.com/family","세무":"https://lawcall.com/tax","행정":"https://lawcall.com/admin","헌법":"https://lawcall.com/constitutional","기본":"https://lawcall.com"}
LAWCALL_LAWYER_NAME=김재철 변호사
LAWCALL_SERVICE_NAME=LawCall

# 결제 (선택)
TOSS_CLIENT_KEY=test_ck_xxxxxxxx
TOSS_SECRET_KEY=test_sk_xxxxxxxx
LAWCALL_BASE_URL=https://your-domain.railway.app

# 보안 (권장)
LAWCALL_ENCRYPTION_KEY=your-32-char-encryption-key-here
LAWCALL_USER_SALT=your-random-salt-here
```

#### 4. 카카오 i 오픈빌더 설정

1. [카카오 i 오픈빌더](https://i.kakao.com/) 접속
2. 새 봇 생성 → 스킬 서버 추가
3. 웹훅 URL 설정: `https://your-app.railway.app/kakao/webhook`
4. 발화 블록에 스킬 연결

자세한 설정 가이드는 [DEPLOY-RAILWAY.md](./DEPLOY-RAILWAY.md)를 참조하세요.

## 사용 방법

### 사용자 명령어

| 명령어 | 설명 |
|--------|------|
| `잔액` / `크레딧` | 현재 크레딧 잔액 확인 |
| `충전` | 크레딧 충전 패키지 선택 |
| `요금 안내` | 요금제 및 가격 정보 확인 |
| `결제내역` | 최근 결제 내역 조회 |
| `API키 등록` | 자신의 API 키 등록 안내 |

### API 키 등록 (무료 이용)

사용자가 자신의 LLM API 키를 등록하면 크레딧 차감 없이 무료로 이용할 수 있습니다:

```
API키 등록 sk-ant-api03-xxxxxxxxx
```

또는

```
API키 등록 sk-xxxxxxxxx
```

### 법률 상담 예시

```
사용자: 이웃집에서 시끄럽게 해서 너무 힘들어요. 어떻게 해야 하나요?

봇: [법률 상담 응답]
    ...

    📋 전문 변호사와 상담하시겠어요?
    [🔗 민사 상담 신청하기] ← 버튼
```

## 크레딧 요금제

| 모델 | 입력 토큰 (1K) | 출력 토큰 (1K) |
|------|---------------|---------------|
| Claude 3 Haiku | 1 크레딧 | 5 크레딧 |
| Claude 3.5 Sonnet | 6 크레딧 | 30 크레딧 |
| Claude 3 Opus | 30 크레딧 | 150 크레딧 |
| GPT-4o | 10 크레딧 | 30 크레딧 |
| GPT-4o-mini | 1 크레딧 | 4 크레딧 |

### 충전 패키지

| 패키지 | 가격 | 크레딧 | 보너스 |
|--------|------|--------|--------|
| 기본 | 5,000원 | 5,000 | - |
| 표준 | 10,000원 | 10,000 | +1,000 |
| 프리미엄 | 20,000원 | 20,000 | +3,000 |
| 프로 | 50,000원 | 50,000 | +10,000 |

## 프로젝트 구조

```
kakaomolt/
├── index.ts              # 메인 엔트리포인트
├── src/
│   ├── api-client.ts     # Kakao API 클라이언트
│   ├── webhook.ts        # 웹훅 핸들러
│   ├── billing.ts        # 크레딧 관리 (Supabase)
│   ├── billing-handler.ts # 과금 명령어 처리
│   ├── payment.ts        # 토스페이먼츠 연동
│   ├── lawcall-router.ts # 법률 카테고리 라우팅
│   └── supabase.ts       # Supabase 클라이언트
├── supabase-schema.sql   # 데이터베이스 스키마
├── Dockerfile            # 컨테이너 설정
├── docker-compose.yml    # 로컬 개발 환경
├── railway.json          # Railway 배포 설정
├── fly.toml              # Fly.io 배포 설정
└── .env.example          # 환경 변수 예시
```

## 개발

### 로컬 실행

```bash
# 의존성 설치
pnpm install

# 환경 변수 설정
cp .env.example .env
# .env 파일 편집

# 개발 서버 실행
pnpm dev

# ngrok으로 터널링 (선택)
ngrok http 8788
```

### Docker 실행

```bash
docker-compose up -d
```

## 라이선스

MIT License - 자세한 내용은 [LICENSE](./LICENSE) 파일을 참조하세요.

## 기여

버그 리포트, 기능 제안, Pull Request를 환영합니다!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 문의

- GitHub Issues: [https://github.com/Kimjaechol/kakaomolt/issues](https://github.com/Kimjaechol/kakaomolt/issues)
- LawCall 서비스: [https://lawcall.com](https://lawcall.com)
