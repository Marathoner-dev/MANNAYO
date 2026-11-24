import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from '@phosphor-icons/react';
import { createCalendar } from '../services/calendar';
import {
  addProfile,
  pickRandomColor,
  setSelectedProfileId,
  setProfileAuthenticated,
} from '../services/profile';
import { useAuth } from '../contexts/AuthContext';
import { debugLog, debugError } from '../utils/debug';

export function CreateCalendar() {
  const [title, setTitle] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
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

    if (!profileName.trim()) {
      debugLog('CREATE_CALENDAR', '유효성 검사 실패 - 프로필 이름 없음');
      setError('내 프로필 이름을 입력해주세요.');
      return;
    }

    // 프로필 비밀번호는 선택 — 입력했다면 4자 이상
    if (profilePassword.trim() && profilePassword.trim().length < 4) {
      debugLog('CREATE_CALENDAR', '유효성 검사 실패 - 프로필 비밀번호 너무 짧음');
      setError('프로필 비밀번호는 4자 이상이어야 합니다.');
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

      // 생성자 프로필 등록 (색상 임의 배정, 비밀번호는 선택)
      try {
        const profile = await addProfile(
          calendar.id,
          profileName.trim(),
          pickRandomColor(),
          profilePassword
        );
        setSelectedProfileId(calendar.id, profile.id);
        // 본인이 만든 프로필은 자동 인증 처리
        if (profile.password) {
          setProfileAuthenticated(profile.id);
        }
        debugLog('CREATE_CALENDAR', '생성자 프로필 등록 완료', {
          calendarId: calendar.id,
          profileId: profile.id,
          name: profile.name,
        });
      } catch (profileErr: any) {
        debugError('CREATE_CALENDAR', '생성자 프로필 등록 실패 (달력 이동은 계속)', profileErr);
      }

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
    <div className="page-narrow">
      <div className="form-card">
        <button type="button" onClick={() => navigate(-1)} className="back-link">
          <ArrowLeft size={16} weight="bold" />
          뒤로
        </button>
        <div className="form-card-head">
          <h1>새 달력 만들기</h1>
          <p>제목과 내 이름만 있으면 바로 시작해요. 만든 뒤 링크를 친구들에게 보내 주세요.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="title">달력 이름</label>
            <input
              id="title"
              type="text"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 연말 동기 모임"
              required
              maxLength={50}
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="profileName">내 이름</label>
            <input
              id="profileName"
              type="text"
              className="input"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="달력에 표시될 이름"
              required
              maxLength={20}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="profilePassword">
              내 프로필 비밀번호 <span className="form-hint">선택 · 4자 이상</span>
            </label>
            <input
              id="profilePassword"
              type="password"
              className="input"
              value={profilePassword}
              onChange={(e) => setProfilePassword(e.target.value)}
              placeholder="설정하면 나만 내 일정을 바꿀 수 있어요"
              disabled={loading}
            />
          </div>

          <label className="switch">
            <span className="switch-text">
              <strong>달력 비밀번호로 잠그기</strong>
              <span>링크가 있어도 비밀번호를 아는 사람만 볼 수 있어요.</span>
            </span>
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
          </label>

          {usePassword && (
            <div className="form-group">
              <label htmlFor="password">달력 비밀번호</label>
              <input
                id="password"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="4자 이상"
                required={usePassword}
                minLength={4}
                disabled={loading}
              />
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
              {loading ? '만드는 중…' : '달력 만들기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

