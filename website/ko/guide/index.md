---
title: 빠른 시작 — claude-account-switch
description: 기존 Claude 설치를 활용한 프로필 설정과 안전한 이관.
jsonLd: {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": "기존 Claude가 있어도 init을 실행하나요?", "acceptedAnswer": {"@type": "Answer", "text": "첫 설정 때만 실행합니다. 이미 프로필이 있으면 현재 설정을 보여주고 종료합니다."}}, {"@type": "Question", "name": "npx 캐시를 지워도 동작하나요?", "acceptedAnswer": {"@type": "Answer", "text": "설치한 로컬 실행 파일을 사용하므로 동작합니다. Node.js와 Claude Code는 필요합니다."}}, {"@type": "Question", "name": "로그인도 복사되나요?", "acceptedAnswer": {"@type": "Answer", "text": "파일 인증은 선택한 프로필에만 복사합니다. macOS Keychain은 복사하지 않으며 Claude가 인증을 확인합니다."}}]}
---

# 빠른 시작

이 도구는 Claude Code의 [별도 설정 폴더 방식](https://code.claude.com/docs/en/iam#log-in-with-multiple-accounts)에 프로필 선택과 설정 이관을 더합니다.

Node.js 18.19+ (18계열) 또는 20.10+와 Claude Code를 준비한 뒤 실행합니다.

```bash
npx claude-account-switch@latest init
```

1. 프로필 이름과 활성 프로필을 정합니다.
2. `settings.json`과 `commands/`를 공유할지 선택합니다.
3. 발견한 기존 설정 중 하나를 선택한 프로필에 복사하거나 건너뜁니다.
4. 새 터미널을 열고 `claude`를 실행합니다. 필요한 로그인은 Claude가 안내합니다.

```bash
cpf personal
claude
claude-pick
```

이미 초기화했다면 `init`은 설정 요약만 보여줍니다. `npx claude-account-switch@latest install-shell`로 셸을 복구·갱신합니다.

## 자주 묻는 질문

### 기존 Claude가 있어도 init을 실행하나요?

첫 설정 때만 실행합니다. 이미 프로필이 있으면 현재 설정을 보여주고 종료합니다.


### npx 캐시를 지워도 동작하나요?

설치한 로컬 실행 파일을 사용하므로 동작합니다. Node.js와 Claude Code는 필요합니다.


### 로그인도 복사되나요?

파일 인증은 선택한 프로필에만 복사합니다. macOS Keychain은 복사하지 않으며 Claude가 인증을 확인합니다.

[설치](/ko/guide/installation) · [명령어·이관](/ko/guide/commands) · [셸 통합](/ko/guide/shell-integration)
