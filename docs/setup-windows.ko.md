# Windows 설치 가이드

[English](./setup-windows.md)

## 사전 요구사항

- **Node.js 18+** — [다운로드](https://nodejs.org/)
- **Claude Code** — `npm i -g @anthropic-ai/claude-code`

## 설치

### 1. 초기 설정 마법사 실행

**PowerShell**을 열고 실행:

```powershell
npx claude-account-switch init
```

### 2. PowerShell 통합 선택

프롬프트에서 **PowerShell (recommended for Windows)** 를 선택합니다.

PowerShell 프로필(`$PROFILE`)에 다음 한 줄이 추가됩니다:

```powershell
. "$env:USERPROFILE\.claude-profiles\.shell-integration.ps1"
```

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

기본적으로 Windows에서는 공유 설정(`settings.json`)이 각 프로필에 **복사**됩니다. 실제 심볼릭 링크를 사용하려면 (변경사항이 프로필 간 자동 동기화):

1. **설정 → 개발자용** 열기
2. **개발자 모드** 활성화

개발자 모드 없이도 정상 동작합니다 — 파일이 링크 대신 복사되었다는 안내만 한 번 표시됩니다.

## 대안: Git Bash / WSL

Windows에서 Unix 셸을 선호한다면, 초기 설정 마법사에서 PowerShell 대신 **bash** 또는 **zsh**를 선택할 수 있습니다.

### Git Bash

```bash
npx claude-account-switch init
# 선택: bash (~/.bashrc)
source ~/.bashrc
```

### WSL (Windows Subsystem for Linux)

WSL은 완전한 Linux 환경으로 동작합니다. [Linux 설치 가이드](./setup-linux.ko.md)를 참고하세요.

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
