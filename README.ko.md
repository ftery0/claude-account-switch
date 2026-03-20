# claude-switch

[Claude Code](https://docs.anthropic.com/en/docs/claude-code)를 위한 멀티 계정 프로필 관리 도구.

[English](./README.md)

Claude Code는 공식적으로 멀티 계정을 지원하지 않습니다. `claude-switch`는 `CLAUDE_CONFIG_DIR` 환경변수를 활용해 프로필별로 독립된 OAuth 인증 정보를 관리합니다.

## 빠른 시작

```bash
npx claude-switch init
```

인터랙티브 위자드가 안내합니다:
1. 프로필 생성 (예: `work`, `personal`)
2. 기존 `~/.claude` 설정 마이그레이션
3. 셸 통합 설치

## 설치

```bash
# npx로 바로 사용 (권장)
npx claude-switch init

# 또는 글로벌 설치
npm i -g claude-switch
```

## 명령어

| 명령어 | 설명 |
|--------|------|
| `claude-switch init` | 인터랙티브 설정 위자드 |
| `claude-switch add <name>` | 새 프로필 생성 |
| `claude-switch remove <name>` | 프로필 삭제 |
| `claude-switch list` | 프로필 목록 |
| `claude-switch use <name>` | 활성 프로필 전환 |
| `claude-switch install-shell` | 셸 통합 설치 |

## 셸 통합

`init` 또는 `install-shell` 실행 후 터미널에서 사용 가능:

| 명령어 | 설명 |
|--------|------|
| `claude` | 활성 프로필로 Claude 실행 |
| `cpf <name>` | 빠른 프로필 전환 |
| `claude-pick` | 인터랙티브 프로필 선택기 |

## 작동 방식

```
~/.claude-profiles/
├── meta.json              ← 프로필 메타 정보 + 활성 프로필
├── _shared/
│   ├── settings.json      ← 공통 설정 (원본)
│   └── commands/           ← 공통 커스텀 명령어
├── work/
│   ├── .claude.json       ← 회사 계정 OAuth
│   ├── settings.json      → ../_shared/settings.json (심링크)
│   └── commands/          → ../_shared/commands/ (심링크)
└── personal/
    ├── .claude.json       ← 개인 계정 OAuth
    ├── settings.json      → ../_shared/settings.json
    └── commands/          → ../_shared/commands/
```

- **공유 파일** (`settings.json`, `commands/`)은 `_shared/`에 원본 저장, 각 프로필에 심링크
- **프로필별 파일** (`.claude.json`, `plugins/`, `projects/`)은 독립 보관
- **임시 파일** (`cache/`, `sessions/` 등)은 Claude Code가 자동 생성, 관리하지 않음

## 프로필 이름 규칙

- 영문 소문자, 숫자, 하이픈만 허용
- 문자 또는 숫자로 시작해야 함
- 예약어 불가: `_shared`, `default`

## 요구사항

- Node.js 18+
- Claude Code CLI 설치 필요

## Zero Dependencies

외부 의존성 없음 — Node.js 내장 모듈만 사용하여 `npx` 실행 시 즉시 시작됩니다.

## 라이선스

MIT
