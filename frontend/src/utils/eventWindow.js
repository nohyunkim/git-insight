export function buildRequestedWindowLabel(summary) {
  const days = summary?.window_days ?? 30
  if (days === 7) return '최근 7일'
  if (days === 30) return '최근 30일'
  if (days === 90) return '최근 90일'
  if (days === 180) return '최근 6개월'
  if (days === 365) return '최근 1년'
  return `최근 ${days}일`
}

export function buildEventWindowLabel(summary) {
  if (!Number.isInteger(summary?.event_window_days)) {
    return '저장 당시 조회된'
  }

  return summary.window_label || buildRequestedWindowLabel({ window_days: summary.event_window_days })
}

export function buildCoverageNote(summary) {
  if (!Number.isInteger(summary?.event_window_days)) {
    return `${buildRequestedWindowLabel(summary)}을 선택한 과거 저장 기록입니다. 당시 실제 이벤트 관측 기간은 기록되지 않았으므로 이벤트·Push·활동 일수가 선택 기간 전체의 수치라고 단정할 수 없습니다. 기존 AI 문구도 기록 당시 기준입니다. 언어 분포는 저장 당시 공개 저장소 기준입니다.`
  }

  const pageNote = summary.event_page_incomplete
    ? ' 이벤트 페이지 일부를 조회하지 못했거나 300건 한도에 도달해 수치가 누락될 수 있습니다.'
    : ''

  if (summary.window_days > summary.event_window_days) {
    return `${buildRequestedWindowLabel(summary)}을 선택했지만 이벤트·Push·활동 일수는 ${buildEventWindowLabel(summary)} 공개 이벤트 조회분이며 선택 기간 전체의 수치가 아닙니다. 언어 분포는 분석 당시 공개 저장소 기준입니다.${pageNote}`
  }

  return `이벤트·Push·활동 일수는 ${buildEventWindowLabel(summary)} 공개 이벤트 조회분입니다. 언어 분포는 분석 당시 공개 저장소 기준입니다.${pageNote}`
}
