import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { joinCalendar, findCalendarByCode } from '../services/calendar';
import { useAuth } from '../contexts/AuthContext';
import './JoinCalendar.css';

export function JoinCalendar() {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // 로그인 확인
  if (!currentUser) {
    navigate('/login');
    return null;
  }

  const handleCodeChange = async (value: string) => {
    setCode(value.toUpperCase().trim());
    setError('');
    
    // 코드가 6자일 때 달력 정보 확인
    if (value.length === 6) {
      try {
        const calendar = await findCalendarByCode(value.toUpperCase());
        if (calendar) {
          setUsePassword(calendar.usePassword);
          if (!calendar.usePassword) {
            setPassword('');
          }
        } else {
          setUsePassword(false);
          setPassword('');
        }
      } catch (err) {
        // 에러는 무시 (코드 입력 중이므로)
      }
    } else {
      setUsePassword(false);
      setPassword('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!code.trim() || code.length !== 6) {
      setError('올바른 달력 코드를 입력해주세요. (6자)');
      return;
    }

    if (usePassword && !password.trim()) {
      setError('비밀번호를 입력해주세요.');
      return;
    }

    setLoading(true);

    try {
      const calendar = await joinCalendar(code.toUpperCase(), usePassword ? password : undefined);
      // 참여 성공 시 달력 상세 페이지로 이동
      navigate(`/calendar/${calendar.code}`);
    } catch (err: any) {
      console.error('달력 참여 실패:', err);
      setError(err.message || '달력 참여에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="join-calendar-page">
      <div className="join-calendar-container">
        <h1>공유달력 참여</h1>
        <p className="description">달력 코드를 입력하여 참여하세요</p>

        <form onSubmit={handleSubmit} className="join-calendar-form">
          <div className="form-group">
            <label htmlFor="code">달력 코드 *</label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="6자리 코드 입력"
              required
              maxLength={6}
              disabled={loading}
              style={{ textTransform: 'uppercase', letterSpacing: '0.5rem', textAlign: 'center' }}
            />
            <small className="form-hint">대문자 6자리 코드를 입력하세요</small>
          </div>

          {usePassword && (
            <div className="form-group">
              <label htmlFor="password">비밀번호 *</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
                required={usePassword}
                disabled={loading}
              />
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="btn btn-outline"
              disabled={loading}
            >
              취소
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !code || code.length !== 6}
            >
              {loading ? '참여 중...' : '참여하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

