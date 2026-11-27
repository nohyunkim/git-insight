import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCoverageNote, buildEventWindowLabel } from './eventWindow.js'

for (const days of [7, 30, 90, 180, 365]) {
  test(`new ${days} day result shows its observed event window`, () => {
    const actual = Math.min(days, 30)
    const summary = { window_days: days, event_window_days: actual }
    const label = buildEventWindowLabel(summary)
    const note = buildCoverageNote(summary)

    assert.equal(label, `최근 ${actual}일`)
    assert.match(note, new RegExp(`최근 ${actual}일`))
    if (days > 30) {
      assert.match(note, /선택 기간 전체의 수치가 아닙니다/)
    }
  })

  test(`legacy ${days} day result does not invent an observation window`, () => {
    const summary = { window_days: days, window_label: `최근 ${days}일` }
    assert.equal(buildEventWindowLabel(summary), '저장 당시 조회된')
    assert.match(buildCoverageNote(summary), /당시 실제 이벤트 관측 기간은 기록되지 않았으므로/)
  })
}

test('partial event pages are disclosed', () => {
  const note = buildCoverageNote({ window_days: 30, event_window_days: 30, event_page_incomplete: true })
  assert.match(note, /수치가 누락될 수 있습니다/)
})
