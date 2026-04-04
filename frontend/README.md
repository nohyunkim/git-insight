# Git Insight Frontend

Git Insight 프론트엔드 프로젝트입니다. React + Vite 기반으로 구성되어 있습니다.

## 로컬 실행

1. 의존성 설치

```bash
npm install
```

2. 개발 서버 실행

```bash
npm run dev
```

기본 주소: http://localhost:5173

## 빌드

```bash
npm run build
npm run preview
```

## 린트

```bash
npm run lint
```

## 환경 변수

frontend/.env 또는 배포 환경에 아래 값을 설정하세요.

- VITE_API_BASE_URL
  - 예시: http://127.0.0.1:8000
- VITE_KAKAO_JAVASCRIPT_KEY
  - 카카오 공유 기능 사용 시 필요
  - 호환 키로 VITE_KAKAO_APP_KEY도 인식
  - 추가 호환 키로 VITE_KAKAO_KEY도 인식

VITE_KAKAO_JAVASCRIPT_KEY/VITE_KAKAO_APP_KEY/VITE_KAKAO_KEY가 없으면 카카오 공유 시 키 미설정 안내가 표시됩니다.

## UI 안내

- 하단 링크에서 서비스 소개/지표 해석 가이드/FAQ/개인정보처리방침/이용약관을 모달로 확인할 수 있습니다.
- 문의/오류 제보는 외부 Google Form으로 연결됩니다.

## 주요 디렉터리

- src/components: 화면 컴포넌트
- src/api: 백엔드 API 호출
- public: 파비콘/공유 이미지/웹 매니페스트

정적 문서 파일:

- public/about.html
- public/guide.html
- public/faq.html
- public/privacy.html
- public/terms.html
- public/robots.txt
- public/sitemap.xml
