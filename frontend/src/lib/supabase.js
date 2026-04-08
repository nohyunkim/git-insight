import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const MAX_NICKNAME_LENGTH = 10

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export function getSupabaseConfigError() {
  if (isSupabaseConfigured) {
    return ''
  }

  return 'Supabase 환경변수가 설정되지 않았습니다. 로컬에서는 frontend/.env를, 배포 환경에서는 호스팅 서비스 환경변수에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 설정해주세요.'
}

function formatLocalDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getAnalysisDateKey(source) {
  if (!source) {
    return ''
  }

  if (typeof source === 'string' || source instanceof Date) {
    return formatLocalDateKey(source)
  }

  return (
    source.analysis_date ||
    formatLocalDateKey(
      source.analysis_generated_at ||
      source.generated_at ||
      source.created_at ||
      source.snapshot?.generated_at ||
      null,
    )
  )
}

function getDefaultOAuthRedirectTo() {
  if (typeof window === 'undefined') {
    return ''
  }

  return `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}`
}

export async function signInWithGoogle(redirectTo = getDefaultOAuthRedirectTo()) {
  if (!supabase) {
    throw new Error(getSupabaseConfigError())
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  })

  if (error) {
    throw error
  }
}

export async function signOutFromSupabase() {
  if (!supabase) {
    return
  }

  const { error } = await supabase.auth.signOut()
  if (error) {
    throw error
  }
}

export async function getCurrentSession() {
  if (!supabase) {
    return null
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) {
    throw error
  }

  return session
}

export function subscribeToAuthChanges(callback) {
  if (!supabase) {
    return () => {}
  }

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })

  return () => subscription.unsubscribe()
}

function getIdentityData(session) {
  const metadata = session?.user?.user_metadata ?? {}
  const identities = Array.isArray(session?.user?.identities) ? session.user.identities : []
  const currentProvider = String(session?.user?.app_metadata?.provider ?? '')
    .replace(/^custom:/, '')
    .trim()
  const matchedIdentity =
    identities.find((identity) => {
      const provider = String(identity?.provider ?? identity?.provider_id ?? '')
        .replace(/^custom:/, '')
        .trim()
      return currentProvider && provider === currentProvider
    }) ?? identities.find((identity) => identity?.identity_data)
  const identityData = matchedIdentity?.identity_data ?? {}
  const nestedSources = [
    identityData?.response,
    identityData?.profile,
    identityData?.account,
    metadata?.response,
    metadata?.profile,
    metadata?.account,
  ].filter(Boolean)

  return {
    ...identityData,
    ...nestedSources.reduce((accumulator, source) => ({ ...accumulator, ...source }), {}),
    ...metadata,
  }
}

function normalizeNickname(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, MAX_NICKNAME_LENGTH)
}

function buildUniqueNicknameCandidates(baseNickname) {
  const normalizedBase = normalizeNickname(baseNickname) || '사용자'
  const candidates = []

  for (let index = 0; index < 10; index += 1) {
    if (index === 0) {
      candidates.push(normalizedBase)
      continue
    }

    const suffix = `-${index + 1}`
    const trimmedBase = normalizedBase.slice(0, MAX_NICKNAME_LENGTH - suffix.length)
    candidates.push(`${trimmedBase}${suffix}`)
  }

  return [...new Set(candidates.map(normalizeNickname).filter(Boolean))]
}

function buildNicknameCandidates(session) {
  const identityData = getIdentityData(session)
  const emailLocalPart = String(session?.user?.email ?? '')
    .split('@')[0]
    .trim()
  const candidates = [
    identityData.nickname,
    identityData.name,
    identityData.full_name,
    identityData.preferred_username,
    emailLocalPart,
    '사용자',
  ]

  return candidates.map(normalizeNickname).filter(Boolean)
}

function getDefaultAvatarUrl(session) {
  const identityData = getIdentityData(session)
  const avatarCandidates = [
    identityData.avatar_url,
    identityData.picture,
    identityData.profile_image,
    identityData.profile_image_url,
  ]

  return avatarCandidates.find((value) => String(value ?? '').trim()) ?? ''
}

async function insertProfileWithUniqueNickname(session, baseNickname, avatarUrl) {
  if (!supabase || !session?.user?.id) {
    throw new Error(getSupabaseConfigError())
  }

  for (const candidate of buildUniqueNicknameCandidates(baseNickname)) {
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        user_id: session.user.id,
        nickname: candidate,
        avatar_url: avatarUrl || null,
        is_custom_nickname: false,
      })
      .select('user_id, nickname, avatar_url, is_custom_nickname, updated_at')
      .single()

    if (!error) {
      return data
    }

    if (error.code === '23505') {
      continue
    }

    throw error
  }

  throw new Error('기본 닉네임 생성 중 중복이 반복되어 프로필 생성에 실패했습니다.')
}

async function updateProfileWithUniqueNickname(session, baseNickname, updates = {}) {
  if (!supabase || !session?.user?.id) {
    throw new Error(getSupabaseConfigError())
  }

  for (const candidate of buildUniqueNicknameCandidates(baseNickname)) {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        nickname: candidate,
      })
      .eq('user_id', session.user.id)
      .select('user_id, nickname, avatar_url, is_custom_nickname, updated_at')
      .single()

    if (!error) {
      return data
    }

    if (error.code === '23505') {
      continue
    }

    throw error
  }

  throw new Error('기본 닉네임 갱신 중 중복이 반복되어 프로필 수정에 실패했습니다.')
}

export function getDefaultProfileDraft(session) {
  return {
    nickname: buildNicknameCandidates(session)[0] || '사용자',
    avatar_url: getDefaultAvatarUrl(session),
  }
}

export async function ensureUserProfile(session) {
  if (!supabase) {
    throw new Error(getSupabaseConfigError())
  }

  if (!session?.user?.id) {
    return null
  }

  const { data: existingProfile, error: fetchError } = await supabase
    .from('profiles')
    .select('user_id, nickname, avatar_url, is_custom_nickname, updated_at')
    .eq('user_id', session.user.id)
    .maybeSingle()

  if (fetchError) {
    throw fetchError
  }

  const defaultDraft = getDefaultProfileDraft(session)
  if (!defaultDraft.avatar_url || defaultDraft.nickname === '사용자') {
    console.info('OAuth profile fallback applied', {
      provider: session?.user?.app_metadata?.provider,
      metadataKeys: Object.keys(session?.user?.user_metadata ?? {}),
      identityKeys: Object.keys(getIdentityData(session)),
    })
  }

  if (!existingProfile) {
    return insertProfileWithUniqueNickname(session, defaultDraft.nickname, defaultDraft.avatar_url)
  }

  const updates = {}
  if (defaultDraft.avatar_url && defaultDraft.avatar_url !== existingProfile.avatar_url) {
    updates.avatar_url = defaultDraft.avatar_url
  }

  const shouldRefreshNickname =
    !existingProfile.is_custom_nickname &&
    defaultDraft.nickname &&
    defaultDraft.nickname !== existingProfile.nickname

  if (!existingProfile.nickname) {
    updates.nickname = defaultDraft.nickname
  }

  if (Object.keys(updates).length === 0) {
    if (!shouldRefreshNickname) {
      return existingProfile
    }

    return updateProfileWithUniqueNickname(session, defaultDraft.nickname, {
      is_custom_nickname: false,
    })
  }

  if (shouldRefreshNickname) {
    return updateProfileWithUniqueNickname(session, defaultDraft.nickname, {
      ...updates,
      is_custom_nickname: false,
    })
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('user_id', session.user.id)
    .select('user_id, nickname, avatar_url, is_custom_nickname, updated_at')
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function updateUserNickname(session, nickname) {
  if (!supabase) {
    throw new Error(getSupabaseConfigError())
  }

  if (!session?.user?.id) {
    throw new Error('로그인 후 닉네임을 변경할 수 있습니다.')
  }

  const normalizedNickname = normalizeNickname(nickname)
  if (!normalizedNickname) {
    throw new Error('닉네임을 입력해주세요.')
  }

  if (normalizedNickname.length < 2) {
    throw new Error('닉네임은 2자 이상으로 입력해주세요.')
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      nickname: normalizedNickname,
      is_custom_nickname: true,
    })
    .eq('user_id', session.user.id)
    .select('user_id, nickname, avatar_url, is_custom_nickname, updated_at')
    .single()

  if (error?.code === '23505') {
    throw new Error('이미 사용 중인 닉네임입니다.')
  }

  if (error) {
    throw error
  }

  return data
}

function toSavedResultRow(userId, analysisPayload) {
  const summary = analysisPayload?.stats?.activity_summary ?? {}
  const feedback = analysisPayload?.feedback ?? {}
  const analysisGeneratedAt = analysisPayload?.generated_at || new Date().toISOString()
  const analysisDate = formatLocalDateKey(new Date())

  return {
    user_id: userId,
    github_username: analysisPayload?.username ?? '',
    window_days: summary.window_days ?? 30,
    analysis_date: analysisDate,
    analysis_generated_at: analysisGeneratedAt,
    profile_name: analysisPayload?.profile?.name ?? null,
    headline: feedback.headline ?? null,
    snapshot: analysisPayload,
  }
}

export async function saveAnalysisResult(session, analysisPayload) {
  if (!supabase) {
    throw new Error(getSupabaseConfigError())
  }

  if (!session?.user?.id) {
    throw new Error('로그인 후 결과를 저장할 수 있습니다.')
  }

  const row = toSavedResultRow(session.user.id, analysisPayload)
  const { data, error } = await supabase
    .from('saved_results')
    .insert(row)
    .select()
    .single()

  if (error?.code === '23505') {
    throw new Error('같은 날짜의 같은 GitHub 아이디와 기간 결과는 한 번만 저장할 수 있습니다.')
  }

  if (error) {
    throw error
  }

  return data
}

export async function fetchSavedResults(session) {
  if (!supabase) {
    throw new Error(getSupabaseConfigError())
  }

  if (!session?.user?.id) {
    return []
  }

  const { data, error } = await supabase
    .from('saved_results')
    .select('id, github_username, window_days, analysis_date, analysis_generated_at, profile_name, headline, snapshot, created_at')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return data ?? []
}

export async function deleteSavedResult(session, savedResultId) {
  if (!supabase) {
    throw new Error(getSupabaseConfigError())
  }

  if (!session?.user?.id) {
    throw new Error('로그인 후 저장한 결과를 삭제할 수 있습니다.')
  }

  const { error } = await supabase
    .from('saved_results')
    .delete()
    .eq('id', savedResultId)
    .eq('user_id', session.user.id)

  if (error) {
    throw error
  }
}
