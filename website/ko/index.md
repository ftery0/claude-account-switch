---
layout: home
title: claude-account-switch — Claude Code 멀티 계정 프로필 관리 도구
description: Claude Code 멀티 계정을 간편하게 관리하세요. CLAUDE_CONFIG_DIR을 활용해 회사/개인 프로필을 즉시 전환합니다.
jsonLd:
  "@context": "https://schema.org"
  "@type": "SoftwareApplication"
  name: "claude-account-switch"
  applicationCategory: "DeveloperApplication"
  operatingSystem: "macOS, Linux, Windows"
  offers:
    "@type": "Offer"
    price: "0"
    priceCurrency: "USD"
  description: "Claude Code를 위한 멀티 계정 프로필 관리 도구. 회사와 개인 계정을 즉시 전환합니다."
  url: "https://ftery0.github.io/claude-account-switch/ko/"
  downloadUrl: "https://www.npmjs.com/package/claude-account-switch"
  softwareVersion: "1.2.0"
  author:
    "@type": "Person"
    name: "haejun"
  license: "https://opensource.org/licenses/MIT"

hero:
  name: claude-account-switch
  text: Claude Code 멀티 계정 프로필 관리 도구
  tagline: 회사와 개인 Claude Code 계정을 즉시 전환하세요. 외부 의존성 없음.
  actions:
    - theme: brand
      text: 시작하기
      link: /ko/guide/
    - theme: alt
      text: GitHub에서 보기
      link: https://github.com/ftery0/claude-account-switch

features:
  - title: 원커맨드 설정
    details: npx claude-account-switch init 한 줄이면 인터랙티브 위자드가 모든 설정을 안내합니다.
  - title: 즉시 프로필 전환
    details: cpf <name>으로 밀리초 만에 프로필을 전환합니다. 재시작 불필요.
  - title: Zero Dependencies
    details: Node.js 내장 모듈만 사용하여 npx 실행 시 즉시 시작됩니다.
  - title: 크로스 플랫폼
    details: macOS, Linux, Windows (네이티브 + WSL) 지원. zsh, bash, fish, PowerShell 호환.
  - title: 공유 설정
    details: 설정과 커스텀 명령어가 심링크를 통해 모든 프로필에서 공유됩니다.
  - title: 인터랙티브 선택기
    details: claude-pick으로 화살표 키 탐색을 통해 프로필을 선택합니다.
---
