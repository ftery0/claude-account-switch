---
title: 설치 — claude-account-switch
description: claude-account-switch 설치 방법. npx로 즉시 사용하거나 npm으로 글로벌 설치할 수 있습니다.
---

# 설치

## 사전 요구사항

- **Node.js 18+** — [다운로드](https://nodejs.org/)
- **Claude Code** — `npm i -g @anthropic-ai/claude-code`

## 권장: npx로 사용

설치 없이 바로 실행:

```bash
npx claude-account-switch init
```

최신 버전을 자동으로 다운로드하고 실행합니다.

## 글로벌 설치

영구적으로 설치하려면:

```bash
npm i -g claude-account-switch
```

이후 명령어를 직접 실행:

```bash
claude-account-switch init
claude-account-switch list
claude-account-switch use work
```

## 설치 확인

```bash
# npx 사용 시
npx claude-account-switch list

# 글로벌 설치 시
claude-account-switch list
```

## 요구사항

| 항목 | 버전 |
|------|------|
| Node.js | 18+ |
| Claude Code | 최신 |
| 플랫폼 | macOS, Linux, Windows (네이티브 + WSL) |

## Zero Dependencies

외부 의존성 없음 — Node.js 내장 모듈만 사용하여 `npx` 실행 시 즉시 시작됩니다.
