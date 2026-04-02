import axios from 'axios'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

function toUserFacingError(error, fallbackMessage) {
  const serverMessage = error.response?.data?.detail
  const statusCode = error.response?.status

  if (serverMessage) {
    return new Error(serverMessage)
  }

  if (statusCode === 503) {
    return new Error(
      '서버가 막 깨어나는 중이거나 GitHub API 연결이 잠시 불안정합니다. 잠깐 뒤 다시 시도해주세요.',
    )
  }

  if (statusCode === 403) {
    return new Error(
      'GitHub API 요청이 제한되었습니다. 서버 토큰 설정이나 요청 한도를 확인해주세요.',
    )
  }

  if (error.code === 'ECONNABORTED') {
    return new Error(
      '응답이 오래 걸리고 있습니다. 첫 요청이라면 서버가 깨어나는 중일 수 있으니 잠시 뒤 다시 시도해주세요.',
    )
  }

  return new Error(fallbackMessage)
}

export async function fetchGitHubInsight(username) {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/analyze/${encodeURIComponent(username)}`,
      {
        timeout: 15000,
      },
    )

    return response.data
  } catch (error) {
    throw toUserFacingError(
      error,
      '유저 정보를 불러오지 못했습니다. 백엔드 서버 실행 상태와 GitHub 토큰 설정을 확인해주세요.',
    )
  }
}

export async function fetchGitHubFeedback(username) {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/feedback/${encodeURIComponent(username)}`,
      {
        timeout: 20000,
      },
    )

    return response.data
  } catch (error) {
    throw toUserFacingError(error, 'AI 요약을 불러오지 못했습니다.')
  }
}
