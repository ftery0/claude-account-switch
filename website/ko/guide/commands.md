---
title: CLI 명령어 — claude-account-switch
description: claude-account-switch의 모든 CLI 명령어 레퍼런스. init, add, remove, list, use, migrate, install-shell, mcp, update.
---

# CLI 명령어

모든 명령어는 `npx claude-account-switch <명령어>` 또는 글로벌 설치 시 `claude-account-switch <명령어>`로 실행합니다.

## `init`

인터랙티브 설정 위자드로 전체 설정 과정을 안내합니다.

```bash
npx claude-account-switch init
```

다음을 수행합니다:
1. 프로필 생성 (기본값: `work`과 `personal`, 단일 프로필은 `main`)
2. 기존 `~/.claude` 설정 마이그레이션 (있는 경우)
3. 사용 가능한 모든 셸에 셸 통합 자동 설치

## `add <name>`

새 프로필을 생성합니다.

```bash
npx claude-account-switch add work
npx claude-account-switch add personal
```

## `remove <name>`

기존 프로필과 데이터를 삭제합니다.

```bash
npx claude-account-switch remove old-account
```

## `list`

모든 프로필을 나열하고 활성 프로필을 표시합니다.

```bash
npx claude-account-switch list
```

출력 예시:
```
  Profiles:

      personal  ~/.claude-profiles/personal
   *  work      ~/.claude-profiles/work

  Active: work
```

## `use <name>`

활성 프로필을 전환합니다.

```bash
npx claude-account-switch use personal
```

## `migrate [name]`

기존 `~/.claude` 데이터를 프로필로 마이그레이션합니다. 이름을 지정하지 않으면 소스 디렉토리와 대상 프로필을 선택하는 위자드가 안내합니다.

```bash
npx claude-account-switch migrate work
```

위자드가 일반적인 소스 디렉토리(`~/.claude`, `~/.claude-work`, `~/.claude-personal`)를 감지하거나, 사용자 지정 경로를 입력할 수 있습니다. 마이그레이션 대상:

- `.claude.json`, `settings.local.json` — 인증 및 로컬 설정
- `plugins/`, `projects/`, `plans/` — 프로필 데이터
- `settings.json`, `commands/` — `_shared`로 복사 후 심링크 (공유 설정 활성화 시)

::: warning
원본 소스 디렉토리는 삭제되지 않습니다. 정상 동작 확인 후 수동으로 삭제하세요.
:::

## `install-shell`

특정 셸에 셸 통합을 수동 설치합니다. 셸 하나를 선택하는 프롬프트가 표시됩니다.

```bash
npx claude-account-switch install-shell
```

::: tip
일반적으로 필요 없습니다 — `init`이 감지된 모든 셸에 자동 설치합니다. 특정 셸에 재설치가 필요한 경우에만 사용하세요.
:::

## `mcp [서브커맨드]`

MCP 서버를 프로필별로 관리합니다. 서브커맨드 없이 실행하면 인터랙티브 TUI가 열립니다.

```bash
npx claude-account-switch mcp                                          # 인터랙티브 TUI
npx claude-account-switch mcp add ctx --shared --command "npx -y ctx7" # 공통 stdio MCP 추가
npx claude-account-switch mcp add figma --shared --type http --url https://mcp.figma.com/mcp
npx claude-account-switch mcp remove figma --profile work              # 프로필에서 제거
npx claude-account-switch mcp disable figma --profile work             # 공통 MCP 비활성화
npx claude-account-switch mcp enable figma --profile work              # 재활성화
```

| 서브커맨드 | 설명 |
|------------|------|
| `mcp` / `mcp list` | 인터랙티브 TUI |
| `mcp add <name> --shared --type http --url <url>` | 공통 HTTP MCP 추가 |
| `mcp add <name> --profile <p> --command <cmd>` | 프로필 전용 stdio MCP 추가 |
| `mcp remove <name> --shared` | 공통 MCP 제거 |
| `mcp remove <name> --profile <p>` | 프로필 전용 MCP 제거 |
| `mcp disable <name> --profile <p>` | 특정 프로필에서 공통 MCP 비활성화 |
| `mcp enable <name> --profile <p>` | 비활성화된 공통 MCP 재활성화 |

::: tip
HTTP MCP는 OAuth 인증이 필요합니다 — 해당 프로필로 `claude` 실행 후 `/mcp`에서 인증하세요.
:::

## `update [옵션]`

셸 통합을 깨뜨리지 않고 Claude Code를 업데이트합니다. 자체 업데이트는 의도적으로 **명령어 안내만 출력**합니다 (실행 중 프로세스 덮어쓰기 회피).

```bash
npx claude-account-switch update            # 두 패키지 체크 후 confirm 시 Claude Code 설치
npx claude-account-switch update --check    # dry-run, 업데이트 있으면 exit 1
npx claude-account-switch update --self     # 자체 업데이트 명령어만 안내
npx claude-account-switch update --claude-code --yes  # 비대화형 (CI)
```

| 옵션 | 동작 |
|------|------|
| (없음) | 두 패키지 모두 체크 → confirm 후 Claude Code 설치 |
| `--check` / `-n` | dry-run, 설치 안 함. 최신이면 exit `0`, 업데이트 있으면 `1`, 레지스트리 오류 `2` |
| `--self` | 자체 업데이트 명령어 안내만 |
| `--claude-code` | Claude Code만 업데이트 |
| `--yes` / `-y` | 설치 confirm 자동 (dev-symlink / sudo / 실행 중 차단은 우회 불가) |

주요 동작:

- 설치 경로로 패키지 매니저(`npm` / `yarn` / `pnpm` / `bun`) 자동 감지
- `claude-account-switch`가 `npm link` 심링크면 자체 업데이트 거부
- sudo 필요 시 사전 감지 후 정확한 `sudo ...` 명령 안내
- Windows에서 `claude.exe` 실행 중이면 EBUSY 방지를 위해 차단
- 설치 성공 후 셸 통합 템플릿 자동 갱신 → 새 터미널이 새 바이너리 사용
- 버전 간 `bin` entry 변경 감지 시 경고 (템플릿 갱신 필요 신호)

::: tip
CI에서는 `--check`로 업데이트 있을 때 잡을 실패시키세요 — exit `1`이 그 용도입니다.
:::

## 프로필 이름 규칙

- 영문 소문자, 숫자, 하이픈만 허용
- 문자 또는 숫자로 시작하고 끝나야 함
- 최대 30자
- 예약어 불가: `_shared`, `default`
