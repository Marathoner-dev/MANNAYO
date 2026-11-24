import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from '@phosphor-icons/react';
import { joinCalendar, findCalendarByCode } from '../services/calendar';
import { useAuth } from '../contexts/AuthContext';
import { debugError } from '../utils/debug';
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
      debugError('JOIN_CALENDAR', '달력 참여 실패', err);
      setError(err.message || '달력 참여에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-narrow">
      <div className="form-card">
        <button type="button" onClick={() => navigate(-1)} className="back-link">
          <ArrowLeft size={16} weight="bold" />
          뒤로
        </button>
        <div className="form-card-head">
          <h1>코드로 참여하기</h1>
          <p>받은 6자리 코드를 넣으면 내 달력 목록에 추가돼요.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="code">달력 코드</label>
            <input
              id="code"
              type="text"
              className="input code-input"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="ABC123"
              required
              maxLength={6}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              disabled={loading}
              autoFocus
            />
          </div>

          {usePassword && (
            <div className="form-group">
              <label htmlFor="password">달력 비밀번호</label>
              <input
                id="password"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비공개 달력이에요"
                required={usePassword}
                disabled={loading}
              />
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary btn-lg btn-block"
              disabled={loading || !code || code.length !== 6}
            >
              {loading ? '참여하는 중…' : '참여하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

