---
title: macOS 설치 가이드 — claude-account-switch
description: macOS에서 claude-account-switch를 설정하는 단계별 가이드. zsh, bash, fish 셸 지원.
jsonLd:
  "@context": "https://schema.org"
  "@type": "HowTo"
  name: "macOS에서 claude-account-switch 설정하기"
  description: "macOS에서 Claude Code 멀티 계정 프로필 전환을 설치하고 설정하는 방법"
  step:
    - "@type": "HowToStep"
      name: "사전 요구사항 설치"
      text: "Homebrew로 Node.js 18+ 설치 (brew install node), Claude Code 설치 (npm i -g @anthropic-ai/claude-code)"
    - "@type": "HowToStep"
      name: "초기 설정 마법사 실행"
      text: "터미널에서 npx claude-account-switch init 실행"
    - "@type": "HowToStep"
      name: "셸 통합 자동 설치"
      text: "감지된 모든 셸(zsh, bash, fish)에 셸 통합이 자동 설치됩니다"
    - "@type": "HowToStep"
      name: "활성화"
      text: "source ~/.zshrc 실행 또는 새 터미널 창 열기"
    - "@type": "HowToStep"
      name: "사용 시작"
      text: "claude, cpf <name>, 또는 claude-pick으로 프로필 관리"
---

# macOS 설치 가이드

## 사전 요구사항

- **Node.js 18+** — [Homebrew](https://brew.sh/)로 설치 (`brew install node`) 또는 [nodejs.org](https://nodejs.org/)
- **Claude Code** — `npm i -g @anthropic-ai/claude-code`

## 설치

### 1. 초기 설정 마법사 실행

```bash
npx claude-account-switch init
```

### 2. 셸 통합 (자동)

초기 설정 마법사가 시스템에서 사용 가능한 모든 셸을 자동 감지하고 통합을 설치합니다. macOS에서는 일반적으로:

- **zsh (~/.zshrc)** — Catalina 이후 기본
- **bash (~/.bashrc)** — `.bashrc`가 있는 경우
- **fish (~/.config/fish/config.fish)** — fish가 설치된 경우

수동 셸 선택이 필요 없습니다.

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
