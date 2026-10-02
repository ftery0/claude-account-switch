---
title: 셸 통합 — claude-account-switch
description: 로컬 실행 파일, 프로필 선택과 기존 실행 훅.
---

# 셸 통합

`init` 첫 설정 또는 `install-shell` 후 새 터미널을 엽니다.

| 명령 | 동작 |
| --- | --- |
| `claude [인자]` | 선택한 프로필로 Claude 실행 |
| `cpf <name>` | 활성 프로필 변경 |
| `claude-pick` | 프로필 선택 |

여러 프로필이면 대화형 `claude`에서 선택기를 보여주며 활성 프로필을 기본 선택합니다. 단일 프로필 또는 비대화형 실행에서는 활성 프로필로 바로 실행합니다. 선택기와 프로필 안내는 stderr로, Claude 출력은 그대로 전달합니다. Ctrl-C는 실행을 취소합니다.

`--help`, `--version`, 공백을 포함한 인자와 종료 코드를 전달합니다. 환경의 `CLAUDE_CONFIG_DIR`은 Claude 자식 프로세스에만 설정됩니다.

## 설치·복구

```bash
npx claude-account-switch@latest install-shell
```

`~/.claude-profiles/_runtime`에 실행 파일을 복사하고 셸 설정에 source 한 줄을 추가합니다. 이미 있는 source 줄은 반복 추가하지 않습니다. 일반 조회·전환 명령은 셸 파일을 변경하지 않습니다.

| 셸 | 설정 파일 |
| --- | --- |
| zsh | `~/.zshrc` |
| bash | `~/.bashrc` |
| fish | `~/.config/fish/config.fish` |
| PowerShell | `~/Documents/PowerShell/Microsoft.PowerShell_profile.ps1` 또는 기존 WindowsPowerShell 프로필 |

현재 셸과 기존 설정 파일로 감지합니다. 새 셸을 설치했다면 `install-shell`을 다시 실행하세요. WSL은 WSL 안에서 따로 설정합니다. Node.js가 없거나 로컬 실행 파일이 사라지면 복구 명령을 안내하고 종료합니다.

## 프로필 실행 훅

프로필 폴더의 `pre-launch.sh`, `pre-launch.fish`, `pre-launch.ps1` 중 현재 셸에 맞는 파일을 실행합니다. 훅의 환경변수는 Claude 실행에 적용되고 호출한 셸에는 남지 않습니다. 훅이 실패하면 Claude를 실행하지 않습니다.

bash/zsh의 기존 `__claude_switch_launch(profile, args...)` 재정의 호출 위치도 유지합니다. 기존 커스텀 런처는 셸 통합을 source한 줄 뒤에 둡니다.

프로필 전환은 이미 실행 중인 Claude 세션에는 적용되지 않습니다. [업데이트 알림](/ko/guide/commands#업데이트-호환)은 선택적으로 켤 수 있습니다.
