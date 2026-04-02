# Git Insight 배포 가이드

이 문서는 Git Insight를 실제 배포 환경에 올릴 때 필요한 설정을 정리한 문서입니다.  
현재 기준 배포 구조는 아래와 같습니다.

- 프론트엔드: Cloudflare Pages
- 백엔드 API: Render

## 배포 구조

```text
사용자 브라우저
  -> Cloudflare Pages (frontend)
  -> Render (backend API)
  -> GitHub API / Groq API
```

## 1. Backend 배포: Render

이 저장소에는 Render 배포용 설정 파일인 [render.yaml](./render.yaml)이 포함되어 있습니다.

### 기본 설정

- Service type: `Web Service`
- Runtime: `Python`
- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Health check path: `/health`

### 환경 변수

Render에서 아래 환경 변수를 설정합니다.

- `GITHUB_TOKEN`
- `FRONTEND_ORIGINS`

선택적으로 아래 값도 사용할 수 있습니다.

- `AI_PROVIDER`
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `CACHE_TTL_SECONDS`

### 권장 예시

```env
GITHUB_TOKEN=your_github_token
FRONTEND_ORIGINS=https://your-project.pages.dev
AI_PROVIDER=groq
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile
CACHE_TTL_SECONDS=300
```

### 참고

- `GITHUB_TOKEN` 키 이름은 반드시 정확히 이 이름이어야 합니다.
- Render 대시보드에서는 값에 따옴표를 넣지 않는 편이 안전합니다.
- `AI_PROVIDER`를 설정하지 않으면 기본적으로 규칙 기반 요약으로 동작합니다.

## 2. Frontend 배포: Cloudflare Pages

`frontend` 디렉터리를 Cloudflare Pages에 배포합니다.

### 기본 설정

- Framework preset: `Vite`
- Root directory: `frontend`
- Build command: `npm run build`
- Build output directory: `dist`

### 환경 변수

- `VITE_API_BASE_URL=https://your-render-backend.onrender.com`

### 참고

- 프론트엔드는 빌드 시점에 `VITE_API_BASE_URL`을 사용합니다.
- 값은 반드시 Render 백엔드의 실제 배포 URL과 일치해야 합니다.

## 3. 배포 순서

권장 순서는 아래와 같습니다.

1. Render에 백엔드 먼저 배포
2. Render 배포 URL 확인
3. Cloudflare Pages에 `VITE_API_BASE_URL` 설정 후 프론트 배포
4. Cloudflare Pages 배포 URL을 Render의 `FRONTEND_ORIGINS`에 반영
5. 필요 시 재배포

## 4. 도메인 및 메타데이터

현재 프론트엔드 `index.html`에는 아래 항목이 포함되어 있습니다.

- Google Search Console 인증 메타태그
- Open Graph 메타태그
- Twitter 카드 메타태그
- 파비콘 설정

커스텀 도메인을 사용할 경우 아래 항목도 함께 점검하는 것이 좋습니다.

- `og:url`
- `og:image`
- `twitter:image`
- `FRONTEND_ORIGINS`
- `VITE_API_BASE_URL`

## 5. 배포 후 점검 체크리스트

배포가 끝난 뒤에는 아래 항목을 확인합니다.

- `/health` 응답이 정상인지
- GitHub 아이디 검색이 정상 동작하는지
- 기간 선택이 실제 지표에 반영되는지
- 공유 링크 복사 후 같은 결과가 열리는지
- 이미지 저장 / PDF 저장이 정상 동작하는지
- 썸네일 미리보기가 정상 노출되는지

## 6. 자주 확인할 문제

### `403` 응답이 발생하는 경우

아래를 먼저 확인합니다.

- `GITHUB_TOKEN`이 올바르게 설정되어 있는지
- GitHub 토큰 권한이나 만료 문제가 없는지
- 배포 후 최신 환경 변수가 반영되었는지

### CORS 오류가 발생하는 경우

대개 `FRONTEND_ORIGINS` 설정 문제입니다.

- Cloudflare Pages 실제 도메인과 정확히 일치하는지 확인
- 여러 도메인을 쓸 경우 쉼표로 구분해 설정

### 링크 미리보기가 바로 안 바뀌는 경우

대부분 플랫폼 캐시 문제입니다.

- 배포 후 잠시 기다리기
- 플랫폼별 미리보기 캐시 갱신 도구 사용
- 썸네일 이미지 비율이 `1200x630`에 맞는지 확인

