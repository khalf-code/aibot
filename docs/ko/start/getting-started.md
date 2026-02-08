---
summary: "OpenClaw를 설치하고 첫 번째 채팅까지 빠르게 완료하는 가이드입니다."
read_when:
  - 처음부터 빠르게 설정하고 싶을 때
  - 가장 짧은 경로로 채팅을 시작하고 싶을 때
title: "시작하기"
x-i18n:
  source_path: start/getting-started.md
  source_hash: 78cfa02eb2e4ea1a83e18edd99d142dbae707ec063e8d74c9a54f94581aa067f
  workflow: manual-ko-bootstrap
---

# 시작하기

목표: 최소 설정으로 **0에서 첫 채팅**까지 빠르게 진행합니다.

<Note>
한국어 문서는 현재 일부 페이지만 번역되어 있습니다. 상세 문서는 영어 페이지로
연결될 수 있습니다.
</Note>

<Info>
가장 빠른 경로는 Control UI를 여는 것입니다(채널 설정 불필요).  
`openclaw dashboard`를 실행한 뒤 브라우저에서 채팅하거나,
<Tooltip headline="Gateway host" tip="OpenClaw Gateway 서비스가 실행 중인 머신">Gateway host</Tooltip>
에서 `http://127.0.0.1:18789/`를 여세요.  
관련 문서: [Dashboard](/web/dashboard), [Control UI](/web/control-ui)
</Info>

## 사전 요구사항

- Node 22 이상

<Tip>
버전이 헷갈리면 `node --version`으로 확인하세요.
</Tip>

## 빠른 설정 (CLI)

<Steps>
  <Step title="OpenClaw 설치 (권장)">
    <Tabs>
      <Tab title="macOS/Linux">
        ```bash
        curl -fsSL https://openclaw.ai/install.sh | bash
        ```
      </Tab>
      <Tab title="Windows (PowerShell)">
        ```powershell
        iwr -useb https://openclaw.ai/install.ps1 | iex
        ```
      </Tab>
    </Tabs>

    <Note>
    다른 설치 방식과 요구사항은 [Install](/install)을 참고하세요.
    </Note>

  </Step>
  <Step title="온보딩 마법사 실행">
    ```bash
    openclaw onboard --install-daemon
    ```

    마법사가 인증, Gateway 설정, 선택 채널 구성을 안내합니다.  
    자세한 내용: [Onboarding Wizard](/start/wizard)

  </Step>
  <Step title="Gateway 상태 확인">
    서비스를 설치했다면 보통 이미 실행 중입니다.

    ```bash
    openclaw gateway status
    ```

  </Step>
  <Step title="Control UI 열기">
    ```bash
    openclaw dashboard
    ```
  </Step>
</Steps>

<Check>
Control UI가 열리면 Gateway가 정상 동작 중입니다.
</Check>

## 선택 점검 및 추가 작업

<AccordionGroup>
  <Accordion title="Gateway를 포그라운드로 실행">
    빠른 테스트나 문제 분석에 유용합니다.

    ```bash
    openclaw gateway --port 18789
    ```

  </Accordion>
  <Accordion title="테스트 메시지 보내기">
    채널이 미리 설정되어 있어야 합니다.

    ```bash
    openclaw message send --target +15555550123 --message "Hello from OpenClaw"
    ```

  </Accordion>
</AccordionGroup>

## 더 알아보기

<Columns>
  <Card title="Onboarding Wizard (상세)" href="/start/wizard">
    CLI 마법사 전체 옵션과 고급 설정을 확인하세요.
  </Card>
  <Card title="macOS 앱 온보딩" href="/start/onboarding">
    macOS 앱 첫 실행 흐름을 확인하세요.
  </Card>
</Columns>

## 완료 상태

- 실행 중인 Gateway
- 인증 구성 완료
- Control UI 접근 또는 채널 연결 완료

## 다음 단계

- DM 보안/승인 흐름: [Pairing](/channels/pairing)
- 채널 추가 연결: [Channels](/channels)
- 고급 워크플로우/소스 빌드: [Setup](/start/setup)
