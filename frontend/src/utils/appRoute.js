import { ALLOWED_PERIOD_DAYS, DEFAULT_DAYS } from '../constants/appContent'

export function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export function readCurrentRoute() {
  if (typeof window === 'undefined') {
    return 'landing'
  }

  if (window.location.pathname === '/result') {
    return 'result'
  }

  if (window.location.pathname === '/mypage') {
    return 'mypage'
  }

  return 'landing'
}

export function readSharedState() {
  if (typeof window === 'undefined') {
    return { username: '', days: DEFAULT_DAYS }
  }

  const params = new URLSearchParams(window.location.search)
  const username = params.get('u')?.trim() ?? ''
  const days = Number.parseInt(params.get('days') ?? `${DEFAULT_DAYS}`, 10)

  return {
    username,
    days: ALLOWED_PERIOD_DAYS.has(days) ? days : DEFAULT_DAYS,
  }
}

export function buildResultUrl(username, days) {
  const params = new URLSearchParams()

  if (username) {
    params.set('u', username)
    params.set('days', `${days}`)
  }

  const queryString = params.toString()
  return `/result${queryString ? `?${queryString}` : ''}`
}
