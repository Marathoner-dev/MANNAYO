import { useRef, type CSSProperties, type PointerEvent } from 'react';
import type { Profile } from '../../types';
import {
  WEEKDAY_LABELS,
  describeBusy,
  describeBusyCompact,
  monthMatrix,
  toDateKey,
  type BusyIndex,
  type DayBusy,
} from '../../utils/schedule';

interface MonthGridProps {
  year: number;
  month: number;
  todayKey: string;
  selectedDate: string | null;
  confirmedDate: string | null;
  profiles: Profile[];
  index: BusyIndex;
  myProfileId: string | null;
  /** 칠하기 모드: 누르거나 드래그한 날짜를 "종일 안 됨" ↔ "가능"으로 바꾼다 */
  paintMode: boolean;
  /** 칸 하나에 보여줄 최대 인원 (넘치면 +N) */
  maxChips: number;
  onSelect: (date: string) => void;
  onPaint: (date: string, busy: DayBusy | null) => void;
}

interface Stroke {
  target: DayBusy | null;
  seen: Set<string>;
}

const ALL_DAY: DayBusy = { kind: 'allDay' };

export function MonthGrid({
  year,
  month,
  todayKey,
  selectedDate,
  confirmedDate,
  profiles,
  index,
  myProfileId,
  paintMode,
  maxChips,
  onSelect,
  onPaint,
}: MonthGridProps) {
  const strokeRef = useRef<Stroke | null>(null);

  const paintTargetFor = (date: string): DayBusy | null => {
    const mine = myProfileId ? index.get(date)?.get(myProfileId) : undefined;
    return mine?.kind === 'allDay' ? null : ALL_DAY;
  };

  const cellFrom = (el: Element | null): HTMLElement | null => {
    const cell = el?.closest<HTMLElement>('[data-date]');
    if (!cell || cell.dataset.past === 'true') return null;
    return cell;
  };

  const paintCell = (cell: HTMLElement) => {
    const stroke = strokeRef.current;
    const date = cell.dataset.date;
    if (!stroke || !date || stroke.seen.has(date)) return;
    stroke.seen.add(date);
    onPaint(date, stroke.target);
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!paintMode || e.button !== 0) return;
    const cell = cellFrom(e.target as Element);
    if (!cell?.dataset.date) return;
    e.preventDefault();
    // 칸 밖으로 끌고 나가도 pointerup을 받도록 캡처
    e.currentTarget.setPointerCapture(e.pointerId);
    strokeRef.current = { target: paintTargetFor(cell.dataset.date), seen: new Set() };
    paintCell(cell);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!strokeRef.current) return;
    const cell = cellFrom(document.elementFromPoint(e.clientX, e.clientY));
    if (cell) paintCell(cell);
  };

  const endStroke = () => {
    strokeRef.current = null;
  };

  const days = monthMatrix(year, month);

  return (
    <div className="cd-month">
      <div className="cd-weekdays" aria-hidden="true">
        {WEEKDAY_LABELS.map((label, i) => (
          <span key={label} className={i === 0 ? 'is-sun' : i === 6 ? 'is-sat' : undefined}>
            {label}
          </span>
        ))}
      </div>
      <div
        className={`cd-grid${paintMode ? ' is-painting' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
      >
        {days.map((d) => {
          const key = toDateKey(d);
          const outside = d.getMonth() !== month;
          const past = key < todayKey;
          const day = index.get(key);
          const busyList = profiles
            .filter((p) => day?.has(p.id))
            .map((p) => ({ profile: p, busy: day!.get(p.id)! }))
            .sort((a, b) => Number(b.busy.kind === 'allDay') - Number(a.busy.kind === 'allDay'));
          const allFree = profiles.length > 0 && busyList.length === 0;
          const visible = busyList.slice(0, maxChips);
          const overflow = busyList.length - visible.length;
          const dow = d.getDay();

          const classes = ['cd-cell'];
          if (outside) classes.push('is-outside');
          if (past) classes.push('is-past');
          if (key === todayKey) classes.push('is-today');
          if (key === selectedDate) classes.push('is-selected');
          if (key === confirmedDate) classes.push('is-confirmed');
          if (dow === 0) classes.push('is-sun');
          if (dow === 6) classes.push('is-sat');

          const label = `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAY_LABELS[dow]}요일, ${
            busyList.length === 0
              ? profiles.length > 0
                ? '모두 가능'
                : '입력 없음'
              : busyList.map(({ profile, busy }) => `${profile.name} ${describeBusy(busy)}`).join(', ') +
                ' 안 됨'
          }${key === confirmedDate ? ', 확정된 날' : ''}`;

          return (
            <button
              key={key}
              type="button"
              className={classes.join(' ')}
              data-date={key}
              data-past={past}
              disabled={past}
              aria-pressed={key === selectedDate}
              aria-label={label}
              onClick={(e) => {
                if (!paintMode) {
                  onSelect(key);
                } else if (e.detail === 0) {
                  // 키보드(Enter/Space)로 칠하기
                  onPaint(key, paintTargetFor(key));
                }
              }}
            >
              <span className="cd-cell-head">
                <span className="cd-daynum">{d.getDate()}</span>
                {key === confirmedDate ? (
                  <span className="cd-cell-badge">확정</span>
                ) : (
                  allFree && !past && <span className="cd-allfree" title="모두 가능" />
                )}
              </span>
              {visible.length > 0 && (
                <span className="cd-chips">
                  {visible.map(({ profile, busy }) => (
                    <span
                      key={profile.id}
                      className={`cd-chip ${busy.kind === 'allDay' ? 'is-allday' : 'is-partial'}`}
                      style={{ '--pc': profile.color } as CSSProperties}
                    >
                      <span className="cd-chip-name">{profile.name}</span>
                      {busy.kind === 'hours' && (
                        <span className="cd-chip-time">{describeBusyCompact(busy)}</span>
                      )}
                    </span>
                  ))}
                  {overflow > 0 && <span className="cd-chip-more">+{overflow}명</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
