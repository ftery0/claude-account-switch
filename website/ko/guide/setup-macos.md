---
title: macOS 설정 — claude-account-switch
description: 기존 설치 확인, 프로필 설정과 셸 복구.
jsonLd: {"@context": "https://schema.org", "@type": "HowTo", "name": "macOS 프로필 설정", "step": [{"@type": "HowToStep", "name": "준비", "text": "Node.js 18.19+ (18계열) 또는 20.10+, npm과 기존 Claude Code 설치를 확인합니다."}, {"@type": "HowToStep", "name": "초기 설정", "text": "npx claude-account-switch@latest init으로 프로필을 설정합니다."}, {"@type": "HowToStep", "name": "실행", "text": "새 터미널을 열고 claude를 실행합니다."}]}
---

# macOS 설정

Node.js 18.19+ (18계열) 또는 20.10+와 npm, Claude Code가 필요합니다. 기존 Claude가 있으면 재설치하지 않습니다. 없는 경우 [공식 설치 가이드](https://code.claude.com/docs/en/setup)를 따릅니다.

```bash
npx claude-account-switch@latest init
```

새 터미널을 열고 `claude`, `cpf personal`, `claude-pick`을 사용합니다. 여러 프로필이면 실행 시 선택기가 나옵니다. 기존 초기화에서 `init`은 요약만 보여줍니다.

## 셸 복구

```bash
npx claude-account-switch@latest install-shell
```

연결할 설정 파일: `~/.zshrc` (zsh), `~/.bashrc` (bash), `~/.config/fish/config.fish` (fish).

실행 파일이 없다는 오류가 나면 Claude와 Node.js가 PATH에 있는지 확인합니다. 로컬 실행 파일이 없으면 위 복구 명령을 실행하고 새 터미널을 엽니다.

macOS Keychain 로그인은 이관하지 않습니다. 프로필 최초 실행에서 필요한 로그인을 진행하세요.

[셸 동작·훅](/ko/guide/shell-integration) · [이관·MCP·업데이트](/ko/guide/commands)
