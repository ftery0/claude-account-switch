---
title: 빠른 시작 — claude-account-switch
description: claude-account-switch를 1분 안에 시작하세요. 프로필 생성, 기존 설정 마이그레이션, Claude Code 계정 전환 방법을 안내합니다.
jsonLd:
  "@context": "https://schema.org"
  "@type": "FAQPage"
  mainEntity:
    - "@type": "Question"
      name: "Claude Code에서 멀티 계정을 어떻게 사용하나요?"
      acceptedAnswer:
        "@type": "Answer"
        text: "claude-account-switch를 설치하고 'npx claude-account-switch init'을 실행하세요. CLAUDE_CONFIG_DIR 환경변수를 활용해 프로필별로 독립된 OAuth 인증 정보를 관리합니다."
    - "@type": "Question"
      name: "claude-account-switch에 외부 의존성이 있나요?"
      acceptedAnswer:
        "@type": "Answer"
        text: "없습니다. Node.js 내장 모듈만 사용하여 외부 의존성이 전혀 없고 npx 실행 시 즉시 시작됩니다."
    - "@type": "Question"
      name: "어떤 플랫폼을 지원하나요?"
      acceptedAnswer:
        "@type": "Answer"
        text: "macOS, Linux, Windows (네이티브 + WSL)를 지원합니다. zsh, bash, fish, PowerShell 셸과 호환됩니다."
    - "@type": "Question"
      name: "프로필 간 설정을 공유할 수 있나요?"
      acceptedAnswer:
        "@type": "Answer"
        text: "네. settings.json과 커스텀 명령어 같은 공유 파일은 _shared 디렉토리에 저장되고 각 프로필에 심링크되어 변경사항이 모든 프로필에 자동 반영됩니다."
---

# 빠른 시작

1분 안에 여러 Claude Code 계정을 설정하고 사용하세요.

## 왜 claude-account-switch인가?

Claude Code는 공식적으로 멀티 계정을 지원하지 않습니다. `claude-account-switch`는 `CLAUDE_CONFIG_DIR` 환경변수를 활용해 프로필별로 독립된 OAuth 인증 정보를 관리합니다.

## 설치

```bash
npx claude-account-switch init
```

인터랙티브 위자드의 실행 흐름입니다:

```
  ╭──────────────────────────────────────╮
  │ Welcome to Claude Switch!            │
  │ Multi-account manager for Claude Code│
  ╰──────────────────────────────────────╯

  How many profiles do you want to set up? 2

  Profile 1 name: work
  Profile 2 name: personal

  Which profile should be active by default?
  ❯ work
    personal

  Share settings across profiles? (recommended) Yes

  Existing ~/.claude detected. Migrate to a profile?
  ❯ Yes, migrate to "work"
    Yes, migrate to "personal"
    No, skip

  ✓ Migrated ~/.claude → profile: work
  ⚠ Original ~/.claude was NOT deleted.
  ✓ Created profile: work
  ✓ Created profile: personal
  ✓ Shared settings linked
  ✓ Shell integration installed (zsh, bash)
  ✓ Active profile: work

  Next steps:
    1. Open a new terminal
    2. Run claude to authenticate your "work" profile
    3. Run cpf personal && claude to authenticate "personal"
```

## 설치 후 사용

```bash
claude           # 활성 프로필로 Claude 실행
cpf work         # "work" 프로필로 전환
cpf personal     # "personal" 프로필로 전환
claude-pick      # 화살표 키로 프로필 선택
```

## 다음 단계

- [설치 방법](/ko/guide/installation) — 모든 설치 방법
- [명령어 레퍼런스](/ko/guide/commands) — 전체 CLI 명령어
- [셸 통합](/ko/guide/shell-integration) — 사용 가능한 셸 명령어
- 플랫폼별 가이드: [macOS](/ko/guide/setup-macos) · [Linux](/ko/guide/setup-linux) · [Windows](/ko/guide/setup-windows)
