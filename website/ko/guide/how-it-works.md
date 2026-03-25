---
title: 작동 방식 — claude-account-switch
description: claude-account-switch의 아키텍처와 설계. 프로필 디렉토리 구조, 심링크를 통한 공유 설정, CLAUDE_CONFIG_DIR 활용.
---

# 작동 방식

`claude-account-switch`는 `CLAUDE_CONFIG_DIR` 환경변수를 활용하여 별도의 Claude Code 프로필을 관리합니다.

## 디렉토리 구조

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

## 공유 설정

공유 파일(`settings.json`, `commands/`)은 `_shared/`에 한 번 저장되고 각 프로필에 링크됩니다:

- **macOS/Linux**: 심볼릭 링크
- **Windows**: 먼저 심링크 생성을 시도합니다. 실패하면(개발자 모드 미활성) 파일을 복사하고 안내 메시지를 표시합니다. 디렉토리는 항상 junction을 사용합니다(별도 권한 불필요).

공유 설정을 변경하면 모든 프로필에 자동 반영됩니다.

## 프로필별 파일

각 프로필은 독립적으로 관리합니다:

- **`.claude.json`** — OAuth 인증 정보
- **`settings.local.json`** — 로컬 설정
- **`plugins/`** — 설치된 플러그인
- **`projects/`** — 프로젝트별 설정
- **`plans/`** — 저장된 플랜

## 임시 파일

`cache/`, `sessions/`, `history.jsonl`, `session-env/`, `shell-snapshots/`, `paste-cache/`, `file-history/`, `backups/` 같은 파일은 Claude Code가 자동 생성하며 `claude-account-switch`가 관리하지 않습니다.

## 자동 셸 감지

`claude-account-switch` 명령어를 실행할 때마다 새로 사용 가능한 셸을 확인하고 자동으로 통합을 설치합니다. 새 셸(예: fish)을 설치하면, 다음 CLI 실행 시 자동으로 감지하여 설정합니다.

## 프로필 전환

`cpf <name>` 또는 `claude-pick`을 실행하면:

1. `meta.json`에 새 활성 프로필을 기록
2. `CLAUDE_CONFIG_DIR`을 선택한 프로필 디렉토리로 설정
3. Claude Code가 해당 디렉토리에서 설정을 읽음
