import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getCalendars, deleteCalendar } from '../services/calendar';
import { useAuth } from '../contexts/AuthContext';
import type { Calendar } from '../types';
import './CalendarList.css';

export function CalendarList() {
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // 로그인 확인
  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    }
  }, [currentUser, navigate]);

  // 달력 리스트 로드
  useEffect(() => {
    if (!currentUser) return;

    const loadCalendars = async () => {
      try {
        setLoading(true);
        const data = await getCalendars();
        setCalendars(data);
      } catch (err: any) {
        console.error('달력 리스트 로드 실패:', err);
        setError(err.message || '달력 리스트를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    loadCalendars();
  }, [currentUser]);

  const handleDelete = async (calendarId: string, calendarTitle: string) => {
    if (!confirm(`"${calendarTitle}" 달력을 정말 삭제하시겠습니까?`)) {
      return;
    }

    try {
      await deleteCalendar(calendarId);
      setCalendars(calendars.filter((cal) => cal.id !== calendarId));
    } catch (err: any) {
      alert(err.message || '달력 삭제에 실패했습니다.');
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  if (!currentUser) {
    return null;
  }

  if (loading) {
    return (
      <div className="calendar-list-page">
        <div className="calendar-list-container">
          <div className="loading">로딩 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="calendar-list-page">
      <div className="calendar-list-container">
        <div className="calendar-list-header">
          <h1>공유달력 리스트</h1>
          <Link to="/calendar/create" className="btn btn-primary">
            새 달력 만들기
          </Link>
        </div>

        {error && <div className="error-message">{error}</div>}

        {calendars.length === 0 ? (
          <div className="empty-state">
            <p>참여한 달력이 없습니다.</p>
            <Link to="/calendar/create" className="btn btn-primary">
              첫 달력 만들기
            </Link>
          </div>
        ) : (
          <div className="calendar-grid">
            {calendars.map((calendar) => (
              <div key={calendar.id} className="calendar-card">
                <div className="calendar-card-header">
                  <h3>{calendar.title}</h3>
                  {calendar.usePassword && (
                    <span className="password-badge">🔒</span>
                  )}
                </div>
                <div className="calendar-card-info">
                  <div className="info-item">
                    <span className="info-label">코드:</span>
                    <span className="info-value code-value">{calendar.code}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">생성일:</span>
                    <span className="info-value">{formatDate(calendar.createdAt)}</span>
                  </div>
                    <div className="info-item confirmed">
                      <span className="info-label">확정일:</span>
                      <span className="info-value">{calendar.confirmedDate}</span>
                    </div>
                </div>
                <div className="calendar-card-actions">
                  <Link
                    to={`/calendar/${calendar.id}`}
                    className="btn btn-primary btn-small"
                  >
                    보기
                  </Link>
                  {calendar.createdBy === currentUser.uid && (
                    <button
                      onClick={() => handleDelete(calendar.id, calendar.title)}
                      className="btn btn-outline btn-small btn-danger"
                    >
                      삭제
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

