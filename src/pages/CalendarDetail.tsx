import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { findCalendarByCode, setConfirmedDate, subscribeCalendar } from '../services/calendar';
import { setDayBusy, subscribeAvailability } from '../services/availability';
import {
  clearSelectedProfileId,
  getProfileById,
  getProfilesByCalendar,
  getSelectedProfileId,
  isProfileAuthenticated,
  setSelectedProfileId,
  subscribeProfiles,
} from '../services/profile';
import { useAuth } from '../contexts/AuthContext';
import type { Availability, Calendar, ConfirmedTime, Profile } from '../types';
import { debugError, debugLog } from '../utils/debug';
import { setMetaTags, resetMetaTags } from '../utils/metaTags';
import { captureCalendarImage } from '../utils/captureCalendar';
import {
  buildBusyIndex,
  commonFreeRanges,
  findSuggestions,
  formatConfirmedTime,
  formatDateLong,
  formatDateShort,
  formatHourRange,
  fromDateKey,
  googleCalendarUrl,
  toDateKey,
  type DayBusy,
  type HourRange,
} from '../utils/schedule';
import { PasswordModal } from '../components/PasswordModal';
import { ProfileSelectModal } from '../components/ProfileSelectModal';
import { MonthGrid } from '../components/calendar/MonthGrid';
import { MonthPicker } from '../components/calendar/MonthPicker';
import { HourPainter } from '../components/calendar/HourPainter';
import { DayRoster } from '../components/calendar/DayRoster';
import { SlotFinder } from '../components/calendar/SlotFinder';
import { ConfirmSheet } from '../components/calendar/ConfirmSheet';
import './CalendarDetail.css';

const NO_HOURS: number[] = [];
const ALL_DAY: DayBusy = { kind: 'allDay' };

type MyMode = 'free' | 'allDay' | 'hours';

function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query]
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}

/** 달력 코드가 바뀌면 화면 상태를 통째로 새로 시작한다 */
export function CalendarDetail() {
  const { code } = useParams<{ code: string }>();
  return <CalendarDetailView key={code} code={(code ?? '').toUpperCase()} />;
}

function CalendarDetailView({ code }: { code: string }) {
  const navigate = useNavigate();
  const { currentUser, loading: authLoading } = useAuth();
  const [now] = useState(() => new Date());
  const todayKey = toDateKey(now);

  // ── 데이터 ──
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── 인증·프로필 ──
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);

  // ── 화면 ──
  const [viewMonth, setViewMonth] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [paintMode, setPaintMode] = useState(false);
  const [panelTab, setPanelTab] = useState<'day' | 'finder'>('day');
  const [highlight, setHighlight] = useState<{ date: string; range: HourRange } | null>(null);
  const [hourModeDate, setHourModeDate] = useState<string | null>(null);
  const [confirmDraft, setConfirmDraft] = useState<{ date: string; time: ConfirmedTime | null } | null>(
    null
  );
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [toast, setToast] = useState<{ id: number; message: string; tone: 'info' | 'error' } | null>(
    null
  );

  const boardRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const isNarrow = useMediaQuery('(max-width: 1023px)');
  const isPhone = useMediaQuery('(max-width: 640px)');

  const isOwner = !!currentUser && !!calendar && calendar.createdBy === currentUser.uid;
  const unlocked = !!calendar && (!calendar.usePassword || !calendar.password || passwordVerified);

  // 달력 불러오기 (코드로 찾기, 로그인 없이도 가능)
  useEffect(() => {
    let cancelled = false;

    findCalendarByCode(code)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setError(`코드 "${code}"에 해당하는 달력을 찾을 수 없어요.`);
          setLoading(false);
          return;
        }

        setCalendar(data);

        // 공유 미리보기 메타 태그 (이미지 캡처 전 기본값)
        const calendarUrl = `${window.location.origin}/calendar/${data.code}`;
        const previewImage = `${window.location.origin}/calendar-preview.jpg`;
        const description = `함께 약속 날짜를 정해보세요! "${data.title}" 달력에 참여하세요.`;
        setMetaTags({
          title: `${data.title} - 만나요`,
          description: `"${data.title}" 달력에 참여하여 약속 날짜를 조율해보세요.`,
          ogTitle: data.title,
          ogDescription: description,
          ogImage: previewImage,
          ogImageWidth: '1200',
          ogImageHeight: '630',
          ogType: 'website',
          ogUrl: calendarUrl,
          twitterCard: 'summary_large_image',
          twitterTitle: data.title,
          twitterDescription: description,
          twitterImage: previewImage,
        });

        const needsPassword =
          data.usePassword &&
          !!data.password &&
          localStorage.getItem(`calendar_auth_${data.id}`) !== 'true';
        if (needsPassword) setShowPasswordModal(true);
        else setPasswordVerified(true);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        debugError('CALENDAR_DETAIL', '달력 데이터 로드 실패', err);
        setError(err instanceof Error ? err.message : '달력을 불러오지 못했어요.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [code]);

  // 페이지를 떠날 때 기본 메타 태그로 되돌림
  useEffect(() => resetMetaTags, []);

  // 프로필 확인: 주인은 첫 프로필로 고정, 그 외에는 저장된 프로필을 검증하고 없으면 선택 모달
  useEffect(() => {
    if (!calendar?.id || !passwordVerified || profileChecked || authLoading) return;
    let cancelled = false;
    const calendarId = calendar.id;

    const check = async () => {
      if (isOwner) {
        const list = await getProfilesByCalendar(calendarId);
        if (cancelled) return;
        const first = [...list].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
        if (first) {
          setSelectedProfileId(calendarId, first.id);
          setSelectedProfile(first);
        } else {
          setShowProfileModal(true);
        }
        setProfileChecked(true);
        return;
      }

      const storedId = getSelectedProfileId(calendarId);
      const profile = storedId ? await getProfileById(calendarId, storedId) : null;
      if (cancelled) return;

      if (profile && (!profile.password || isProfileAuthenticated(profile.id))) {
        setSelectedProfile(profile);
      } else {
        if (storedId && !profile) clearSelectedProfileId(calendarId);
        setShowProfileModal(true);
      }
      setProfileChecked(true);
    };

    check().catch((err) => debugError('CALENDAR_DETAIL', '프로필 확인 실패', err));
    return () => {
      cancelled = true;
    };
  }, [calendar?.id, passwordVerified, profileChecked, authLoading, isOwner]);

  // 실시간 구독: 달력(확정 정보) · 프로필 · 가용성
  useEffect(() => {
    if (!calendar?.id || !unlocked) return;
    const calendarId = calendar.id;

    const unsubCalendar = subscribeCalendar(calendarId, (c) => c && setCalendar(c));
    const unsubProfiles = subscribeProfiles(calendarId, (data) => {
      // 생성 순 정렬 — 첫 프로필(주인)이 항상 앞
      setProfiles([...data].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()));
    });
    const unsubAvailability = subscribeAvailability(calendarId, setAvailability);

    return () => {
      unsubCalendar();
      unsubProfiles();
      unsubAvailability();
    };
  }, [calendar?.id, unlocked]);

  // 공유 미리보기용 달력 이미지 캡처
  useEffect(() => {
    if (!calendar?.id || !unlocked) return;
    const calendarId = calendar.id;
    const calendarCode = calendar.code;

    const timer = setTimeout(async () => {
      if (!boardRef.current) return;
      try {
        const imageUrl = await captureCalendarImage(boardRef.current, {
          width: 1200,
          height: 630,
          quality: 0.7,
          pixelRatio: 2,
          backgroundColor: '#ffffff',
        });
        setMetaTags({
          ogImage: imageUrl,
          ogImageWidth: '1200',
          ogImageHeight: '630',
          twitterImage: imageUrl,
          ogUrl: `${window.location.origin}/calendar/${calendarCode}`,
        });
        debugLog('CALENDAR_DETAIL', '달력 이미지 캡처 완료', { calendarId });
      } catch (err) {
        debugError('CALENDAR_DETAIL', '달력 이미지 캡처 실패', err);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [calendar?.id, calendar?.code, unlocked]);

  // 토스트 자동 닫힘
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  // ── 파생 데이터 ──
  const index = useMemo(() => buildBusyIndex(availability), [availability]);
  const enteredIds = useMemo(
    () => new Set(availability.filter((a) => a.isUnavailable).map((a) => a.profileId)),
    [availability]
  );
  const profileIds = useMemo(() => profiles.map((p) => p.id), [profiles]);
  const upcoming = useMemo(
    () =>
      findSuggestions({
        profileIds,
        index,
        days: 28,
        fromHour: 10,
        toHour: 22,
        minHours: 2,
        weekdays: 'all',
        now,
      }).filter((s) => s.busyIds.length === 0),
    [profileIds, index, now]
  );

  const showToast = (message: string, tone: 'info' | 'error' = 'info') =>
    setToast((prev) => ({ id: (prev?.id ?? 0) + 1, message, tone }));

  const scrollPanelIntoView = (force: boolean) => {
    if (!isNarrow) return;
    requestAnimationFrame(() => {
      const el = panelRef.current;
      if (!el) return;
      if (force || el.getBoundingClientRect().top > window.innerHeight - 96) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  };

  // ── 쓰기 ──
  const writeBusy = (date: string, busy: DayBusy | null) => {
    if (!calendar) return;
    if (!selectedProfile) {
      setShowProfileModal(true);
      return;
    }
    const profileId = selectedProfile.id;
    const stale = availability
      .filter((a) => a.date === date && a.profileId === profileId)
      .map((a) => a.id);
    setDayBusy(calendar.id, profileId, date, busy, stale).catch((err: unknown) => {
      debugError('CALENDAR_DETAIL', '일정 저장 실패', err);
      showToast(`저장하지 못했어요: ${err instanceof Error ? err.message : '알 수 없는 오류'}`, 'error');
    });
  };

  const selectDate = (date: string, range?: HourRange) => {
    const d = fromDateKey(date);
    setViewMonth({ year: d.getFullYear(), month: d.getMonth() });
    setSelectedDate(date);
    setHighlight(range ? { date, range } : null);
    setPanelTab('day');
    scrollPanelIntoView(!!range);
  };

  const moveMonth = (delta: number) => {
    const d = new Date(viewMonth.year, viewMonth.month + delta, 1);
    setViewMonth({ year: d.getFullYear(), month: d.getMonth() });
  };

  const goToday = () => {
    setViewMonth({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedDate(todayKey);
    setHighlight(null);
  };

  const handlePaint = (date: string, busy: DayBusy | null) => {
    setSelectedDate(date);
    setHighlight(null);
    writeBusy(date, busy);
  };

  const setMyMode = (mode: MyMode) => {
    const current = selectedProfile ? index.get(selectedDate)?.get(selectedProfile.id) : undefined;
    if (mode === 'hours') {
      setHourModeDate(selectedDate);
      if (current?.kind === 'allDay') writeBusy(selectedDate, null);
      return;
    }
    setHourModeDate(null);
    writeBusy(selectedDate, mode === 'allDay' ? ALL_DAY : null);
  };

  const handleConfirmSubmit = async (time: ConfirmedTime | null, location: string | null) => {
    if (!calendar || !confirmDraft) return;
    const date = confirmDraft.date;
    await setConfirmedDate(calendar.id, date, location, time);
    setCalendar({ ...calendar, confirmedDate: date, confirmedTime: time, confirmedLocation: location });
    setConfirmDraft(null);
    showToast('약속을 확정했어요');
  };

  const handleCancelConfirm = async () => {
    if (!calendar || !confirm('확정을 취소할까요? 날짜·시간·장소가 모두 지워져요.')) return;
    try {
      await setConfirmedDate(calendar.id, null, null);
      setCalendar({ ...calendar, confirmedDate: null, confirmedTime: null, confirmedLocation: null });
      showToast('확정을 취소했어요');
    } catch (err) {
      debugError('CALENDAR_DETAIL', '확정 취소 실패', err);
      showToast(err instanceof Error ? err.message : '확정을 취소하지 못했어요.', 'error');
    }
  };

  const handleShare = async () => {
    if (!calendar) return;
    const url = `${window.location.origin}/calendar/${calendar.code}`;

    // 휴대폰에서는 기본 공유 시트(카카오톡 등)를 연다
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({
          title: calendar.title,
          text: `"${calendar.title}" 언제 만날까요? 안 되는 날을 표시해 주세요.`,
          url,
        });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      showToast('링크를 복사했어요');
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (copied) showToast('링크를 복사했어요');
      else showToast(`복사하지 못했어요. 직접 복사해 주세요: ${url}`, 'error');
    }
  };

  const handlePasswordCorrect = (inputPassword: string) => {
    if (!calendar) return;
    if (calendar.password && inputPassword === calendar.password) {
      localStorage.setItem(`calendar_auth_${calendar.id}`, 'true');
      setPasswordVerified(true);
      setShowPasswordModal(false);
      setPasswordError('');
    } else {
      setPasswordError('비밀번호가 일치하지 않습니다.');
    }
  };

  const handleProfileSelect = (profile: Profile) => {
    if (!calendar) return;
    // 달력 주인은 첫 생성 프로필로 고정
    if (isOwner && profiles.length > 0 && profile.id !== profiles[0].id) return;
    setSelectedProfileId(calendar.id, profile.id);
    setSelectedProfile(profile);
    setShowProfileModal(false);
  };

  const goCreate = () =>
    navigate(currentUser ? '/calendar/create' : '/login?redirect=/calendar/create');

  // ── 화면: 로딩 / 오류 / 비밀번호 ──
  if (loading) {
    return (
      <div className="cd-page">
        <div className="cd-shell" aria-busy="true" aria-label="달력을 불러오는 중">
          <div className="cd-skel cd-skel-title" />
          <div className="cd-skel cd-skel-line" />
          <div className="cd-layout">
            <div className="cd-skel cd-skel-board" />
            <div className="cd-skel cd-skel-panel" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !calendar) {
    return (
      <div className="cd-page">
        <div className="cd-shell">
          <div className="cd-state">
            <div className="cd-state-icon" aria-hidden="true">
              🗓️
            </div>
            <h1>달력을 찾을 수 없어요</h1>
            <p>{error || '링크가 정확한지 다시 확인해 주세요.'}</p>
            {code && <p className="cd-state-code">요청한 코드 · {code}</p>}
            <button type="button" className="cd-btn cd-btn-primary" onClick={() => navigate('/')}>
              홈으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="cd-page">
        <div className="cd-shell">
          <div className="cd-state">
            <div className="cd-state-icon" aria-hidden="true">
              🔒
            </div>
            <h1>{calendar.title}</h1>
            <p>비공개 달력이에요. 비밀번호를 입력하면 볼 수 있어요.</p>
            <button
              type="button"
              className="cd-btn cd-btn-primary"
              onClick={() => setShowPasswordModal(true)}
            >
              비밀번호 입력
            </button>
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

  // ── 화면: 본문 ──
  const { year, month } = viewMonth;
  const isThisMonth = year === now.getFullYear() && month === now.getMonth();
  const selectedDay = index.get(selectedDate);
  const myBusy = selectedProfile ? selectedDay?.get(selectedProfile.id) : undefined;
  const myMode: MyMode =
    myBusy?.kind === 'allDay'
      ? 'allDay'
      : myBusy?.kind === 'hours' || hourModeDate === selectedDate
        ? 'hours'
        : 'free';
  const selectedPast = selectedDate < todayKey;
  const dayHighlight = highlight?.date === selectedDate ? highlight.range : null;
  const isConfirmedDay = selectedDate === calendar.confirmedDate;
  // 확정된 날은 확정 시간을 기본으로 강조
  const rosterHighlight: HourRange | null =
    dayHighlight ??
    (isConfirmedDay && calendar.confirmedTime
      ? [calendar.confirmedTime.start, calendar.confirmedTime.end]
      : null);
  const allDayBusy = profiles.filter((p) => selectedDay?.get(p.id)?.kind === 'allDay').length;
  const partialBusy = profiles.filter((p) => selectedDay?.get(p.id)?.kind === 'hours').length;
  const dayFree = commonFreeRanges(profileIds, selectedDay);

  const daySummary =
    profiles.length === 0
      ? '아직 참여자가 없어요'
      : allDayBusy + partialBusy === 0
        ? `${profiles.length}명 모두 종일 가능해요`
        : [
            allDayBusy > 0 && `${allDayBusy}명 종일 안 됨`,
            partialBusy > 0 && `${partialBusy}명 일부 시간 안 됨`,
            dayFree.length > 0 ? '겹치는 시간 있음' : '겹치는 시간 없음',
          ]
            .filter(Boolean)
            .join(' · ');

  const modeOptions: Array<{ value: MyMode; label: string }> = [
    { value: 'free', label: '가능' },
    { value: 'allDay', label: '종일 안 돼요' },
    { value: 'hours', label: '시간 선택' },
  ];

  return (
    <div className="cd-page">
      <div className="cd-shell">
        <header className="cd-top">
          <div className="cd-top-main">
            <h1 className="cd-title">{calendar.title}</h1>
            <div className="cd-meta">
              <span className="cd-code">#{calendar.code}</span>
              <span>참여 {profiles.length}명</span>
              {calendar.usePassword && <span>🔒 비공개</span>}
            </div>
          </div>
          <div className="cd-top-actions">
            {selectedProfile ? (
              <button
                type="button"
                className="cd-me"
                style={{ '--pc': selectedProfile.color } as CSSProperties}
                onClick={() => setShowProfileModal(true)}
                title={isOwner ? '내 프로필 (주인) · 참여자 관리' : '프로필 바꾸기'}
              >
                <span className="cd-avatar" aria-hidden="true">
                  {selectedProfile.name.charAt(0)}
                </span>
                <span className="cd-me-name">{selectedProfile.name}</span>
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </button>
            ) : (
              <button type="button" className="cd-btn" onClick={() => setShowProfileModal(true)}>
                프로필 선택
              </button>
            )}
            <button type="button" className="cd-btn cd-btn-primary" onClick={handleShare}>
              <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                <path
                  d="M10 13V3m0 0L6.5 6.5M10 3l3.5 3.5M4 11v4.5A1.5 1.5 0 005.5 17h9a1.5 1.5 0 001.5-1.5V11"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              공유
            </button>
          </div>
        </header>

        {calendar.confirmedDate ? (
          <section className="cd-banner is-confirmed" aria-label="확정된 약속">
            <div className="cd-banner-icon" aria-hidden="true">
              📌
            </div>
            <div className="cd-banner-body">
              <span className="cd-banner-eyebrow">약속 확정</span>
              <strong>
                {formatDateShort(calendar.confirmedDate)} · {formatConfirmedTime(calendar.confirmedTime)}
              </strong>
              <span>{calendar.confirmedLocation ? `📍 ${calendar.confirmedLocation}` : '장소 미정'}</span>
            </div>
            <div className="cd-banner-actions">
              <a
                className="cd-btn"
                href={googleCalendarUrl({
                  title: calendar.title,
                  date: calendar.confirmedDate,
                  time: calendar.confirmedTime,
                  location: calendar.confirmedLocation,
                  details: `${window.location.origin}/calendar/${calendar.code}`,
                })}
                target="_blank"
                rel="noreferrer"
              >
                캘린더에 추가
              </a>
              {isOwner && (
                <>
                  <button
                    type="button"
                    className="cd-btn"
                    onClick={() =>
                      setConfirmDraft({ date: calendar.confirmedDate!, time: calendar.confirmedTime })
                    }
                  >
                    변경
                  </button>
                  <button type="button" className="cd-btn cd-btn-danger" onClick={handleCancelConfirm}>
                    확정 취소
                  </button>
                </>
              )}
            </div>
          </section>
        ) : (
          <section className="cd-banner" aria-label="진행 상황">
            {profiles.length > 0 && (
              <div className="cd-avatars" aria-hidden="true">
                {profiles.slice(0, 5).map((p) => (
                  <span key={p.id} className="cd-avatar" style={{ '--pc': p.color } as CSSProperties}>
                    {p.name.charAt(0)}
                  </span>
                ))}
                {profiles.length > 5 && <span className="cd-avatar is-more">+{profiles.length - 5}</span>}
              </div>
            )}
            <div className="cd-banner-body">
              {profiles.length === 0 ? (
                <>
                  <strong>친구들을 초대해 보세요</strong>
                  <span>링크를 받은 사람은 각자 안 되는 날과 시간을 표시할 수 있어요.</span>
                </>
              ) : upcoming.length > 0 ? (
                <>
                  <strong>
                    앞으로 4주 동안 모두 되는 날 {new Set(upcoming.map((s) => s.date)).size}일
                  </strong>
                  <span>
                    가장 빠른 날 · {formatDateShort(upcoming[0].date)}{' '}
                    {formatHourRange(upcoming[0].start, upcoming[0].end)}
                  </span>
                </>
              ) : (
                <>
                  <strong>앞으로 4주 동안 모두 되는 날이 아직 없어요</strong>
                  <span>시간 찾기에서 조건을 바꾸거나, 한 명 빠지는 시간을 확인해 보세요.</span>
                </>
              )}
            </div>
            <div className="cd-banner-actions">
              {profiles.length === 0 ? (
                <button type="button" className="cd-btn cd-btn-primary" onClick={handleShare}>
                  링크 공유
                </button>
              ) : (
                <button
                  type="button"
                  className="cd-btn cd-btn-primary"
                  onClick={() => {
                    setPanelTab('finder');
                    scrollPanelIntoView(true);
                  }}
                >
                  ✨ 모두 되는 시간 찾기
                </button>
              )}
            </div>
          </section>
        )}

        <div className="cd-layout">
          <section className="cd-board" ref={boardRef} aria-label="달력">
            <div className="cd-board-head">
              <div className="cd-month-title-wrap">
                <button
                  type="button"
                  className="cd-month-title"
                  onClick={() => setMonthPickerOpen(true)}
                  aria-haspopup="dialog"
                  aria-expanded={monthPickerOpen}
                >
                  <strong>{month + 1}월</strong>
                  <span>{year}</span>
                  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                    <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </button>
                {monthPickerOpen && (
                  <MonthPicker
                    year={year}
                    month={month}
                    onChange={(y, m) => setViewMonth({ year: y, month: m })}
                    onClose={() => setMonthPickerOpen(false)}
                  />
                )}
              </div>
              <div className="cd-nav">
                <button
                  type="button"
                  className="cd-circle-btn"
                  onClick={() => moveMonth(-1)}
                  aria-label="이전 달"
                >
                  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                    <path d="M12 5l-5 5 5 5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="cd-today-btn"
                  onClick={goToday}
                  disabled={isThisMonth && selectedDate === todayKey}
                >
                  오늘
                </button>
                <button
                  type="button"
                  className="cd-circle-btn"
                  onClick={() => moveMonth(1)}
                  aria-label="다음 달"
                >
                  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                    <path d="M8 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="cd-toolbar">
              <div className="cd-segmented" role="radiogroup" aria-label="달력 모드">
                <button
                  type="button"
                  role="radio"
                  aria-checked={!paintMode}
                  className={!paintMode ? 'is-on' : ''}
                  onClick={() => setPaintMode(false)}
                >
                  날짜 보기
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={paintMode}
                  className={paintMode ? 'is-on' : ''}
                  onClick={() => {
                    setPaintMode(true);
                    if (!selectedProfile) setShowProfileModal(true);
                  }}
                >
                  🖌 안 되는 날 칠하기
                </button>
              </div>
              <div className="cd-legend" aria-hidden="true">
                <span>
                  <i className="is-allday" />
                  종일 안 됨
                </span>
                <span>
                  <i className="is-partial" />
                  일부 시간
                </span>
                <span>
                  <i className="is-free" />
                  모두 가능
                </span>
              </div>
            </div>

            {paintMode && (
              <p
                className="cd-paint-hint"
                style={{ '--pc': selectedProfile?.color ?? 'var(--accent)' } as CSSProperties}
              >
                {selectedProfile ? (
                  <>
                    누르거나 드래그해서 <b>{selectedProfile.name}</b>님이 <b>종일 안 되는 날</b>을
                    칠하세요. 다시 누르면 지워져요. 시간 단위는 날짜 보기에서 고를 수 있어요.
                  </>
                ) : (
                  '먼저 프로필을 선택해 주세요.'
                )}
              </p>
            )}

            <MonthGrid
              year={year}
              month={month}
              todayKey={todayKey}
              selectedDate={selectedDate}
              confirmedDate={calendar.confirmedDate}
              profiles={profiles}
              index={index}
              myProfileId={selectedProfile?.id ?? null}
              paintMode={paintMode}
              maxChips={isPhone ? 2 : 3}
              onSelect={(date) => selectDate(date)}
              onPaint={handlePaint}
            />
          </section>

          <aside className="cd-panel" ref={panelRef} aria-label="상세">
            <div className="cd-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={panelTab === 'day'}
                className={panelTab === 'day' ? 'is-on' : ''}
                onClick={() => setPanelTab('day')}
              >
                날짜 상세
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={panelTab === 'finder'}
                className={panelTab === 'finder' ? 'is-on' : ''}
                onClick={() => setPanelTab('finder')}
              >
                ✨ 시간 찾기
              </button>
            </div>

            {panelTab === 'finder' ? (
              <SlotFinder
                profiles={profiles}
                index={index}
                enteredIds={enteredIds}
                now={now}
                onPick={(s) => selectDate(s.date, [s.start, s.end])}
              />
            ) : (
              <div className="cd-day">
                <div className="cd-day-head">
                  <div>
                    <h2 className="cd-day-title">{formatDateLong(selectedDate)}</h2>
                    <p className="cd-day-sub">{daySummary}</p>
                  </div>
                  {isConfirmedDay && (
                    <span className="cd-pill is-success">확정된 날</span>
                  )}
                </div>

                <section className="cd-card">
                  <div className="cd-card-head">
                    <h3>내 일정</h3>
                    {selectedProfile && (
                      <span
                        className="cd-mine-who"
                        style={{ '--pc': selectedProfile.color } as CSSProperties}
                      >
                        <span className="cd-dot" aria-hidden="true" />
                        {selectedProfile.name}
                      </span>
                    )}
                  </div>
                  {selectedPast ? (
                    <p className="cd-hint">지난 날짜는 바꿀 수 없어요.</p>
                  ) : selectedProfile ? (
                    <>
                      <div className="cd-segmented is-wide" role="radiogroup" aria-label="내 상태">
                        {modeOptions.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            role="radio"
                            aria-checked={myMode === opt.value}
                            className={`${myMode === opt.value ? 'is-on' : ''} is-${opt.value}`}
                            onClick={() => setMyMode(opt.value)}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      {myMode === 'hours' && (
                        <HourPainter
                          key={selectedDate}
                          hours={myBusy?.kind === 'hours' ? myBusy.hours : NO_HOURS}
                          color={selectedProfile.color}
                          onCommit={(hours) =>
                            writeBusy(selectedDate, hours.length > 0 ? { kind: 'hours', hours } : null)
                          }
                        />
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      className="cd-btn cd-btn-primary cd-btn-block"
                      onClick={() => setShowProfileModal(true)}
                    >
                      프로필 선택하고 내 일정 표시하기
                    </button>
                  )}
                </section>

                <section className="cd-card">
                  <div className="cd-card-head">
                    <h3>누가 안 되나요</h3>
                    {profiles.length > 0 && (
                      <span className="cd-card-sub">
                        {allDayBusy + partialBusy}/{profiles.length}명 안 됨
                      </span>
                    )}
                  </div>
                  {profiles.length === 0 ? (
                    <p className="cd-hint">링크를 공유하면 참여자가 여기에 나타나요.</p>
                  ) : (
                    <DayRoster
                      profiles={profiles}
                      day={selectedDay}
                      myProfileId={selectedProfile?.id ?? null}
                      enteredIds={enteredIds}
                      highlight={rosterHighlight}
                      onPickRange={(range) => setHighlight({ date: selectedDate, range })}
                    />
                  )}
                </section>

                {/* 확정된 날에는 배너의 "변경"을 쓰고, 다른 시간을 고른 경우에만 다시 확정 버튼을 보인다 */}
                {isOwner && !selectedPast && (!isConfirmedDay || dayHighlight) && (
                  <button
                    type="button"
                    className="cd-btn cd-btn-primary cd-btn-block cd-btn-lg"
                    onClick={() =>
                      setConfirmDraft({
                        date: selectedDate,
                        time: dayHighlight ? { start: dayHighlight[0], end: dayHighlight[1] } : null,
                      })
                    }
                  >
                    {dayHighlight
                      ? `${formatHourRange(dayHighlight[0], dayHighlight[1])} · 이 시간으로 확정하기`
                      : '이 날로 약속 확정하기'}
                  </button>
                )}
              </div>
            )}
          </aside>
        </div>

        <footer className="cd-footer">
          <button type="button" className="cd-link-btn" onClick={() => navigate('/')}>
            {currentUser ? '← 내 달력 목록' : '← 홈으로'}
          </button>
          <button type="button" className="cd-link-btn" onClick={goCreate}>
            새 달력 만들기
          </button>
        </footer>
      </div>

      {confirmDraft && (
        <ConfirmSheet
          date={confirmDraft.date}
          initialTime={confirmDraft.time}
          initialLocation={calendar.confirmedLocation}
          freeRanges={commonFreeRanges(profileIds, index.get(confirmDraft.date))}
          onClose={() => setConfirmDraft(null)}
          onSubmit={handleConfirmSubmit}
        />
      )}

      <ProfileSelectModal
        isOpen={showProfileModal}
        calendarId={calendar.id}
        calendarTitle={calendar.title}
        onSelect={handleProfileSelect}
        onClose={selectedProfile ? () => setShowProfileModal(false) : undefined}
        isOwner={isOwner}
        onProfileDeleted={(deletedId) => {
          if (selectedProfile?.id === deletedId) {
            clearSelectedProfileId(calendar.id);
            setSelectedProfile(null);
          }
        }}
      />

      {toast && (
        <div key={toast.id} className={`cd-toast is-${toast.tone}`} role="status">
          {toast.message}
        </div>
      )}
    </div>
  );
}
