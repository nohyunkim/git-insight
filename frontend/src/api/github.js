import axios from 'axios'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

export async function fetchGitHubInsight(username) {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/analyze/${encodeURIComponent(username)}`,
    )

    return response.data
  } catch (error) {
    const serverMessage = error.response?.data?.detail

    if (serverMessage) {
      throw new Error(serverMessage)
    }

    throw new Error(
      '유저 정보를 불러오지 못했습니다. 백엔드 서버 실행 상태와 GitHub 토큰 설정을 확인해주세요.',
    )
  }
}
