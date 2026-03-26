import asyncio
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent

# 로컬 실행 위치가 달라도 루트/백엔드 어느 쪽 .env든 읽을 수 있게 처리합니다.
load_dotenv(PROJECT_ROOT / '.env')
load_dotenv(BASE_DIR / '.env', override=False)

GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')

app = FastAPI(title='Git Insight API')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:5173', 'http://127.0.0.1:5173'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.get('/api/analyze/{username}')
async def analyze_user(username: str):
    normalized_username = username.strip()

    if not normalized_username:
        raise HTTPException(status_code=400, detail='GitHub 아이디가 비어 있습니다.')

    headers = {'Accept': 'application/vnd.github.v3+json'}
    if GITHUB_TOKEN:
        headers['Authorization'] = f'Bearer {GITHUB_TOKEN}'

    user_url = f'https://api.github.com/users/{normalized_username}'
    events_url = (
        f'https://api.github.com/users/{normalized_username}/events?per_page=100'
    )
    repos_url = (
        f'https://api.github.com/users/{normalized_username}/repos'
        '?per_page=100&sort=updated'
    )

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            # 프로필/이벤트/레포 목록을 동시에 불러와 응답 속도를 줄입니다.
            user_res, events_res, repos_res = await asyncio.gather(
                client.get(user_url, headers=headers),
                client.get(events_url, headers=headers),
                client.get(repos_url, headers=headers),
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503,
            detail='GitHub API 연결에 실패했습니다. 네트워크 상태를 확인해주세요.',
        ) from exc

    if user_res.status_code == 404:
        raise HTTPException(status_code=404, detail='해당 GitHub 사용자를 찾지 못했습니다.')

    if user_res.status_code != 200:
        raise HTTPException(
            status_code=user_res.status_code,
            detail='GitHub 프로필 정보를 불러오지 못했습니다.',
        )

    if repos_res.status_code != 200:
        raise HTTPException(
            status_code=repos_res.status_code,
            detail='레포지토리 목록을 불러오지 못했습니다. GitHub 토큰 상태를 확인해주세요.',
        )

    user_data = user_res.json()
    events_data = events_res.json() if events_res.status_code == 200 else []
    repos_data = repos_res.json()

    event_types = {}
    recent_commits = 0
    for event in events_data:
        event_type = event.get('type')
        if not event_type:
            continue

        event_types[event_type] = event_types.get(event_type, 0) + 1
        if event_type == 'PushEvent':
            recent_commits += len(event.get('payload', {}).get('commits', []))

    languages = {}
    for repo in repos_data:
        language = repo.get('language')
        if language:
            languages[language] = languages.get(language, 0) + 1

    return {
        'status': 'success',
        'username': normalized_username,
        'profile': {
            'name': user_data.get('name'),
            'avatar_url': user_data.get('avatar_url'),
            'public_repos': user_data.get('public_repos'),
            'total_repos': len(repos_data),
        },
        'stats': {
            'recent_commits': recent_commits,
            'languages': languages,
            'event_types': event_types,
        },
    }
