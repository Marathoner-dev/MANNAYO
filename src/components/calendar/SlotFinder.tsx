import { useMemo, useState } from 'react';
import type { Profile } from '../../types';
import {
  WEEKDAY_LABELS,
  findSuggestions,
  formatHourRange,
  fromDateKey,
  type BusyIndex,
  type Suggestion,
  type WeekdayFilter,
} from '../../utils/schedule';

interface SlotFinderProps {
  profiles: Profile[];
  index: BusyIndex;
  enteredIds: Set<string>;
  now: Date;
  onPick: (suggestion: Suggestion) => void;
}

const PERIODS = [
  { days: 14, label: '2주' },
  { days: 28, label: '4주' },
  { days: 56, label: '8주' },
];
const MIN_HOURS: Array<{ value: number | null; label: string }> = [
  { value: 1, label: '1시간+' },
  { value: 2, label: '2시간+' },
  { value: 3, label: '3시간+' },
  { value: null, label: '시간대 전체' },
];
const WEEKDAYS: Array<{ value: WeekdayFilter; label: string }> = [
  { value: 'all', label: '모든 요일' },
  { value: 'weekday', label: '평일' },
  { value: 'weekend', label: '주말' },
];
const START_HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6~23
const PAGE = 6;

export function SlotFinder({ profiles, index, enteredIds, now, onPick }: SlotFinderProps) {
  const [days, setDays] = useState(28);
  const [fromHour, setFromHour] = useState(10);
  const [toHour, setToHour] = useState(22);
  const [minHours, setMinHours] = useState<number | null>(2);
  const [weekdays, setWeekdays] = useState<WeekdayFilter>('all');
  const [shown, setShown] = useState(PAGE);

  const suggestions = useMemo(
    () =>
      findSuggestions({
        profileIds: profiles.map((p) => p.id),
        index,
        days,
        fromHour,
        toHour,
        minHours,
        weekdays,
        now,
      }),
    [profiles, index, days, fromHour, toHour, minHours, weekdays, now]
  );

  const everyone = suggestions.filter((s) => s.busyIds.length === 0);
  const fewestBusy = suggestions.find((s) => s.busyIds.length > 0)?.busyIds.length;
  // 모두 되는 시간이 적으면 "한 명 빼고" 같은 차선책도 보여준다
  const almost =
    everyone.length < 3 && fewestBusy !== undefined
      ? suggestions.filter((s) => s.busyIds.length === fewestBusy).slice(0, 5)
      : [];
  const everyoneDays = new Set(everyone.map((s) => s.date)).size;
  const notEntered = profiles.filter((p) => !enteredIds.has(p.id));
  const nameOf = new Map(profiles.map((p) => [p.id, p.name]));

  const resetPaging = () => setShown(PAGE);

  if (profiles.length === 0) {
    return (
      <div className="cd-empty">
        <p className="cd-empty-title">아직 참여자가 없어요</p>
        <p>링크를 공유해서 친구들이 일정을 표시하면 모두 되는 시간을 찾아드려요.</p>
      </div>
    );
  }

  const renderItem = (s: Suggestion) => {
    const d = fromDateKey(s.date);
    const dow = d.getDay();
    return (
      <li key={`${s.date}-${s.start}`}>
        <button type="button" className="cd-suggestion" onClick={() => onPick(s)}>
          <span className={`cd-suggestion-date${dow === 0 ? ' is-sun' : dow === 6 ? ' is-sat' : ''}`}>
            <span>{d.getMonth() + 1}월</span>
            <strong>{d.getDate()}</strong>
            <span>{WEEKDAY_LABELS[dow]}</span>
          </span>
          <span className="cd-suggestion-body">
            <span className="cd-suggestion-time">{formatHourRange(s.start, s.end)}</span>
            <span className="cd-suggestion-meta">
              {s.end - s.start}시간
              {s.busyIds.length > 0 &&
                ` · ${s.busyIds.map((id) => nameOf.get(id)).join(', ')} 안 됨`}
            </span>
          </span>
          <span className={`cd-pill ${s.busyIds.length === 0 ? 'is-success' : 'is-warning'}`}>
            {s.busyIds.length === 0
              ? '모두 가능'
              : `${profiles.length - s.busyIds.length}/${profiles.length}명`}
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="cd-finder">
      <div className="cd-finder-controls">
        <div className="cd-field">
          <span className="cd-field-label">기간</span>
          <div className="cd-chipset" role="radiogroup" aria-label="기간">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                type="button"
                role="radio"
                aria-checked={days === p.days}
                className={`cd-toggle${days === p.days ? ' is-on' : ''}`}
                onClick={() => {
                  setDays(p.days);
                  resetPaging();
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="cd-field">
          <span className="cd-field-label">시간대</span>
          <div className="cd-timerange">
            <select
              value={fromHour}
              aria-label="시작 시간"
              onChange={(e) => {
                const v = Number(e.target.value);
                setFromHour(v);
                if (toHour <= v) setToHour(v + 1);
                resetPaging();
              }}
            >
              {START_HOURS.map((h) => (
                <option key={h} value={h}>
                  {h}시
                </option>
              ))}
            </select>
            <span>부터</span>
            <select
              value={toHour}
              aria-label="끝 시간"
              onChange={(e) => {
                setToHour(Number(e.target.value));
                resetPaging();
              }}
            >
              {START_HOURS.filter((h) => h > fromHour)
                .concat(24)
                .map((h) => (
                  <option key={h} value={h}>
                    {h}시
                  </option>
                ))}
            </select>
            <span>까지</span>
          </div>
        </div>

        <div className="cd-field">
          <span className="cd-field-label">최소</span>
          <div className="cd-chipset" role="radiogroup" aria-label="최소 시간">
            {MIN_HOURS.map((m) => (
              <button
                key={m.label}
                type="button"
                role="radio"
                aria-checked={minHours === m.value}
                className={`cd-toggle${minHours === m.value ? ' is-on' : ''}`}
                onClick={() => {
                  setMinHours(m.value);
                  resetPaging();
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="cd-field">
          <span className="cd-field-label">요일</span>
          <div className="cd-chipset" role="radiogroup" aria-label="요일">
            {WEEKDAYS.map((w) => (
              <button
                key={w.value}
                type="button"
                role="radio"
                aria-checked={weekdays === w.value}
                className={`cd-toggle${weekdays === w.value ? ' is-on' : ''}`}
                onClick={() => {
                  setWeekdays(w.value);
                  resetPaging();
                }}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`cd-finder-summary${everyone.length > 0 ? ' is-found' : ''}`} aria-live="polite">
        {everyone.length > 0 ? (
          <>
            <strong>{profiles.length}명 모두 되는 시간 {everyone.length}개</strong>
            <span>{everyoneDays}일에 걸쳐 있어요. 눌러서 그 날을 확인하세요.</span>
          </>
        ) : (
          <>
            <strong>모두 되는 시간이 없어요</strong>
            <span>기간·시간대·최소 시간을 넓혀 보세요.</span>
          </>
        )}
      </div>

      {everyone.length > 0 && (
        <ul className="cd-suggestions">{everyone.slice(0, shown).map(renderItem)}</ul>
      )}
      {everyone.length > shown && (
        <button type="button" className="cd-more" onClick={() => setShown(shown + PAGE)}>
          더 보기 ({everyone.length - shown}개 남음)
        </button>
      )}

      {almost.length > 0 && (
        <>
          <h4 className="cd-subhead">
            {fewestBusy}명만 빠지면 되는 시간
          </h4>
          <ul className="cd-suggestions">{almost.map(renderItem)}</ul>
        </>
      )}

      {notEntered.length > 0 && (
        <p className="cd-note">
          <strong>{notEntered.map((p) => p.name).join(', ')}</strong>님은 아직 안 되는 날을
          표시하지 않아서 모두 가능으로 계산했어요.
        </p>
      )}
    </div>
  );
}
