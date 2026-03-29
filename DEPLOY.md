# Git Insight Deploy

## Frontend

Deploy `frontend` to Cloudflare Pages.

- Framework preset: `Vite`
- Root directory: `frontend`
- Build command: `npm run build`
- Build output directory: `dist`
- Environment variable:
  - `VITE_API_BASE_URL=https://<your-render-backend>.onrender.com`

## Backend

Deploy this repository to Render using [render.yaml](/c:/Users/user/Downloads/Code/git-insight/render.yaml).

- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Environment variables:
  - `GITHUB_TOKEN=<your github token>`
  - `FRONTEND_ORIGINS=https://<your-cloudflare-pages-domain>`

## Order

1. Deploy backend on Render first.
2. Copy the Render URL into Cloudflare Pages as `VITE_API_BASE_URL`.
3. Deploy frontend on Cloudflare Pages.
4. Copy the Cloudflare Pages URL into Render as `FRONTEND_ORIGINS`.
