import asyncio
import hashlib
import json
import os
import re
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

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
GITHUB_TIME_FORMAT = '%Y-%m-%dT%H:%M:%SZ'
ALLOWED_WINDOWS = {7, 30, 90, 180, 365}

# 실행 위치와 상관없이 루트 또는 backend 폴더의 .env를 읽습니다.
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


def window_label(days: int):
    labels = {
        7: '최근 7일',
        30: '최근 30일',
        90: '최근 90일',
        180: '최근 6개월',
        365: '최근 1년',
    }
    return labels.get(days, f'최근 {days}일')


def build_feedback(
    summary: dict,
    top_language: str | None,
    event_types: dict | None = None,
    total_repos: int = 0,
):
    event_types = event_types or {}
    push_events = summary['push_events_30d']
    total_events = summary['total_events_30d']
    active_days = summary['active_days_30d']
    pr_events = event_types.get('PullRequestEvent', 0)

    if total_events == 0:
        headline = '최근 30일 공개 활동이 아직 많지 않아요.'
        strength = '지금은 프로필과 저장소 구조를 먼저 쌓아도 좋은 시기입니다.'
        improvement = '아직 공개 히스토리가 얇아서 꾸준함이나 작업 흐름이 선명하게 드러나진 않는 상태입니다.'
        next_step = '작은 커밋이라도 주 2~3회 남겨서 활동 흐름을 만들어보세요.'
    elif push_events >= 20:
        headline = '최근 한 달 동안 꾸준히 코드를 올리고 있어요.'
        strength = 'Push 이벤트가 많아 손을 놓지 않고 작업 흐름을 이어가고 있다는 점이 강점입니다.'
        if active_days <= 9:
            improvement = '다만 활동이 여러 날에 고르게 퍼지기보다 특정 시기에 몰린 편이라, 꾸준한 루틴으로 보이기엔 아직 아쉬움이 있습니다.'
            next_step = '다음 작업에서는 주 3회 정도로 커밋을 나눠 남겨서, 활동 일수가 자연스럽게 늘어나도록 해보세요.'
        elif pr_events <= 2:
            improvement = '다만 작업량에 비해 PR이나 작업 설명 기록이 적어, 어떤 맥락으로 발전했는지는 덜 또렷하게 보일 수 있습니다.'
            next_step = '다음 작업에서는 PR 설명이나 README 업데이트를 함께 남겨서, 작업 맥락이 보이게 정리해보세요.'
        else:
            improvement = '다만 활동량에 비해 프로젝트 설명이나 결과 정리가 조금 더 보강되면 성장 흐름이 훨씬 또렷해질 수 있습니다.'
            next_step = '다음 작업에서는 핵심 프로젝트 하나를 골라 README나 회고 메모까지 남겨보세요.'
    elif active_days >= 10:
        headline = '최근 30일 활동이 비교적 꾸준한 편이에요.'
        strength = '여러 날짜에 걸쳐 활동이 분산돼 있어 루틴이 만들어지고 있습니다.'
        if pr_events <= 2:
            improvement = '다만 협업 흔적이나 작업 설명이 적다면, 활동량에 비해 배운 점과 개선 흐름이 덜 드러날 수 있습니다.'
            next_step = '다음 작업에서는 PR 설명이나 작업 기록을 함께 남겨서, 왜 바꿨는지까지 보이게 해보세요.'
        else:
            improvement = '다만 여러 활동이 보이더라도 대표 프로젝트 하나가 또렷하게 보이지 않으면 인상이 분산될 수 있습니다.'
            next_step = '다음 작업에서는 가장 공들인 프로젝트 하나를 골라 README, 커밋, PR 흐름을 함께 정리해보세요.'
    else:
        headline = '활동이 시작되고 있지만 아직 밀도는 낮은 편이에요.'
        strength = '레포와 이벤트가 쌓이기 시작했고, 이제 패턴을 만들 단계입니다.'
        if total_repos <= 2:
            improvement = '공개 저장소 수와 활동 일수가 아직 적어서, 어떤 주제로 성장하고 있는지 한눈에 보이진 않는 상태입니다.'
            next_step = '다음 작업에서는 작더라도 끝까지 마무리한 프로젝트 하나를 더 공개해보세요.'
        else:
            improvement = '활동 일수와 기록 밀도가 아직 높지 않아, 꾸준함이 강하게 보이진 않는 상태입니다.'
            next_step = '다음 작업에서는 하루 단위의 짧은 커밋을 늘려서, 활동 히스토리가 더 자주 보이게 해보세요.'

    if top_language:
      strength = f'{strength} 현재 가장 많이 보이는 언어는 {top_language}입니다.'

    return {
        'headline': headline,
        'strength': strength,
        'improvement': improvement,
        'next_step': next_step,
    }


def adapt_feedback_to_window(feedback: dict, summary: dict):
    label = summary.get('window_label', f"최근 {summary.get('window_days', 30)}일")
    replacements = (
        ('최근 30일', label),
        ('최근 한 달', label),
        ('30일 동안', label),
    )
    adapted = {}
    for key, value in feedback.items():
        updated = value
        for source, target in replacements:
            updated = updated.replace(source, target)
        adapted[key] = updated
    return adapted


def sanitize_feedback(payload: dict):
    headline = str(payload.get('headline', '')).strip()
    strength = str(payload.get('strength', '')).strip()
    improvement = str(payload.get('improvement', '')).strip()
    next_step = str(payload.get('next_step', '')).strip()

    if not headline or not strength or not improvement or not next_step:
        return None

    cleaned_feedback = {
        'headline': headline[:140],
        'strength': strength[:240],
        'improvement': improvement[:220],
        'next_step': next_step[:240],
    }

    combined_text = ' '.join(cleaned_feedback.values())

    # 한글 UI에 한자나 호환 한자가 섞이면 바로 폐기합니다.
    if re.search(r'[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]', combined_text):
        return None

    banned_phrases = (
        'GitHub 활동을 시작하셨군요',
        'GitHub 활동을 시작하셨군요!',
        '활동을 시작하셨군요',
        '활동을 시작하셨군요!',
        '초보 개발자',
        'GitHub 활동을 시작하는 데 도움이 되는 몇 가지 팁',
        '다음에 해보면 좋은 행동은',
        'JavaScript, HTML, Python을 연습',
        'JavaScript, HTML, Python을 더 공부해 보시는 것을 추천합니다',
        '仓库',
        '倉庫',
        'GitHub 활동이 부족합니다',
        'GitHub 활동이 활발합니다',
        '가지고 있습니다',
        '발생시키는 활동',
    )
    if any(phrase in value for value in cleaned_feedback.values() for phrase in banned_phrases):
        return None

    if cleaned_feedback['headline'].endswith('!'):
        return None

    if re.search(r'[A-Za-z]+Event', combined_text):
        return None

    if re.search(r'JavaScript,\s*HTML,\s*Python', combined_text):
        return None

    if '30일 동안' in cleaned_feedback['strength'] and len(re.findall(r'\d+', cleaned_feedback['strength'])) >= 2:
        return None

    # 숫자를 여러 개 나열하는 설명은 품질이 낮은 경우가 많아 제외합니다.
    if len(re.findall(r'\d+', cleaned_feedback['strength'])) >= 2:
        return None

    if len(re.findall(r'\d+', cleaned_feedback['headline'])) >= 2:
        return None

    # 각 문장은 최소한의 역할을 해야 하므로 너무 짧은 응답은 폐기합니다.
    if (
        len(cleaned_feedback['headline']) < 12
        or len(cleaned_feedback['strength']) < 20
        or len(cleaned_feedback['improvement']) < 18
        or len(cleaned_feedback['next_step']) < 18
    ):
        return None

    forbidden_numbers = ('38개의 프로젝트', '38개 프로젝트')
    if any(token in value for value in cleaned_feedback.values() for token in forbidden_numbers):
        return None

    return cleaned_feedback


def normalize_feedback(payload: dict, fallback_feedback: dict):
    sanitized = sanitize_feedback(payload)
    if sanitized:
        return sanitized

    return {
        'headline': fallback_feedback['headline'],
        'strength': fallback_feedback['strength'],
        'improvement': fallback_feedback['improvement'],
        'next_step': fallback_feedback['next_step'],
    }


def build_improvement_hints(
    activity_summary: dict,
    top_language: str | None,
    languages: dict,
    event_types: dict,
    total_repos: int,
):
    hints = []
    total_events = activity_summary['total_events_30d']
    push_events = activity_summary['push_events_30d']
    active_days = activity_summary['active_days_30d']

    if total_events == 0:
        hints.append('최근 30일 공개 활동이 거의 보이지 않으니 작은 단위 커밋부터 다시 쌓는 것이 좋다.')
    elif active_days <= 4:
        hints.append('활동한 날짜 수가 적은 편이라 특정 날에 몰아 작업하기보다 주간 루틴을 만드는 쪽이 좋다.')
    elif active_days <= 8:
        hints.append('활동 밀도는 있지만 루틴으로 굳어졌다고 보긴 어려우니 활동 일수를 조금 더 늘리는 게 좋다.')

    if push_events <= 3:
        hints.append('코드 푸시 기록이 적으면 작업 과정이 잘 안 보이니 작은 커밋을 더 자주 남기는 것이 좋다.')

    if total_repos <= 2:
        hints.append('공개 저장소 수가 적어 작업 스펙트럼이 잘 안 보일 수 있으니 작은 프로젝트라도 하나 더 쌓는 것이 좋다.')

    if not event_types.get('PullRequestEvent'):
        hints.append('풀 리퀘스트 기록이 없으면 협업 흔적이 약해 보일 수 있으니 자기 프로젝트라도 PR 설명을 남겨보는 게 좋다.')
    elif event_types.get('PullRequestEvent', 0) <= 2:
        hints.append('풀 리퀘스트 기록이 적은 편이라 작업 맥락과 변경 이유가 충분히 드러나지 않을 수 있다.')

    issue_events = event_types.get('IssuesEvent', 0) + event_types.get('IssueCommentEvent', 0)
    if issue_events == 0:
        hints.append('이슈나 댓글 기록이 없어 문제를 어떻게 정리하고 해결했는지가 잘 드러나지 않는다.')

    if top_language and languages.get(top_language, 0) >= max(3, total_repos - 1):
        hints.append(f'{top_language} 비중이 높아 활동 폭이 한쪽으로 모여 보일 수 있다.')

    if not hints:
        hints.append('지금은 활동 흐름이 보이므로 다음 단계 제안은 너무 강한 보완 요구보다 기록 품질을 높이는 방향이면 좋다.')

    return hints[:3]


def build_strength_hints(
    activity_summary: dict,
    top_language: str | None,
    event_types: dict,
):
    hints = []
    total_events = activity_summary['total_events_30d']
    push_events = activity_summary['push_events_30d']
    active_days = activity_summary['active_days_30d']

    if push_events >= 20:
        hints.append('푸시 기록이 많아 작업 흐름이 이어지고 있다.')
    elif push_events >= 8:
        hints.append('최근 푸시 기록이 꾸준히 쌓이고 있다.')

    if active_days >= 10:
        hints.append('여러 날짜에 걸쳐 활동이 분산돼 있어 루틴이 만들어지고 있다.')
    elif active_days >= 6:
        hints.append('특정 하루에 몰리지 않고 며칠에 걸쳐 활동이 이어지고 있다.')

    if event_types.get('PullRequestEvent', 0) >= 3:
        hints.append('풀 리퀘스트 기록이 있어 작업 정리와 협업 흔적이 보인다.')

    if top_language:
        hints.append(f'주요 언어 흐름은 {top_language} 중심으로 보인다.')

    if total_events >= 40:
        hints.append('최근 공개 활동량 자체는 충분히 눈에 띄는 편이다.')

    if not hints:
        hints.append('아직 강점을 크게 단정하긴 어렵지만, 공개 활동 데이터는 쌓이기 시작한 상태다.')

    return hints[:4]


def build_recommendation_hints(
    activity_summary: dict,
    top_language: str | None,
    languages: dict,
    event_types: dict,
):
    hints = []
    pull_request_events = event_types.get('PullRequestEvent', 0)
    issue_events = event_types.get('IssuesEvent', 0) + event_types.get('IssueCommentEvent', 0)
    known_languages = set(languages.keys())
    language_followups = {
        'JavaScript': 'TypeScript',
        'TypeScript': 'Python',
        'Python': 'TypeScript',
        'Java': 'Kotlin',
        'HTML': 'JavaScript',
    }

    if pull_request_events == 0:
        hints.append('풀 리퀘스트 흔적이 없으니 자기 프로젝트라도 PR 설명과 변경 이유를 남겨보는 연습이 필요하다.')
    elif pull_request_events <= 2:
        hints.append('풀 리퀘스트 기록이 적은 편이니 작업 단위를 나눠 PR 설명을 남기는 연습을 더 해보는 것이 좋다.')

    if issue_events == 0:
        hints.append('다음 작업에서는 이슈를 먼저 열고 작업 목표와 완료 기준을 짧게 남겨보는 것이 좋다.')
    elif issue_events <= 2:
        hints.append('이슈 기록이 적은 편이니 작업 전후 메모를 이슈나 댓글로 남겨 맥락을 더 또렷하게 만드는 것이 좋다.')

    if activity_summary['active_days_30d'] <= 8:
        hints.append('활동 일수가 아주 높은 편은 아니니, 주 3회 정도 짧은 커밋 루틴을 만드는 방향이 좋다.')

    if top_language and languages.get(top_language, 0) >= max(3, len(known_languages)):
        suggested_language = language_followups.get(top_language)
        if suggested_language and suggested_language not in known_languages:
            hints.append(
                f'지금은 {top_language} 중심 흐름이 강하니 다음 작업에서는 {suggested_language}로 작은 기능 하나를 옮겨 보며 폭을 넓혀보는 것도 좋다.'
            )

    if not hints and top_language:
        hints.append(f'지금은 {top_language} 중심의 흐름이 뚜렷하니, 대표 프로젝트 하나의 README나 작업 기록을 더 선명하게 다듬는 것이 좋다.')

    if not hints:
        hints.append('다음 작업에서는 README, 커밋 메시지, 작업 기록 중 하나를 더 또렷하게 남겨 활동의 맥락이 보이게 하는 것이 좋다.')

    return hints[:4]


def build_style_notes(
    username: str,
    activity_summary: dict,
    event_types: dict,
):
    variants = [
        {
            'tone': '담백한 분석형',
            'headline_rule': '판정문보다 최근 흐름을 묘사하는 문장으로 시작한다.',
            'strength_rule': '활동 패턴이 보이는 이유를 차분하게 해석한다.',
        },
        {
            'tone': '짧은 회고형',
            'headline_rule': '최근 흐름을 한 번 정리해 주는 느낌으로 시작한다.',
            'strength_rule': '눈에 띄는 강점과 아직 덜 보이는 점의 균형을 맞춘다.',
        },
        {
            'tone': '서비스 요약형',
            'headline_rule': '짧고 또렷하게 현재 상태를 요약한다.',
            'strength_rule': '숫자보다 패턴과 맥락이 먼저 읽히게 쓴다.',
        },
        {
            'tone': '멘토 코멘트형',
            'headline_rule': '부담 주지 않는 말투로 현재 흐름을 짚는다.',
            'strength_rule': '강점과 다음 성장 포인트가 자연스럽게 이어지게 쓴다.',
        },
    ]
    seed_source = (
        f"{username}:{activity_summary['total_events_30d']}:"
        f"{activity_summary['push_events_30d']}:{activity_summary['active_days_30d']}:"
        f"{event_types.get('PullRequestEvent', 0)}:{event_types.get('IssuesEvent', 0)}"
    )
    index = int(hashlib.md5(seed_source.encode('utf-8')).hexdigest(), 16) % len(variants)
    return variants[index]


def build_ai_prompt(
    username: str,
    activity_summary: dict,
    top_language: str | None,
    languages: dict,
    event_types: dict,
    total_repos: int,
    recent_push_events: int,
    strength_hints: list[str],
    improvement_hints: list[str],
    recommendation_hints: list[str],
):
    strength_text = ' '.join(strength_hints[:2])
    improvement_text = improvement_hints[0] if improvement_hints else ''
    recommendation_text = recommendation_hints[0] if recommendation_hints else ''
    style_notes = build_style_notes(username, activity_summary, event_types)

    return f"""
너는 IT 서비스의 코드 분석 봇이다.
아래 제공된 [분석 데이터] 문장들을 바탕으로, 자연스러운 한국어 서비스 안내문구를 JSON 형식으로만 작성해라.

[분석 데이터]
- 강점: {strength_text}
- 보완점: {improvement_text}
- 제안: {recommendation_text}

[문장 스타일]
- 톤: {style_notes['tone']}
- headline: {style_notes['headline_rule']}
- strength: {style_notes['strength_rule']}

[작성 규칙]
1. [분석 데이터]에 없는 내용을 지어내지 마라.
2. "초보 개발자", "활동을 시작하셨군요", "仓库" 같은 어색한 표현은 절대 금지한다. 저장소, 레포지토리처럼 자연스러운 표현만 써라.
3. 숫자를 기계적으로 나열하지 말고, 의미를 풀어서 설명해라.
4. headline, strength, improvement, next_step은 서로 다른 역할로 작성해라.
5. improvement는 [보완점] 첫 문장을 기준으로 작성하고, next_step은 [제안] 첫 문장을 기준으로 작성해라.
6. next_step에서는 push를 더 하라고 권하지 말고, [제안]에 있는 구체 행동만 추천해라.
7. 아래 표현을 그대로 반복하지 말고, 같은 뜻이라도 새로운 문장으로 다시 써라:
    - 최근 30일 공개 활동이 아직 많지 않아요.
    - 최근 한 달 동안 꾸준히 코드를 올리고 있어요.
    - 최근 30일 활동이 비교적 꾸준한 편이에요.
8. JSON 이외의 텍스트는 절대 출력하지 마라.

[응답 JSON 형식]
{{
    "headline": "문장",
    "strength": "문장",
    "improvement": "문장",
    "next_step": "문장"
}}
""".strip()


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
            temperature=0.2,
            response_format={'type': 'json_object'},
        )
        response_text = (
            response.choices[0].message.content.strip()
            .replace('```json', '')
            .replace('```', '')
            .strip()
        )
        payload = json.loads(response_text)
        normalized = normalize_feedback(payload, fallback_feedback)
        if normalized == fallback_feedback:
            return normalized, 'validation_failed'
        return normalized, 'ai'
    except Exception as exc:
        print(f'Groq error: {exc}')
        return None, 'generation_failed'


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
            detail = 'GitHub API 요청 한도에 도달했습니다. 잠시 뒤 다시 시도해주세요.'
        elif not GITHUB_TOKEN:
            detail = (
                'GitHub 토큰이 설정되지 않아 요청이 제한되고 있습니다. '
                '서버 환경변수를 확인해주세요.'
            )
        else:
            detail = (
                'GitHub 토큰이 없거나 만료되었을 수 있습니다. '
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
        detail = '레포지토리 목록을 불러오지 못했습니다.'
        if rate_limit_remaining == '0':
            detail = 'GitHub API 요청 한도에 도달했습니다. 잠시 뒤 다시 시도해주세요.'
        else:
            detail = '레포지토리 목록 요청이 제한되었습니다. GitHub 토큰 상태를 확인해주세요.'
        raise HTTPException(status_code=403, detail=detail)

    if response.status_code != 200:
        print(
            f'GitHub repos request failed for {username}: '
            f'status={response.status_code}'
        )
        raise HTTPException(
            status_code=response.status_code,
            detail='레포지토리 목록을 불러오지 못했습니다. GitHub 토큰 상태를 확인해주세요.',
        )


def summarize_analysis(
    username: str,
    user_data: dict,
    events_data: list,
    repos_data: list,
    days: int,
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

    for page in range(1, 4):
        response = await client.get(
            f'https://api.github.com/users/{username}/events?per_page=100&page={page}',
            headers=headers,
        )
        if response.status_code != 200:
            if page == 1:
                return response, []
            break

        page_events = response.json()
        if not page_events:
            break

        collected_events.extend(page_events)

        oldest_created_at = parse_github_datetime(page_events[-1].get('created_at'))
        if oldest_created_at and oldest_created_at < cutoff:
            break

    return None, collected_events


async def fetch_analysis_payload(username: str, days: int):
    cache_key = build_cache_key(username, days)
    cached = get_cache_entry(analysis_cache, cache_key)
    if cached:
        return cached

    client = app.state.github_client
    headers = build_github_headers()
    user_url = f'https://api.github.com/users/{username}'
    repos_url = (
        f'https://api.github.com/users/{username}/repos'
        '?per_page=100&sort=updated'
    )

    try:
        user_res, repos_res = await asyncio.gather(
            client.get(user_url, headers=headers),
            client.get(repos_url, headers=headers),
        )
        events_res, events_data = await fetch_user_events(client, username, headers, days)
    except httpx.RequestError as exc:
        print(f'GitHub request error for {username}: {exc}')
        raise HTTPException(
            status_code=503,
            detail=(
                'GitHub API 연결이 일시적으로 불안정합니다. '
                '첫 요청 직후이거나 네트워크가 잠시 흔들릴 수 있으니 10~20초 뒤 다시 시도해주세요.'
            ),
        ) from exc

    raise_for_profile_error(username, user_res)
    raise_for_repos_error(username, repos_res)

    user_data = user_res.json()
    if events_res is not None:
        events_data = []
    repos_data = repos_res.json()
    payload = summarize_analysis(username, user_data, events_data, repos_data, days)
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

    if not feedback:
        feedback = analysis_payload['feedback']
        feedback_source = 'rule-based'
    else:
        feedback = adapt_feedback_to_window(feedback, activity_summary)

    return {
        'username': analysis_payload['username'],
        'feedback': feedback,
        'feedback_source': feedback_source,
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


@app.get('/api/analyze-legacy/{username}')
async def analyze_user_legacy(username: str):
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
        print(f'GitHub request error for {normalized_username}: {exc}')
        raise HTTPException(
            status_code=503,
            detail=(
                'GitHub API 연결이 일시적으로 불안정합니다. '
                '첫 요청 직후이거나 네트워크가 잠시 흔들릴 수 있으니 '
                '10~20초 뒤 다시 시도해주세요.'
            ),
        ) from exc

    if user_res.status_code == 404:
        raise HTTPException(status_code=404, detail='해당 GitHub 사용자를 찾지 못했습니다.')

    if user_res.status_code == 403:
        rate_limit_remaining = user_res.headers.get('x-ratelimit-remaining')
        print(
            'GitHub profile request blocked '
            f'for {normalized_username}: remaining={rate_limit_remaining}'
        )
        detail = 'GitHub 프로필 정보를 불러오지 못했습니다.'
        if rate_limit_remaining == '0':
            detail = (
                'GitHub API 요청 한도에 도달했습니다. '
                '잠시 뒤 다시 시도해주세요.'
            )
        elif not GITHUB_TOKEN:
            detail = (
                'GitHub 토큰이 설정되지 않아 요청이 제한되고 있습니다. '
                '서버 환경변수를 확인해주세요.'
            )
        else:
            detail = (
                'GitHub 토큰이 없거나 만료되었을 수 있습니다. '
                '서버 환경변수를 확인해주세요.'
            )
        raise HTTPException(status_code=403, detail=detail)

    if user_res.status_code != 200:
        print(
            f'GitHub profile request failed for {normalized_username}: '
            f'status={user_res.status_code}'
        )
        raise HTTPException(
            status_code=user_res.status_code,
            detail='GitHub 프로필 정보를 불러오지 못했습니다.',
        )

    if repos_res.status_code == 403:
        rate_limit_remaining = repos_res.headers.get('x-ratelimit-remaining')
        print(
            'GitHub repos request blocked '
            f'for {normalized_username}: remaining={rate_limit_remaining}'
        )
        detail = '레포지토리 목록을 불러오지 못했습니다.'
        if rate_limit_remaining == '0':
            detail = 'GitHub API 요청 한도에 도달했습니다. 잠시 뒤 다시 시도해주세요.'
        else:
            detail = '레포지토리 목록 요청이 제한되었습니다. GitHub 토큰 상태를 확인해주세요.'
        raise HTTPException(status_code=403, detail=detail)

    if repos_res.status_code != 200:
        print(
            f'GitHub repos request failed for {normalized_username}: '
            f'status={repos_res.status_code}'
        )
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

    feedback, feedback_source = await asyncio.to_thread(
        generate_feedback_with_groq,
        normalized_username,
        activity_summary,
        top_language,
        languages,
        summary_event_types,
        len(repos_data),
        recent_push_events,
    )
    if not feedback:
        feedback = build_feedback(
            activity_summary,
            top_language,
            event_types=summary_event_types,
            total_repos=len(repos_data),
        )
        if feedback_source == 'ai':
            feedback_source = 'rule-based'

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
        'feedback': feedback,
        'feedback_source': feedback_source,
    }


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
    cache_key = build_cache_key(normalized_username, normalized_days)
    cached = get_cache_entry(feedback_cache, cache_key)
    if cached:
        return cached

    analysis_payload = await fetch_analysis_payload(normalized_username, normalized_days)
    feedback_payload = await asyncio.to_thread(build_feedback_payload, analysis_payload)
    set_cache_entry(feedback_cache, cache_key, feedback_payload)
    return feedback_payload
