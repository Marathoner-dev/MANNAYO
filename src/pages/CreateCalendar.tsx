import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCalendar } from '../services/calendar';
import { useAuth } from '../contexts/AuthContext';
import { debugLog, debugError } from '../utils/debug';
import './CreateCalendar.css';

export function CreateCalendar() {
  const [title, setTitle] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // 로그인 확인
  if (!currentUser) {
    navigate('/login');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    debugLog('CREATE_CALENDAR', '폼 제출 시작', { title, usePassword });
    setError('');

    if (!title.trim()) {
      debugLog('CREATE_CALENDAR', '유효성 검사 실패 - 제목 없음');
      setError('달력 제목을 입력해주세요.');
      return;
    }

    if (usePassword && !password.trim()) {
      debugLog('CREATE_CALENDAR', '유효성 검사 실패 - 비밀번호 없음');
      setError('비밀번호를 입력해주세요.');
      return;
    }

    if (usePassword && password.length < 4) {
      debugLog('CREATE_CALENDAR', '유효성 검사 실패 - 비밀번호 너무 짧음', { length: password.length });
      setError('비밀번호는 4자 이상이어야 합니다.');
      return;
    }

    setLoading(true);

    try {
      const calendar = await createCalendar(
        title.trim(),
        usePassword,
        usePassword ? password : undefined
      );
      debugLog('CREATE_CALENDAR', '달력 생성 성공', { calendarId: calendar.id, code: calendar.code });
      // 생성 성공 시 달력 상세 페이지로 이동
      navigate(`/calendar/${calendar.code}`);
    } catch (err: any) {
      debugError('CREATE_CALENDAR', '달력 생성 실패', err);
      setError(err.message || '달력 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-calendar-page">
      <div className="create-calendar-container">
        <h1>공유달력 생성</h1>
        <p className="description">새로운 공유달력을 만들어보세요</p>

        <form onSubmit={handleSubmit} className="create-calendar-form">
          <div className="form-group">
            <label htmlFor="title">달력 제목 *</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 팀 회의 일정"
              required
              maxLength={50}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={usePassword}
                onChange={(e) => {
                  setUsePassword(e.target.checked);
                  if (!e.target.checked) {
                    setPassword('');
                  }
                }}
                disabled={loading}
              />
              <span>비밀번호 사용</span>
            </label>
          </div>

          {usePassword && (
            <div className="form-group">
              <label htmlFor="password">비밀번호 *</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="4자 이상 입력"
                required={usePassword}
                minLength={4}
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
              disabled={loading}
            >
              {loading ? '생성 중...' : '생성하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

