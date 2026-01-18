import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { findCalendarByCode } from '../services/calendar';
import { setConfirmedDate } from '../services/calendar';
import { toggleAvailability, subscribeAvailability } from '../services/availability';
import { useAuth } from '../contexts/AuthContext';
import type { Calendar, Availability } from '../types';
import { debugLog, debugError } from '../utils/debug';
import { PasswordModal } from '../components/PasswordModal';
import { AddressSearchModal } from '../components/AddressSearchModal';
import { setMetaTags, resetMetaTags } from '../utils/metaTags';
import { captureCalendarImage } from '../utils/captureCalendar';
import './CalendarDetail.css';

// 날짜 유틸리티 함수들
// 날짜 유틸리티 함수들
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function formatDate(date: Date): string {
  // 로컬 시간대를 유지하여 YYYY-MM-DD 형식으로 변환
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [longPressDate, setLongPressDate] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const calendarContainerRef = useRef<HTMLDivElement>(null);
  const confirmDateInProgressRef = useRef(false); // 확정 처리 중복 실행 방지

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
          confirmedDate: calendarData.confirmedDate,
          confirmedLocation: calendarData.confirmedLocation,
        });

        // ========== 공유 미리보기 메타 태그 설정 ==========
        // 이 부분을 수정하여 공유 시 표시되는 정보를 변경할 수 있습니다.
        const calendarUrl = `${window.location.origin}/calendar/${calendarData.code}`;
        const defaultPreviewImageUrl = `${window.location.origin}/calendar-preview.jpg`;
        
        // 기본 메타 태그 설정 (이미지 캡처 전)
        setMetaTags({
          // 브라우저 탭 제목
          title: `${calendarData.title} - 만나요`,
          
          // 검색 엔진 및 소셜 미디어 설명
          description: `"${calendarData.title}" 달력에 참여하여 약속 날짜를 조율해보세요.`,
          
          // Open Graph (Facebook, LinkedIn 등)
          ogTitle: calendarData.title,
          ogDescription: `함께 약속 날짜를 정해보세요! "${calendarData.title}" 달력에 참여하세요.`,
          ogImage: defaultPreviewImageUrl,
          ogImageWidth: '1200',
          ogImageHeight: '630',
          ogType: 'website',
          ogUrl: calendarUrl,
          
          // Twitter Card
          twitterCard: 'summary_large_image',
          twitterTitle: calendarData.title,
          twitterDescription: `함께 약속 날짜를 정해보세요! "${calendarData.title}" 달력에 참여하세요.`,
          twitterImage: defaultPreviewImageUrl,
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

  // 가용성 데이터 변경 감지 및 사이트 자동 업데이트 (로그인 없이도 가능, 비밀번호 인증 후)
  useEffect(() => {
    if (!calendar?.id) return;
    
    // 비밀번호가 필요한데 인증되지 않은 경우 변경 감지하지 않음
    if (calendar.usePassword && calendar.password && !passwordVerified) {
      debugLog('CALENDAR_DETAIL', '비밀번호 미인증으로 변경 감지 건너뜀', { calendarId: calendar.id });
      return;
    }

    debugLog('CALENDAR_DETAIL', '가용성 데이터 변경 감지 시작', { 
      calendarId: calendar.id,
      passwordVerified,
    });
    
    const unsubscribe = subscribeAvailability(calendar.id, (data) => {
      debugLog('CALENDAR_DETAIL', '데이터베이스 변경 감지 - 사이트 상태 업데이트', {
        calendarId: calendar.id,
        count: data.length,
        dates: data.map(av => av.date).slice(0, 5), // 처음 5개 날짜만 로그
        unavailableDates: data.filter(av => av.isUnavailable).map(av => av.date).slice(0, 5),
      });
      
      // 데이터베이스 변경사항을 감지하여 사이트 상태 업데이트
      // 새로운 배열 참조를 생성하여 React가 변경을 감지하도록 함
      setAvailability([...data]);
      
      debugLog('CALENDAR_DETAIL', '상태 업데이트 완료 - 리렌더링 트리거', {
        calendarId: calendar.id,
        newAvailabilityCount: data.length,
      });
    });

    return () => {
      debugLog('CALENDAR_DETAIL', '가용성 데이터 변경 감지 해제', { calendarId: calendar.id });
      unsubscribe();
    };
  }, [calendar?.id, passwordVerified]);

  // 달력 이미지 캡처 (렌더링 완료 후)
  useEffect(() => {
    // 달력이 로드되고, 비밀번호 인증이 완료되었으며, 로딩이 끝난 후에만 캡처
    if (!calendar || loading || !passwordVerified) return;
    
    // 비밀번호가 필요한데 인증되지 않은 경우 캡처하지 않음
    if (calendar.usePassword && calendar.password && !passwordVerified) {
      return;
    }

    // 렌더링 완료를 위해 약간의 지연
    const captureTimer = setTimeout(async () => {
      if (!calendarContainerRef.current) {
        debugLog('CALENDAR_DETAIL', '캡처할 컨테이너를 찾을 수 없음');
        return;
      }

      try {
        debugLog('CALENDAR_DETAIL', '달력 이미지 캡처 시작', { calendarId: calendar.id });
        
        // 달력 컨테이너 캡처
        const imageUrl = await captureCalendarImage(calendarContainerRef.current, {
          width: 1200,
          height: 630,
          quality: 0.7,
          pixelRatio: 2,
          backgroundColor: '#ffffff',
        });

        debugLog('CALENDAR_DETAIL', '달력 이미지 캡처 완료', { 
          calendarId: calendar.id,
          imageSize: imageUrl.length 
        });

        // 캡처한 이미지로 메타 태그 업데이트
        const calendarUrl = `${window.location.origin}/calendar/${calendar.code}`;
        setMetaTags({
          ogImage: imageUrl,
          ogImageWidth: '1200',
          ogImageHeight: '630',
          twitterImage: imageUrl,
          ogUrl: calendarUrl,
        });

      } catch (error) {
        debugError('CALENDAR_DETAIL', '달력 이미지 캡처 실패', error);
        // 캡처 실패 시 기본 이미지 사용 (이미 설정됨)
      }
    }, 1000); // 렌더링 완료 대기

    return () => {
      clearTimeout(captureTimer);
    };
  }, [calendar, loading, passwordVerified]);

  // 컴포넌트 언마운트 시 타이머 정리 및 메타 태그 리셋
  useEffect(() => {
    return () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
      // 페이지를 떠날 때 기본 메타 태그로 리셋
      resetMetaTags();
    };
  }, [longPressTimer]);

  const handleDateClick = async (date: string) => {
    if (!calendar?.id) return;

    // 비밀번호가 필요한데 인증되지 않은 경우
    if (calendar.usePassword && calendar.password && !passwordVerified) {
      setShowPasswordModal(true);
      return;
    }

    // 길게 누르기 중이면 클릭 무시
    if (longPressDate === date) {
      return;
    }

    try {
      debugLog('CALENDAR_DETAIL', '날짜 클릭 - Firestore에 저장 시작 (모든 사용자에게 적용)', { 
        date, 
        calendarId: calendar.id,
      });
      
      // Firestore에 실제로 저장 (모든 사용자에게 공통으로 적용)
      const updatedAvailability = await toggleAvailability(calendar.id, date);
      
      debugLog('CALENDAR_DETAIL', 'Firestore 저장 완료', {
        date,
        availabilityId: updatedAvailability.id,
        isUnavailable: updatedAvailability.isUnavailable,
      });
      
      setSelectedDate(date);
      
      // 성공 메시지 (선택사항)
      // console.log(`날짜 ${date}가 ${updatedAvailability.isUnavailable ? '불가능' : '가능'}으로 설정되었습니다.`);
      
    } catch (err: any) {
      debugError('CALENDAR_DETAIL', 'Firestore 저장 실패', {
        error: err,
        code: err.code,
        message: err.message,
        stack: err.stack,
      });
      alert(`날짜 상태 변경에 실패했습니다: ${err.message || err.code || '알 수 없는 오류'}`);
    }
  };

  const handleLongPressStart = (date: string) => {
    if (!calendar || calendar.createdBy !== currentUser?.uid) {
      return; // 생성자만 확정일 설정 가능
    }

    debugLog('CALENDAR_DETAIL', '길게 누르기 시작', { date });
    setLongPressDate(date);

    const timer = setTimeout(() => {
      // 길게 누르면 날짜를 선택하고 장소 선택 모달 열기
      setSelectedDate(date);
      setShowAddressModal(true);
      setLongPressDate(null);
      debugLog('CALENDAR_DETAIL', '길게 누르기 완료 - 장소 선택 모달 열기', { date });
    }, 500); // 500ms 이상 누르면 장소 선택 모달 열기

    setLongPressTimer(timer);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    setLongPressDate(null);
  };

  const handleConfirmDate = async (locationOverride?: string) => {
    if (!calendar || !selectedDate) return;

    // 중복 실행 방지
    if (confirmDateInProgressRef.current) {
      debugLog('CALENDAR_DETAIL', '확정일 설정 중복 실행 방지', { 
        calendarId: calendar.id,
        date: selectedDate 
      });
      return;
    }

    // locationOverride가 있으면 사용, 없으면 selectedLocation 사용
    const location = locationOverride ? locationOverride.trim() : selectedLocation.trim();
    if (!location) {
      alert('날짜와 장소를 모두 입력해주세요.');
      return;
    }

    // 진행 중 플래그 설정
    confirmDateInProgressRef.current = true;

    try {
      debugLog('CALENDAR_DETAIL', '확정일 설정', { 
        calendarId: calendar.id, 
        date: selectedDate, 
        location,
        previousDate: calendar.confirmedDate,
        previousLocation: calendar.confirmedLocation,
        locationOverride: !!locationOverride
      });
      
      // 데이터베이스에 저장
      await setConfirmedDate(calendar.id, selectedDate, location);
      
      // 로컬 상태 업데이트 (확정일과 장소 모두 반영)
      // 새로운 객체를 생성하여 React가 변경을 감지하도록 함
      const updatedCalendar = {
        ...calendar,
        confirmedDate: selectedDate,
        confirmedLocation: location
      };
      setCalendar(updatedCalendar);
      
      // 입력 필드 초기화
      setSelectedDate(null);
      setSelectedLocation('');
      
      debugLog('CALENDAR_DETAIL', '확정일 설정 완료 - 상태 업데이트됨', {
        newDate: selectedDate,
        newLocation: location,
        calendarUpdated: updatedCalendar.confirmedDate === selectedDate && updatedCalendar.confirmedLocation === location
      });
      
      alert('약속 확정일과 장소가 설정되었습니다.');
    } catch (err: any) {
      debugError('CALENDAR_DETAIL', '확정일 설정 실패', err);
      alert(err.message || '확정일 설정에 실패했습니다.');
    } finally {
      // 진행 중 플래그 해제
      confirmDateInProgressRef.current = false;
    }
  };

  const handleCancelConfirmedDate = async () => {
    if (!calendar) return;

    if (!confirm('확정일과 장소를 취소하시겠습니까?')) {
      return;
    }

    try {
      debugLog('CALENDAR_DETAIL', '확정일 취소', { calendarId: calendar.id });
      await setConfirmedDate(calendar.id, null, null);
      // 새로운 객체를 생성하여 React가 변경을 감지하도록 함
      const updatedCalendar = {
        ...calendar,
        confirmedDate: null,
        confirmedLocation: null
      };
      setCalendar(updatedCalendar);
      alert('확정일과 장소가 취소되었습니다.');
    } catch (err: any) {
      debugError('CALENDAR_DETAIL', '확정일 취소 실패', err);
      alert(err.message || '확정일 취소에 실패했습니다.');
    }
  };

  const handleSearchAddress = () => {
    setShowAddressModal(true);
  };

  const handleSelectAddress = (address: string) => {
    setSelectedLocation(address);
    debugLog('CALENDAR_DETAIL', '주소 검색 완료', { address, hasSelectedDate: !!selectedDate });
    
    // 길게 누르기로 날짜가 이미 선택된 경우 자동으로 확정 처리
    // 중복 실행 방지를 위해 confirmDateInProgressRef 체크
    if (selectedDate && address.trim() && !confirmDateInProgressRef.current) {
      // 모달이 닫힌 후 확정 처리를 위해 약간의 지연
      // locationOverride를 사용하여 상태 업데이트 타이밍 문제 해결
      setTimeout(() => {
        // setTimeout 내부에서도 다시 체크
        if (!confirmDateInProgressRef.current) {
          handleConfirmDate(address);
        }
      }, 100);
    }
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const isDateUnavailable = (date: string): boolean => {
    // 날짜별로 관리되므로 사용자 구분 없이 모든 사용자에게 동일하게 적용
    const dateAvailability = availability.find((av) => av.date === date);
    return dateAvailability?.isUnavailable || false;
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
  
  // 각 요일별 배열 초기화
  for (let i = 0; i < 7; i++) {
    daysByWeekday[i] = [];
  }
  
  // 요일별 날짜  분류
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const weekdayIndex = date.getDay();
    daysByWeekday[weekdayIndex].push(day);
  }

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
      <div className="calendar-detail-container" ref={calendarContainerRef}>
        <div className="calendar-header">
          <div className="calendar-header-top">
            <h1>{calendar.title}</h1>
            <div className="calendar-header-actions">
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
              <button
                onClick={() => {
                  if (currentUser) {
                    navigate('/calendar/create');
                  } else {
                    navigate('/login?redirect=/calendar/create');
                  }
                }}
                className="btn btn-primary btn-create-calendar"
              >
                새 달력 만들기
              </button>
            </div>
          </div>
          <div className="calendar-info">
            <span className="code-badge">코드: {calendar.code}</span>
            <div className="confirmed-date-info">
              <span className={`confirmed-badge ${!calendar.confirmedDate ? 'undecided' : ''}`}>
                확정일: {calendar.confirmedDate || '미정'}
              </span>
              <span className={`confirmed-badge ${!calendar.confirmedLocation ? 'undecided' : ''}`}>
                장소: {calendar.confirmedLocation || '미정'}
              </span>
              {currentUser && calendar.createdBy === currentUser.uid && (calendar.confirmedDate || calendar.confirmedLocation) && (
                <button
                  onClick={handleCancelConfirmedDate}
                  className="btn btn-outline btn-small"
                  style={{ marginLeft: '0.5rem' }}
                >
                  확정 취소
                </button>
              )}
            </div>
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
            <span>불가능 (클릭하기)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color confirmed"></div>
            <span>확정일 (길게누르기)</span>
          </div>
        </div>

        {currentUser && calendar.createdBy === currentUser.uid && (
          <div className="confirm-date-section">
            <h3>약속 확정일 및 장소 설정</h3>
            <div className="confirm-date-controls">
              <input
                type="date"
                value={selectedDate || ''}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="date-input"
                placeholder="날짜 선택"
              />
              <input
                type="text"
                value={selectedLocation}
                readOnly
                onClick={handleSearchAddress}
                className="location-input location-input-readonly"
                placeholder="주소 검색을 통해 입력해주세요 *"
              />
              <button
                onClick={() => handleConfirmDate()}
                disabled={!selectedDate || !selectedLocation.trim()}
                className="btn btn-primary"
              >
                확정하기
              </button>
            </div>
          </div>
        )}

        <div className="calendar-actions">
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

      <AddressSearchModal
        isOpen={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        onSelectAddress={handleSelectAddress}
      />
    </div>
  );
}

