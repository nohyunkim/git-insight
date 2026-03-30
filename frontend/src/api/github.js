import axios from 'axios'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

export async function fetchGitHubInsight(username) {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/analyze/${encodeURIComponent(username)}`,
      {
        timeout: 30000,
      },
    )

    return response.data
  } catch (error) {
    const serverMessage = error.response?.data?.detail

    if (serverMessage) {
      throw new Error(serverMessage)
    }

    if (error.code === 'ECONNABORTED') {
      throw new Error(
        '응답이 오래 걸리고 있습니다. 첫 요청이라면 서버가 깨어나는 중일 수 있으니 잠시 후 다시 시도해주세요.',
      )
    }

    throw new Error(
      '유저 정보를 불러오지 못했습니다. 백엔드 서버 실행 상태와 GitHub 토큰 설정을 확인해주세요.',
    )
  }
}
