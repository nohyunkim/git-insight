import asyncio
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
GITHUB_TIME_FORMAT = '%Y-%m-%dT%H:%M:%SZ'

# 실행 위치와 상관없이 루트 또는 backend 폴더의 .env를 읽습니다.
load_dotenv(PROJECT_ROOT / '.env')
load_dotenv(BASE_DIR / '.env', override=False)

GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')
FRONTEND_ORIGINS = [
    origin.strip().rstrip('/')
    for origin in os.getenv('FRONTEND_ORIGINS', '').split(',')
    if origin.strip()
]

app = FastAPI(title='Git Insight API')

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_origin_regex=r'https?://(localhost|127\.0\.0\.1)(:\d+)?$',
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


def parse_github_datetime(value: str | None):
    if not value:
        return None
    return datetime.strptime(value, GITHUB_TIME_FORMAT).replace(tzinfo=timezone.utc)


def build_feedback(summary: dict, top_language: str | None):
    push_events = summary['push_events_30d']
    total_events = summary['total_events_30d']
    active_days = summary['active_days_30d']

    if total_events == 0:
        headline = '최근 30일 공개 활동이 아직 많지 않아요.'
        strength = '지금은 프로필과 저장소 구조를 먼저 쌓아도 좋은 시기입니다.'
        next_step = '작은 커밋이라도 주 2~3회 남겨서 활동 흐름을 만들어보세요.'
    elif push_events >= 20:
        headline = '최근 한 달 동안 꾸준히 코드를 올리고 있어요.'
        strength = 'Push 이벤트가 많아서 작업 흐름이 이어지고 있다는 점이 강점입니다.'
        next_step = '이제는 README 정리나 PR 기록도 함께 남기면 성장 흐름이 더 잘 보입니다.'
    elif active_days >= 10:
        headline = '최근 30일 활동이 비교적 꾸준한 편이에요.'
        strength = '여러 날짜에 걸쳐 활동이 분산돼 있어 루틴이 만들어지고 있습니다.'
        next_step = '작업 단위를 더 잘게 나눠 커밋 수와 기록 밀도를 늘려보세요.'
    else:
        headline = '활동이 시작되고 있지만 아직 밀도는 낮은 편이에요.'
        strength = '레포와 이벤트가 쌓이기 시작했고, 이제 패턴을 만들 단계입니다.'
        next_step = '최근 작업을 하루 단위로 짧게라도 커밋해 활동 히스토리를 쌓아보세요.'

    if top_language:
      strength = f'{strength} 현재 가장 많이 보이는 언어는 {top_language}입니다.'

    return {
        'headline': headline,
        'strength': strength,
        'next_step': next_step,
    }


@app.get('/')
async def root():
    return {
        'service': 'Git Insight API',
        'status': 'ok',
        'docs': '/docs',
        'health': '/health',
    }


@app.get('/health')
async def health():
    return {'status': 'ok'}


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
            # 프로필, 이벤트, 레포 목록을 병렬로 불러와 응답 시간을 줄입니다.
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
    recent_push_events = 0
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    recent_events_30d = []
    active_days = set()

    for event in events_data:
        event_type = event.get('type')
        if not event_type:
            continue

        event_types[event_type] = event_types.get(event_type, 0) + 1

        if event_type == 'PushEvent':
            recent_push_events += 1

        created_at = parse_github_datetime(event.get('created_at'))
        if created_at and created_at >= thirty_days_ago:
            recent_events_30d.append(event)
            active_days.add(created_at.date().isoformat())

    summary_event_types = {}
    for event in recent_events_30d:
        event_type = event.get('type')
        if event_type:
            summary_event_types[event_type] = summary_event_types.get(event_type, 0) + 1

    push_events_30d = summary_event_types.get('PushEvent', 0)

    languages = {}
    for repo in repos_data:
        language = repo.get('language')
        if language:
            languages[language] = languages.get(language, 0) + 1

    top_language = None
    if languages:
        top_language = max(languages.items(), key=lambda item: item[1])[0]

    activity_summary = {
        'window_days': 30,
        'total_events_30d': len(recent_events_30d),
        'push_events_30d': push_events_30d,
        'active_days_30d': len(active_days),
    }

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
            'recent_push_events': recent_push_events,
            'languages': languages,
            'event_types': event_types,
            'activity_summary': activity_summary,
        },
        'feedback': build_feedback(activity_summary, top_language),
    }
