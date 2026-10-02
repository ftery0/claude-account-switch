# claude-account-switch

[![npm version](https://img.shields.io/npm/v/claude-account-switch)](https://www.npmjs.com/package/claude-account-switch)
[![license](https://img.shields.io/npm/l/claude-account-switch)](./LICENSE)

`CLAUDE_CONFIG_DIR`로 [Claude Code 계정](https://code.claude.com/docs/en/iam#log-in-with-multiple-accounts)을 전환합니다. 실행에 필요한 외부 패키지는 없습니다.

[English](./README.md) · [전체 가이드](https://ftery0.github.io/claude-account-switch/ko/guide/)

## 시작

Node.js 18.19+ (18계열) 또는 20.10+와 기존 Claude Code 설치를 사용합니다. Claude Code가 없다면 [공식 설치 가이드](https://code.claude.com/docs/en/setup)를 따릅니다.

```bash
npx claude-account-switch@latest init
```

프로필 이름을 정하고 기존 설정 하나를 가져올지 선택한 뒤, 새 터미널을 엽니다.

```bash
claude
cpf personal
claude-pick
```

프로필이 여러 개이면 대화형 터미널에서 `claude` 실행 시 선택기가 나옵니다. 스크립트에서는 활성 프로필을 사용합니다. `--help`, `--version`을 포함한 Claude 인자는 그대로 전달됩니다.

## 기존 사용자

`init`을 다시 실행하면 현재 설정만 보여줍니다. 1.x 사용자는 자동 업데이트가 가능한 새 실행 구조로 전환하기 위해 아래 명령을 최초 한 번 실행합니다. 셸 통합 복구에도 같은 명령을 사용합니다:

```bash
npx claude-account-switch@latest install-shell
```

셸은 `~/.claude-profiles/_runtime`의 로컬 실행 파일을 사용합니다. 일상적인 사용에는 글로벌 설치나 임시 npx 캐시가 필요하지 않습니다. Node.js·npm·Claude Code는 계속 설치되어 있어야 합니다. 최초 전환 후 새 터미널을 엽니다.

대화형 Claude 실행 시 하루 한 번 백그라운드에서 이 도구의 새 버전을 확인합니다. 검증된 호환 버전은 다음 실행부터 사용하며, 실행 중인 세션의 파일·계정 데이터·하네스 훅·셸 설정 파일을 덮어쓰지 않습니다. 오프라인이나 다운로드 실패 시 기존 버전으로 계속 실행합니다. 비대화형 실행에서는 자동 업데이트하지 않습니다.

`CLAUDE_SWITCH_DISABLE_AUTO_UPDATE=1`로 자동 업데이트를 끌 수 있습니다. 즉시 갱신하려면 `node ~/.claude-profiles/_runtime/bin/cli.mjs update`를 실행하고, 설치 없이 확인하려면 `--check`를 붙입니다. 글로벌 npm 설치본과 셸 실행 파일은 별개이며, 자동 업데이트는 셸 실행 파일만 갱신합니다. 실행 중인 세션 보호를 위해 이전 실행 파일은 보존합니다.

## 명령어

| 명령 | 용도 |
| --- | --- |
| `init` | 첫 설정 또는 기존 설정 요약 |
| `add <name>` / `remove <name>` | 프로필 관리 |
| `list` / `use <name>` | 프로필 조회·전환 |
| `migrate <name> --from <path>` | 기존 설정을 안전하게 복사 |
| `install-shell` | 셸 통합·로컬 실행 파일 설치·복구·갱신 |
| `update [--check]` | 로컬 실행 파일 갱신; `--check`는 설치 없이 확인 |
| `mcp list` | 과거 MCP 이름과 전환 안내 조회 |

이관은 원본을 보존하며 데이터가 충돌하면 멈춥니다. 스킬·에이전트·규칙·훅·`CLAUDE.md`는 선택한 프로필에 보존됩니다. macOS Keychain 인증은 복사하지 않아 새 프로필에서 로그인할 수 있습니다. [이관·호환 안내](https://ftery0.github.io/claude-account-switch/ko/guide/commands)를 참고하세요.

2 버전부터 별도 MCP 편집기와 Claude 설치 관리를 없앴습니다. 공식 `claude mcp`와 Claude의 [업데이트 방식](https://code.claude.com/docs/en/setup#update-manually)을 사용합니다. 과거 MCP 파일은 그대로 보존하며 자동 업데이트는 이 도구만 대상으로 하며 Claude Code는 갱신하지 않습니다.

플랫폼 가이드: [macOS](docs/setup-macos.ko.md) · [Linux](docs/setup-linux.ko.md) · [Windows](docs/setup-windows.ko.md)

[MIT](./LICENSE)
