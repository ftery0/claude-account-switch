---
title: Windows 설치 가이드 — claude-account-switch
description: Windows에서 claude-account-switch를 설정하는 단계별 가이드. PowerShell, Git Bash, WSL 지원.
jsonLd:
  "@context": "https://schema.org"
  "@type": "HowTo"
  name: "Windows에서 claude-account-switch 설정하기"
  description: "Windows에서 Claude Code 멀티 계정 프로필 전환을 설치하고 설정하는 방법"
  step:
    - "@type": "HowToStep"
      name: "사전 요구사항 설치"
      text: "nodejs.org에서 Node.js 18+ 설치, Claude Code 설치 (npm i -g @anthropic-ai/claude-code)"
    - "@type": "HowToStep"
      name: "초기 설정 마법사 실행"
      text: "PowerShell을 열고 npx claude-account-switch init 실행"
    - "@type": "HowToStep"
      name: "셸 통합 자동 설치"
      text: "감지된 모든 셸(PowerShell, bash, zsh)에 셸 통합이 자동 설치됩니다"
    - "@type": "HowToStep"
      name: "활성화"
      text: ". $PROFILE 실행 또는 새 PowerShell 창 열기"
    - "@type": "HowToStep"
      name: "사용 시작"
      text: "claude, cpf <name>, 또는 claude-pick으로 프로필 관리"
---

# Windows 설치 가이드

## 사전 요구사항

- **Node.js 18+** — [다운로드](https://nodejs.org/)
- **Claude Code** — `npm i -g @anthropic-ai/claude-code`

## 설치

### 1. 초기 설정 마법사 실행

**PowerShell**을 열고 실행:

```powershell
npx claude-account-switch init
```

### 2. 셸 통합 (자동)

초기 설정 마법사가 사용 가능한 셸을 자동 감지하고 통합을 설치합니다. Windows에서는 일반적으로:

- **PowerShell (`$PROFILE`)** — Windows에서 자동 설치
- **bash (~/.bashrc)** — Git Bash 또는 WSL이 감지된 경우
- **zsh (~/.zshrc)** — zsh가 설치된 WSL이 감지된 경우

수동 셸 선택이 필요 없습니다.

### 3. 활성화

```powershell
# 프로필 다시 로드
. $PROFILE

# 또는 새 PowerShell 창 열기
```

### 4. 사용

```powershell
claude           # 활성 프로필로 Claude 실행
cpf <name>       # 빠른 프로필 전환
claude-pick      # 인터랙티브 프로필 선택
```

## 선택사항: 개발자 모드 활성화

Windows에서는 공유 설정(`settings.json`)에 심링크 생성을 먼저 시도합니다. 실패하면(개발자 모드 미활성) 파일을 복사하고 안내 메시지를 표시합니다.

심링크를 활성화하려면:

1. **설정 > 개발자용** 열기
2. **개발자 모드** 활성화

개발자 모드 없이도 정상 동작합니다 — 공유 디렉토리(`commands/`)는 항상 junction을 사용하고(별도 권한 불필요), 공유 파일은 링크 대신 복사됩니다.

## 대안: Git Bash / WSL

셸 통합은 감지된 모든 셸에 자동 설치됩니다. Git Bash나 WSL이 있으면 `init` 실행 시 자동으로 설정됩니다.

### Git Bash

```bash
npx claude-account-switch init
source ~/.bashrc
```

### WSL (Windows Subsystem for Linux)

WSL은 완전한 Linux 환경으로 동작합니다. [Linux 설치 가이드](/ko/guide/setup-linux)를 참고하세요.

## 문제 해결

### `running scripts is disabled on this system`

PowerShell 실행 정책이 프로필 스크립트를 차단할 수 있습니다. 해결:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### `claude: The term 'claude' is not recognized`

Claude Code가 전역 설치되어 있고 PATH에 있는지 확인:

```powershell
npm i -g @anthropic-ai/claude-code
claude --version
```

### 프로필 스크립트가 로드되지 않음

프로필 경로와 통합 라인이 존재하는지 확인:

```powershell
echo $PROFILE
Get-Content $PROFILE | Select-String "shell-integration"
```
