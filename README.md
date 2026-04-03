# Git Insight

Git Insight는 GitHub 공개 활동을 한눈에 읽을 수 있도록 정리해주는 분석 서비스입니다.  
사용자는 GitHub 아이디만 입력하면 최근 활동 흐름, 언어 분포, 이벤트 패턴, 그리고 다음 액션에 대한 인사이트를 빠르게 확인할 수 있습니다.

## 프로젝트 소개

이 프로젝트는 다음 질문에서 출발했습니다.

> "GitHub 아이디 하나만으로 이 사람의 최근 활동 흐름을 빠르게 이해할 수 있을까?"

Git Insight는 이 문제를 해결하기 위해 GitHub 공개 데이터를 수집하고, 선택한 기간 기준으로 활동을 집계한 뒤, 읽기 쉬운 대시보드 형태로 보여줍니다.

현재 서비스는 다음 경험을 제공합니다.

- 기간 선택 기반 분석: `7일`, `30일`, `90일`, `6개월`, `1년`
- 프로필 요약 카드: 이벤트 수, Push 활동, 활동 날짜, 공개 레포 수
- 언어 분포 차트 및 이벤트 유형 차트
- 규칙 기반 인사이트 + 선택적 AI 보강 피드백
- 결과 공유 기능: 링크 복사, 이미지 저장, PDF 저장
- 브랜드 아이콘, 파비콘, 공유 썸네일(OG/Twitter) 적용

## 주요 기능

### 1. GitHub 활동 대시보드

GitHub 아이디를 입력하면 다음 정보를 확인할 수 있습니다.

- 공개 프로필 요약
- 전체 공개 레포 수
- 선택 기간 기준 공개 이벤트 수
- 선택 기간 기준 Push 수
- 선택 기간 기준 활동 날짜 수
- 공개 레포 기준 언어 분포
- 공개 활동 기준 상위 이벤트 유형

### 2. 기간 선택 분석

다음 기간 기준으로 활동을 분석할 수 있습니다.

- `7일`
- `30일`
- `90일`
- `6개월`
- `1년`

이벤트, Push, 활동 날짜 등 기간 민감 지표는 선택한 기간에 맞춰 다시 계산됩니다.

### 3. 인사이트 생성

Git Insight는 GitHub 활동 데이터를 기반으로 읽기 쉬운 분석 문장을 생성합니다.

- 기본: 규칙 기반 요약
- 선택: Groq 기반 AI 보강 피드백

인사이트 구조는 다음 4개 필드로 나뉩니다.

- `headline`
- `strength`
- `improvement`
- `next_step`

### 4. 공유 및 저장

결과 화면은 다음 방식으로 활용할 수 있습니다.

- `링크 복사`
- `이미지 저장`
- `PDF 저장`

복사한 링크에는 현재 선택한 GitHub 아이디와 기간 상태가 함께 반영됩니다.

## 기술 스택

### Frontend

- React
- Vite
- Axios
- Recharts
- html-to-image
- jsPDF

### Backend

- FastAPI
- httpx
- python-dotenv

### 외부 연동

- GitHub REST API
- Groq API

### 배포

- Cloudflare Pages: 프론트엔드
- Render: 백엔드 API

## 프로젝트 구조

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
├─ DEPLOY.md
├─ render.yaml
└─ README.md
```

## 아키텍처 개요

### 프론트엔드 역할

- GitHub 아이디 입력 및 기간 선택
- 분석 결과 대시보드 렌더링
- 인사이트 카드 및 차트 표현
- 공유 및 저장 기능 제공
- 소셜 미리보기 메타태그 관리

### 백엔드 역할

- GitHub 프로필 / 레포 / 이벤트 데이터 조회
- 기간 기준 활동 집계
- 언어 분포 및 이벤트 통계 계산
- 캐시 처리
- 선택적 AI 피드백 생성

## API 요약

### `GET /health`

배포 환경에서 상태 확인용으로 사용하는 헬스체크 엔드포인트입니다.

### `GET /api/analyze/{username}?days=30`

프로필 정보, 활동 통계, 기본 인사이트를 반환합니다.

예시 응답 구조:

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

### `GET /api/feedback/{username}?days=30`

기본 분석 결과 이후, 추가 AI 피드백을 별도로 반환합니다.

## 설계 및 성능 포인트

실사용 체감을 개선하기 위해 다음과 같은 구조를 적용했습니다.

- 기본 분석 결과를 먼저 반환하고, AI 피드백은 뒤이어 로드
- GitHub 요청은 전역 async HTTP client 재사용
- 동일한 사용자 / 기간 요청에는 메모리 TTL 캐시 적용
- 이미지 저장 / PDF 저장 라이브러리는 버튼 클릭 시점에만 lazy load

## 로컬 실행 방법

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

## 환경 변수

프론트엔드(Cloudflare Pages 또는 `frontend/.env`)에는 아래 키를 설정하세요.

- `VITE_API_BASE_URL`
- 카카오 공유 키: `VITE_KAKAO_JAVASCRIPT_KEY` (권장)
  - 호환 키로 `VITE_KAKAO_APP_KEY`도 인식합니다.

루트 `.env`, `backend/.env`, 또는 배포 환경 변수에 아래 값을 설정할 수 있습니다.

- `GITHUB_TOKEN`
- `AI_PROVIDER`
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `CACHE_TTL_SECONDS`
- `FRONTEND_ORIGINS`
- `VITE_API_BASE_URL`
- `VITE_KAKAO_JAVASCRIPT_KEY` (프론트 카카오 공유 기능 사용 시)

## 배포 메모

- 프론트엔드는 Cloudflare Pages 배포를 기준으로 구성되어 있습니다.
- 백엔드는 Render 배포를 기준으로 구성되어 있습니다.
- `render.yaml`에는 헬스체크 경로가 포함되어 있습니다.
- 공유 썸네일과 소셜 미리보기 메타는 `frontend/index.html`에서 관리합니다.

배포 상세 내용은 [DEPLOY.md](./DEPLOY.md)에서 확인할 수 있습니다.

## 현재 범위

Git Insight는 현재 다음 범위에 집중하고 있습니다.

- 공개 GitHub 활동 분석
- 빠르게 읽히는 대시보드형 요약
- 간단한 공유 및 저장 경험

다음과 같은 범위는 현재 목표에 포함하지 않습니다.

- GitHub 전체 분석 플랫폼 수준의 기능 확장
- 비공개 레포 분석
- 점수화 / 순위화 / 미래 예측 중심 기능

## 향후 개선 아이디어

다음 단계로 고려할 수 있는 항목입니다.

- 활동 히트맵
- 이전 기간 대비 비교 지표
- 레포지토리별 활동 Top N
- 협업 패턴 분석
- 결과 공유 화면 고도화
