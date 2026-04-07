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
MAX_GITHUB_EVENT_PAGES = 3
EVENT_API_RELIABLE_WINDOW_DAYS = 90
FEEDBACK_PROMPT_VERSION = 'v2'

# ?�행 ?�치?� ?��??�이 루트 ?�는 backend ?�더??.env�??�습?�다.
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
        raise HTTPException(status_code=400, detail='지?�하지 ?�는 기간?�니??')
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
        headline = '최근 30??공개 ?�동???�직 많�? ?�아??'
        strength = '지금�? ?�로?�과 ?�?�소 구조�?먼�? ?�아??좋�? ?�기?�니??'
        improvement = '?�직 공개 ?�스?�리가 ?�아??꾸�??�이???�업 ?�름???�명?�게 ?�러?�진 ?�는 ?�태?�니??'
        next_step = '?��? 커밋?�라??�?2~3???�겨???�동 ?�름??만들?�보?�요.'
    elif push_events >= 20:
        headline = '최근 ?????�안 꾸�???코드�??�리�??�어??'
        strength = 'Push ?�벤?��? 많아 ?�을 ?��? ?�고 ?�업 ?�름???�어가�??�다???�이 강점?�니??'
        if active_days <= 9:
            improvement = '?�만 ?�동???�러 ?�에 고르�??��?기보???�정 ?�기??몰린 ?�이?? 꾸�???루틴?�로 보이기엔 ?�직 ?�쉬?�???�습?�다.'
            next_step = '?�음 ?�업?�서??�?3???�도�?커밋???�눠 ?�겨?? ?�동 ?�수가 ?�연?�럽�??�어?�도�??�보?�요.'
        elif pr_events <= 2:
            improvement = '?�만 ?�업?�에 비해 PR?�나 ?�업 ?�명 기록???�어, ?�떤 맥락?�로 발전?�는지?????�렷?�게 보일 ???�습?�다.'
            next_step = '?�음 ?�업?�서??PR ?�명?�나 README ?�데?�트�??�께 ?�겨?? ?�업 맥락??보이�??�리?�보?�요.'
        else:
            improvement = '?�만 ?�동?�에 비해 ?�로?�트 ?�명?�나 결과 ?�리가 조금 ??보강?�면 ?�장 ?�름???�씬 ?�렷?�질 ???�습?�다.'
            next_step = '?�음 ?�업?�서???�심 ?�로?�트 ?�나�?골라 README???�고 메모까�? ?�겨보세??'
    elif active_days >= 10:
        headline = '최근 30???�동??비교??꾸�????�이?�요.'
        strength = '?�러 ?�짜??걸쳐 ?�동??분산???�어 루틴??만들?��?�??�습?�다.'
        if pr_events <= 2:
            improvement = '?�만 ?�업 ?�적?�나 ?�업 ?�명???�다�? ?�동?�에 비해 배운 ?�과 개선 ?�름?????�러?????�습?�다.'
            next_step = '?�음 ?�업?�서??PR ?�명?�나 ?�업 기록???�께 ?�겨?? ??바꿨?��?까�? 보이�??�보?�요.'
        else:
            improvement = '?�만 ?�러 ?�동??보이?�라???�???�로?�트 ?�나가 ?�렷?�게 보이지 ?�으�??�상??분산?????�습?�다.'
            next_step = '?�음 ?�업?�서??가??공들???�로?�트 ?�나�?골라 README, 커밋, PR ?�름???�께 ?�리?�보?�요.'
    else:
        headline = '?�동???�작?�고 ?��?�??�직 밀?�는 ??? ?�이?�요.'
        strength = '?�포?� ?�벤?��? ?�이�??�작?�고, ?�제 ?�턴??만들 ?�계?�니??'
        if total_repos <= 2:
            improvement = '공개 ?�?�소 ?��? ?�동 ?�수가 ?�직 ?�어?? ?�떤 주제�??�장?�고 ?�는지 ?�눈??보이�??�는 ?�태?�니??'
            next_step = '?�음 ?�업?�서???�더?�도 ?�까지 마무리한 ?�로?�트 ?�나�???공개?�보?�요.'
        else:
            improvement = '?�동 ?�수?� 기록 밀?��? ?�직 ?��? ?�아, 꾸�??�이 강하�?보이�??�는 ?�태?�니??'
            next_step = '?�음 ?�업?�서???�루 ?�위??짧�? 커밋???�려?? ?�동 ?�스?�리가 ???�주 보이�??�보?�요.'

    if top_language:
      strength = f'{strength} ?�재 가??많이 보이???�어??{top_language}?�니??'

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
        return None, 'missing_fields'

    cleaned_feedback = {
        'headline': headline[:140],
        'strength': strength[:240],
        'improvement': improvement[:220],
        'next_step': next_step[:240],
    }

    combined_text = ' '.join(cleaned_feedback.values())

    # ?��? UI???�자???�환 ?�자가 ?�이�?바로 ?�기?�니??
    if re.search(r'[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]', combined_text):
        return None, 'contains_cjk'

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
        return None, 'contains_banned_phrase'

    if cleaned_feedback['headline'].endswith('!'):
        return None, 'headline_exclamation'

    if re.search(r'[A-Za-z]+Event', combined_text):
        return None, 'contains_event_name'

    if re.search(r'JavaScript,\s*HTML,\s*Python', combined_text):
        return None, 'contains_literal_language_triplet'

    if '30???�안' in cleaned_feedback['strength'] and len(re.findall(r'\d+', cleaned_feedback['strength'])) >= 2:
        return None

    # ?�자�??�러 �??�열?�는 ?�명?� ?�질????? 경우가 많아 ?�외?�니??
    if len(re.findall(r'\d+', cleaned_feedback['strength'])) >= 2:
        return None

    if len(re.findall(r'\d+', cleaned_feedback['headline'])) >= 2:
        return None

    # �?문장?� 최소?�의 ??��???�야 ?��?�??�무 짧�? ?�답?� ?�기?�니??
    if (
        len(cleaned_feedback['headline']) < 12
        or len(cleaned_feedback['strength']) < 20
        or len(cleaned_feedback['improvement']) < 18
        or len(cleaned_feedback['next_step']) < 18
    ):
        return None

    forbidden_numbers = ('38개의 ?�로?�트', '38�??�로?�트')
    if any(token in value for value in cleaned_feedback.values() for token in forbidden_numbers):
        return None

    return cleaned_feedback


def normalize_feedback(payload: dict, fallback_feedback: dict):
    sanitized = sanitize_feedback(payload)
    if isinstance(sanitized, tuple):
        normalized_feedback, reason = sanitized
        if normalized_feedback:
            return normalized_feedback, 'ai'
        return {
            'headline': fallback_feedback['headline'],
            'strength': fallback_feedback['strength'],
            'improvement': fallback_feedback['improvement'],
            'next_step': fallback_feedback['next_step'],
        }, reason

    if sanitized:
        return sanitized, 'ai'

    return {
        'headline': fallback_feedback['headline'],
        'strength': fallback_feedback['strength'],
        'improvement': fallback_feedback['improvement'],
        'next_step': fallback_feedback['next_step'],
    }, 'validation_failed'


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
        hints.append('최근 30??공개 ?�동??거의 보이지 ?�으???��? ?�위 커밋부???�시 ?�는 것이 좋다.')
    elif active_days <= 4:
        hints.append('?�동???�짜 ?��? ?��? ?�이???�정 ?�에 몰아 ?�업?�기보다 주간 루틴??만드??쪽이 좋다.')
    elif active_days <= 8:
        hints.append('?�동 밀?�는 ?��?�?루틴?�로 굳어졌다�?보긴 ?�려?�니 ?�동 ?�수�?조금 ???�리??�?좋다.')

    if push_events <= 3:
        hints.append('코드 ?�시 기록???�으�??�업 과정??????보이???��? 커밋?????�주 ?�기??것이 좋다.')

    if total_repos <= 2:
        hints.append('공개 ?�?�소 ?��? ?�어 ?�업 ?�펙?�럼??????보일 ???�으???��? ?�로?�트?�도 ?�나 ???�는 것이 좋다.')

    if not event_types.get('PullRequestEvent'):
        hints.append('?� 리퀘스??기록???�으�??�업 ?�적???�해 보일 ???�으???�기 ?�로?�트?�도 PR ?�명???�겨보는 �?좋다.')
    elif event_types.get('PullRequestEvent', 0) <= 2:
        hints.append('?� 리퀘스??기록???��? ?�이???�업 맥락�?변�??�유가 충분???�러?��? ?�을 ???�다.')

    issue_events = event_types.get('IssuesEvent', 0) + event_types.get('IssueCommentEvent', 0)
    if issue_events == 0:
        hints.append('?�슈???��? 기록???�어 문제�??�떻�??�리?�고 ?�결?�는지가 ???�러?��? ?�는??')

    if top_language and languages.get(top_language, 0) >= max(3, total_repos - 1):
        hints.append(f'{top_language} 비중???�아 ?�동 ??�� ?�쪽?�로 모여 보일 ???�다.')

    if not hints:
        hints.append('지금�? ?�동 ?�름??보이므�??�음 ?�계 ?�안?� ?�무 강한 보완 ?�구보다 기록 ?�질???�이??방향?�면 좋다.')

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
        hints.append('?�시 기록??많아 ?�업 ?�름???�어지�??�다.')
    elif push_events >= 8:
        hints.append('최근 ?�시 기록??꾸�????�이�??�다.')

    if active_days >= 10:
        hints.append('?�러 ?�짜??걸쳐 ?�동??분산???�어 루틴??만들?��?�??�다.')
    elif active_days >= 6:
        hints.append('?�정 ?�루??몰리지 ?�고 며칠??걸쳐 ?�동???�어지�??�다.')

    if event_types.get('PullRequestEvent', 0) >= 3:
        hints.append('?� 리퀘스??기록???�어 ?�업 ?�리?� ?�업 ?�적??보인??')

    if top_language:
        hints.append(f'주요 ?�어 ?�름?� {top_language} 중심?�로 보인??')

    if total_events >= 40:
        hints.append('최근 공개 ?�동???�체??충분???�에 ?�는 ?�이??')

    if not hints:
        hints.append('?�직 강점???�게 ?�정?�긴 ?�렵지�? 공개 ?�동 ?�이?�는 ?�이�??�작???�태??')

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
        hints.append('?� 리퀘스???�적???�으???�기 ?�로?�트?�도 PR ?�명�?변�??�유�??�겨보는 ?�습???�요?�다.')
    elif pull_request_events <= 2:
        hints.append('?� 리퀘스??기록???��? ?�이???�업 ?�위�??�눠 PR ?�명???�기???�습?????�보??것이 좋다.')

    if issue_events == 0:
        hints.append('?�음 ?�업?�서???�슈�?먼�? ?�고 ?�업 목표?� ?�료 기�???짧게 ?�겨보는 것이 좋다.')
    elif issue_events <= 2:
        hints.append('?�슈 기록???��? ?�이???�업 ?�후 메모�??�슈???��?�??�겨 맥락?????�렷?�게 만드??것이 좋다.')

    if activity_summary['active_days_30d'] <= 8:
        hints.append('?�동 ?�수가 ?�주 ?��? ?��? ?�니?? �?3???�도 짧�? 커밋 루틴??만드??방향??좋다.')

    if top_language and languages.get(top_language, 0) >= max(3, len(known_languages)):
        suggested_language = language_followups.get(top_language)
        if suggested_language and suggested_language not in known_languages:
            hints.append(
                f'지금�? {top_language} 중심 ?�름??강하???�음 ?�업?�서??{suggested_language}�??��? 기능 ?�나�???�� 보며 ??�� ?��?보는 것도 좋다.'
            )

    if not hints and top_language:
        hints.append(f'지금�? {top_language} 중심???�름???�렷?�니, ?�???�로?�트 ?�나??README???�업 기록?????�명?�게 ?�듬??것이 좋다.')

    if not hints:
        hints.append('?�음 ?�업?�서??README, 커밋 메시지, ?�업 기록 �??�나�????�렷?�게 ?�겨 ?�동??맥락??보이�??�는 것이 좋다.')

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
?�는 IT ?�비?�의 코드 분석 봇이??
?�래 ?�공??[분석 ?�이?? 문장?�을 바탕?�로, ?�연?�러???�국???�비???�내문구�?JSON ?�식?�로�??�성?�라.

[분석 ?�이??
- 강점: {strength_text}
- 보완?? {improvement_text}
- ?�안: {recommendation_text}

[문장 ?��???
- ?? {style_notes['tone']}
- headline: {style_notes['headline_rule']}
- strength: {style_notes['strength_rule']}

[?�성 규칙]
1. [분석 ?�이?????�는 ?�용??지?�내지 마라.
2. "초보 개발??, "?�동???�작?�셨군요", "仓库" 같�? ?�색???�현?� ?��? 금�??�다. ?�?�소, ?�포지?�리처럼 ?�연?�러???�현�??�라.
3. ?�자�?기계?�으�??�열?��? 말고, ?��?�??�?�서 ?�명?�라.
4. headline, strength, improvement, next_step?� ?�로 ?�른 ??���??�성?�라.
5. improvement??[보완?? �?문장??기�??�로 ?�성?�고, next_step?� [?�안] �?문장??기�??�로 ?�성?�라.
6. next_step?�서??push�????�라�?권하지 말고, [?�안]???�는 구체 ?�동�?추천?�라.
7. ?�래 ?�현??그�?�?반복?��? 말고, 같�? ?�이?�도 ?�로??문장?�로 ?�시 ?�라:
    - 최근 30??공개 ?�동???�직 많�? ?�아??
    - 최근 ?????�안 꾸�???코드�??�리�??�어??
    - 최근 30???�동??비교??꾸�????�이?�요.
8. JSON ?�외???�스?�는 ?��? 출력?��? 마라.

[?�답 JSON ?�식]
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
        raise HTTPException(status_code=400, detail='GitHub ?�이?��? 비어 ?�습?�다.')
    return normalized_username


def raise_for_profile_error(username: str, response: httpx.Response):
    if response.status_code == 404:
        raise HTTPException(status_code=404, detail='?�당 GitHub ?�용?��? 찾�? 못했?�니??')

    if response.status_code == 403:
        rate_limit_remaining = response.headers.get('x-ratelimit-remaining')
        print(
            'GitHub profile request blocked '
            f'for {username}: remaining={rate_limit_remaining}'
        )
        detail = 'GitHub ?�로???�보�?불러?��? 못했?�니??'
        if rate_limit_remaining == '0':
            detail = 'GitHub API ?�청 ?�도???�달?�습?�다. ?�시 ???�시 ?�도?�주?�요.'
        elif not GITHUB_TOKEN:
            detail = (
                'GitHub ?�큰???�정?��? ?�아 ?�청???�한?�고 ?�습?�다. '
                '?�버 ?�경변?��? ?�인?�주?�요.'
            )
        else:
            detail = (
                'GitHub ?�큰???�거??만료?�었?????�습?�다. '
                '?�버 ?�경변?��? ?�인?�주?�요.'
            )
        raise HTTPException(status_code=403, detail=detail)

    if response.status_code != 200:
        print(
            f'GitHub profile request failed for {username}: '
            f'status={response.status_code}'
        )
        raise HTTPException(
            status_code=response.status_code,
            detail='GitHub ?�로???�보�?불러?��? 못했?�니??',
        )


def raise_for_repos_error(username: str, response: httpx.Response):
    if response.status_code == 403:
        rate_limit_remaining = response.headers.get('x-ratelimit-remaining')
        print(
            'GitHub repos request blocked '
            f'for {username}: remaining={rate_limit_remaining}'
        )
        detail = '?�포지?�리 목록??불러?��? 못했?�니??'
        if rate_limit_remaining == '0':
            detail = 'GitHub API ?�청 ?�도???�달?�습?�다. ?�시 ???�시 ?�도?�주?�요.'
        else:
            detail = '?�포지?�리 목록 ?�청???�한?�었?�니?? GitHub ?�큰 ?�태�??�인?�주?�요.'
        raise HTTPException(status_code=403, detail=detail)

    if response.status_code != 200:
        print(
            f'GitHub repos request failed for {username}: '
            f'status={response.status_code}'
        )
        raise HTTPException(
            status_code=response.status_code,
            detail='?�포지?�리 목록??불러?��? 못했?�니?? GitHub ?�큰 ?�태�??�인?�주?�요.',
        )


def raise_for_events_error(username: str, response: httpx.Response):
    if response.status_code == 404:
        raise HTTPException(status_code=404, detail='?�당 GitHub ?�용?��? 찾�? 못했?�니??')

    if response.status_code == 403:
        rate_limit_remaining = response.headers.get('x-ratelimit-remaining')
        print(
            'GitHub events request blocked '
            f'for {username}: remaining={rate_limit_remaining}'
        )
        detail = 'GitHub ?�동 ?�벤?��? 불러?��? 못했?�니??'
        if rate_limit_remaining == '0':
            detail = 'GitHub API ?�청 ?�도???�달?�습?�다. ?�시 ???�시 ?�도?�주?�요.'
        elif not GITHUB_TOKEN:
            detail = (
                'GitHub ?�큰???�정?��? ?�아 ?�동 ?�벤???�청???�한?�고 ?�습?�다. '
                '?�버 ?�경변?��? ?�인?�주?�요.'
            )
        else:
            detail = (
                'GitHub ?�큰??만료?�었거나 ?�동 ?�벤???�청???�한?�었?�니?? '
                '?�버 ?�경변?��? ?�인?�주?�요.'
            )
        raise HTTPException(status_code=403, detail=detail)

    print(
        f'GitHub events request failed for {username}: '
        f'status={response.status_code}'
    )
    raise HTTPException(
        status_code=response.status_code,
        detail='GitHub ?�동 ?�벤?��? 불러?��? 못했?�니??',
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
                'GitHub API ?�결???�시?�으�?불안?�합?�다. '
                '�??�청 직후?�거???�트?�크가 ?�시 ?�들�????�으??10~20�????�시 ?�도?�주?�요.'
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
    # ?�거???�드?�인?�는 ?�환???��?�??�해 ?�겨?�고, ?�제 처리??최신 분석 경로�??�용?�니??
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

