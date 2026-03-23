# macOS 설치 가이드

[English](./setup-macos.md)

## 사전 요구사항

- **Node.js 18+** — [Homebrew](https://brew.sh/)로 설치 (`brew install node`) 또는 [nodejs.org](https://nodejs.org/)
- **Claude Code** — `npm i -g @anthropic-ai/claude-code`

## 설치

### 1. 초기 설정 마법사 실행

```bash
npx claude-account-switch init
```

### 2. 셸 선택

macOS는 Catalina 이후 **zsh**가 기본 셸입니다. 선택:

- **zsh (~/.zshrc)** — 대부분의 사용자에게 권장
- **bash (~/.bashrc)** — bash로 변경한 경우
- **fish (~/.config/fish/config.fish)** — fish 사용자

### 3. 활성화

```bash
# zsh
source ~/.zshrc

# bash
source ~/.bashrc

# fish
source ~/.config/fish/config.fish

# 또는 새 터미널 창 열기
```

### 4. 사용

```bash
claude           # 활성 프로필로 Claude 실행
cpf <name>       # 빠른 프로필 전환
claude-pick      # 인터랙티브 프로필 선택
```

## 공유 설정 작동 방식

macOS에서는 공유 파일(`settings.json`, `commands/`)이 `_shared/`에서 각 프로필로 심볼릭 링크됩니다. 공유 설정을 변경하면 모든 프로필에 자동 반영됩니다.

## 문제 해결

### `command not found: claude`

Claude Code가 설치되어 있고 PATH에 있는지 확인:

```bash
npm i -g @anthropic-ai/claude-code
which claude
```

### 재시작 후 셸 통합이 작동하지 않음

rc 파일에 source 라인이 추가되었는지 확인:

```bash
# zsh
grep "shell-integration" ~/.zshrc

# bash
grep "shell-integration" ~/.bashrc
```

없으면 다시 실행:

```bash
npx claude-account-switch install-shell
```
