import { useEffect, useRef, useState } from 'react'

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.68-.06-1.33-.17-1.95H12v3.69h5.39a4.61 4.61 0 0 1-2 3.03v2.51h3.24c1.89-1.74 2.97-4.31 2.97-7.28Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.97-.9 6.63-2.44l-3.24-2.51c-.9.6-2.05.96-3.39.96-2.61 0-4.83-1.77-5.62-4.15H3.03v2.59A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC04"
        d="M6.38 13.86A5.98 5.98 0 0 1 6.07 12c0-.65.11-1.28.31-1.86V7.55H3.03A10 10 0 0 0 2 12c0 1.61.39 3.13 1.03 4.45l3.35-2.59Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.99c1.47 0 2.79.5 3.83 1.47l2.87-2.87C16.96 2.98 14.69 2 12 2a10 10 0 0 0-8.97 5.55l3.35 2.59C7.17 7.76 9.39 5.99 12 5.99Z"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6.7 5.3a1 1 0 0 1 1.4 0L12 9.17l3.9-3.88a1 1 0 1 1 1.4 1.42L13.42 10.6l3.88 3.9a1 1 0 1 1-1.42 1.4L12 12.02l-3.9 3.88a1 1 0 1 1-1.4-1.42l3.88-3.9-3.88-3.9a1 1 0 0 1 0-1.39Z"
        fill="currentColor"
      />
    </svg>
  )
}

function getUserLabel(session, profile) {
  if (profile?.nickname) {
    return profile.nickname
  }

  const metadata = session?.user?.user_metadata ?? {}
  const nestedMetadata = metadata.response ?? metadata.profile ?? metadata.account ?? {}
  return (
    metadata.full_name ||
    metadata.name ||
    metadata.nickname ||
    nestedMetadata.nickname ||
    nestedMetadata.name ||
    session?.user?.email ||
    '사용자'
  )
}

function getUserAvatar(session, profile) {
  if (profile?.avatar_url) {
    return profile.avatar_url
  }

  const metadata = session?.user?.user_metadata ?? {}
  const nestedMetadata = metadata.response ?? metadata.profile ?? metadata.account ?? {}
  return (
    metadata.avatar_url ||
    metadata.picture ||
    metadata.profile_image ||
    nestedMetadata.avatar_url ||
    nestedMetadata.picture ||
    nestedMetadata.profile_image ||
    nestedMetadata.profile_image_url ||
    ''
  )
}

function AuthMenu({
  session,
  profile,
  loading = false,
  onGoogleLogin,
  onLogout,
  onNavigateToMyPage,
}) {
  const [open, setOpen] = useState(false)
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  useEffect(() => {
    if (!loginModalOpen) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setLoginModalOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [loginModalOpen])

  if (!session) {
    return (
      <>
        <div className="auth-menu auth-menu-guest">
          <button
            type="button"
            className="auth-menu-trigger auth-menu-trigger-guest"
            onClick={() => setLoginModalOpen(true)}
          >
            {loading ? '연결 중...' : '로그인'}
          </button>
        </div>

        {loginModalOpen ? (
          <div
            className="auth-modal-backdrop"
            role="presentation"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setLoginModalOpen(false)
              }
            }}
          >
            <section className="auth-modal" role="dialog" aria-modal="true" aria-label="로그인">
              <div className="auth-modal-header">
                <div>
                  <p className="auth-modal-kicker">Account</p>
                  <h2>로그인하고 저장 기능을 시작하세요</h2>
                </div>
                <button
                  type="button"
                  className="auth-modal-close"
                  onClick={() => setLoginModalOpen(false)}
                  aria-label="닫기"
                >
                  <CloseIcon />
                </button>
              </div>

              <div className="auth-provider-list">
                <button
                  type="button"
                  className="auth-provider-button auth-provider-button-google"
                  onClick={async () => {
                    setLoginModalOpen(false)
                    await onGoogleLogin()
                  }}
                  disabled={loading}
                >
                  <span className="auth-provider-icon">
                    <GoogleMark />
                  </span>
                  <span className="auth-provider-copy">
                    <strong>{loading ? '연결 중...' : 'Google 로그인'}</strong>
                  </span>
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </>
    )
  }

  const userLabel = getUserLabel(session, profile)
  const userAvatar = getUserAvatar(session, profile)

  return (
    <div className="auth-menu" ref={menuRef}>
      <button
        type="button"
        className={`auth-menu-trigger${open ? ' is-open' : ''}`}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {userAvatar ? (
          <img src={userAvatar} alt={userLabel} className="auth-menu-avatar" />
        ) : (
          <span className="auth-menu-avatar auth-menu-avatar-fallback" aria-hidden="true">
            {userLabel.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="auth-menu-name">{userLabel}</span>
      </button>

      {open ? (
        <div className="auth-menu-dropdown" role="menu">
          <button
            type="button"
            className="auth-menu-item"
            onClick={() => {
              setOpen(false)
              onNavigateToMyPage()
            }}
          >
            마이페이지
          </button>
          <button
            type="button"
            className="auth-menu-item"
            onClick={async () => {
              setOpen(false)
              await onLogout()
            }}
          >
            로그아웃
          </button>
        </div>
      ) : null}
    </div>
  )
}

export { AuthMenu }
