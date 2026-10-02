---
title: Windows 설정 — claude-account-switch
description: 기존 설치 확인, 프로필 설정과 셸 복구.
jsonLd: {"@context": "https://schema.org", "@type": "HowTo", "name": "Windows 프로필 설정", "step": [{"@type": "HowToStep", "name": "준비", "text": "Node.js 18.19+ (18계열) 또는 20.10+, npm과 기존 Claude Code 설치를 확인합니다."}, {"@type": "HowToStep", "name": "초기 설정", "text": "npx claude-account-switch@latest init으로 프로필을 설정합니다."}, {"@type": "HowToStep", "name": "실행", "text": "새 터미널을 열고 claude를 실행합니다."}]}
---

# Windows 설정

Node.js 18.19+ (18계열) 또는 20.10+와 npm, Claude Code가 필요합니다. 기존 Claude가 있으면 재설치하지 않습니다. 없는 경우 [공식 설치 가이드](https://code.claude.com/docs/en/setup)를 따릅니다.

```powershell
npx claude-account-switch@latest init
```

새 터미널을 열고 `claude`, `cpf personal`, `claude-pick`을 사용합니다. 여러 프로필이면 실행 시 선택기가 나옵니다. 기존 초기화에서 `init`은 요약만 보여줍니다.

## 셸 복구

```powershell
npx claude-account-switch@latest install-shell
```

Windows의 Documents 폴더 아래 PowerShell 5.1과 PowerShell 7 콘솔 프로필을 모두 연결합니다. OneDrive 등으로 이동한 Documents 폴더도 처리하며, 기존 프로필의 내용과 인코딩을 보존합니다.

실행 파일이 없다는 오류가 나면 Claude와 Node.js가 PATH에 있는지 확인합니다. 로컬 실행 파일이 없으면 위 복구 명령을 실행하고 새 터미널을 엽니다.

PowerShell의 `$PROFILE`과 설치 위치를 확인하세요. 실행 정책·회사 정책으로 프로필 로딩이 차단되면 해당 정책 안내를 따릅니다. Developer Mode 없이 파일 링크 생성에 실패하면 복사하며, 디렉터리는 junction으로 연결합니다. 복사된 설정 파일은 자동 동기화되지 않습니다. WSL은 [Linux 가이드](/ko/guide/setup-linux)를 따릅니다.

[셸 동작·훅](/ko/guide/shell-integration) · [이관·MCP·업데이트](/ko/guide/commands)
