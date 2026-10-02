---
title: 작동 방식 — claude-account-switch
description: 공유 범위, 프로필 파일과 인증의 역할.
---

# 작동 방식

셸 명령은 로컬 실행 파일을 호출하고, 선택한 프로필 경로를 `CLAUDE_CONFIG_DIR`로 Claude에 전달합니다.

```text
~/.claude-profiles/
├── meta.json                 활성 프로필과 공유 여부
├── _runtime/                 bin, src, package.json
├── .shell-integration.sh     셸 연결 파일
├── _shared/
│   ├── settings.json
│   └── commands/
└── work/
    ├── .claude.json          사용자 설정·상태
    ├── .credentials.json     파일 인증이 있는 환경에서만
    ├── settings.local.json
    ├── settings.json         공유 사용 시 _shared로 연결
    ├── commands/             공유 사용 시 _shared로 연결
    ├── CLAUDE.md
    ├── skills/
    ├── agents/
    ├── rules/
    ├── hooks/
    ├── plugins/
    ├── projects/
    └── plans/
```

## 공유 범위

공유는 `settings.json`과 기존 `commands/`만 대상으로 합니다. 스킬·에이전트·규칙·훅·`CLAUDE.md`는 선택한 프로필에 가져오며 다른 계정에 자동 배포하지 않습니다. 계정 전환 도구 자체가 스킬을 설치하지 않습니다.

macOS/Linux는 심볼릭 링크, Windows 디렉터리는 junction을 사용합니다. Windows에서 파일 링크를 만들 권한이 없으면 파일을 복사하고 안내합니다. 그 경우 이후 파일 변경은 자동 동기화되지 않습니다.

## 인증

`.claude.json`은 사용자 설정·상태이며 OAuth 로그인 증거가 아닙니다. macOS Keychain 인증을 자동 이전하지 않습니다. 인증 파일이 있으면 선택한 프로필에만 복사합니다. 실행 시 로그인 판단은 Claude가 담당합니다.

[공식 인증 안내](https://code.claude.com/docs/en/iam#log-in-with-multiple-accounts)의 별도 설정 폴더 방식은 claude.ai 계정과 API 키를 구분합니다. API 키 없는 Claude Console 로그인은 설정 폴더만으로 분리되지 않습니다. 셸에서 상속한 인증 환경변수도 계속 적용됩니다.

## 보존과 실행 파일

기본 설정 이관은 `~/.claude`와 `~/.claude.json`을 함께 처리합니다. 기존 링크는 원래 대상을 유지하며 원본은 수정하지 않습니다. 충돌·손상된 JSON은 중단 이유를 보여줍니다.

`meta.json`은 활성 선택만 기록합니다. 셸 설치·갱신은 명시적인 초기 설정·`install-shell`·`shell refresh` 때 수행합니다. 그 뒤 실행은 npx 캐시나 글로벌 switch 명령에 의존하지 않습니다.

Claude가 생성하는 캐시·세션·임시 기록 전체는 이관하지 않습니다. 기존 원본에 남겨 둡니다.
