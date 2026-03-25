# claude-account-switch

[![npm version](https://img.shields.io/npm/v/claude-account-switch)](https://www.npmjs.com/package/claude-account-switch)
[![npm downloads](https://img.shields.io/npm/dm/claude-account-switch)](https://www.npmjs.com/package/claude-account-switch)
[![license](https://img.shields.io/npm/l/claude-account-switch)](./LICENSE)

[Claude Code](https://docs.anthropic.com/en/docs/claude-code)를 위한 멀티 계정 프로필 관리 도구.

[English](./README.md)

Claude Code는 공식적으로 멀티 계정을 지원하지 않습니다. `claude-account-switch`는 `CLAUDE_CONFIG_DIR` 환경변수를 활용해 프로필별로 독립된 OAuth 인증 정보를 관리합니다.

## 빠른 시작

```bash
npx claude-account-switch init
```

인터랙티브 위자드가 프로필 생성, 기존 설정 마이그레이션, 감지된 모든 셸에 셸 통합 자동 설치를 안내합니다.

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

**플랫폼별 가이드:** [macOS](docs/setup-macos.ko.md) · [Linux](docs/setup-linux.ko.md) · [Windows](docs/setup-windows.ko.md)

## 설치

```bash
# npx로 바로 사용 (권장)
npx claude-account-switch init

# 또는 글로벌 설치
npm i -g claude-account-switch
```

## 명령어

| 명령어 | 설명 |
|--------|------|
| `claude-account-switch init` | 인터랙티브 설정 위자드 |
| `claude-account-switch add <name>` | 새 프로필 생성 |
| `claude-account-switch remove <name>` | 프로필 삭제 |
| `claude-account-switch list` | 프로필 목록 |
| `claude-account-switch use <name>` | 활성 프로필 전환 |
| `claude-account-switch migrate [name]` | 기존 `~/.claude` 데이터를 프로필로 마이그레이션 |
| `claude-account-switch install-shell` | 셸 통합 설치 |

## 셸 통합

`init` 실행 시 감지된 모든 셸에 자동 설치됩니다. 터미널에서 사용 가능:

| 명령어 | 설명 |
|--------|------|
| `claude` | 활성 프로필로 Claude 실행 |
| `cpf <name>` | 빠른 프로필 전환 |
| `claude-pick` | 인터랙티브 프로필 선택기 |

**지원 셸:**

| 셸 | 플랫폼 | 설정 파일 |
|----|--------|-----------|
| zsh | macOS / Linux | `~/.zshrc` |
| bash | macOS / Linux / Git Bash | `~/.bashrc` |
| fish | macOS / Linux | `~/.config/fish/config.fish` |
| PowerShell | Windows | `$PROFILE` |

## 작동 방식

```
~/.claude-profiles/
├── meta.json                  ← 프로필 메타 정보 + 활성 프로필
├── .shell-integration.sh      ← bash/zsh 통합 스크립트
├── .shell-integration.fish    ← fish 통합 스크립트
├── .shell-integration.ps1     ← PowerShell 통합 스크립트
├── .picker.mjs                ← 화살표 키 선택기 스크립트
├── _shared/
│   ├── settings.json          ← 공통 설정 (원본)
│   └── commands/               ← 공통 커스텀 명령어
├── work/
│   ├── .claude.json           ← 회사 계정 OAuth
│   ├── settings.local.json    ← 로컬 설정 (프로필별)
│   ├── settings.json          → ../_shared/settings.json (심링크)
│   ├── commands/              → ../_shared/commands/ (심링크)
│   ├── plugins/               ← 설치된 플러그인
│   ├── projects/              ← 프로젝트별 설정
│   └── plans/                 ← 저장된 플랜
└── personal/
    ├── .claude.json           ← 개인 계정 OAuth
    ├── settings.local.json
    ├── settings.json          → ../_shared/settings.json
    ├── commands/              → ../_shared/commands/
    ├── plugins/
    ├── projects/
    └── plans/
```

- **공유 파일** (`settings.json`, `commands/`)은 `_shared/`에 원본 저장, 각 프로필에 링크
  - macOS/Linux: 심볼릭 링크
  - Windows: 먼저 심링크 생성을 시도하고, 실패 시(개발자 모드 미활성) 복사. 디렉토리는 항상 junction 사용.
- **프로필별 파일** (`.claude.json`, `settings.local.json`, `plugins/`, `projects/`, `plans/`)은 독립 보관
- **임시 파일** (`cache/`, `sessions/`, `history.jsonl` 등)은 Claude Code가 자동 생성, 관리하지 않음

## 프로필 이름 규칙

- 영문 소문자, 숫자, 하이픈만 허용
- 문자 또는 숫자로 시작하고 끝나야 함
- 최대 30자
- 예약어 불가: `_shared`, `default`

## 요구사항

- Node.js 18+
- Claude Code CLI 설치 필요
- **지원 플랫폼:** macOS, Linux, Windows (네이티브 + WSL)

## Zero Dependencies

외부 의존성 없음 — Node.js 내장 모듈만 사용하여 `npx` 실행 시 즉시 시작됩니다.

## 라이선스

MIT
