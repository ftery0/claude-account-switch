# Linux 설치 가이드

[English](./setup-linux.md)

## 사전 요구사항

- **Node.js 18+** — 패키지 매니저 또는 [nvm](https://github.com/nvm-sh/nvm)으로 설치
  ```bash
  # nvm 사용 (권장)
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
  nvm install --lts

  # Ubuntu / Debian
  sudo apt install nodejs npm

  # Fedora
  sudo dnf install nodejs
  ```
- **Claude Code** — `npm i -g @anthropic-ai/claude-code`

## 설치

### 1. 초기 설정 마법사 실행

```bash
npx claude-account-switch init
```

### 2. 셸 선택

셸을 선택합니다:

- **bash (~/.bashrc)** — 대부분의 배포판 기본
- **zsh (~/.zshrc)** — 인기 있는 대안
- **fish (~/.config/fish/config.fish)** — fish 사용자

### 3. 활성화

```bash
# bash
source ~/.bashrc

# zsh
source ~/.zshrc

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

Linux에서는 공유 파일(`settings.json`, `commands/`)이 `_shared/`에서 각 프로필로 심볼릭 링크됩니다. 공유 설정을 변경하면 모든 프로필에 자동 반영됩니다.

## WSL (Windows Subsystem for Linux)

WSL에서 Linux를 실행 중이라면, 이 가이드가 그대로 적용됩니다. WSL은 표준 Linux 환경으로 동작합니다.

## 문제 해결

### `command not found: claude`

Claude Code가 설치되어 있고 PATH에 있는지 확인:

```bash
npm i -g @anthropic-ai/claude-code
which claude
```

### 전역 npm 설치 시 권한 오류

nvm으로 Node.js를 관리하면 `sudo` 없이 전역 패키지를 설치할 수 있습니다. 또는 npm 권한 수정:

```bash
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### 재시작 후 셸 통합이 작동하지 않음

source 라인이 추가되었는지 확인:

```bash
grep "shell-integration" ~/.bashrc   # 또는 ~/.zshrc
```

없으면 다시 실행:

```bash
npx claude-account-switch install-shell
```
