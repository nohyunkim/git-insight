import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityChart, LanguageChart } from './InsightCharts'

const DEFAULT_KAKAO_JAVASCRIPT_KEY = '376d342e159bd263e1645efea4abf0a1'

const KAKAO_JAVASCRIPT_KEY = (
  import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY ??
  import.meta.env.VITE_KAKAO_APP_KEY ??
  import.meta.env.VITE_KAKAO_KEY ??
  DEFAULT_KAKAO_JAVASCRIPT_KEY
).trim()

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M15 8a3 3 0 1 0-2.82-4H12a3 3 0 0 0 .18 1.01L8.91 6.63a3 3 0 0 0-1.91-.68 3 3 0 1 0 1.91 5.32l3.27 1.62a3 3 0 0 0-.18 1.03 3 3 0 1 0 .18-1.02l-3.27-1.63a3.03 3.03 0 0 0 0-2.54l3.27-1.62A3 3 0 0 0 15 8Z"
        fill="currentColor"
      />
    </svg>
  )
}

function ExportIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3a1 1 0 0 1 1 1v8.59l2.3-2.29a1 1 0 1 1 1.4 1.42l-4 3.95a1 1 0 0 1-1.4 0l-4-3.95a1 1 0 1 1 1.4-1.42L11 12.59V4a1 1 0 0 1 1-1Zm-7 14a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z"
        fill="currentColor"
      />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M10.59 13.41a1 1 0 0 1 0-1.41l3.42-3.42a3 3 0 0 1 4.24 4.24l-1.83 1.83a3 3 0 0 1-4.24 0 1 1 0 1 1 1.41-1.41 1 1 0 0 0 1.42 0l1.82-1.83a1 1 0 1 0-1.41-1.41L12 13.41a1 1 0 0 1-1.41 0Zm2.82-2.82a1 1 0 0 1 0 1.41L10 15.42a3 3 0 1 1-4.24-4.24l1.83-1.83a3 3 0 0 1 4.24 0 1 1 0 1 1-1.41 1.41 1 1 0 0 0-1.42 0l-1.82 1.83a1 1 0 1 0 1.41 1.41L12 10.59a1 1 0 0 1 1.41 0Z"
        fill="currentColor"
      />
    </svg>
  )
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 4a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H5Zm0 2h14a1 1 0 0 1 1 1v6.17l-3.59-3.58a2 2 0 0 0-2.82 0L8 15.17l-1.59-1.58a2 2 0 0 0-2.82 0L4 14V7a1 1 0 0 1 1-1Zm0 12a1 1 0 0 1-1-1v-.17l2-2 2.17 2.17a1 1 0 0 0 1.41 0L15 11.41l5 5V17a1 1 0 0 1-1 1H5Zm2-8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
        fill="currentColor"
      />
    </svg>
  )
}

function PdfIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M7 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9.83A2 2 0 0 0 18.41 8l-3.42-3.41A2 2 0 0 0 13.58 4H7Zm0 2h6v4a1 1 0 0 0 1 1h4v9H7V5Zm1.5 8h1.75a2.25 2.25 0 1 1 0 4.5H9.75V19H8.5v-6Zm1.25 1.1V16.4h.45a1.15 1.15 0 1 0 0-2.3h-.45Zm3.25-1.1h1.65A2.35 2.35 0 0 1 17 15.35v1.3A2.35 2.35 0 0 1 14.65 19H13v-6Zm1.25 1.1v3.7h.35a1.1 1.1 0 0 0 1.1-1.1v-1.5a1.1 1.1 0 0 0-1.1-1.1h-.35ZM18.5 13h3v1.1h-1.75v1.35h1.55v1.1h-1.55V19H18.5v-6Z"
        fill="currentColor"
      />
    </svg>
  )
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M18.9 3H21l-4.58 5.23L22 21h-4.39l-3.44-4.94L9.85 21H7.74l4.9-5.6L2 3h4.5l3.11 4.48L13.53 3h2.11l-4.7 5.37L18.9 3Zm-1.54 16h1.22L5.96 4.9H4.66L17.36 19Z"
        fill="currentColor"
      />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M13.5 21v-7h2.33l.35-2.73H13.5V9.53c0-.79.22-1.33 1.36-1.33H16.3V5.77A18.5 18.5 0 0 0 14.2 5c-2.08 0-3.5 1.27-3.5 3.61v2.66H8.4V14h2.3v7h2.8Z"
        fill="currentColor"
      />
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6.94 8.5A1.56 1.56 0 1 1 6.94 5.38a1.56 1.56 0 0 1 0 3.12ZM5.7 9.75H8.2V18H5.7V9.75Zm4.07 0h2.4v1.13h.03c.34-.63 1.15-1.3 2.37-1.3 2.53 0 3 1.67 3 3.84V18h-2.5v-4.03c0-.96-.02-2.2-1.34-2.2-1.34 0-1.55 1.05-1.55 2.13V18h-2.41V9.75Z"
        fill="currentColor"
      />
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M20.5 11.92A8.5 8.5 0 0 0 6.3 5.62a8.44 8.44 0 0 0-1.2 9.95L4 20l4.57-1.18a8.5 8.5 0 0 0 11.93-6.9Zm-8.51 6.08a7.04 7.04 0 0 1-3.58-.98l-.26-.15-2.71.7.72-2.64-.17-.27a7.02 7.02 0 1 1 6 3.34Zm3.85-5.24c-.21-.1-1.22-.6-1.41-.67-.19-.07-.32-.1-.45.1-.13.2-.52.67-.64.8-.12.13-.23.15-.44.05-.21-.1-.87-.32-1.66-1.03a6.2 6.2 0 0 1-1.16-1.44c-.12-.2-.01-.31.09-.41.09-.09.2-.23.31-.34.1-.12.13-.2.2-.33.07-.13.03-.24-.02-.34-.05-.1-.45-1.09-.62-1.49-.16-.39-.32-.33-.44-.34h-.38c-.13 0-.34.05-.52.24-.18.2-.69.68-.69 1.66s.7 1.93.8 2.07c.1.13 1.37 2.09 3.33 2.93.47.2.84.32 1.12.4.47.15.9.13 1.24.08.38-.06 1.22-.5 1.39-.98.17-.48.17-.89.12-.98-.05-.09-.18-.15-.39-.25Z"
        fill="currentColor"
      />
    </svg>
  )
}

function KakaoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 4c-4.97 0-9 3.12-9 6.97 0 2.48 1.67 4.66 4.18 5.89l-.84 3.08a.48.48 0 0 0 .72.53l3.68-2.42c.41.05.83.08 1.26.08 4.97 0 9-3.12 9-6.97S16.97 4 12 4Z"
        fill="currentColor"
      />
    </svg>
  )
}

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

function getCurrentShareUrl() {
  return window.location.href
}

function getSharePreviewImageUrl() {
  return `${window.location.origin}/social-preview.png`
}

function getKakaoReadyState() {
  if (!KAKAO_JAVASCRIPT_KEY) {
    return 'missing_key'
  }

  const kakao = window.Kakao
  if (!kakao) {
    return 'missing_sdk'
  }

  try {
    if (!kakao.isInitialized()) {
      kakao.init(KAKAO_JAVASCRIPT_KEY)
    }
  } catch {
    return 'init_failed'
  }

  if (!kakao.Share?.sendDefault) {
    return 'share_unavailable'
  }

  return 'ready'
}

function fallbackCopyText(text) {
  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.setAttribute('readonly', '')
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'
  document.body.appendChild(textArea)
  textArea.select()

  const copied = document.execCommand('copy')
  document.body.removeChild(textArea)
  return copied
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

function buildInterpretationNotes(summaryLabel) {
  return [
    {
      title: '이 결과는 어떻게 계산되나요?',
      body: `${summaryLabel} 동안의 공개 이벤트와 공개 저장소 정보를 기준으로 활동량, Push 수, 활동 일수, 언어 분포를 다시 집계합니다. 빠르게 읽기 좋은 형태로 요약한 값이기 때문에 실제 저장소 내용과 함께 보면 더 정확합니다.`,
    },
    {
      title: 'Push 수가 높다고 무조건 좋은가요?',
      body: 'Push 수는 코드 반영 빈도를 보여주지만, 품질이나 협업 수준을 단독으로 판단해주지는 않습니다. 이슈 정리, PR 설명, README 관리처럼 화면에 바로 드러나지 않는 요소도 함께 봐야 전체 맥락이 읽힙니다.',
    },
    {
      title: '활동 일수는 왜 중요할까요?',
      body: '비슷한 이벤트 수라도 여러 날짜에 나뉘어 있으면 꾸준한 개발 리듬으로 읽히고, 짧은 구간에 몰려 있으면 스프린트형 작업 패턴으로 보일 수 있습니다. 포트폴리오 관점에서는 이런 리듬 정보가 꽤 중요한 인상을 남깁니다.',
    },
    {
      title: '언어 분포를 볼 때 주의할 점',
      body: '언어 분포는 공개 저장소 기준이라 실제 실무 전체 스택과 다를 수 있습니다. 비공개 프로젝트나 실험용 레포가 빠져 있으면 현재 역량보다 좁게 보일 수 있으니, README와 프로젝트 설명으로 보완하는 편이 좋습니다.',
    },
  ]
}

function buildCoverageNote(summary) {
  if (!summary?.event_data_incomplete) {
    return ''
  }

  return `${buildWindowLabel(summary)} 이벤트는 GitHub 공개 Events API 제공 범위까지만 반영됩니다. 활동량이 많은 계정은 장기 기간에서 일부 오래된 이벤트가 제외될 수 있습니다.`
}

function ProfileCard({ userData, feedbackLoading = false }) {
  const { profile, stats, username, feedback, feedback_source: feedbackSource } = userData
  const [actionMessage, setActionMessage] = useState('')
  const [exportingAction, setExportingAction] = useState('')
  const [openMenu, setOpenMenu] = useState('')
  const exportTargetRef = useRef(null)
  const menuWrapRef = useRef(null)

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
  const interpretationNotes = buildInterpretationNotes(summaryLabel)
  const coverageNote = buildCoverageNote(summary)
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

  const handleKakaoShare = useCallback(() => {
    const kakaoState = getKakaoReadyState()

    if (kakaoState !== 'ready') {
      if (kakaoState === 'missing_key') {
        setActionMessage(
          '카카오 공유 키가 설정되지 않았어요. VITE_KAKAO_JAVASCRIPT_KEY 또는 VITE_KAKAO_APP_KEY를 확인해주세요.'
        )
      } else if (kakaoState === 'missing_sdk') {
        setActionMessage('카카오 SDK를 불러오지 못했어요. 잠시 뒤 다시 시도해주세요.')
      } else if (kakaoState === 'init_failed') {
        setActionMessage('카카오 공유 초기화에 실패했어요. 앱 키 설정을 확인해주세요.')
      } else {
        setActionMessage('카카오 공유 기능을 사용할 수 없는 환경이에요.')
      }
      setOpenMenu('')
      return
    }

    const shareUrl = getCurrentShareUrl()

    window.Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: `${username}님의 Git Insight 결과`,
        description: `${summaryLabel} GitHub 활동 요약을 확인해보세요.`,
        imageUrl: getSharePreviewImageUrl(),
        link: {
          mobileWebUrl: shareUrl,
          webUrl: shareUrl,
        },
      },
      buttons: [
        {
          title: '결과 보기',
          link: {
            mobileWebUrl: shareUrl,
            webUrl: shareUrl,
          },
        },
      ],
    })

    setOpenMenu('')
  }, [summaryLabel, username])

  const shareLinks = useMemo(() => {
    const title = `${username}님의 Git Insight 결과`
    const text = `${summaryLabel} GitHub 활동 요약을 확인해보세요.`
    const encodedUrl = encodeURIComponent(getCurrentShareUrl())
    const encodedTitle = encodeURIComponent(title)
    const encodedText = encodeURIComponent(text)

    const links = [
      {
        id: 'twitter',
        label: 'X에 공유',
        icon: <XIcon />,
        href: `https://twitter.com/intent/tweet?text=${encodedTitle}%20${encodedUrl}`,
      },
      {
        id: 'facebook',
        label: 'Facebook에 공유',
        icon: <FacebookIcon />,
        href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      },
      {
        id: 'whatsapp',
        label: 'WhatsApp에 공유',
        icon: <WhatsAppIcon />,
        href: `https://api.whatsapp.com/send?text=${encodedText}%20${encodedUrl}`,
      },
      {
        id: 'kakao',
        label: '카카오톡 공유',
        icon: <KakaoIcon />,
        onClick: handleKakaoShare,
      },
      {
        id: 'linkedin',
        label: 'LinkedIn에 공유',
        icon: <LinkedInIcon />,
        href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      },
    ]

    return links
  }, [handleKakaoShare, summaryLabel, username])

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

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!menuWrapRef.current?.contains(event.target)) {
        setOpenMenu('')
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  useEffect(() => {
    if (!KAKAO_JAVASCRIPT_KEY) {
      return
    }

    getKakaoReadyState()
  }, [])

  function toggleMenu(menuName) {
    setOpenMenu((current) => (current === menuName ? '' : menuName))
  }

  function openShareWindow(href) {
    window.open(href, '_blank', 'noopener,noreferrer,width=680,height=720')
    setOpenMenu('')
  }

  async function handleCopyLink() {
    const shareUrl = getCurrentShareUrl()

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
      } else {
        const copied = fallbackCopyText(shareUrl)
        if (!copied) {
          throw new Error('fallback_copy_failed')
        }
      }
      setActionMessage('링크를 복사했어요.')
    } catch {
      setActionMessage('링크 복사에 실패했어요. 다시 시도해주세요.')
    } finally {
      setOpenMenu('')
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
      setOpenMenu('')
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
      setOpenMenu('')
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

        {coverageNote ? <p className="profile-note">{coverageNote}</p> : null}

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

      <section className="result-editorial" aria-labelledby="result-editorial-title">
        <div className="result-editorial-header">
          <p className="editorial-kicker">Reading Guide</p>
          <h3 id="result-editorial-title">결과를 해석할 때 같이 보면 좋은 설명</h3>
          <p>
            이 화면은 공개 GitHub 활동을 빠르게 읽도록 요약한 결과입니다. 숫자만 보기보다 아래 설명과 함께 보면 현재 기록이
            어떤 인상으로 보이는지 더 쉽게 판단할 수 있습니다.
          </p>
        </div>

        <div className="result-editorial-grid">
          {interpretationNotes.map((item) => (
            <article key={item.title} className="result-editorial-card">
              <h4>{item.title}</h4>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="result-actions">
        <div className="result-actions-copy">
          <p className="result-actions-label">공유/저장</p>
          <p className="result-actions-hint">
            현재 선택한 아이디와 기간 기준 결과를 저장하거나 링크로 공유할 수 있어요.
          </p>
        </div>

        <div className="result-menu-wrap" ref={menuWrapRef}>
          <div className="result-menu-buttons">
            <button
              type="button"
              className="result-menu-trigger"
              onClick={() => toggleMenu('share')}
              aria-expanded={openMenu === 'share'}
              aria-haspopup="menu"
            >
              <span className="result-menu-icon">
                <ShareIcon />
              </span>
              <span>공유하기</span>
            </button>

            <button
              type="button"
              className="result-menu-trigger"
              onClick={() => toggleMenu('export')}
              aria-expanded={openMenu === 'export'}
              aria-haspopup="menu"
            >
              <span className="result-menu-icon">
                <ExportIcon />
              </span>
              <span>저장하기</span>
            </button>
          </div>

          {openMenu === 'share' ? (
            <div className="result-dropdown-menu result-dropdown-share" role="menu">
              {shareLinks.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="result-dropdown-item"
                  onClick={() => {
                    if (item.onClick) {
                      item.onClick()
                      return
                    }
                    openShareWindow(item.href)
                  }}
                >
                  <span className="result-dropdown-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
              <button type="button" className="result-dropdown-item" onClick={handleCopyLink}>
                <span className="result-dropdown-icon">
                  <LinkIcon />
                </span>
                <span>링크 복사</span>
              </button>
            </div>
          ) : null}

          {openMenu === 'export' ? (
            <div className="result-dropdown-menu result-dropdown-export" role="menu">
              <button
                type="button"
                className="result-dropdown-item"
                onClick={handleSaveImage}
                disabled={exportingAction === 'image' || exportingAction === 'pdf'}
              >
                <span className="result-dropdown-icon">
                  <ImageIcon />
                </span>
                <span>{exportingAction === 'image' ? 'PNG 저장 중' : 'PNG 저장'}</span>
              </button>
              <button
                type="button"
                className="result-dropdown-item"
                onClick={handleSavePdf}
                disabled={exportingAction === 'image' || exportingAction === 'pdf'}
              >
                <span className="result-dropdown-icon">
                  <PdfIcon />
                </span>
                <span>{exportingAction === 'pdf' ? 'PDF 저장 중' : 'PDF 저장'}</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {actionMessage ? <p className="result-action-message">{actionMessage}</p> : null}
    </div>
  )
}

export { ProfileCard }
