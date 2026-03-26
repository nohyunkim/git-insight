from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os
import asyncio
from dotenv import load_dotenv

load_dotenv()
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

app = FastAPI(title="Git Insight API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/analyze/{username}")
async def analyze_user(username: str):
    headers = {"Accept": "application/vnd.github.v3+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
        
    async with httpx.AsyncClient() as client:
        # 3개의 깃허브 API 엔드포인트 주소
        user_url = f"https://api.github.com/users/{username}"
        events_url = f"https://api.github.com/users/{username}/events?per_page=100"
        repos_url = f"https://api.github.com/users/{username}/repos?per_page=100&sort=updated"

        # 세 가지 API를 동시에 호출하여 속도 최적화
        user_res, events_res, repos_res = await asyncio.gather(
            client.get(user_url, headers=headers),
            client.get(events_url, headers=headers),
            client.get(repos_url, headers=headers)
        )
        
        if user_res.status_code != 200:
            raise HTTPException(status_code=user_res.status_code, detail="유저를 찾을 수 없거나 API 호출 실패")
            
        user_data = user_res.json()
        events_data = events_res.json() if events_res.status_code == 200 else []
        repos_data = repos_res.json() if repos_res.status_code == 200 else []

        # 1. 최근 커밋 수 계산 (PushEvent 분석)
        recent_commits = 0
        for event in events_data:
            if event.get("type") == "PushEvent":
                recent_commits += len(event.get("payload", {}).get("commits", []))

        # 2. 사용 언어 비율 분석
        languages = {}
        for repo in repos_data:
            lang = repo.get("language")
            if lang:
                languages[lang] = languages.get(lang, 0) + 1

        return {
            "status": "success",
            "username": username,
            "profile": {
                "name": user_data.get("name"),
                "avatar_url": user_data.get("avatar_url"),
                "public_repos": user_data.get("public_repos")
            },
            "stats": {
                "recent_commits": recent_commits,
                "languages": languages
            }
        }