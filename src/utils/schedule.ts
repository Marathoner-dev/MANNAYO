/**
 * 일정(가용성) 계산 유틸리티
 *
 * - 날짜 키: 로컬 시간대 기준 `YYYY-MM-DD`
 * - 시간 단위: 1시간 (0~23시). 범위는 [start, end) — end는 포함하지 않음
 * - 가용성 문서가 없으면 그 날은 "가능"으로 본다
 */
import type { Availability, ConfirmedTime } from '../types';

/** 화면에 보여주는 시간 범위 (06:00 ~ 24:00) */
export const VIEW_START_HOUR = 6;
export const VIEW_END_HOUR = 24;
export const VIEW_HOURS = Array.from(
  { length: VIEW_END_HOUR - VIEW_START_HOUR },
  (_, i) => VIEW_START_HOUR + i
);

export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

/** 한 사람의 하루 상태. 맵에 없으면 가능 */
export type DayBusy = { kind: 'allDay' } | { kind: 'hours'; hours: number[] };

/** date → profileId → DayBusy */
export type BusyIndex = Map<string, Map<string, DayBusy>>;

export type HourRange = [start: number, end: number];

// ───────────────────────── 날짜 ─────────────────────────

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** 일요일 시작 달력 칸 — 앞뒤 달 날짜 포함, 주 단위로 채움 */
export function monthMatrix(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = Math.ceil((first.getDay() + daysInMonth) / 7);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
}

/** "3월 14일 (금)" */
export function formatDateShort(key: string): string {
  const d = fromDateKey(key);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY_LABELS[d.getDay()]})`;
}

/** "2025. 3. 14. 금요일" */
export function formatDateLong(key: string): string {
  const d = fromDateKey(key);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${WEEKDAY_LABELS[d.getDay()]}요일`;
}

// ───────────────────────── 시간 ─────────────────────────

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/** "14:00–18:00" */
export function formatHourRange(start: number, end: number): string {
  return `${formatHour(start)}–${formatHour(end)}`;
}

/** 달력 칸처럼 좁은 곳용: "14–18시" */
export function formatHourRangeCompact(start: number, end: number): string {
  return `${start}–${end}시`;
}

/** 정렬·중복 제거된 시간 목록을 연속 구간으로 묶음: [9,10,11,14] → [[9,12],[14,15]] */
export function hoursToRanges(hours: Iterable<number>): HourRange[] {
  const sorted = [...new Set(hours)].sort((a, b) => a - b);
  const ranges: HourRange[] = [];
  for (const h of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && last[1] === h) {
      last[1] = h + 1;
    } else {
      ranges.push([h, h + 1]);
    }
  }
  return ranges;
}

export function isBusyAt(busy: DayBusy | undefined, hour: number): boolean {
  if (!busy) return false;
  return busy.kind === 'allDay' || busy.hours.includes(hour);
}

/** "종일" | "14:00–18:00, 20:00–22:00" */
export function describeBusy(busy: DayBusy): string {
  if (busy.kind === 'allDay') return '종일';
  return hoursToRanges(busy.hours)
    .map(([s, e]) => formatHourRange(s, e))
    .join(', ');
}

export function describeBusyCompact(busy: DayBusy): string {
  if (busy.kind === 'allDay') return '종일';
  return hoursToRanges(busy.hours)
    .map(([s, e]) => formatHourRangeCompact(s, e))
    .join(', ');
}

export function formatConfirmedTime(time: ConfirmedTime | null): string {
  return time ? formatHourRange(time.start, time.end) : '종일';
}

// ───────────────────────── 가용성 인덱스 ─────────────────────────

/** (날짜, 프로필) 조합의 정규 문서 ID */
export function availabilityDocId(date: string, profileId: string): string {
  return `${date}_${profileId}`;
}

function normalizeHours(hours: number[] | null): number[] {
  if (!hours) return [];
  return [...new Set(hours.filter((h) => Number.isInteger(h) && h >= 0 && h < 24))].sort(
    (a, b) => a - b
  );
}

/**
 * 가용성 문서 → 날짜·프로필별 상태
 * 같은 (날짜, 프로필)에 문서가 여러 개면(예전 랜덤 ID 문서) 정규 ID 문서, 없으면 가장 최근 문서를 쓴다.
 */
export function buildBusyIndex(availability: Availability[]): BusyIndex {
  const chosen = new Map<string, Availability>();
  for (const av of availability) {
    if (!av.profileId || !av.date) continue;
    const key = availabilityDocId(av.date, av.profileId);
    const prev = chosen.get(key);
    if (
      !prev ||
      av.id === key ||
      (prev.id !== key && av.updatedAt.getTime() > prev.updatedAt.getTime())
    ) {
      chosen.set(key, av);
    }
  }

  const index: BusyIndex = new Map();
  for (const av of chosen.values()) {
    if (!av.isUnavailable) continue;
    const hours = normalizeHours(av.busyHours);
    const busy: DayBusy = hours.length > 0 ? { kind: 'hours', hours } : { kind: 'allDay' };
    let day = index.get(av.date);
    if (!day) {
      day = new Map();
      index.set(av.date, day);
    }
    day.set(av.profileId, busy);
  }
  return index;
}

/** [from, to) 시간 중 모든 프로필이 가능한 구간 */
export function commonFreeRanges(
  profileIds: string[],
  day: Map<string, DayBusy> | undefined,
  from = VIEW_START_HOUR,
  to = VIEW_END_HOUR
): HourRange[] {
  const free: number[] = [];
  for (let h = from; h < to; h++) {
    if (profileIds.every((id) => !isBusyAt(day?.get(id), h))) free.push(h);
  }
  return hoursToRanges(free);
}

// ───────────────────────── 시간 추천 ─────────────────────────

export type WeekdayFilter = 'all' | 'weekday' | 'weekend';

export interface FinderOptions {
  profileIds: string[];
  index: BusyIndex;
  /** 오늘부터 며칠을 볼지 */
  days: number;
  fromHour: number;
  toHour: number;
  /** 최소 연속 시간. null이면 [fromHour, toHour) 전체가 비어야 함 */
  minHours: number | null;
  weekdays: WeekdayFilter;
  now: Date;
}

export interface Suggestion {
  date: string;
  start: number;
  end: number;
  /** 이 구간에 안 되는 사람 (비어 있으면 모두 가능) */
  busyIds: string[];
}

/**
 * 오늘부터 `days`일 동안, 안 되는 사람 구성이 같은 연속 구간을 찾는다.
 * 정렬: 안 되는 사람이 적은 순 → 빠른 날짜 → 이른 시간
 * 오늘은 지금 이후 정각부터만 본다.
 */
export function findSuggestions(opts: FinderOptions): Suggestion[] {
  const { profileIds, index, days, fromHour, toHour, minHours, weekdays, now } = opts;
  if (profileIds.length === 0 || toHour <= fromHour) return [];

  const needed = minHours ?? toHour - fromHour;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const results: Suggestion[] = [];

  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const dow = date.getDay();
    const isWeekend = dow === 0 || dow === 6;
    if (weekdays === 'weekday' && isWeekend) continue;
    if (weekdays === 'weekend' && !isWeekend) continue;

    const key = toDateKey(date);
    const day = index.get(key);
    const start = i === 0 ? Math.max(fromHour, now.getHours() + 1) : fromHour;

    let runStart = start;
    let runBusy: string[] | null = null;
    let runKey = '';

    const close = (end: number) => {
      if (runBusy && runBusy.length < profileIds.length && end - runStart >= needed) {
        results.push({ date: key, start: runStart, end, busyIds: runBusy });
      }
    };

    for (let h = start; h < toHour; h++) {
      const busy = profileIds.filter((id) => isBusyAt(day?.get(id), h));
      const k = busy.join(',');
      if (runBusy === null || k !== runKey) {
        close(h);
        runStart = h;
        runBusy = busy;
        runKey = k;
      }
    }
    close(toHour);
  }

  return results.sort(
    (a, b) =>
      a.busyIds.length - b.busyIds.length ||
      a.date.localeCompare(b.date) ||
      a.start - b.start
  );
}

// ───────────────────────── 캘린더 내보내기 ─────────────────────────

function gcalStamp(date: Date, hour: number | null): string {
  const d = hour === 24 ? addDays(date, 1) : date;
  const ymd = toDateKey(d).replaceAll('-', '');
  if (hour === null) return ymd;
  return `${ymd}T${String(hour % 24).padStart(2, '0')}0000`;
}

/** 구글 캘린더 "일정 추가" 링크 */
export function googleCalendarUrl(params: {
  title: string;
  date: string;
  time: ConfirmedTime | null;
  location: string | null;
  details: string;
}): string {
  const day = fromDateKey(params.date);
  const dates = params.time
    ? `${gcalStamp(day, params.time.start)}/${gcalStamp(day, params.time.end)}`
    : `${gcalStamp(day, null)}/${gcalStamp(addDays(day, 1), null)}`;
  const query = new URLSearchParams({
    action: 'TEMPLATE',
    text: params.title,
    dates,
    details: params.details,
    ctz: 'Asia/Seoul',
  });
  if (params.location) query.set('location', params.location);
  return `https://calendar.google.com/calendar/render?${query.toString()}`;
}
