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
    uses_consistent_polite_tone,
    window_label,
)

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
GITHUB_TIME_FORMAT = '%Y-%m-%dT%H:%M:%SZ'
ALLOWED_WINDOWS = {7, 30, 90, 180, 365}
MAX_GITHUB_EVENT_PAGES = 3
EVENT_API_RELIABLE_WINDOW_DAYS = 90
FEEDBACK_PROMPT_VERSION = 'v3'
COMPARISON_PROMPT_VERSION = 'v2'

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
comparison_cache: dict[str, tuple[datetime, dict]] = {}


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


def build_comparison_cache_key(current_snapshot: dict, previous_snapshot: dict):
    provider = AI_PROVIDER or 'rule-based'
    model = GROQ_MODEL if provider == 'groq' else 'rule-based'
    serialized = json.dumps(
        {
            'current': current_snapshot,
            'previous': previous_snapshot,
            'provider': provider,
            'model': model,
            'version': COMPARISON_PROMPT_VERSION,
        },
        ensure_ascii=False,
        sort_keys=True,
    )
    digest = hashlib.sha256(serialized.encode('utf-8')).hexdigest()
    return f'comparison:{digest}'


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
                    'content': (
                        'Return only valid JSON in natural Korean honorific speech. '
                        'Use consistent 존댓말 only. No markdown.'
                    ),
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


def log_comparison_event(username: str, days: int, status: str, detail: str | None = None):
    detail_suffix = f' detail={detail}' if detail else ''
    print(
        f'Comparison feedback status={status} username={username} '
        f'days={days} provider={AI_PROVIDER}{detail_suffix}'
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


def top_ranked_key(values: dict):
    if not values:
        return None
    return max(values.items(), key=lambda item: (item[1], item[0]))[0]


def build_comparison_summary(current_snapshot: dict, previous_snapshot: dict):
    current_username = normalize_username_or_400(current_snapshot.get('username', ''))
    previous_username = normalize_username_or_400(previous_snapshot.get('username', ''))

    current_stats = current_snapshot.get('stats', {})
    previous_stats = previous_snapshot.get('stats', {})
    current_activity = current_stats.get('activity_summary', {})
    previous_activity = previous_stats.get('activity_summary', {})

    current_days = normalize_window_days(int(current_activity.get('window_days') or 0))
    previous_days = normalize_window_days(int(previous_activity.get('window_days') or 0))

    if current_username.lower() != previous_username.lower():
        raise HTTPException(status_code=400, detail='같은 GitHub 사용자 기록끼리만 비교할 수 있습니다.')

    if current_days != previous_days:
        raise HTTPException(status_code=400, detail='같은 기간으로 저장한 기록끼리만 비교할 수 있습니다.')

    current_languages = current_stats.get('languages', {})
    previous_languages = previous_stats.get('languages', {})
    current_events = current_stats.get('event_types', {})
    previous_events = previous_stats.get('event_types', {})
    current_top_language = top_ranked_key(current_languages)
    previous_top_language = top_ranked_key(previous_languages)

    current_data = {
        'generated_at': current_snapshot.get('generated_at'),
        'total_events': current_activity.get('total_events_30d', 0),
        'push_events': current_activity.get('push_events_30d', 0),
        'active_days': current_activity.get('active_days_30d', 0),
        'pull_request_events': current_events.get('PullRequestEvent', 0),
        'issue_events': current_events.get('IssuesEvent', 0)
        + current_events.get('IssueCommentEvent', 0),
        'total_repos': current_snapshot.get('profile', {}).get('total_repos')
        or current_snapshot.get('profile', {}).get('public_repos', 0),
        'top_language': current_top_language,
        'language_count': len(current_languages),
        'event_data_incomplete': bool(current_activity.get('event_data_incomplete')),
    }
    previous_data = {
        'generated_at': previous_snapshot.get('generated_at'),
        'total_events': previous_activity.get('total_events_30d', 0),
        'push_events': previous_activity.get('push_events_30d', 0),
        'active_days': previous_activity.get('active_days_30d', 0),
        'pull_request_events': previous_events.get('PullRequestEvent', 0),
        'issue_events': previous_events.get('IssuesEvent', 0)
        + previous_events.get('IssueCommentEvent', 0),
        'total_repos': previous_snapshot.get('profile', {}).get('total_repos')
        or previous_snapshot.get('profile', {}).get('public_repos', 0),
        'top_language': previous_top_language,
        'language_count': len(previous_languages),
        'event_data_incomplete': bool(previous_activity.get('event_data_incomplete')),
    }

    delta = {
        'total_events': current_data['total_events'] - previous_data['total_events'],
        'push_events': current_data['push_events'] - previous_data['push_events'],
        'active_days': current_data['active_days'] - previous_data['active_days'],
        'pull_request_events': (
            current_data['pull_request_events'] - previous_data['pull_request_events']
        ),
        'issue_events': current_data['issue_events'] - previous_data['issue_events'],
        'total_repos': current_data['total_repos'] - previous_data['total_repos'],
        'language_count': current_data['language_count'] - previous_data['language_count'],
    }

    gained_languages = sorted(set(current_languages) - set(previous_languages))[:4]
    lost_languages = sorted(set(previous_languages) - set(current_languages))[:4]

    reliability_note = None
    if current_data['event_data_incomplete'] or previous_data['event_data_incomplete']:
        reliability_note = (
            f'{window_label(current_days)} 비교는 GitHub 공개 Events API 조회 한계로 '
            '오래된 이벤트 일부가 빠질 수 있습니다.'
        )

    return {
        'username': current_username,
        'window_days': current_days,
        'window_label': window_label(current_days),
        'current': current_data,
        'previous': previous_data,
        'delta': delta,
        'gained_languages': gained_languages,
        'lost_languages': lost_languages,
        'reliability_note': reliability_note,
        'current_generated_at': current_data['generated_at'],
        'previous_generated_at': previous_data['generated_at'],
    }


def build_comparison_feedback(summary: dict):
    current = summary['current']
    previous = summary['previous']
    delta = summary['delta']
    label = summary['window_label']

    positive_signals = []
    caution_signals = []

    if delta['active_days'] > 0:
        positive_signals.append(
            f'활동 일수가 {previous["active_days"]}일에서 {current["active_days"]}일로 늘어 리듬이 더 또렷해졌습니다.'
        )
    elif delta['active_days'] < 0:
        caution_signals.append(
            f'활동 일수는 {previous["active_days"]}일에서 {current["active_days"]}일로 줄어 흐름이 덜 이어져 보일 수 있습니다.'
        )

    if delta['push_events'] > 0:
        positive_signals.append(
            f'Push 기록이 {previous["push_events"]}회에서 {current["push_events"]}회로 늘어 코드 반영 흔적이 더 분명합니다.'
        )
    elif delta['push_events'] < 0:
        caution_signals.append(
            f'Push 기록은 {previous["push_events"]}회에서 {current["push_events"]}회로 줄어 작업 흔적이 다소 옅어졌습니다.'
        )

    if delta['pull_request_events'] > 0:
        positive_signals.append(
            f'PR 관련 기록이 {previous["pull_request_events"]}회에서 {current["pull_request_events"]}회로 늘어 협업 맥락이 더 잘 드러납니다.'
        )
    elif current['pull_request_events'] == 0:
        caution_signals.append('여전히 PR 기록이 없어 변경 이유와 협업 흐름은 약하게 보일 수 있습니다.')

    if delta['issue_events'] > 0:
        positive_signals.append(
            f'이슈 관련 기록이 {previous["issue_events"]}회에서 {current["issue_events"]}회로 늘어 문제 정의 흔적이 더 보입니다.'
        )
    elif current['issue_events'] == 0:
        caution_signals.append('이슈 기록은 아직 거의 없어 문제를 어떻게 정의하고 정리했는지 보완이 필요합니다.')

    if delta['total_repos'] > 0:
        positive_signals.append(
            f'공개 저장소 수가 {previous["total_repos"]}개에서 {current["total_repos"]}개로 늘어 작업 범위가 조금 더 넓어졌습니다.'
        )

    if (
        current['top_language']
        and previous['top_language']
        and current['top_language'] != previous['top_language']
    ):
        positive_signals.append(
            f'주력 언어가 {previous["top_language"]}에서 {current["top_language"]}로 바뀌어 최근 관심 축이 달라진 점도 보입니다.'
        )

    if summary['gained_languages']:
        positive_signals.append(
            f'최근 기록에 {", ".join(summary["gained_languages"])} 언어가 새로 보여 기술 폭이 조금 더 넓어졌습니다.'
        )

    if delta['total_events'] < 0 and not caution_signals:
        caution_signals.append(
            f'전체 공개 이벤트 수는 {previous["total_events"]}회에서 {current["total_events"]}회로 줄었습니다.'
        )

    if not positive_signals:
        positive_signals.append(
            '큰 폭의 성장 신호보다는 기존 흐름을 유지한 기록에 가깝습니다.'
        )

    if not caution_signals:
        caution_signals.append(
            '큰 하락 신호는 없지만, 다음 저장본에서는 협업 흔적과 기록의 맥락을 조금 더 남기면 비교 포인트가 더 선명해집니다.'
        )

    if delta['active_days'] > 0 and delta['push_events'] >= 0:
        headline = f'{label} 기준 직전 기록보다 활동 리듬이 더 안정적으로 보입니다.'
    elif delta['push_events'] > 0:
        headline = f'{label} 기준 직전 기록보다 코드 반영 흔적이 더 또렷해졌습니다.'
    elif delta['total_events'] < 0 and delta['active_days'] < 0:
        headline = f'{label} 기준 직전 기록보다 공개 활동 흐름이 조금 옅어졌습니다.'
    else:
        headline = f'{label} 기준 직전 기록과 비슷한 흐름 안에서 몇 가지 변화가 보입니다.'

    if current['pull_request_events'] == 0:
        next_step = '다음 기록에서는 작은 변경이라도 PR 설명을 남겨서 비교했을 때 협업 맥락이 보이게 만드는 편이 좋습니다.'
    elif current['issue_events'] == 0:
        next_step = '다음 기록에서는 이슈나 작업 메모를 함께 남겨서 무엇을 해결했는지 연결되도록 만드는 편이 좋습니다.'
    elif delta['active_days'] <= 0:
        next_step = '다음 기록에서는 커밋을 며칠에 나눠 남겨 활동 리듬이 끊기지 않도록 만드는 편이 좋습니다.'
    else:
        next_step = '지금처럼 유지하되 다음 기록에서는 README나 PR 설명까지 함께 남겨 성장 이유가 더 잘 읽히게 만드는 편이 좋습니다.'

    return {
        'headline': headline,
        'growth': positive_signals[0],
        'needs_attention': caution_signals[0],
        'next_step': next_step,
    }


def normalize_comparison_feedback(payload: dict, fallback_feedback: dict):
    if not isinstance(payload, dict):
        return fallback_feedback, 'invalid_payload'

    cleaned = {}
    for field, max_length in (
        ('headline', 140),
        ('growth', 240),
        ('needs_attention', 240),
        ('next_step', 240),
    ):
        value = str(payload.get(field, '')).strip()
        if not value:
            return fallback_feedback, f'missing_{field}'
        cleaned[field] = value[:max_length]

    if not all(uses_consistent_polite_tone(value) for value in cleaned.values()):
        return fallback_feedback, 'non_polite_tone'

    return cleaned, 'ai'


def build_comparison_prompt(summary: dict):
    current = summary['current']
    previous = summary['previous']
    delta = summary['delta']
    reliability_note = summary['reliability_note'] or 'No special reliability warning.'
    gained_languages = ', '.join(summary['gained_languages']) or 'none'
    lost_languages = ', '.join(summary['lost_languages']) or 'none'

    return f"""
You write concise Korean comparison feedback for saved GitHub activity snapshots.
The two snapshots are from the same GitHub user and the same analysis window.
Return only valid JSON with the keys headline, growth, needs_attention, next_step.

Current snapshot
- username: {summary['username']}
- window: {summary['window_label']}
- total public events: {current['total_events']}
- push events: {current['push_events']}
- active days: {current['active_days']}
- pull request events: {current['pull_request_events']}
- issue-related events: {current['issue_events']}
- public repos: {current['total_repos']}
- top language: {current['top_language'] or 'none'}
- language count: {current['language_count']}

Previous snapshot
- total public events: {previous['total_events']}
- push events: {previous['push_events']}
- active days: {previous['active_days']}
- pull request events: {previous['pull_request_events']}
- issue-related events: {previous['issue_events']}
- public repos: {previous['total_repos']}
- top language: {previous['top_language'] or 'none'}
- language count: {previous['language_count']}

Delta
- total public events: {delta['total_events']:+d}
- push events: {delta['push_events']:+d}
- active days: {delta['active_days']:+d}
- pull request events: {delta['pull_request_events']:+d}
- issue-related events: {delta['issue_events']:+d}
- public repos: {delta['total_repos']:+d}
- language count: {delta['language_count']:+d}
- gained languages: {gained_languages}
- lost languages: {lost_languages}
- reliability note: {reliability_note}

Rules
1. Write natural Korean without markdown.
2. Every field must use consistent polite Korean honorific speech only.
3. Do not use casual speech, banmal, or plain "-다" narrative endings.
4. End sentences politely, for example with forms like "~습니다", "~보입니다", or "~해보세요".
5. Focus on change from previous to current, not a generic profile review.
6. growth must describe what improved or became clearer.
7. needs_attention must describe what still looks weak or what declined.
8. next_step must suggest one concrete action for the next saved record.
9. Keep each field to one or two sentences.
10. Do not mention raw JSON, prompts, or model limitations.
""".strip()


def generate_comparison_feedback_with_groq(summary: dict):
    fallback_feedback = build_comparison_feedback(summary)

    if AI_PROVIDER != 'groq' or not groq_client:
        return fallback_feedback, 'rule_based'

    prompt = build_comparison_prompt(summary)

    try:
        response = groq_client.chat.completions.create(
            messages=[
                {
                    'role': 'system',
                    'content': (
                        'Return only valid JSON in natural Korean honorific speech. '
                        'Use consistent 존댓말 only. No markdown.'
                    ),
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
        normalized, normalization_reason = normalize_comparison_feedback(
            payload,
            fallback_feedback,
        )
        if normalization_reason != 'ai':
            log_comparison_event(
                summary['username'],
                summary['window_days'],
                'fallback',
                normalization_reason,
            )
            return normalized, normalization_reason

        log_comparison_event(summary['username'], summary['window_days'], 'success', 'ai')
        return normalized, 'ai'
    except Exception as exc:
        log_comparison_event(
            summary['username'],
            summary['window_days'],
            'error',
            exc.__class__.__name__,
        )
        print(f'Groq comparison error: {exc}')
        return fallback_feedback, f'generation_failed:{exc.__class__.__name__}'


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


@app.post('/api/compare-feedback')
async def compare_feedback(payload: dict):
    current_snapshot = payload.get('current_snapshot')
    previous_snapshot = payload.get('previous_snapshot')

    if not isinstance(current_snapshot, dict) or not isinstance(previous_snapshot, dict):
        raise HTTPException(
            status_code=400,
            detail='현재 기록과 이전 기록 스냅샷이 모두 필요합니다.',
        )

    cache_key = build_comparison_cache_key(current_snapshot, previous_snapshot)
    cached = get_cache_entry(comparison_cache, cache_key)
    if cached:
        return cached

    comparison_summary = build_comparison_summary(current_snapshot, previous_snapshot)
    comparison_feedback, source_detail = await asyncio.to_thread(
        generate_comparison_feedback_with_groq,
        comparison_summary,
    )
    comparison_source = 'ai' if source_detail == 'ai' else 'rule-based'

    response_payload = {
        'username': comparison_summary['username'],
        'window_days': comparison_summary['window_days'],
        'comparison': comparison_feedback,
        'comparison_source': comparison_source,
        'comparison_meta': {
            'provider': AI_PROVIDER,
            'model': GROQ_MODEL if AI_PROVIDER == 'groq' else None,
            'cache_version': COMPARISON_PROMPT_VERSION,
            'source_detail': source_detail,
        },
        'comparison_summary': {
            'window_label': comparison_summary['window_label'],
            'current_generated_at': comparison_summary['current_generated_at'],
            'previous_generated_at': comparison_summary['previous_generated_at'],
            'delta': comparison_summary['delta'],
            'reliability_note': comparison_summary['reliability_note'],
        },
    }
    set_cache_entry(comparison_cache, cache_key, response_payload)
    return response_payload

