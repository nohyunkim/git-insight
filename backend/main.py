import asyncio
import hashlib
import json
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
try:
    from groq import Groq
except ImportError:
    Groq = None
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from feedback_utils import (
    adapt_feedback_to_window,
    build_ai_prompt,
    build_feedback,
    build_improvement_hints,
    build_recommendation_hints,
    build_strength_hints,
    format_ranked_counts,
    normalize_feedback,
    window_label,
)

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
GITHUB_TIME_FORMAT = '%Y-%m-%dT%H:%M:%SZ'
ALLOWED_WINDOWS = {7, 30, 90, 180, 365}
MAX_GITHUB_EVENT_PAGES = 3
EVENT_API_RELIABLE_WINDOW_DAYS = 90
FEEDBACK_PROMPT_VERSION = 'v2'

# 실행 위치와 관계없이 루트 또는 backend 폴더의 .env를 읽습니다.
load_dotenv(PROJECT_ROOT / '.env')
load_dotenv(BASE_DIR / '.env', override=False)

GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')
AI_PROVIDER = os.getenv('AI_PROVIDER', 'rule-based').strip().lower()
GROQ_API_KEY = os.getenv('GROQ_API_KEY')
GROQ_MODEL = os.getenv('GROQ_MODEL', 'llama-3.3-70b-versatile')
CACHE_TTL_SECONDS = int(os.getenv('CACHE_TTL_SECONDS', '300'))
FRONTEND_ORIGINS = [
    origin.strip().rstrip('/')
    for origin in os.getenv('FRONTEND_ORIGINS', '').split(',')
    if origin.strip()
]

groq_client = Groq(api_key=GROQ_API_KEY) if Groq and GROQ_API_KEY else None


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.github_client = httpx.AsyncClient(
        timeout=20.0,
        headers={'Accept': 'application/vnd.github.v3+json'},
    )
    yield
    await app.state.github_client.aclose()


app = FastAPI(title='Git Insight API', lifespan=lifespan)

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


analysis_cache: dict[str, tuple[datetime, dict]] = {}
feedback_cache: dict[str, tuple[datetime, dict]] = {}


def get_cache_entry(cache: dict[str, tuple[datetime, dict]], key: str):
    cached = cache.get(key)
    if not cached:
        return None

    expires_at, payload = cached
    if expires_at <= datetime.now(timezone.utc):
        cache.pop(key, None)
        return None

    return payload


def set_cache_entry(cache: dict[str, tuple[datetime, dict]], key: str, payload: dict):
    cache[key] = (
        datetime.now(timezone.utc) + timedelta(seconds=CACHE_TTL_SECONDS),
        payload,
    )


def has_next_page(response: httpx.Response):
    link_header = response.headers.get('link', '')
    return 'rel="next"' in link_header


def build_github_headers():
    headers = {}
    if GITHUB_TOKEN:
        headers['Authorization'] = f'Bearer {GITHUB_TOKEN}'
    return headers


def normalize_window_days(days: int):
    if days not in ALLOWED_WINDOWS:
        raise HTTPException(status_code=400, detail='지원하지 않는 기간입니다.')
    return days


def build_cache_key(username: str, days: int):
    return f'{username}:{days}'


def build_feedback_cache_key(username: str, days: int):
    provider = AI_PROVIDER or 'rule-based'
    model = GROQ_MODEL if provider == 'groq' else 'rule-based'
    return f'{username}:{days}:{provider}:{model}:{FEEDBACK_PROMPT_VERSION}'


def log_feedback_event(username: str, days: int, status: str, detail: str | None = None):
    detail_suffix = f' detail={detail}' if detail else ''
    print(
        f'Feedback generation status={status} username={username} '
        f'days={days} provider={AI_PROVIDER}{detail_suffix}'
    )


def generate_feedback_with_groq(
    username: str,
    activity_summary: dict,
    top_language: str | None,
    languages: dict,
    event_types: dict,
    total_repos: int,
    recent_push_events: int,
):
    if AI_PROVIDER != 'groq' or not groq_client:
        return None, 'ai_disabled'

    fallback_feedback = build_feedback(
        activity_summary,
        top_language,
        event_types=event_types,
        total_repos=total_repos,
    )

    prompt = build_ai_prompt(
        username=username,
        activity_summary=activity_summary,
        top_language=top_language,
        languages=languages,
        event_types=event_types,
        total_repos=total_repos,
        recent_push_events=recent_push_events,
        strength_hints=build_strength_hints(
            activity_summary=activity_summary,
            top_language=top_language,
            event_types=event_types,
        ),
        improvement_hints=build_improvement_hints(
            activity_summary=activity_summary,
            top_language=top_language,
            languages=languages,
            event_types=event_types,
            total_repos=total_repos,
        ),
        recommendation_hints=build_recommendation_hints(
            activity_summary=activity_summary,
            top_language=top_language,
            languages=languages,
            event_types=event_types,
        ),
    )

    try:
        response = groq_client.chat.completions.create(
            messages=[
                {
                    'role': 'system',
                    'content': 'Return only valid JSON in natural Korean. No markdown.',
                },
                {
                    'role': 'user',
                    'content': prompt,
                },
            ],
            model=GROQ_MODEL,
            temperature=0.45,
            response_format={'type': 'json_object'},
        )
        response_text = (
            response.choices[0].message.content.strip()
            .replace('```json', '')
            .replace('```', '')
            .strip()
        )
        payload = json.loads(response_text)
        normalized, normalization_reason = normalize_feedback(payload, fallback_feedback)
        if normalization_reason != 'ai':
            log_feedback_event(
                username,
                activity_summary.get('window_days', 30),
                'fallback',
                normalization_reason,
            )
            return normalized, normalization_reason

        log_feedback_event(
            username,
            activity_summary.get('window_days', 30),
            'success',
            'ai',
        )
        return normalized, 'ai'
    except Exception as exc:
        log_feedback_event(
            username,
            activity_summary.get('window_days', 30),
            'error',
            exc.__class__.__name__,
        )
        print(f'Groq error: {exc}')
        return None, f'generation_failed:{exc.__class__.__name__}'


def normalize_username_or_400(username: str):
    normalized_username = username.strip()
    if not normalized_username:
        raise HTTPException(status_code=400, detail='GitHub 아이디가 비어 있습니다.')
    return normalized_username


def raise_for_profile_error(username: str, response: httpx.Response):
    if response.status_code == 404:
        raise HTTPException(status_code=404, detail='해당 GitHub 사용자를 찾지 못했습니다.')

    if response.status_code == 403:
        rate_limit_remaining = response.headers.get('x-ratelimit-remaining')
        print(
            'GitHub profile request blocked '
            f'for {username}: remaining={rate_limit_remaining}'
        )
        detail = 'GitHub 프로필 정보를 불러오지 못했습니다.'
        if rate_limit_remaining == '0':
            detail = 'GitHub API 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.'
        elif not GITHUB_TOKEN:
            detail = (
                'GitHub 토큰이 설정되지 않아 요청이 제한되고 있습니다. '
                '서버 환경변수를 확인해주세요.'
            )
        else:
            detail = (
                'GitHub 토큰이 만료되었거나 올바르지 않습니다. '
                '서버 환경변수를 확인해주세요.'
            )
        raise HTTPException(status_code=403, detail=detail)

    if response.status_code != 200:
        print(
            f'GitHub profile request failed for {username}: '
            f'status={response.status_code}'
        )
        raise HTTPException(
            status_code=response.status_code,
            detail='GitHub 프로필 정보를 불러오지 못했습니다.',
        )


def raise_for_repos_error(username: str, response: httpx.Response):
    if response.status_code == 403:
        rate_limit_remaining = response.headers.get('x-ratelimit-remaining')
        print(
            'GitHub repos request blocked '
            f'for {username}: remaining={rate_limit_remaining}'
        )
        detail = '저장소 목록을 불러오지 못했습니다.'
        if rate_limit_remaining == '0':
            detail = 'GitHub API 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.'
        else:
            detail = '저장소 목록 요청이 제한되었습니다. GitHub 토큰 상태를 확인해주세요.'
        raise HTTPException(status_code=403, detail=detail)

    if response.status_code != 200:
        print(
            f'GitHub repos request failed for {username}: '
            f'status={response.status_code}'
        )
        raise HTTPException(
            status_code=response.status_code,
            detail='저장소 목록을 불러오지 못했습니다. GitHub 토큰 상태를 확인해주세요.',
        )


def raise_for_events_error(username: str, response: httpx.Response):
    if response.status_code == 404:
        raise HTTPException(status_code=404, detail='해당 GitHub 사용자를 찾지 못했습니다.')

    if response.status_code == 403:
        rate_limit_remaining = response.headers.get('x-ratelimit-remaining')
        print(
            'GitHub events request blocked '
            f'for {username}: remaining={rate_limit_remaining}'
        )
        detail = 'GitHub 활동 이벤트를 불러오지 못했습니다.'
        if rate_limit_remaining == '0':
            detail = 'GitHub API 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.'
        elif not GITHUB_TOKEN:
            detail = (
                'GitHub 토큰이 설정되지 않아 활동 이벤트 요청이 제한되고 있습니다. '
                '서버 환경변수를 확인해주세요.'
            )
        else:
            detail = (
                'GitHub 토큰이 만료되었거나 활동 이벤트 요청이 제한되었습니다. '
                '서버 환경변수를 확인해주세요.'
            )
        raise HTTPException(status_code=403, detail=detail)

    print(
        f'GitHub events request failed for {username}: '
        f'status={response.status_code}'
    )
    raise HTTPException(
        status_code=response.status_code,
        detail='GitHub 활동 이벤트를 불러오지 못했습니다.',
    )


def summarize_analysis(
    username: str,
    user_data: dict,
    events_data: list,
    repos_data: list,
    days: int,
    *,
    events_incomplete: bool = False,
):
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(days=days)
    recent_window_events = []
    active_days = set()

    for event in events_data:
        event_type = event.get('type')
        if not event_type:
            continue

        created_at = parse_github_datetime(event.get('created_at'))
        if created_at and created_at >= window_start:
            recent_window_events.append(event)
            active_days.add(created_at.date().isoformat())

    summary_event_types = {}
    for event in recent_window_events:
        event_type = event.get('type')
        if event_type:
            summary_event_types[event_type] = summary_event_types.get(event_type, 0) + 1

    languages = {}
    for repo in repos_data:
        language = repo.get('language')
        if language:
            languages[language] = languages.get(language, 0) + 1

    top_language = None
    if languages:
        top_language = max(languages.items(), key=lambda item: item[1])[0]

    activity_summary = {
        'window_days': days,
        'window_label': window_label(days),
        'total_events_30d': len(recent_window_events),
        'push_events_30d': summary_event_types.get('PushEvent', 0),
        'active_days_30d': len(active_days),
        'event_data_incomplete': events_incomplete or days > EVENT_API_RELIABLE_WINDOW_DAYS,
    }

    feedback = build_feedback(
        activity_summary,
        top_language,
        event_types=summary_event_types,
        total_repos=len(repos_data),
    )
    feedback = adapt_feedback_to_window(feedback, activity_summary)

    feedback_enabled = AI_PROVIDER == 'groq' and bool(groq_client)

    return {
        'status': 'success',
        'username': username,
        'generated_at': now.isoformat(),
        'profile': {
            'name': user_data.get('name'),
            'avatar_url': user_data.get('avatar_url'),
            'public_repos': user_data.get('public_repos'),
            'total_repos': len(repos_data),
        },
        'stats': {
            'recent_push_events': summary_event_types.get('PushEvent', 0),
            'languages': languages,
            'event_types': summary_event_types,
            'activity_summary': activity_summary,
        },
        'feedback': feedback,
        'feedback_source': 'rule-based',
        'feedback_pending': feedback_enabled,
    }


async def fetch_user_events(client: httpx.AsyncClient, username: str, headers: dict, days: int):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    collected_events = []
    event_data_incomplete = False

    for page in range(1, MAX_GITHUB_EVENT_PAGES + 1):
        response = await client.get(
            f'https://api.github.com/users/{username}/events?per_page=100&page={page}',
            headers=headers,
        )
        if response.status_code != 200:
            if page == 1:
                return response, [], False
            break

        page_events = response.json()
        if not page_events:
            break

        collected_events.extend(page_events)

        oldest_created_at = parse_github_datetime(page_events[-1].get('created_at'))
        if oldest_created_at and oldest_created_at < cutoff:
            break
    else:
        event_data_incomplete = has_next_page(response)

    return None, collected_events, event_data_incomplete


async def fetch_user_repos(client: httpx.AsyncClient, username: str, headers: dict):
    collected_repos = []
    page = 1
    first_response = None

    while True:
        response = await client.get(
            f'https://api.github.com/users/{username}/repos?per_page=100&sort=updated&page={page}',
            headers=headers,
        )
        if first_response is None:
            first_response = response

        if response.status_code != 200:
            return response, []

        page_repos = response.json()
        if not page_repos:
            break

        collected_repos.extend(page_repos)

        if len(page_repos) < 100 or not has_next_page(response):
            break

        page += 1

    return first_response, collected_repos


async def fetch_analysis_payload(username: str, days: int):
    cache_key = build_cache_key(username, days)
    cached = get_cache_entry(analysis_cache, cache_key)
    if cached:
        return cached

    client = app.state.github_client
    headers = build_github_headers()
    user_url = f'https://api.github.com/users/{username}'
    try:
        user_res, repos_result = await asyncio.gather(
            client.get(user_url, headers=headers),
            fetch_user_repos(client, username, headers),
        )
        repos_res, repos_data = repos_result
        events_res, events_data, events_incomplete = await fetch_user_events(
            client,
            username,
            headers,
            days,
        )
    except httpx.RequestError as exc:
        print(f'GitHub request error for {username}: {exc}')
        raise HTTPException(
            status_code=503,
            detail=(
                'GitHub API 연결이 일시적으로 불안정합니다. '
                '방금 요청한 경우라면 10~20초 뒤 다시 시도해주세요.'
            ),
        ) from exc

    raise_for_profile_error(username, user_res)
    raise_for_repos_error(username, repos_res)
    if events_res is not None:
        raise_for_events_error(username, events_res)

    user_data = user_res.json()
    payload = summarize_analysis(
        username,
        user_data,
        events_data,
        repos_data,
        days,
        events_incomplete=events_incomplete,
    )
    set_cache_entry(analysis_cache, cache_key, payload)
    return payload


def build_feedback_payload(analysis_payload: dict):
    stats = analysis_payload['stats']
    profile = analysis_payload['profile']
    languages = stats.get('languages', {})
    activity_summary = stats.get('activity_summary', {})
    event_types = stats.get('event_types', {})
    top_language = None
    if languages:
        top_language = max(languages.items(), key=lambda item: item[1])[0]

    feedback, feedback_source = generate_feedback_with_groq(
        analysis_payload['username'],
        activity_summary,
        top_language,
        languages,
        event_types,
        profile.get('total_repos', 0),
        stats.get('recent_push_events', 0),
    )
    feedback_meta = {
        'provider': AI_PROVIDER,
        'model': GROQ_MODEL if AI_PROVIDER == 'groq' else None,
        'cache_version': FEEDBACK_PROMPT_VERSION,
        'source_detail': feedback_source,
    }

    if not feedback:
        feedback = analysis_payload['feedback']
        feedback_source = 'rule-based'
        feedback_meta['source_detail'] = feedback_meta['source_detail'] or 'rule_based_fallback'
    else:
        feedback = adapt_feedback_to_window(feedback, activity_summary)
        if feedback_source != 'ai':
            feedback_source = 'rule-based'

    return {
        'username': analysis_payload['username'],
        'feedback': feedback,
        'feedback_source': feedback_source,
        'feedback_meta': feedback_meta,
        'feedback_pending': False,
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


@app.get('/api/analyze-legacy/{username}', deprecated=True)
async def analyze_user_legacy(username: str):
    # 이전 엔드포인트는 호환성 유지를 위해 남겨두고 실제 처리는 최신 경로를 사용합니다.
    return await analyze_user(username=username, days=30)


@app.get('/api/analyze/{username}')
async def analyze_user(
    username: str,
    days: int = Query(default=30),
):
    normalized_username = normalize_username_or_400(username)
    normalized_days = normalize_window_days(days)
    return await fetch_analysis_payload(normalized_username, normalized_days)


@app.get('/api/feedback/{username}')
async def get_feedback(
    username: str,
    days: int = Query(default=30),
):
    normalized_username = normalize_username_or_400(username)
    normalized_days = normalize_window_days(days)
    cache_key = build_feedback_cache_key(normalized_username, normalized_days)
    cached = get_cache_entry(feedback_cache, cache_key)
    if cached:
        return cached

    analysis_payload = await fetch_analysis_payload(normalized_username, normalized_days)
    feedback_payload = await asyncio.to_thread(build_feedback_payload, analysis_payload)
    set_cache_entry(feedback_cache, cache_key, feedback_payload)
    return feedback_payload

