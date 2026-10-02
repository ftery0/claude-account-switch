---
title: 설치 — claude-account-switch
description: Node.js, Claude Code와 로컬 실행 파일 설치 안내.
---

# 설치

Node.js 18.19+ (18계열) 또는 20.10+와 npm이 필요합니다. 기존 Claude Code를 다시 설치할 필요는 없습니다. Claude Code가 없다면 [공식 설치 가이드](https://code.claude.com/docs/en/setup)를 사용합니다.

```bash
npx claude-account-switch@latest init
```

첫 설정은 프로필과 로컬 실행 파일을 `~/.claude-profiles/`에 저장하고 감지한 셸에 연결합니다. npx 캐시를 지워도 계속 사용할 수 있습니다.

## 기존 설치 복구·갱신

```bash
npx claude-account-switch@latest install-shell
```

새 터미널을 열어 반영합니다. `init` 재실행은 기존 설정을 바꾸지 않습니다. `list`, `use`, 도움말도 셸 설정을 변경하지 않습니다.

글로벌 CLI를 선호하면 `npm install -g claude-account-switch@latest`도 가능합니다. 글로벌 패키지를 갱신한 뒤에는 `claude-account-switch install-shell`로 로컬 실행 파일을 갱신합니다.

## 확인

```bash
npx claude-account-switch@latest list
```

일상적인 `claude`, `cpf`, `claude-pick` 실행에는 Node.js가 계속 필요합니다. [플랫폼별 설정](/ko/guide/setup-macos)을 참고하세요.
