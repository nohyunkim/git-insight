# Playwright MCP

이 저장소에서는 Playwright 산출물을 `output/playwright/` 아래에 두는 것을 기준으로 잡습니다.

## 현재 상태

로컬 Codex 전역 설정 파일 `C:\Users\user\.codex\config.toml`에는 이미 아래 MCP 서버가 등록되어 있습니다.

```toml
[mcp_servers.playwright]
command = "npx"
args = ["-y", "@playwright/mcp@latest"]
```

즉, Codex 쪽 전역 설정은 이미 들어가 있습니다. 세션에서 바로 보이지 않으면 Codex를 다시 시작해야 할 수 있습니다.

## 필수 준비

1. `npx`가 설치되어 있어야 합니다.
2. 처음 실행 시 Playwright 브라우저가 필요하면 아래 명령으로 설치합니다.

```powershell
npx playwright install chromium
```

## 확인 명령

MCP 패키지가 정상 실행되는지 확인하려면 아래 명령을 사용합니다.

```powershell
npx -y @playwright/mcp@latest --help
```

## 운영 메모

- MCP 설정은 저장소 내부가 아니라 Codex 전역 설정에서 관리합니다.
- 저장소 안에는 테스트 결과물 경로와 사용 문서만 둡니다.
- 브라우저 자동화 결과물은 `output/playwright/` 아래에 저장하는 것을 권장합니다.
