---
title: CLI 명령어 — claude-account-switch
description: claude-account-switch의 모든 CLI 명령어 레퍼런스. init, add, remove, list, use, migrate, install-shell.
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

## 프로필 이름 규칙

- 영문 소문자, 숫자, 하이픈만 허용
- 문자 또는 숫자로 시작하고 끝나야 함
- 최대 30자
- 예약어 불가: `_shared`, `default`
