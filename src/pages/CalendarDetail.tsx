import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { findCalendarByCode } from '../services/calendar';
import { setConfirmedDate } from '../services/calendar';
import { toggleAvailability, subscribeAvailability } from '../services/availability';
import { useAuth } from '../contexts/AuthContext';
import type { Calendar, Availability } from '../types';
import { debugLog, debugError } from '../utils/debug';
import { getAnonymousUserId } from '../utils/anonymousUser';
import { PasswordModal } from '../components/PasswordModal';
import './CalendarDetail.css';

// 날짜 유틸리티 함수들
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getDateKey(year: number, month: number, day: number): string {
  const date = new Date(year, month, day);
  return formatDate(date);
}

export function CalendarDetail() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [longPressDate, setLongPressDate] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // 초기 디버깅 로그
  useEffect(() => {
    debugLog('CALENDAR_DETAIL', '컴포넌트 마운트', {
      code,
      hasCode: !!code,
      currentUser: currentUser?.uid || 'anonymous',
      loading,
      error,
    });
  }, []);

  // 달력 데이터 로드 (코드로 찾기, 로그인 없이도 가능)
  useEffect(() => {
    debugLog('CALENDAR_DETAIL', 'useEffect 실행', { code, hasCode: !!code });
    
    if (!code) {
      debugLog('CALENDAR_DETAIL', '코드가 없음', { code });
      setError('달력 코드가 필요합니다.');
      setLoading(false);
      return;
    }

    const loadCalendar = async () => {
      try {
        setLoading(true);
        setError('');
        debugLog('CALENDAR_DETAIL', '달력 데이터 로드 시작', { 
          code, 
          codeUpperCase: code.toUpperCase(),
          timestamp: new Date().toISOString()
        });
        
        // 코드로 달력 찾기
        const calendarData = await findCalendarByCode(code.toUpperCase());
        
        debugLog('CALENDAR_DETAIL', 'findCalendarByCode 결과', {
          found: !!calendarData,
          calendarData: calendarData ? {
            id: calendarData.id,
            code: calendarData.code,
            title: calendarData.title,
          } : null,
        });
        
        if (!calendarData) {
          const errorMsg = `코드 "${code.toUpperCase()}"에 해당하는 달력을 찾을 수 없습니다.`;
          debugLog('CALENDAR_DETAIL', '달력을 찾을 수 없음', { code: code.toUpperCase() });
          setError(errorMsg);
          setLoading(false);
          return;
        }

        setCalendar(calendarData);
        debugLog('CALENDAR_DETAIL', '달력 데이터 로드 완료', {
          id: calendarData.id,
          code: calendarData.code,
          title: calendarData.title,
          usePassword: calendarData.usePassword,
        });

        // 비밀번호가 필요한 경우 비밀번호 모달 표시
        if (calendarData.usePassword && calendarData.password) {
          // 로컬 스토리지에서 인증 상태 확인
          const authKey = `calendar_auth_${calendarData.id}`;
          const isAuthenticated = localStorage.getItem(authKey) === 'true';
          
          if (!isAuthenticated) {
            debugLog('CALENDAR_DETAIL', '비밀번호 필요', { calendarId: calendarData.id });
            setShowPasswordModal(true);
            setLoading(false);
            return;
          } else {
            debugLog('CALENDAR_DETAIL', '이미 인증됨', { calendarId: calendarData.id });
            setPasswordVerified(true);
          }
        } else {
          setPasswordVerified(true);
        }
      } catch (err: any) {
        debugError('CALENDAR_DETAIL', '달력 데이터 로드 실패', err);
        const errorMessage = err.message || err.toString() || '달력을 불러오는데 실패했습니다.';
        debugLog('CALENDAR_DETAIL', '에러 상세', {
          message: errorMessage,
          code: err.code,
          stack: err.stack,
        });
        setError(errorMessage);
      } finally {
        setLoading(false);
        debugLog('CALENDAR_DETAIL', '로딩 완료', { loading: false });
      }
    };

    loadCalendar();
  }, [code]);

  // 가용성 데이터 실시간 구독 (로그인 없이도 가능, 비밀번호 인증 후)
  useEffect(() => {
    if (!calendar?.id) return;
    
    // 비밀번호가 필요한데 인증되지 않은 경우 구독하지 않음
    if (calendar.usePassword && calendar.password && !passwordVerified) {
      return;
    }

    debugLog('CALENDAR_DETAIL', '가용성 구독 시작', { calendarId: calendar.id });
    const unsubscribe = subscribeAvailability(calendar.id, (data) => {
      setAvailability(data);
    });

    return () => {
      debugLog('CALENDAR_DETAIL', '가용성 구독 해제');
      unsubscribe();
    };
  }, [calendar?.id, passwordVerified]);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
    };
  }, [longPressTimer]);

  const handleDateClick = async (date: string) => {
    if (!calendar?.id) return;

    // 길게 누르기 중이면 클릭 무시
    if (longPressDate === date) {
      return;
    }

    try {
      debugLog('CALENDAR_DETAIL', '날짜 클릭', { date, calendarId: calendar.id });
      await toggleAvailability(calendar.id, date);
      setSelectedDate(date);
    } catch (err: any) {
      debugError('CALENDAR_DETAIL', '가용성 토글 실패', err);
      alert(err.message || '날짜 상태 변경에 실패했습니다.');
    }
  };

  const handleLongPressStart = (date: string) => {
    if (!calendar || calendar.createdBy !== currentUser?.uid) {
      return; // 생성자만 확정일 설정 가능
    }

    debugLog('CALENDAR_DETAIL', '길게 누르기 시작', { date });
    setLongPressDate(date);

    const timer = setTimeout(() => {
      handleConfirmDateDirect(date);
      setLongPressDate(null);
    }, 500); // 500ms 이상 누르면 확정일 설정

    setLongPressTimer(timer);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    setLongPressDate(null);
  };

  const handleConfirmDateDirect = async (date: string) => {
    if (!calendar) return;

    try {
      debugLog('CALENDAR_DETAIL', '길게 누르기로 확정일 설정', { calendarId: calendar.id, date });
      await setConfirmedDate(calendar.id, date);
      setCalendar({ ...calendar, confirmedDate: date });
      alert('약속 확정일이 설정되었습니다.');
    } catch (err: any) {
      debugError('CALENDAR_DETAIL', '확정일 설정 실패', err);
      alert(err.message || '확정일 설정에 실패했습니다.');
    }
  };

  const handleConfirmDate = async () => {
    if (!calendar || !selectedDate) return;

    try {
      debugLog('CALENDAR_DETAIL', '확정일 설정', { calendarId: calendar.id, date: selectedDate });
      await setConfirmedDate(calendar.id, selectedDate);
      setCalendar({ ...calendar, confirmedDate: selectedDate });
      setSelectedDate(null);
      alert('약속 확정일이 설정되었습니다.');
    } catch (err: any) {
      debugError('CALENDAR_DETAIL', '확정일 설정 실패', err);
      alert(err.message || '확정일 설정에 실패했습니다.');
    }
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const isDateUnavailable = (date: string): boolean => {
    // 로그인한 사용자 또는 익명 사용자 모두 확인
    const userId = currentUser?.uid || getAnonymousUserId();
    const userAvailability = availability.find(
      (av) => av.userId === userId && av.date === date
    );
    return userAvailability?.isUnavailable || false;
  };


  const isConfirmedDate = (date: string): boolean => {
    return calendar?.confirmedDate === date;
  };

  const handlePasswordCorrect = (inputPassword: string) => {
    if (!calendar) return;

    debugLog('CALENDAR_DETAIL', '비밀번호 확인 시도', {
      calendarId: calendar.id,
      hasPassword: !!calendar.password,
    });

    if (calendar.password && inputPassword === calendar.password) {
      // 비밀번호가 맞으면 인증 상태 저장
      const authKey = `calendar_auth_${calendar.id}`;
      localStorage.setItem(authKey, 'true');
      setPasswordVerified(true);
      setShowPasswordModal(false);
      setPasswordError('');
      debugLog('CALENDAR_DETAIL', '비밀번호 확인 성공', { calendarId: calendar.id });
    } else {
      setPasswordError('비밀번호가 일치하지 않습니다.');
      debugLog('CALENDAR_DETAIL', '비밀번호 확인 실패', { calendarId: calendar.id });
    }
  };

  const handleShare = async () => {
    if (!calendar?.code) return;

    const url = `${window.location.origin}/calendar/${calendar.code}`;
    
    try {
      await navigator.clipboard.writeText(url);
      debugLog('CALENDAR_DETAIL', '링크 복사 성공', { url });
      setShareCopied(true);
      setTimeout(() => {
        setShareCopied(false);
      }, 2000);
    } catch (err: any) {
      debugError('CALENDAR_DETAIL', '링크 복사 실패', err);
      // 클립보드 API가 실패하면 fallback으로 input 요소 사용
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setShareCopied(true);
        setTimeout(() => {
          setShareCopied(false);
        }, 2000);
      } catch (fallbackErr) {
        alert('링크 복사에 실패했습니다. 수동으로 복사해주세요: ' + url);
      }
      document.body.removeChild(textArea);
    }
  };

  // 디버깅: 렌더링 상태 로그
  useEffect(() => {
    debugLog('CALENDAR_DETAIL', '렌더링 상태', {
      loading,
      error,
      hasCalendar: !!calendar,
      code,
    });
  }, [loading, error, calendar, code]);

  if (loading) {
    debugLog('CALENDAR_DETAIL', '로딩 화면 표시');
    return (
      <div className="calendar-detail-page">
        <div className="calendar-detail-container">
          <div className="loading">
            <p>로딩 중...</p>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
              코드: {code || '없음'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !calendar) {
    debugLog('CALENDAR_DETAIL', '에러 화면 표시', { error, hasCalendar: !!calendar });
    return (
      <div className="calendar-detail-page">
        <div className="calendar-detail-container">
          <div className="error-message">
            <h2>오류 발생</h2>
            <p>{error || '달력을 찾을 수 없습니다.'}</p>
            {code && (
              <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                요청한 코드: <strong>{code.toUpperCase()}</strong>
              </p>
            )}
            <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
              <p>문제 해결 방법:</p>
              <ul style={{ textAlign: 'left', display: 'inline-block' }}>
                <li>코드가 정확한지 확인해주세요</li>
                <li>Firestore 보안 규칙이 올바르게 설정되었는지 확인해주세요</li>
                <li>브라우저 콘솔에서 에러 메시지를 확인해주세요</li>
              </ul>
            </div>
          </div>
          <div style={{ marginTop: '1.5rem' }}>
            <button onClick={() => navigate('/')} className="btn btn-primary">
              홈으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 비밀번호가 필요한데 인증되지 않은 경우
  if (calendar.usePassword && calendar.password && !passwordVerified) {
    return (
      <>
        <div className="calendar-detail-page">
          <div className="calendar-detail-container">
            <div className="loading">
              <p>비밀번호 입력이 필요합니다.</p>
            </div>
          </div>
        </div>
        <PasswordModal
          isOpen={showPasswordModal}
          calendarTitle={calendar.title}
          onClose={() => {
            setShowPasswordModal(false);
            navigate('/');
          }}
          onPasswordCorrect={handlePasswordCorrect}
          error={passwordError}
        />
      </>
    );
  }

  const daysInMonth = getDaysInMonth(year, month);
  const monthNames = [
    '1월', '2월', '3월', '4월', '5월', '6월',
    '7월', '8월', '9월', '10월', '11월', '12월'
  ];

  // 각 요일별 날짜 배열 생성
  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
  const daysByWeekday: { [key: number]: number[] } = {};
  
  // 각 요일별로 날짜 분류
  weekDays.forEach((_, weekdayIndex) => {
    daysByWeekday[weekdayIndex] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      if (date.getDay() === weekdayIndex) {
        daysByWeekday[weekdayIndex].push(day);
      }
    }
  });

  // 각 날짜의 주차(week) 계산 함수
  const getWeekOfMonth = (day: number): number => {
    const firstDate = new Date(year, month, 1);
    const daysDiff = day - 1;
    const weekNumber = Math.floor((firstDate.getDay() + daysDiff) / 7);
    return weekNumber;
  };

  // 각 요일별로 주차별로 그룹화
  const daysByWeekdayAndWeek: { [key: number]: { [week: number]: number } } = {};
  weekDays.forEach((_, weekdayIndex) => {
    daysByWeekdayAndWeek[weekdayIndex] = {};
    daysByWeekday[weekdayIndex].forEach((day) => {
      const week = getWeekOfMonth(day);
      daysByWeekdayAndWeek[weekdayIndex][week] = day;
    });
  });

  // 최대 주차 수 계산
  const maxWeek = Math.max(
    ...weekDays.map((_, weekdayIndex) => {
      const weeks = Object.keys(daysByWeekdayAndWeek[weekdayIndex]).map(Number);
      return weeks.length > 0 ? Math.max(...weeks) : -1;
    })
  );

  return (
    <div className="calendar-detail-page">
      <div className="calendar-detail-container">
        <div className="calendar-header">
          <div className="calendar-header-top">
            <h1>{calendar.title}</h1>
            <button
              onClick={handleShare}
              className="btn btn-share"
              title="링크 복사"
            >
              {shareCopied ? (
                <>
                  <span className="share-icon">✓</span>
                  <span>복사됨!</span>
                </>
              ) : (
                <>
                  <span className="share-icon">🔗</span>
                  <span>공유</span>
                </>
              )}
            </button>
          </div>
          <div className="calendar-info">
            <span className="code-badge">코드: {calendar.code}</span>
            {calendar.confirmedDate && (
              <span className="confirmed-badge">확정일: {calendar.confirmedDate}</span>
            )}
          </div>
        </div>

        <div className="calendar-controls">
          <button onClick={handlePrevMonth} className="btn btn-outline">
            ← 이전 달
          </button>
          <h2>{year}년 {monthNames[month]}</h2>
          <button onClick={handleNextMonth} className="btn btn-outline">
            다음 달 →
          </button>
        </div>

        <div className="calendar-grid-vertical">
          {weekDays.map((dayName, weekdayIndex) => {
            return (
              <div key={dayName} className="calendar-weekday-column">
                <div className="weekday-header">{dayName}</div>
                <div className="weekday-days">
                  {/* 각 주차별로 날짜 배치 */}
                  {Array.from({ length: maxWeek + 1 }).map((_, weekIndex) => {
                    const day = daysByWeekdayAndWeek[weekdayIndex][weekIndex];
                    
                    if (!day) {
                      // 해당 주차에 날짜가 없으면 빈칸
                      return (
                        <div key={`empty-${weekIndex}`} className="calendar-day empty"></div>
                      );
                    }

                    const dateKey = getDateKey(year, month, day);
                    const unavailable = isDateUnavailable(dateKey);
                    const confirmed = isConfirmedDate(dateKey);
                    const isToday = dateKey === formatDate(new Date());

                    return (
                      <div
                        key={day}
                        className={`calendar-day ${unavailable ? 'unavailable' : ''} ${confirmed ? 'confirmed' : ''} ${isToday ? 'today' : ''} ${longPressDate === dateKey ? 'long-pressing' : ''}`}
                        onClick={() => handleDateClick(dateKey)}
                        onMouseDown={() => handleLongPressStart(dateKey)}
                        onMouseUp={handleLongPressEnd}
                        onMouseLeave={handleLongPressEnd}
                        onTouchStart={() => handleLongPressStart(dateKey)}
                        onTouchEnd={handleLongPressEnd}
                        onTouchCancel={handleLongPressEnd}
                      >
                        <div className="day-number">{day}</div>
                        {confirmed && <div className="confirmed-indicator">✓</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>


        <div className="calendar-legend">
          <div className="legend-item">
            <div className="legend-color available"></div>
            <span>가능</span>
          </div>
          <div className="legend-item">
            <div className="legend-color unavailable"></div>
            <span>불가능 (클릭하여 변경)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color confirmed"></div>
            <span>확정일</span>
          </div>
        </div>

        {currentUser && calendar.createdBy === currentUser.uid && (
          <div className="confirm-date-section">
            <h3>약속 확정일 설정</h3>
            <div className="confirm-date-controls">
              <input
                type="date"
                value={selectedDate || ''}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="date-input"
              />
              <button
                onClick={handleConfirmDate}
                disabled={!selectedDate}
                className="btn btn-primary"
              >
                확정일 설정
              </button>
            </div>
          </div>
        )}

        <div className="calendar-actions">
          <button
            onClick={() => {
              if (currentUser) {
                navigate('/calendar/create');
              } else {
                // 비로그인 시 로그인 페이지로 이동, 로그인 완료 후 생성 페이지로 리다이렉트
                navigate('/login?redirect=/calendar/create');
              }
            }}
            className="btn btn-primary"
          >
            새 달력 만들기
          </button>
          {currentUser ? (
            <button onClick={() => navigate('/')} className="btn btn-outline">
              목록으로
            </button>
          ) : (
            <button onClick={() => navigate('/')} className="btn btn-outline">
              홈으로
            </button>
          )}
        </div>
      </div>

      <PasswordModal
        isOpen={showPasswordModal}
        calendarTitle={calendar.title}
        onClose={() => {
          setShowPasswordModal(false);
          navigate('/');
        }}
        onPasswordCorrect={handlePasswordCorrect}
        error={passwordError}
      />
    </div>
  );
}

