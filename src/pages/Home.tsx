import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCalendars, deleteCalendar } from '../services/calendar';
import { useAuth } from '../contexts/AuthContext';
import type { Calendar } from '../types';
import { debugLog, debugError } from '../utils/debug';
import './Home.css';
import './HomeLanding.css';

export function Home() {
  const { currentUser } = useAuth();
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [loading, setLoading] = useState(false);

  // 달력 리스트 로드
  useEffect(() => {
    if (!currentUser) return;

    const loadCalendars = async () => {
      try {
        setLoading(true);
        debugLog('HOME', '달력 리스트 로드 시작');
        const data = await getCalendars();
        setCalendars(data);
        debugLog('HOME', '달력 리스트 로드 완료', { count: data.length });
      } catch (err: any) {
        debugError('HOME', '달력 리스트 로드 실패', err);
        alert(err.message || '달력 리스트를 불러오는데 실패했습니다.');
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
      debugLog('HOME', '달력 삭제 시작', { calendarId });
      await deleteCalendar(calendarId);
      setCalendars(calendars.filter((cal) => cal.id !== calendarId));
      debugLog('HOME', '달력 삭제 완료', { calendarId });
    } catch (err: any) {
      debugError('HOME', '달력 삭제 실패', err);
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
    return (
      <div className="home-landing">
        <div className="home-landing-content">
          <h1 className="home-landing-logo">MANNAYO</h1>
          <Link to="/login" className="home-landing-login-btn">
            로그인하기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="home">
      <div className="home-container">
        <h1 className="home-title">MANNAYO</h1>
        <p className="home-subtitle">쉽고 빠르게 표시하는 서로의 일정</p>

        {loading ? (
          <div className="loading">로딩 중...</div>
        ) : calendars.length === 0 ? (
          <div className="empty-state">
            <p>참여한 달력이 없습니다.</p>
            <div className="home-actions">
              <Link to="/calendar/create" className="btn btn-primary btn-large">
                첫 달력 만들기
              </Link>
            </div>
          </div>
        ) : (
          <>
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
                      to={`/calendar/${calendar.code}`}
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
            <div className="home-actions-bottom">
              <Link to="/calendar/create" className="btn btn-outline btn-large">
                공유달력 생성하기
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


