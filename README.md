# Git Insight

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:1f6feb,100:16c47f&height=220&section=header&text=Git%20Insight&desc=Read%20Public%20GitHub%20Activity%20Like%20a%20Story&descAlignY=62&fontSize=42&fontColor=ffffff&descSize=18&animation=fadeIn&fontAlignY=38" />

<br />

<img src="https://readme-typing-svg.herokuapp.com?font=Fira+Code&size=20&pause=1200&color=9BE9A8&center=true&vCenter=true&width=780&lines=GitHub+activity+dashboard;Timeline-based+archive+for+saved+results;Rule-based+insight+with+optional+AI+feedback;FastAPI+%2B+React+%2B+Supabase" />

<br /><br />

<img src="https://img.shields.io/badge/FastAPI-Backend-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
<img src="https://img.shields.io/badge/React-Frontend-61dafb?style=for-the-badge&logo=react&logoColor=111827" />
<img src="https://img.shields.io/badge/Supabase-Auth%20%26%20Archive-3ecf8e?style=for-the-badge&logo=supabase&logoColor=white" />
<img src="https://img.shields.io/badge/Cloudflare%20Pages-Deploy-f38020?style=for-the-badge&logo=cloudflare&logoColor=white" />

</div>

---

## Overview

Git Insight는 공개 GitHub 기록을 숫자 나열이 아니라 흐름 중심으로 읽게 해주는 분석 서비스입니다.  
GitHub 아이디와 기간만 입력하면 공개 프로필, 저장소, 이벤트를 다시 집계해 활동 패턴, 언어 분포, 이벤트 유형, 다음 액션 힌트를 한 화면에서 확인할 수 있습니다.

이 프로젝트는 아래 질문에서 출발했습니다.

> "GitHub 아이디 하나만으로 최근 활동 흐름과 기록 인상을 빠르게 읽을 수 있을까?"

---

## What It Does

- `7일`, `30일`, `90일`, `6개월`, `1년` 기준으로 공개 활동을 다시 집계합니다.
- 이벤트 수, Push 수, 활동 일수, 언어 분포, 이벤트 유형을 대시보드로 보여줍니다.
- 규칙 기반 인사이트를 먼저 제공하고, 선택적으로 AI 보강 피드백을 이어서 보여줍니다.
- 결과 링크 복사, 이미지 저장, PDF 저장을 지원합니다.
- Google 로그인 후 결과를 저장하고, 마이페이지에서 날짜별 달력 아카이브로 다시 열람할 수 있습니다.
- 서비스 소개, 지표 해석 가이드, FAQ, 개인정보 안내, 이용 안내 문서를 함께 제공합니다.

---

## Highlight

### 1. Activity Dashboard

- 공개 프로필 요약
- 전체 공개 레포 수
- 기간 기준 공개 이벤트 수
- 기간 기준 Push 수
- 기간 기준 활동 날짜 수
- 공개 저장소 기준 언어 분포
- 공개 활동 기준 상위 이벤트 유형

### 2. Insight Flow

- 기본 분석 결과를 먼저 반환
- AI 피드백은 뒤이어 로드
- `headline`, `strength`, `improvement`, `next_step` 구조로 인사이트 제공

### 3. Saved Archive

- 같은 사용자와 같은 기간이라도 저장 날짜가 다르면 별도 기록으로 저장
- 마이페이지에서 월별 달력으로 기록 관리
- 날짜 클릭 시 저장된 결과 목록을 다시 확인하고 열람 또는 삭제 가능

### 4. Shareable Output

- 링크 복사
- 이미지 저장
- PDF 저장

---

## Stack

<table>
  <tr>
    <td valign="top" width="25%">
      <strong>Frontend</strong><br /><br />
      <img src="https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=111827" />
      <img src="https://img.shields.io/badge/Vite-646cff?style=flat-square&logo=vite&logoColor=white" />
      <img src="https://img.shields.io/badge/Axios-5A29E4?style=flat-square&logo=axios&logoColor=white" />
      <img src="https://img.shields.io/badge/Recharts-ff6384?style=flat-square&logo=chartdotjs&logoColor=white" />
      <img src="https://img.shields.io/badge/jsPDF-bb1e10?style=flat-square&logo=adobeacrobatreader&logoColor=white" />
    </td>
    <td valign="top" width="25%">
      <strong>Backend</strong><br /><br />
      <img src="https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white" />
      <img src="https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white" />
      <img src="https://img.shields.io/badge/httpx-1f2937?style=flat-square&logoColor=white" />
      <img src="https://img.shields.io/badge/GitHub%20REST%20API-181717?style=flat-square&logo=github&logoColor=white" />
    </td>
    <td valign="top" width="25%">
      <strong>Database & Auth</strong><br /><br />
      <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white" />
      <img src="https://img.shields.io/badge/PostgreSQL-4169e1?style=flat-square&logo=postgresql&logoColor=white" />
      <img src="https://img.shields.io/badge/Google%20OAuth-4285F4?style=flat-square&logo=google&logoColor=white" />
    </td>
    <td valign="top" width="25%">
      <strong>Infra & AI</strong><br /><br />
      <img src="https://img.shields.io/badge/Cloudflare%20Pages-F38020?style=flat-square&logo=cloudflare&logoColor=white" />
      <img src="https://img.shields.io/badge/Render-46E3B7?style=flat-square&logo=render&logoColor=111827" />
      <img src="https://img.shields.io/badge/Groq-f55036?style=flat-square&logoColor=white" />
      <img src="https://img.shields.io/badge/AI%20Feedback-0f172a?style=flat-square&logoColor=white" />
    </td>
  </tr>
</table>

<br />

<p align="center">
  <img src="https://skillicons.dev/icons?i=react,vite,python,fastapi,supabase,postgres,cloudflare&theme=dark" />
</p>


---

## Architecture

```text
Browser
  -> Cloudflare Pages (frontend)
  -> Render (FastAPI backend)
  -> GitHub API / Groq API
  -> Supabase Auth / Database
```

### Frontend Responsibilities

- GitHub 아이디 입력과 기간 선택
- 결과 대시보드 렌더링
- AI 피드백 후속 로드
- 공유 액션 처리
- 로그인, 저장, 마이페이지 달력 아카이브 UI

### Backend Responsibilities

- GitHub 프로필 / 저장소 / 이벤트 조회
- 기간 기준 활동 집계
- 언어 분포 및 이벤트 통계 계산
- 캐시 처리
- 규칙 기반 요약 및 선택적 AI 피드백 생성

---

## API

### `GET /health`

배포 상태 확인용 헬스체크 엔드포인트입니다.

### `GET /api/analyze/{username}?days=30`

프로필 정보, 활동 통계, 기본 인사이트를 반환합니다.

### `GET /api/feedback/{username}?days=30`

기본 분석 결과 이후 AI 보강 피드백을 반환합니다.

예시 응답 구조:

```json
{
  "status": "success",
  "username": "example",
  "generated_at": "2026-04-08T12:34:56.000Z",
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
      "window_label": "최근 30일",
      "total_events_30d": 20,
      "push_events_30d": 12,
      "active_days_30d": 8
    }
  },
  "feedback": {
    "headline": "최근 활동 흐름을 요약한 한 줄 인사이트",
    "strength": "강점 요약",
    "improvement": "보완 포인트",
    "next_step": "다음 액션 제안"
  },
  "feedback_source": "rule-based",
  "feedback_pending": true
}
```

---

## Local Setup

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

기본 포트는 `8000`입니다.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

기본 포트는 `5173`입니다.

---

## Environment Variables

### Frontend

- `VITE_API_BASE_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_KAKAO_JAVASCRIPT_KEY` 권장
- 호환 키: `VITE_KAKAO_APP_KEY`, `VITE_KAKAO_KEY`

### Backend

- `GITHUB_TOKEN`
- `AI_PROVIDER`
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `CACHE_TTL_SECONDS`
- `FRONTEND_ORIGINS`

---

## Deployment Notes

- 프론트엔드는 Cloudflare Pages 기준으로 구성되어 있습니다.
- 백엔드는 Render 기준으로 구성되어 있습니다.
- 로그인과 저장 기능을 쓰려면 Supabase Auth URL 설정까지 같이 맞춰야 합니다.
- `saved_results`와 `profiles` SQL을 Supabase에 반영해야 마이페이지 기능이 정상 동작합니다.
- 상세 배포 순서와 로그인 설정 체크리스트는 [DEPLOY.md](./DEPLOY.md)에서 확인할 수 있습니다.

---

## Project Structure

```text
git-insight/
├─ backend/
│  ├─ main.py
│  └─ requirements.txt
├─ frontend/
│  ├─ public/
│  ├─ src/
│  ├─ package.json
│  └─ vite.config.js
├─ supabase/
│  ├─ profiles.sql
│  └─ saved_results.sql
├─ DEPLOY.md
├─ render.yaml
└─ README.md
```

---

## With This Project

- 공개 GitHub 기록을 해석 가능한 제품 UX로 바꾸는 흐름
- FastAPI + React + Supabase 조합의 실서비스 구조
- 규칙 기반 분석과 AI 피드백을 분리한 응답 설계
- 로그인, 저장, 날짜별 아카이브를 포함한 사용자 기능 확장

---

<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=0:16c47f,100:1f6feb&height=120&section=footer" />
</div>
