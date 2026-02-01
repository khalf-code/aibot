---
name: newsletter-digest
description: "뉴스레터 메일을 HTML 정제하고 핵심 내용 추출. Use when: 뉴스레터 요약해줘, 메일 정리해줘, digest newsletter, 뉴스레터 핵심만 뽑아줘"
metadata: {"moltbot":{"emoji":"📋"}}
---

# Newsletter Digest

뉴스레터 메일에서 HTML을 정제하고 핵심 내용(제목, 날짜, 주요 포인트)을 추출한다.

## 사용법

```bash
/Users/koed/moltbot/skills/newsletter-digest/scripts/digest.sh [OPTIONS] [MAIL_ID]
```

### 옵션

- `--help` - 도움말 표시
- `--stdin` - 메일 ID 대신 stdin에서 이메일 본문 읽기
- `--json` - 마크다운 대신 JSON 형식으로 출력
- `--account ACCOUNT` - 이메일 계정 지정 (기본값: 자동 감지)

### 예시

```bash
# 메일 ID로 다이제스트 생성
digest.sh 50395

# 특정 계정에서 메일 읽기
digest.sh 50395 gmail

# stdin에서 HTML 읽기
digest.sh --stdin < email.html

# JSON 형식으로 출력
digest.sh --stdin --json < email.html
```

## 워크플로우

1. `himalaya read <id>` 로 메일 본문 가져오기 (또는 stdin에서 읽기)
2. `parse-html.py` 로 HTML 정제 (script, iframe, form 제거)
3. `summarize.py` 로 제목, 날짜, 핵심 포인트 추출
4. 마크다운 또는 JSON 형식으로 출력

## 출력 형식

### 마크다운 (기본값)

```markdown
# Newsletter Title

**Date:** 2024-01-15

## Key Points

- First important point from the content
- Second important point
- Third important point
```

### JSON (--json 옵션)

```json
{
  "title": "Newsletter Title",
  "date": "2024-01-15",
  "key_points": [
    "First important point",
    "Second important point",
    "Third important point"
  ],
  "extracted_at": "2024-01-15T10:30:00.123456"
}
```

## 기능

### HTML 정제 (parse-html.py)

- 위험한 태그 제거: `<script>`, `<style>`, `<iframe>`, `<form>`, `<noscript>`
- 텍스트 추출 및 정규화
- 공백 및 줄바꿈 정리

### 핵심 내용 추출 (summarize.py)

- **제목**: 첫 번째 마크다운 헤딩 또는 첫 번째 긴 줄
- **날짜**: 일반적인 날짜 패턴 인식 (YYYY-MM-DD, Month DD, YYYY 등)
- **핵심 포인트**: 문장 점수 기반 추출
  - 길이 적절한 문장 (20-300자)
  - "important", "key", "critical" 등 키워드 포함
  - 문서 초반부 문장 우선
  - 최대 5개 포인트 (기본값)

## 통합

newsletter-parser와 함께 사용하여 뉴스레터 처리 파이프라인 구성:

```bash
# 1. 링크 추출 및 분류
parse.sh 50395 | tee links.json

# 2. 핵심 내용 추출
digest.sh 50395 | tee digest.md
```
