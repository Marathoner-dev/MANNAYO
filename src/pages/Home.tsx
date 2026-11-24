import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarBlank,
  CalendarCheck,
  Clock,
  Hash,
  LockSimple,
  MapPin,
  Plus,
  Trash,
} from '@phosphor-icons/react';
import { getCalendars, deleteCalendar } from '../services/calendar';
import { useAuth } from '../contexts/AuthContext';
import type { Calendar } from '../types';
import { debugLog, debugError } from '../utils/debug';
import { formatConfirmedTime, formatDateShort } from '../utils/schedule';
import './Home.css';
import './HomeLanding.css';

/** 실제 화면 캡처 (라이트/다크 테마에 맞춰 바꿔 보여줌) */
function ThemedShot({ name, alt, width, height }: { name: string; alt: string; width: number; height: number }) {
  return (
    <picture>
      <source srcSet={`/landing/${name}-dark.webp`} media="(prefers-color-scheme: dark)" />
      <img src={`/landing/${name}-light.webp`} alt={alt} width={width} height={height} loading="lazy" />
    </picture>
  );
}

function Landing() {
  return (
    <div className="landing">
      <section className="landing-hero">
        <div className="landing-copy">
          <h1>
            다 같이 되는 날,
            <br />
            링크 하나로 찾아요
          </h1>
          <p>
            안 되는 날과 시간만 칠하면 모두 되는 시간을 찾아 드려요. 친구들은 가입 없이 링크로
            참여해요.
          </p>
          <Link to="/login?redirect=/calendar/create" className="btn btn-primary btn-lg">
            달력 만들기
            <ArrowRight size={18} weight="bold" />
          </Link>
        </div>
        <div className="landing-shot">
          <ThemedShot
            name="hero"
            alt="달력에 친구별로 안 되는 날이 표시되고, 오른쪽에 하루 현황이 보이는 만나요 화면"
            width={1240}
            height={556}
          />
        </div>
      </section>

      <section className="landing-features" aria-label="주요 기능">
        <article className="feature feature-wide">
          <div className="feature-text">
            <h2>누가 안 되는지 바로 보여요</h2>
            <p>달력 칸마다 안 되는 사람 이름이 색으로 표시돼요. 종일인지 몇 시만 안 되는지도 구분돼요.</p>
          </div>
          <div className="feature-shot">
            <ThemedShot name="chips" alt="날짜 칸에 친구 이름이 색깔 칩으로 표시된 달력" width={1600} height={506} />
          </div>
        </article>
        <article className="feature">
          <div className="feature-text">
            <h2>시간까지 칠해요</h2>
            <p>오전·오후·저녁을 한 번에, 또는 드래그로 원하는 시간만 골라요.</p>
          </div>
          <div className="feature-shot">
            <ThemedShot name="hours" alt="안 되는 시간을 칠하는 시간표" width={764} height={573} />
          </div>
        </article>
        <article className="feature">
          <div className="feature-text">
            <h2>모두 되는 시간을 찾아 드려요</h2>
            <p>기간과 시간대만 고르면 빠른 날부터 추천해요.</p>
          </div>
          <div className="feature-shot">
            <ThemedShot name="finder" alt="모두 되는 시간 추천 목록" width={764} height={785} />
          </div>
        </article>
      </section>
    </div>
  );
}

export function Home() {
  const { currentUser } = useAuth();
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 달력 리스트 로드
  useEffect(() => {
    if (!currentUser) return;

    const loadCalendars = async () => {
      try {
        setLoading(true);
        const data = await getCalendars();
        setCalendars(data);
        debugLog('HOME', '달력 리스트 로드 완료', { count: data.length });
      } catch (err) {
        debugError('HOME', '달력 리스트 로드 실패', err);
        setError(err instanceof Error ? err.message : '달력 목록을 불러오지 못했어요.');
      } finally {
        setLoading(false);
      }
    };

    loadCalendars();
  }, [currentUser]);

  const handleDelete = async (calendarId: string, calendarTitle: string) => {
    if (!confirm(`"${calendarTitle}" 달력을 삭제할까요?\n표시한 일정도 모두 사라져요.`)) {
      return;
    }

    try {
      await deleteCalendar(calendarId);
      setCalendars(calendars.filter((cal) => cal.id !== calendarId));
    } catch (err) {
      debugError('HOME', '달력 삭제 실패', err);
      setError(err instanceof Error ? err.message : '달력을 삭제하지 못했어요.');
    }
  };

  if (!currentUser) {
    return <Landing />;
  }

  return (
    <div className="home">
      <div className="home-inner">
        <header className="home-head">
          <div>
            <h1>내 달력</h1>
            <p>{loading ? '불러오는 중' : `${calendars.length}개의 달력`}</p>
          </div>
          <div className="home-head-actions">
            <Link to="/calendar/join" className="btn btn-outline">
              <Hash size={18} weight="bold" />
              코드로 참여
            </Link>
            <Link to="/calendar/create" className="btn btn-primary">
              <Plus size={18} weight="bold" />새 달력
            </Link>
          </div>
        </header>

        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <ul className="cal-grid" aria-busy="true" aria-label="달력 목록을 불러오는 중">
            {[0, 1, 2].map((i) => (
              <li key={i} className="skeleton cal-card-skeleton" />
            ))}
          </ul>
        ) : calendars.length === 0 ? (
          <div className="home-empty">
            <span className="home-empty-icon" aria-hidden="true">
              <CalendarBlank size={28} />
            </span>
            <h2>아직 달력이 없어요</h2>
            <p>달력을 만들고 링크를 보내면 친구들이 안 되는 날을 표시해 줘요.</p>
            <Link to="/calendar/create" className="btn btn-primary">
              <Plus size={18} weight="bold" />새 달력
            </Link>
          </div>
        ) : (
          <ul className="cal-grid">
            {calendars.map((calendar) => (
              <li key={calendar.id} className="cal-card">
                <Link to={`/calendar/${calendar.code}`} className="cal-card-link">
                  <span className="cal-card-code">
                    #{calendar.code}
                    {calendar.usePassword && <LockSimple size={14} weight="bold" aria-label="비공개" />}
                  </span>
                  <h3>{calendar.title}</h3>
                  {calendar.confirmedDate ? (
                    <span className="cal-card-status is-confirmed">
                      <CalendarCheck size={18} weight="fill" />
                      {formatDateShort(calendar.confirmedDate)} ·{' '}
                      {formatConfirmedTime(calendar.confirmedTime)}
                    </span>
                  ) : (
                    <span className="cal-card-status">
                      <Clock size={18} />
                      날짜 조율 중
                    </span>
                  )}
                  {calendar.confirmedLocation && (
                    <span className="cal-card-place">
                      <MapPin size={16} />
                      {calendar.confirmedLocation}
                    </span>
                  )}
                </Link>
                {calendar.createdBy === currentUser.uid && (
                  <button
                    type="button"
                    onClick={() => handleDelete(calendar.id, calendar.title)}
                    className="btn btn-icon cal-card-delete"
                    aria-label={`${calendar.title} 삭제`}
                  >
                    <Trash size={18} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
