import { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [username, setUsername] = useState('');
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async () => {
    if (!username) return;
    setLoading(true);
    setError(null);
    try {
      // 파이썬 백엔드 API로 데이터 요청
      const response = await axios.get(`http://localhost:8000/api/analyze/${username}`);
      setUserData(response.data);
    } catch (err) {
      setError('유저 정보를 불러오는데 실패했습니다. 백엔드 서버가 켜져있는지 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <h1>Git Insight Dashboard</h1>
      <div className="search-box">
        <input
          type="text"
          placeholder="GitHub 아이디를 입력하세요"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <button onClick={handleSearch}>검색</button>
      </div>

      {loading && <p>데이터를 불러오는 중입니다...</p>}
      {error && <p className="error">{error}</p>}

      {userData && (
        <div className="profile-section">
          <img src={userData.profile.avatar_url} alt="프로필" width="150" />
          <h2>{userData.profile.name || userData.username}</h2>
          <p>공개 레포지토리: {userData.profile.public_repos}개</p>
          <p>최근 커밋(Push): {userData.stats.recent_commits}개</p>
        </div>
      )}
    </div>
  );
}

export default App;