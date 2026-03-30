# Git Insight

GitHub 공개 활동을 분석해서 프로필 요약, 활동 지표, 언어 분포, 그리고 다음 액션에 대한 짧은 인사이트를 제공하는 프로젝트다.

프론트엔드는 React + Vite, 백엔드는 FastAPI로 구성되어 있고, GitHub API 데이터를 바탕으로 최근 활동 패턴을 정리한다. 배포 기준으로는 Cloudflare Pages에서 프론트엔드를, Render에서 API 서버를 운영하는 구조를 사용한다.

## Stack

- Frontend: React, Vite, Axios, Recharts
- Backend: FastAPI, httpx, python-dotenv
- AI Feedback: Groq API
- Deploy: Cloudflare Pages, Render

## Project Structure

```text
git-insight/
├─ backend/
│  ├─ main.py
│  └─ requirements.txt
├─ frontend/
│  ├─ src/
│  ├─ package.json
│  └─ vite.config.js
├─ render.yaml
└─ DEPLOY.md
```

## Features

- GitHub 사용자 프로필, 공개 저장소, 최근 이벤트 집계
- 최근 30일 기준 활동량, 푸시 수, 활동 일수 요약
- 언어 분포 및 이벤트 유형 시각화
- 규칙 기반 피드백 + AI 피드백 보강
- AI 응답 품질 검증 및 fallback 처리

## Recent Changes

최근 작업에서 정리한 내용은 아래와 같다.

- Gemini 기반 응답 생성 코드를 Groq 기반으로 교체했다.
- `feedback` 구조를 `headline`, `strength`, `improvement`, `next_step` 4개 필드로 확장했다.
- AI 프롬프트를 원시 GitHub 데이터 나열 방식에서, 백엔드가 계산한 힌트 기반 요약 방식으로 단순화했다.
- PR, 이슈, 활동 루틴, 기록 밀도를 우선해서 추천하도록 보완 로직을 정리했다.
- 한자 혼용, 번역투 문장, 숫자 나열형 응답, 부자연스러운 추천 문장을 차단하는 검증 로직을 추가했다.
- AI 응답이 품질 기준을 통과하지 못하면 규칙 기반 피드백으로 fallback 되도록 처리했다.
- 인사이트 카드가 `improvement` 필드를 표시하도록 프론트 UI를 확장했다.
- Render 배포 타임아웃 대응을 위해 `render.yaml`에 `healthCheckPath: /health`를 추가했다.

## Local Development

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

기본 실행 포트는 `8000`이다.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

기본 개발 서버는 `5173`이다.

## Environment Variables

루트 `.env` 또는 Render 환경변수에서 아래 값을 사용한다.

- `GITHUB_TOKEN`
- `AI_PROVIDER`
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `FRONTEND_ORIGINS`
- `VITE_API_BASE_URL` (`frontend` 배포 시 사용)

주의할 점:

- 코드에서 읽는 GitHub 토큰 이름은 반드시 `GITHUB_TOKEN`이다.
- Render 대시보드에서는 값에 따옴표를 넣지 않아도 된다.
- 환경변수 변경 후에는 새 배포가 완료되어야 실제 서비스에 반영된다.

## API

### `GET /health`

배포 환경에서 health check 용도로 사용한다.

### `GET /api/analyze/{username}`

GitHub 사용자 데이터를 분석해서 아래 형태의 응답을 반환한다.

```json
{
  "status": "success",
  "username": "example",
  "profile": {
    "name": "Example User",
    "avatar_url": "https://...",
    "public_repos": 10,
    "total_repos": 10
  },
  "stats": {
    "recent_push_events": 12,
    "languages": {
      "JavaScript": 4
    },
    "event_types": {
      "PushEvent": 12
    },
    "activity_summary": {
      "window_days": 30,
      "total_events_30d": 20,
      "push_events_30d": 12,
      "active_days_30d": 8
    }
  },
  "feedback": {
    "headline": "최근 한 달 동안 꾸준히 코드를 올리고 있어요.",
    "strength": "코드 푸시 기록이 꾸준히 이어져 작업 흐름이 보입니다.",
    "improvement": "PR이나 작업 맥락을 설명하는 기록은 아직 더 보강할 수 있습니다.",
    "next_step": "다음 작업에서는 PR 설명이나 이슈 기록을 함께 남겨보세요."
  },
  "feedback_source": "ai"
}
```

## Deployment Notes

- Render backend는 `rootDir: backend`, `startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT` 기준으로 배포한다.
- `render.yaml`에는 `healthCheckPath: /health`가 포함되어 있어야 한다.
- Cloudflare Pages에는 `VITE_API_BASE_URL`을 Render backend 주소로 지정해야 한다.
- 배포 후 `403`이 발생하면 가장 먼저 `GITHUB_TOKEN` 설정과 최신 배포 반영 여부를 확인하는 것이 좋다.

상세 배포 절차는 [DEPLOY.md](/c:/Users/user/Downloads/Code/git-insight/DEPLOY.md)에서 확인할 수 있다.
