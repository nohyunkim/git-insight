import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from main import (
    build_comparison_feedback,
    build_comparison_prompt,
    build_comparison_summary,
    compare_feedback,
    fetch_user_events,
    fetch_analysis_payload,
    generate_comparison_feedback_with_groq,
    summarize_analysis,
    app,
)


def event(event_id, days_ago):
    created_at = datetime.now(timezone.utc) - timedelta(days=days_ago)
    return {
        'id': event_id,
        'type': 'PushEvent',
        'created_at': created_at.strftime('%Y-%m-%dT%H:%M:%SZ'),
    }


def snapshot(days, *, recorded):
    activity = {
        'window_days': days,
        'window_label': f'최근 {days}일',
        'total_events_30d': 2,
        'push_events_30d': 1,
        'active_days_30d': 1,
        'event_data_incomplete': False,
    }
    if recorded:
        activity['event_window_days'] = min(days, 30)
        activity['window_label'] = f'최근 {min(days, 30)}일'
    return {
        'username': 'octocat',
        'generated_at': '2026-04-10T00:00:00Z',
        'profile': {'public_repos': 3, 'total_repos': 3},
        'stats': {
            'activity_summary': activity,
            'recent_push_events': 1,
            'event_types': {'PushEvent': 1},
            'languages': {'Python': 2},
        },
    }


class EventWindowTests(unittest.TestCase):
    def test_all_selected_windows_keep_old_fields_and_report_actual_coverage(self):
        for days in (7, 30, 90, 180, 365):
            with self.subTest(days=days):
                payload = summarize_analysis(
                    'octocat', {'public_repos': 3},
                    [event('recent', 2), event('old', 45)],
                    [{'language': 'Python'}], days,
                )
                summary = payload['stats']['activity_summary']
                self.assertEqual(summary['window_days'], days)
                self.assertEqual(summary['event_window_days'], min(days, 30))
                self.assertEqual(summary['total_events_30d'], 1)
                self.assertEqual(summary['push_events_30d'], 1)
                self.assertEqual(summary['active_days_30d'], 1)
                self.assertEqual(payload['profile']['total_repos'], 1)
                self.assertEqual(payload['stats']['languages'], {'Python': 1})
                self.assertEqual(summary['event_data_incomplete'], days > 30)

    def test_seven_day_selection_excludes_older_events(self):
        payload = summarize_analysis('octocat', {}, [event('recent', 2), event('older', 10)], [], 7)
        self.assertEqual(payload['stats']['activity_summary']['total_events_30d'], 1)

    def test_duplicate_ids_and_future_events_are_excluded(self):
        payload = summarize_analysis(
            'octocat', {}, [event('same', 1), event('same', 1), event('future', -1)], [], 30,
        )
        self.assertEqual(payload['stats']['activity_summary']['total_events_30d'], 1)
        self.assertEqual(payload['stats']['recent_push_events'], 1)

    def test_legacy_snapshots_of_every_window_remain_comparable(self):
        for days in (7, 30, 90, 180, 365):
            with self.subTest(days=days):
                summary = build_comparison_summary(snapshot(days, recorded=False), snapshot(days, recorded=False))
                self.assertEqual(summary['window_days'], days)
                self.assertIn('관측 기간이 기록되지 않았습니다', summary['reliability_note'])
                self.assertEqual(summary['delta']['total_events'], 0)
                self.assertFalse(summary['event_windows_comparable'])
                self.assertIn('같은 기간의 변화로 해석할 수 없습니다', build_comparison_feedback(summary)['needs_attention'])

    def test_legacy_and_new_snapshots_do_not_claim_equal_coverage(self):
        for days in (7, 30, 90, 180, 365):
            with self.subTest(days=days):
                summary = build_comparison_summary(snapshot(days, recorded=True), snapshot(days, recorded=False))
                self.assertIn('동일한 기간', summary['reliability_note'])
                prompt = build_comparison_prompt(summary)
                self.assertIn(summary['reliability_note'], prompt)
                feedback, source = generate_comparison_feedback_with_groq(summary)
                self.assertEqual(source, 'unrecorded_event_window')
                self.assertIn('관측 기간이 없어', feedback['needs_attention'])

    def test_new_long_window_snapshots_explain_thirty_day_comparison(self):
        summary = build_comparison_summary(snapshot(90, recorded=True), snapshot(90, recorded=True))
        self.assertEqual(summary['window_label'], '최근 30일')
        self.assertIn('최근 30일 조회분', summary['reliability_note'])
        self.assertTrue(summary['event_windows_comparable'])


class EventPaginationTests(unittest.IsolatedAsyncioTestCase):
    async def test_analysis_path_remains_successful_with_synthetic_github_responses(self):
        class FakeClient:
            async def get(self, url, headers):
                if '/repos?' in url:
                    return httpx.Response(200, json=[{'language': 'Python'}])
                if '/events?' in url:
                    return httpx.Response(200, json=[event('one', 1)])
                return httpx.Response(200, json={'name': 'Synthetic', 'public_repos': 1})

        previous_client = getattr(app.state, 'github_client', None)
        app.state.github_client = FakeClient()
        try:
            payload = await fetch_analysis_payload('synthetic-event-window-user', 90)
        finally:
            app.state.github_client = previous_client

        self.assertEqual(payload['status'], 'success')
        self.assertEqual(payload['stats']['activity_summary']['event_window_days'], 30)
        self.assertEqual(payload['stats']['recent_push_events'], 1)

    async def test_compare_api_accepts_legacy_and_new_snapshots_without_ai_call(self):
        response = await compare_feedback({
            'current_snapshot': snapshot(90, recorded=True),
            'previous_snapshot': snapshot(90, recorded=False),
        })
        self.assertEqual(response['comparison_source'], 'rule-based')
        self.assertEqual(response['comparison_meta']['source_detail'], 'unrecorded_event_window')
        self.assertIn('관측 기간이 기록되지 않았습니다', response['comparison_summary']['reliability_note'])

    async def test_later_page_failure_marks_partial_result(self):
        class FakeClient:
            calls = 0

            async def get(self, _url, headers):
                self.calls += 1
                return httpx.Response(200, json=[event('one', 1)]) if self.calls == 1 else httpx.Response(502)

        response, events, incomplete = await fetch_user_events(FakeClient(), 'octocat', {}, 30)
        self.assertIsNone(response)
        self.assertEqual(len(events), 1)
        self.assertTrue(incomplete)


if __name__ == '__main__':
    unittest.main()
