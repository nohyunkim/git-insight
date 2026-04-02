import { useEffect, useRef, useState } from 'react'
import { ActivityChart, LanguageChart } from './InsightCharts'

function toChartData(entries, limit = 5) {
  return entries
    .sort(([, leftValue], [, rightValue]) => rightValue - leftValue)
    .slice(0, limit)
    .map(([name, value]) => ({ name, value }))
}

function buildExportFileName(username, summary, extension) {
  const dayLabel = summary?.window_days ?? 30
  return `git-insight-${username}-${dayLabel}d.${extension}`
}

async function exportCardAsPng(node, username, summary) {
  const { toPng } = await import('html-to-image')
  const dataUrl = await toPng(node, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: '#1e243a',
  })

  const link = document.createElement('a')
  link.href = dataUrl
  link.download = buildExportFileName(username, summary, 'png')
  link.click()
}

async function exportCardAsPdf(node, username, summary) {
  const [{ toPng }, { jsPDF }] = await Promise.all([
    import('html-to-image'),
    import('jspdf'),
  ])
  const dataUrl = await toPng(node, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: '#1e243a',
  })

  const image = new Image()
  image.src = dataUrl

  await new Promise((resolve, reject) => {
    image.onload = resolve
    image.onerror = reject
  })

  const pdf = new jsPDF({
    orientation: image.width > image.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [image.width + 32, image.height + 32],
  })

  pdf.addImage(dataUrl, 'PNG', 16, 16, image.width, image.height)
  pdf.save(buildExportFileName(username, summary, 'pdf'))
}

function buildWindowLabel(summary) {
  if (summary?.window_label) {
    return summary.window_label
  }

  const days = summary?.window_days ?? 30
  if (days === 7) return '최근 7일'
  if (days === 30) return '최근 30일'
  if (days === 90) return '최근 90일'
  if (days === 180) return '최근 6개월'
  if (days === 365) return '최근 1년'
  return `최근 ${days}일`
}

function ProfileCard({ userData, feedbackLoading = false }) {
  const { profile, stats, username, feedback, feedback_source: feedbackSource } = userData
  const [actionMessage, setActionMessage] = useState('')
  const [exportingAction, setExportingAction] = useState('')
  const exportTargetRef = useRef(null)

  const languageChartData = toChartData(Object.entries(stats.languages ?? {}))
  const eventChartData = toChartData(Object.entries(stats.event_types ?? {}))
  const repositoryCount = profile.total_repos ?? profile.public_repos ?? 0
  const summary = stats.activity_summary ?? {
    window_days: 30,
    total_events_30d: 0,
    push_events_30d: 0,
    active_days_30d: 0,
  }
  const summaryLabel = buildWindowLabel(summary)
  const strengthText =
    feedback?.strength ?? '활동 흐름을 바탕으로 강점을 정리하고 있습니다.'
  const improvementText =
    feedback?.improvement ?? '보완 포인트를 읽기 쉽게 정리하고 있습니다.'
  const nextStepText =
    feedback?.next_step ?? '다음에 바로 적용할 수 있는 제안을 준비하고 있습니다.'
  const feedbackBadge = feedbackLoading
    ? 'AI 요약 보강 중'
    : feedbackSource === 'ai'
      ? 'AI 요약 반영'
      : '기본 요약'

  useEffect(() => {
    if (!actionMessage) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setActionMessage('')
    }, 2200)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [actionMessage])

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setActionMessage('링크를 복사했어요.')
    } catch {
      setActionMessage('링크 복사에 실패했어요. 다시 시도해주세요.')
    }
  }

  async function handleSaveImage() {
    if (!exportTargetRef.current) {
      return
    }

    setExportingAction('image')
    setActionMessage('')

    try {
      await exportCardAsPng(exportTargetRef.current, username, summary)
      setActionMessage('이미지를 저장했어요.')
    } catch {
      setActionMessage('이미지 저장에 실패했어요. 다시 시도해주세요.')
    } finally {
      setExportingAction('')
    }
  }

  async function handleSavePdf() {
    if (!exportTargetRef.current) {
      return
    }

    setExportingAction('pdf')
    setActionMessage('')

    try {
      await exportCardAsPdf(exportTargetRef.current, username, summary)
      setActionMessage('PDF를 저장했어요.')
    } catch {
      setActionMessage('PDF 저장에 실패했어요. 다시 시도해주세요.')
    } finally {
      setExportingAction('')
    }
  }

  return (
    <div className="profile-card-wrap">
      <article ref={exportTargetRef} className="profile-card">
        <div className="profile-top">
          <div className="profile-header">
            <img
              className="avatar"
              src={profile.avatar_url}
              alt={`${profile.name || username} avatar`}
              width="108"
              height="108"
            />

            <div>
              <p className="profile-kicker">@{username}</p>
              <h2>{profile.name || username}</h2>
              <p className="profile-summary">
                공개 레포 {repositoryCount}개와 {summaryLabel} 공개 Push 이벤트{' '}
                {stats.recent_push_events}개를 확인했습니다.
              </p>
            </div>
          </div>

          <div className="profile-sidecard">
            <span className="sidecard-label">현재 활동 온도</span>
            <strong>{summary.total_events_30d > 0 ? '활동 중' : '준비 중'}</strong>
            <p>{summaryLabel} 공개 이벤트와 언어 분포를 기준으로 요약했습니다.</p>
          </div>
        </div>

        <section className="insight-card">
          <div className="insight-heading">
            <p className="insight-label">핵심 인사이트</p>
            <span className="insight-status">{feedbackBadge}</span>
          </div>
          <h3>{feedback?.headline ?? '활동 데이터를 바탕으로 요약을 준비하고 있습니다.'}</h3>
          <p>{strengthText}</p>
          <p>{improvementText}</p>
          <p>{nextStepText}</p>
        </section>

        <div className="metric-grid">
          <div className="metric-card">
            <span className="metric-label">{summaryLabel} Push 이벤트</span>
            <strong>{stats.recent_push_events}</strong>
          </div>

          <div className="metric-card">
            <span className="metric-label">전체 공개 레포</span>
            <strong>{repositoryCount}</strong>
          </div>

          <div className="metric-card accent-card">
            <span className="metric-label">{summaryLabel} 이벤트</span>
            <strong>{summary.total_events_30d}</strong>
          </div>

          <div className="metric-card accent-card">
            <span className="metric-label">{summaryLabel} Push</span>
            <strong>{summary.push_events_30d}</strong>
          </div>

          <div className="metric-card accent-card">
            <span className="metric-label">{summaryLabel} 활동 일수</span>
            <strong>{summary.active_days_30d}</strong>
          </div>
        </div>

        <div className="detail-grid">
          <section className="detail-card">
            <div className="section-heading">
              <h3>언어 분포</h3>
              <p>레포지토리 기준 상위 언어</p>
            </div>
            <LanguageChart languages={languageChartData} />
          </section>

          <section className="detail-card detail-card-activity">
            <div className="section-heading">
              <h3>{summaryLabel} 이벤트</h3>
              <p>공개 활동 상위 이벤트 유형</p>
            </div>
            <ActivityChart events={eventChartData} />
          </section>
        </div>
      </article>

      <div className="result-actions">
        <div className="result-actions-copy">
          <p className="result-actions-label">공유하기</p>
          <p className="result-actions-hint">
            현재 선택한 아이디와 기간 기준 결과를 저장할 수 있어요.
          </p>
        </div>

        <div className="result-action-buttons">
          <button type="button" onClick={handleCopyLink}>
            링크 복사
          </button>
          <button
            type="button"
            onClick={handleSaveImage}
            disabled={exportingAction === 'image' || exportingAction === 'pdf'}
          >
            {exportingAction === 'image' ? '이미지 저장 중' : '이미지 저장'}
          </button>
          <button
            type="button"
            onClick={handleSavePdf}
            disabled={exportingAction === 'image' || exportingAction === 'pdf'}
          >
            {exportingAction === 'pdf' ? 'PDF 저장 중' : 'PDF 저장'}
          </button>
        </div>
      </div>

      {actionMessage ? <p className="result-action-message">{actionMessage}</p> : null}
    </div>
  )
}

export { ProfileCard }
