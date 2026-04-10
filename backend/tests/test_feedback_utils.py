import sys
import unittest
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from feedback_utils import normalize_feedback, sanitize_feedback, uses_consistent_polite_tone


class FeedbackToneTests(unittest.TestCase):
    def test_polite_tone_helper_accepts_consistent_honorifics(self):
        self.assertTrue(
            uses_consistent_polite_tone(
                '최근 활동 흐름이 안정적으로 보입니다. 다음 기록도 기대됩니다.',
            )
        )

    def test_polite_tone_helper_rejects_banmal(self):
        self.assertFalse(
            uses_consistent_polite_tone(
                '최근 활동 흐름이 안정적으로 보여. 다음 기록도 기대된다.',
            )
        )

    def test_sanitize_feedback_accepts_polite_payload(self):
        payload = {
            'headline': '최근 30일 활동 흐름이 또렷하게 이어지고 있습니다.',
            'strength': 'Push 기록과 활동 일수가 함께 보여 작업 리듬이 비교적 안정적으로 읽힙니다.',
            'improvement': 'PR 설명이 적어 변경 이유와 협업 맥락이 충분히 드러나지는 않습니다.',
            'next_step': '다음 기록에서는 작은 수정이라도 PR 설명을 함께 남겨보세요.',
        }

        cleaned, reason = sanitize_feedback(payload)

        self.assertEqual(reason, 'ok')
        self.assertEqual(cleaned, payload)

    def test_sanitize_feedback_rejects_non_polite_payload(self):
        payload = {
            'headline': '최근 30일 활동 흐름이 또렷하게 이어지고 있다.',
            'strength': 'Push 기록과 활동 일수가 함께 보여 작업 리듬이 비교적 안정적으로 읽힌다.',
            'improvement': 'PR 설명이 적어 변경 이유와 협업 맥락이 충분히 드러나지 않는다.',
            'next_step': '다음 기록에서는 작은 수정이라도 PR 설명을 함께 남겨보자.',
        }

        cleaned, reason = sanitize_feedback(payload)

        self.assertIsNone(cleaned)
        self.assertEqual(reason, 'non_polite_tone')

    def test_normalize_feedback_falls_back_for_non_polite_payload(self):
        fallback_feedback = {
            'headline': '기본 headline 입니다.',
            'strength': '기본 strength 문장입니다.',
            'improvement': '기본 improvement 문장입니다.',
            'next_step': '기본 next_step 문장입니다.',
        }
        payload = {
            'headline': '최근 활동 흐름이 이전보다 또렷하게 보인다.',
            'strength': 'Push 기록이 꾸준히 보여 작업 흔적과 개발 리듬이 분명하게 읽힌다.',
            'improvement': 'PR 설명이 부족해 변경 이유와 협업 맥락이 충분하게 드러나지 않는다.',
            'next_step': '다음에는 작은 변경이라도 설명을 함께 남겨 흐름을 더 명확하게 보여주자.',
        }

        normalized, reason = normalize_feedback(payload, fallback_feedback)

        self.assertEqual(normalized, fallback_feedback)
        self.assertEqual(reason, 'non_polite_tone')


if __name__ == '__main__':
    unittest.main()
