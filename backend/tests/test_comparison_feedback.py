import sys
import unittest
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from feedback_utils import uses_consistent_polite_tone
from main import build_comparison_feedback, normalize_comparison_feedback


def make_summary():
    return {
        'username': 'octocat',
        'window_days': 30,
        'window_label': '최근 30일',
        'current_generated_at': '2026-04-10T00:00:00Z',
        'previous_generated_at': '2026-04-09T00:00:00Z',
        'reliability_note': '',
        'gained_languages': [],
        'lost_languages': [],
        'current': {
            'total_events': 24,
            'push_events': 10,
            'active_days': 8,
            'pull_request_events': 2,
            'issue_events': 1,
            'total_repos': 5,
            'top_language': 'Python',
            'language_count': 3,
        },
        'previous': {
            'total_events': 20,
            'push_events': 7,
            'active_days': 6,
            'pull_request_events': 1,
            'issue_events': 0,
            'total_repos': 4,
            'top_language': 'Python',
            'language_count': 2,
        },
        'delta': {
            'total_events': 4,
            'push_events': 3,
            'active_days': 2,
            'pull_request_events': 1,
            'issue_events': 1,
            'total_repos': 1,
            'language_count': 1,
        },
    }


class ComparisonFeedbackTests(unittest.TestCase):
    def test_build_comparison_feedback_uses_polite_tone(self):
        feedback = build_comparison_feedback(make_summary())

        self.assertTrue(all(uses_consistent_polite_tone(value) for value in feedback.values()))

    def test_normalize_comparison_feedback_accepts_polite_payload(self):
        payload = {
            'headline': '최근 30일 기준 직전 기록보다 활동 리듬이 더 안정적으로 보입니다.',
            'growth': 'Push 기록과 활동 일수가 함께 늘어 작업 흐름이 더 또렷하게 읽힙니다.',
            'needs_attention': 'PR 설명은 아직 적어 변경 이유와 협업 맥락은 더 보강할 여지가 있습니다.',
            'next_step': '다음 기록에서는 PR 설명을 함께 남겨 변화 이유를 더 선명하게 보여주세요.',
        }
        fallback_feedback = build_comparison_feedback(make_summary())

        normalized, reason = normalize_comparison_feedback(payload, fallback_feedback)

        self.assertEqual(reason, 'ai')
        self.assertEqual(normalized, payload)

    def test_normalize_comparison_feedback_falls_back_for_non_polite_payload(self):
        payload = {
            'headline': '최근 30일 기준 직전 기록보다 활동 리듬이 더 안정적으로 보인다.',
            'growth': 'Push 기록과 활동 일수가 함께 늘어 작업 흐름이 더 또렷하게 읽힌다.',
            'needs_attention': 'PR 설명은 아직 적어 변경 이유와 협업 맥락은 더 보강할 여지가 있다.',
            'next_step': '다음 기록에서는 PR 설명을 함께 남겨 변화 이유를 더 선명하게 보여주자.',
        }
        fallback_feedback = build_comparison_feedback(make_summary())

        normalized, reason = normalize_comparison_feedback(payload, fallback_feedback)

        self.assertEqual(reason, 'non_polite_tone')
        self.assertEqual(normalized, fallback_feedback)


if __name__ == '__main__':
    unittest.main()
