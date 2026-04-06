import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

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

  return 'Supabase 환경변수가 아직 설정되지 않았습니다. frontend/.env의 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 확인해주세요.'
}

export async function signInWithGoogle(redirectTo = window.location.href) {
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

function toSavedResultRow(userId, analysisPayload) {
  const summary = analysisPayload?.stats?.activity_summary ?? {}
  const feedback = analysisPayload?.feedback ?? {}

  return {
    user_id: userId,
    github_username: analysisPayload?.username ?? '',
    window_days: summary.window_days ?? 30,
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
    .select('id, github_username, window_days, profile_name, headline, snapshot, created_at')
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
