import hashlib
import re


def window_label(days: int):
    labels = {
        7: '최근 7일',
        30: '최근 30일',
        90: '최근 90일',
        180: '최근 6개월',
        365: '최근 1년',
    }
    return labels.get(days, f'최근 {days}일')


def format_ranked_counts(values: dict, *, suffix: str, limit: int = 4):
    if not values:
        return '없음'

    ranked = sorted(values.items(), key=lambda item: (-item[1], item[0]))[:limit]
    return ', '.join(f'{name} {count}{suffix}' for name, count in ranked)


def build_feedback(
    summary: dict,
    top_language: str | None,
    event_types: dict | None = None,
    total_repos: int = 0,
):
    event_types = event_types or {}
    label = summary.get('window_label', window_label(summary.get('window_days', 30)))
    push_events = summary['push_events_30d']
    total_events = summary['total_events_30d']
    active_days = summary['active_days_30d']
    pr_events = event_types.get('PullRequestEvent', 0)
    issue_events = event_types.get('IssuesEvent', 0) + event_types.get('IssueCommentEvent', 0)

    if total_events == 0:
        headline = f'{label} 공개 활동이 거의 보이지 않습니다.'
        strength = '지금은 저장소 구조와 기본 프로젝트 흐름을 다지는 단계로 보입니다.'
        improvement = '공개 이벤트가 없어 어떤 리듬으로 작업하는지와 어떤 주제에 몰입하고 있는지까지는 아직 읽히지 않습니다.'
        next_step = '작은 수정이라도 커밋과 README 갱신을 함께 남겨 첫 활동 흐름을 만들어보세요.'
    elif push_events >= 20:
        headline = f'{label} 코드 반영량이 높아 작업 흔적이 분명합니다.'
        strength = f'Push {push_events}회로 손을 자주 움직인 흔적이 뚜렷하고, 공개 이벤트도 {total_events}회로 충분히 쌓였습니다.'
        if active_days <= 9:
            improvement = f'다만 활동 일수는 {active_days}일이라 꾸준한 루틴보다는 특정 시점에 몰아친 스퍼트형 패턴으로 읽힙니다.'
            next_step = '다음 작업에서는 하루에 몰아 올리기보다 2~3일로 나눠 커밋과 PR 설명을 남겨보세요.'
        elif pr_events <= 2:
            improvement = f'작업량에 비해 PR 기록이 {pr_events}회로 적어서 왜 바뀌었는지와 어떤 맥락에서 발전했는지가 덜 드러납니다.'
            next_step = '다음 작업에서는 PR 설명이나 README 업데이트를 함께 남겨 변경 이유를 보강해보세요.'
        else:
            improvement = '활동량은 충분하지만 대표 프로젝트 설명과 결과 정리가 더해지면 강점이 훨씬 선명해집니다.'
            next_step = '핵심 프로젝트 하나를 골라 README, PR, 회고 메모를 한 묶음으로 정리해보세요.'
    elif active_days >= 10:
        headline = f'{label} 활동이 여러 날짜에 고르게 퍼져 있습니다.'
        strength = f'활동 일수 {active_days}일로 리듬이 비교적 안정적이고, 공개 이벤트 {total_events}회가 일정하게 분산돼 있습니다.'
        if pr_events <= 2:
            improvement = f'다만 PR 기록이 {pr_events}회에 그쳐 무엇을 배우고 어떻게 개선했는지까지는 충분히 드러나지 않습니다.'
            next_step = '다음 작업에서는 PR 설명이나 작업 기록을 함께 남겨 변경 이유까지 드러내보세요.'
        else:
            improvement = '여러 활동은 보이지만 대표 프로젝트 하나가 강하게 남는 구조는 아직 약한 편입니다.'
            next_step = '가장 공들인 프로젝트 하나를 골라 README, 커밋, PR 흐름을 한 화면에서 읽히게 정리해보세요.'
    else:
        headline = f'{label} 활동 기록이 조금씩 쌓이는 단계입니다.'
        strength = f'공개 이벤트 {total_events}회, Push {push_events}회 수준으로 이제 패턴을 만들 수 있는 구간에 들어와 있습니다.'
        if total_repos <= 2:
            improvement = f'공개 저장소가 {total_repos}개라 어떤 주제에 강점을 두는지 한눈에 읽히기에는 아직 정보가 적습니다.'
            next_step = '다음 작업에서는 마무리한 프로젝트 하나를 공개 저장소로 정리하고 설명까지 붙여보세요.'
        else:
            improvement = f'활동 일수 {active_days}일, PR {pr_events}회 수준이라 꾸준히 이어가는 인상까지는 아직 약합니다.'
            next_step = '짧은 작업이라도 하루 단위로 커밋을 남기고, 가끔은 PR이나 이슈로 맥락도 같이 남겨보세요.'

    if top_language:
        strength = f'{strength} 현재 저장소 기준 대표 언어는 {top_language}입니다.'
    if issue_events == 0 and total_events > 0 and '이슈' not in improvement:
        improvement = f'{improvement} 이슈 기록이 없어 문제 정의와 해결 과정은 상대적으로 덜 보입니다.'

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
    banned_phrases = (
        'GitHub 활동을 시작하셨군요',
        '활동을 시작하셨군요',
        '초보 개발자',
        'GitHub 활동을 시작하는 데 도움이 되는 몇 가지 팁',
        '다음에 해보면 좋은 행동은',
        'JavaScript, HTML, Python을 연습',
        'JavaScript, HTML, Python을 더 공부해 보시는 것을 추천합니다',
        '仓库',
        '倉庫',
        'GitHub 활동이 부족합니다',
        'GitHub 활동이 활발합니다',
        '발생시키는 활동',
    )

    if re.search(r'[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]', combined_text):
        return None, 'contains_cjk'

    if any(phrase in value for value in cleaned_feedback.values() for phrase in banned_phrases):
        return None, 'contains_banned_phrase'

    if cleaned_feedback['headline'].endswith('!'):
        return None, 'headline_exclamation'

    if re.search(r'[A-Za-z]+Event', combined_text):
        return None, 'contains_event_name'

    if re.search(r'JavaScript,\s*HTML,\s*Python', combined_text):
        return None, 'contains_literal_language_triplet'

    if len(re.findall(r'\d+', cleaned_feedback['headline'])) >= 3:
        return None, 'too_many_numbers_in_headline'

    if len(re.findall(r'\d+', cleaned_feedback['strength'])) >= 4:
        return None, 'too_many_numbers_in_strength'

    if (
        len(cleaned_feedback['headline']) < 12
        or len(cleaned_feedback['strength']) < 20
        or len(cleaned_feedback['improvement']) < 18
        or len(cleaned_feedback['next_step']) < 18
    ):
        return None, 'too_short'

    return cleaned_feedback, 'ok'


def normalize_feedback(payload: dict, fallback_feedback: dict):
    normalized_feedback, reason = sanitize_feedback(payload)
    if normalized_feedback:
        return normalized_feedback, 'ai'

    return {
        'headline': fallback_feedback['headline'],
        'strength': fallback_feedback['strength'],
        'improvement': fallback_feedback['improvement'],
        'next_step': fallback_feedback['next_step'],
    }, reason


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
        hints.append('공개 활동이 거의 보이지 않아 먼저 작은 단위의 커밋 흐름을 만드는 편이 좋다.')
    elif active_days <= 4:
        hints.append('활동 날짜 수가 적어 특정 시점에 몰려 보이므로 주간 루틴을 만드는 편이 좋다.')
    elif active_days <= 8:
        hints.append('활동 빈도가 나쁘진 않지만 꾸준한 루틴으로 읽히기엔 조금 더 분산될 필요가 있다.')

    if push_events <= 3:
        hints.append('코드 반영 기록이 적어 작업 과정이 잘 드러나지 않으니 커밋 빈도를 높이는 편이 좋다.')

    if total_repos <= 2:
        hints.append('공개 저장소 수가 적어 작업 스펙트럼이 좁게 보일 수 있으니 프로젝트 수를 늘리는 편이 좋다.')

    if not event_types.get('PullRequestEvent'):
        hints.append('PR 기록이 없어 협업 흔적이 약해 보일 수 있으니 작은 프로젝트에도 설명을 남겨보는 편이 좋다.')
    elif event_types.get('PullRequestEvent', 0) <= 2:
        hints.append('PR 기록이 적어 작업 맥락과 변경 이유가 충분히 드러나지 않을 수 있다.')

    issue_events = event_types.get('IssuesEvent', 0) + event_types.get('IssueCommentEvent', 0)
    if issue_events == 0:
        hints.append('이슈 기록이 없어 문제를 어떻게 정의하고 해결했는지가 잘 보이지 않는다.')

    if top_language and languages.get(top_language, 0) >= max(3, total_repos - 1):
        hints.append(f'{top_language} 비중이 높아 활동이 한쪽으로 몰려 보일 수 있다.')

    if not hints:
        hints.append('활동 흐름은 이미 보이므로 큰 보완보다 기록 품질을 높이는 방향이 적절하다.')

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
        hints.append('Push 기록이 많아 작업 흐름이 꾸준하게 이어진다.')
    elif push_events >= 8:
        hints.append('최근 Push 기록이 비교적 꾸준하다.')

    if active_days >= 10:
        hints.append('여러 날짜에 걸쳐 활동이 분산돼 있어 루틴이 보인다.')
    elif active_days >= 6:
        hints.append('특정 하루에 몰리지 않고 며칠에 걸쳐 활동이 이어진다.')

    if event_types.get('PullRequestEvent', 0) >= 3:
        hints.append('PR 기록이 있어 협업 정리와 작업 흔적이 함께 보인다.')

    if top_language:
        hints.append(f'주요 언어 흐름이 {top_language} 중심으로 보인다.')

    if total_events >= 40:
        hints.append('최근 공개 활동량 자체가 충분한 편이다.')

    if not hints:
        hints.append('아직 강점을 크게 단정하긴 어렵지만 공개 활동 자체는 시작된 상태다.')

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
        hints.append('작은 프로젝트에도 PR 설명과 변경 이유를 남기는 습관을 들이는 편이 좋다.')
    elif pull_request_events <= 2:
        hints.append('작업 단위를 조금 더 쪼개고 PR 설명을 붙여 맥락을 남기는 편이 좋다.')

    if issue_events == 0:
        hints.append('다음 작업에서는 이슈를 먼저 만들고 목표와 완료 기준을 짧게 남겨보면 좋다.')
    elif issue_events <= 2:
        hints.append('이슈 기록이 적으니 작업 전후 메모를 함께 남겨 맥락을 선명하게 만드는 편이 좋다.')

    if activity_summary['active_days_30d'] <= 8:
        hints.append('활동 일수가 적은 편이니 주 3회 정도의 짧은 커밋 루틴을 만드는 방향이 좋다.')

    if top_language and languages.get(top_language, 0) >= max(3, len(known_languages)):
        suggested_language = language_followups.get(top_language)
        if suggested_language and suggested_language not in known_languages:
            hints.append(
                f'지금은 {top_language} 중심 흐름이 강하니 다음 작업에서 {suggested_language} 기반의 작은 기능을 곁들여보는 것도 좋다.'
            )

    if not hints and top_language:
        hints.append(f'지금은 {top_language} 중심 흐름이 분명하니 대표 프로젝트 하나의 README와 작업 기록을 더 선명하게 다듬는 편이 좋다.')

    if not hints:
        hints.append('다음 작업에서는 README, 커밋 메시지, 작업 기록 중 하나를 더 선명하게 남겨 활동 맥락을 보이게 하는 편이 좋다.')

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
    strength_text = ' / '.join(strength_hints) if strength_hints else '강점 정보 없음'
    improvement_text = ' / '.join(improvement_hints) if improvement_hints else '보완 정보 없음'
    recommendation_text = ' / '.join(recommendation_hints) if recommendation_hints else '제안 정보 없음'
    style_notes = build_style_notes(username, activity_summary, event_types)
    summary_label = activity_summary.get('window_label', window_label(activity_summary.get('window_days', 30)))
    language_summary = format_ranked_counts(languages, suffix='개', limit=5)
    event_summary = format_ranked_counts(event_types, suffix='회', limit=6)
    top_language_label = top_language or '없음'
    push_events = activity_summary.get('push_events_30d', 0)
    total_events = activity_summary.get('total_events_30d', 0)
    active_days = activity_summary.get('active_days_30d', 0)
    pull_request_events = event_types.get('PullRequestEvent', 0)
    issue_events = event_types.get('IssuesEvent', 0) + event_types.get('IssueCommentEvent', 0)
    coverage_note = (
        'GitHub Events API 한계로 장기 기간에서는 오래된 이벤트 일부가 누락될 수 있음.'
        if activity_summary.get('event_data_incomplete')
        else '이벤트 데이터는 현재 조회 범위 안에서 충분함.'
    )

    return f"""
당신은 한국어로 응답하는 GitHub 활동 분석 보조 작성자다.
아래 정보를 바탕으로 사용자 화면에 바로 노출할 짧은 한국어 문구를 JSON 형식으로 작성하라.

[사용자 정보]
- username: {username}
- 분석 기간: {summary_label}
- 공개 저장소 수: {total_repos}
- 공개 이벤트 수: {total_events}
- Push 수: {push_events}
- 활동 일수: {active_days}
- PR 관련 이벤트 수: {pull_request_events}
- 이슈 관련 이벤트 수: {issue_events}
- 대표 언어: {top_language_label}
- 언어 분포: {language_summary}
- 이벤트 분포: {event_summary}
- 데이터 범위 메모: {coverage_note}

[분석 힌트]
- 강점: {strength_text}
- 보완: {improvement_text}
- 제안: {recommendation_text}

[문장 스타일]
- 톤: {style_notes['tone']}
- headline: {style_notes['headline_rule']}
- strength: {style_notes['strength_rule']}

[작성 규칙]
1. 자연스러운 한국어만 사용한다.
2. 초보 개발자, 활동을 시작하셨군요, 仓库 같은 어색한 표현은 금지한다.
3. 숫자를 기계적으로 나열하지 말고 흐름과 맥락을 먼저 설명한다.
4. headline, strength, improvement, next_step는 서로 다른 문장으로 작성한다.
5. strength 또는 improvement 중 최소 하나에는 실제 근거를 1개 이상 자연스럽게 녹여라. 예: Push 18회, 활동 일수 11일, PR 기록이 적다.
6. improvement는 보완 포인트, next_step는 바로 실행할 제안에 집중한다.
7. next_step에서 막연히 push를 늘리라고만 말하지 말고 구체 행동을 제안한다.
8. 아래처럼 너무 안전하고 비슷한 문장은 피한다: "흐름이 보입니다", "조금 더 보완하면 좋습니다", "기록을 남겨보세요"만 반복하는 식의 문장.
9. 서비스 문구처럼 짧고 또렷하게 쓰되, 계정별 차이가 느껴지게 작성한다.
10. JSON 외 텍스트는 출력하지 않는다.

[응답 JSON 형식]
{{
    "headline": "문장",
    "strength": "문장",
    "improvement": "문장",
    "next_step": "문장"
}}
""".strip()
