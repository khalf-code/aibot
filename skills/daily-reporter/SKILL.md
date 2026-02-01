---
name: daily-reporter
description: "캘린더/뉴스레터/웹 스크랩을 모아 데일리 노트를 생성. Use when: 데일리 리포트 생성, 오늘 요약, daily reporter"
metadata: {"moltbot": {"emoji": "🗓️"}}
---

# Daily Reporter

캘린더 일정, 뉴스레터 요약, 웹 스크랩을 합쳐 Obsidian 데일리 노트를 생성한다.

## 사용법

```bash
# 도움말
/Users/koed/moltbot/skills/daily-reporter/scripts/reporter.sh help

# 미리보기 (stdout)
/Users/koed/moltbot/skills/daily-reporter/scripts/reporter.sh preview

# 생성 후 Obsidian 저장
/Users/koed/moltbot/skills/daily-reporter/scripts/reporter.sh generate

# 기존 파일 저장
/Users/koed/moltbot/skills/daily-reporter/scripts/reporter.sh save /path/to/file.md
```

## 출력 경로

- 기본 Obsidian 경로: `~/Dev/BrainFucked/95-Daily/YYYY-MM-DD-daily.md`
- 경로는 `references/config.json`에서 변경 가능

## 문서 구조

```markdown
# 🗓️ 데일리 리포트 - 2026년 02월 01일 (토)

## 📅 오늘의 일정
- **09:30** - 스탠드업

## 📬 뉴스레터 요약
- 뉴스레터 제목: 핵심 요약

## 🌐 웹 스크랩
- 스크랩 제목: 요약

## ✅ TODO
```

## 의존성

- Bun (TypeScript 실행)
- jq (config.json 파싱)
- calendar-schedule 스킬

## 설정

`references/config.json`에서 출력 경로 및 데이터 소스 경로를 수정한다.
