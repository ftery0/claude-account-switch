---
title: 셸 통합 — claude-account-switch
description: claude-account-switch 설치 후 사용 가능한 셸 명령어. claude, cpf, claude-pick으로 즉시 프로필 전환.
---

# 셸 통합

`init` 또는 `install-shell` 실행 후 터미널에서 사용할 수 있는 명령어입니다.

## 사용 가능한 명령어

| 명령어 | 설명 |
|--------|------|
| `claude` | 활성 프로필로 Claude 실행 |
| `cpf <name>` | 빠른 프로필 전환 |
| `claude-pick` | 인터랙티브 프로필 선택기 |

### `claude`

활성 프로필의 `CLAUDE_CONFIG_DIR`을 설정하여 Claude Code를 실행합니다.

- **프로필이 하나인 경우**: 즉시 실행
- **프로필이 여러 개인 경우**: 화살표 키로 프로필을 선택하는 인터랙티브 선택기를 표시한 후 실행

```bash
claude
```

### `cpf <name>`

다른 프로필로 즉시 전환합니다.

```bash
cpf work        # work 프로필로 전환
cpf personal    # personal 프로필로 전환
```

### `claude-pick`

화살표 키로 프로필을 선택하는 인터랙티브 선택기를 엽니다. Node.js가 없는 환경에서는 번호 입력 방식으로 대체됩니다.

```bash
claude-pick
```

## 지원 셸

| 셸 | 플랫폼 | 설정 파일 |
|----|--------|-----------|
| zsh | macOS / Linux | `~/.zshrc` |
| bash | macOS / Linux / Git Bash | `~/.bashrc` |
| fish | macOS / Linux | `~/.config/fish/config.fish` |
| PowerShell | Windows | `$PROFILE` (PS 5.1: `~/Documents/WindowsPowerShell/`, PS 7+: `~/Documents/PowerShell/`) |

## 자동 감지

셸 통합은 `init` 실행 시 감지된 모든 셸에 자동 설치됩니다. 추가로, `claude-account-switch` 명령어를 실행할 때마다 새로 사용 가능한 셸을 확인하고 자동으로 통합을 설치합니다.

## 수동 설치

특정 셸에 재설치가 필요한 경우:

```bash
npx claude-account-switch install-shell
```

셸 하나를 선택하는 프롬프트가 표시됩니다. 그런 다음 셸을 다시 로드:

```bash
# zsh
source ~/.zshrc

# bash
source ~/.bashrc

# fish
source ~/.config/fish/config.fish

# PowerShell
. $PROFILE
```
