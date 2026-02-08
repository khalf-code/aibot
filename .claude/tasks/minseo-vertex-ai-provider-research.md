# 민서 리서치: OpenClaw Vertex AI Provider 지원 여부

## 배경
- 현재 Google AI Studio (`google-ai-studio/`) 경유로 Gemini 모델 사용 가능
- 문제: AI Studio에 rate limit 존재 → Vertex AI로 전환 희망
- Vertex AI: Google Cloud 프로젝트 + 서비스 계정 키 인증 (rate limit 더 높음)
- 참고 스크립트: `/Users/jeon-yeongjin/Desktop/gemini_client.py` (Vertex AI 직접 호출 예시)

## 조사 항목

### 1. OpenClaw 코드에서 Vertex AI provider 지원 여부
- `src/` 내 provider 관련 코드 탐색
- `google-ai-studio` provider가 어디에 구현되어 있는지 확인
- Vertex AI 별도 provider가 있는지, 또는 같은 provider에서 옵션으로 지원하는지

### 2. openclaw.json 설정 방법
- Vertex AI를 사용하려면 어떤 설정이 필요한지
- 서비스 계정 키 파일 경로 설정 방법
- project_id, location 설정 방법
- 모델 ID 형식 (`vertex-ai/gemini-3-flash-preview`? 또는 다른 형식?)

### 3. 미지원 시 대안
- OpenClaw에 Vertex AI provider가 없으면:
  - 기존 `google-ai-studio` provider를 Vertex AI로 확장 가능한지
  - OpenAI 호환 엔드포인트 경유 가능한지
  - LiteLLM 등 프록시 경유 가능한지

### 4. AI Studio vs Vertex AI 비교 (간단히)
| 항목 | AI Studio | Vertex AI |
|------|-----------|-----------|
| 인증 | API Key | 서비스 계정 키 |
| Rate Limit | 낮음 (RPM 제한) | 높음 (프로젝트 쿼터) |
| 비용 | 무료 티어 있음 | 사용량 과금 |
| 모델 | 동일 | 동일 |

## 조사 범위
- `src/` 내 provider/model 관련 코드
- `docs/` 내 provider 설정 가이드
- `openclaw.json` 스키마 (어떤 provider prefix가 유효한지)

## 결과물
- BOARD.md에 조사 결과 요약 보고
- 지원됨 → 설정 방법 정리
- 미지원 → 가장 현실적인 대안 1개 추천

## 우선순위
현재 A2A Phase 1 진행 중이므로 Phase 작업에 방해되지 않는 선에서 조사.
