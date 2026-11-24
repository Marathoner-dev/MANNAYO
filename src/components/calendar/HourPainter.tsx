import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { formatHourRange, hoursToRanges } from '../../utils/schedule';

const ROWS = [
  { label: '오전', hours: [6, 7, 8, 9, 10, 11] },
  { label: '오후', hours: [12, 13, 14, 15, 16, 17] },
  { label: '저녁', hours: [18, 19, 20, 21, 22, 23] },
];

interface HourPainterProps {
  /** 현재 저장된 "안 되는 시간" */
  hours: number[];
  color: string;
  /** 칠하기가 끝날 때마다 한 번 호출 */
  onCommit: (hours: number[]) => void;
}

/**
 * 시간 칠하기: 칸을 누르거나 드래그해서 안 되는 시간을 표시한다.
 * 드래그하는 동안은 화면에만 반영하고, 손을 떼면 저장한다.
 */
export function HourPainter({ hours, color, onCommit }: HourPainterProps) {
  const [draft, setDraft] = useState<Set<number> | null>(null);
  // 저장 직후 새 스냅샷이 오기 전까지 저장한 값을 그대로 보여준다 (깜빡임 방지)
  const [pending, setPending] = useState<{ base: number[]; set: Set<number> } | null>(null);
  const strokeRef = useRef<{ paint: boolean; set: Set<number> } | null>(null);

  const current =
    draft ?? (pending && pending.base === hours ? pending.set : new Set(hours));

  const commit = (set: Set<number>) => {
    setPending({ base: hours, set });
    onCommit([...set].sort((a, b) => a - b));
  };

  const endStroke = () => {
    const stroke = strokeRef.current;
    if (!stroke) return;
    strokeRef.current = null;
    setDraft(null);
    commit(stroke.set);
  };

  const apply = (hour: number) => {
    const stroke = strokeRef.current;
    if (!stroke) return;
    if (stroke.paint === stroke.set.has(hour)) return;
    if (stroke.paint) stroke.set.add(hour);
    else stroke.set.delete(hour);
    setDraft(new Set(stroke.set));
  };

  const hourFrom = (el: Element | null): number | null => {
    const cell = el?.closest<HTMLElement>('[data-hour]');
    return cell ? Number(cell.dataset.hour) : null;
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const hour = hourFrom(e.target as Element);
    if (hour === null) return;
    e.preventDefault();
    // 그리드 밖으로 끌고 나가도 pointerup을 받도록 캡처
    e.currentTarget.setPointerCapture(e.pointerId);
    strokeRef.current = { paint: !current.has(hour), set: new Set(current) };
    apply(hour);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!strokeRef.current) return;
    const hour = hourFrom(document.elementFromPoint(e.clientX, e.clientY));
    if (hour !== null) apply(hour);
  };

  const toggleRow = (rowHours: number[]) => {
    const next = new Set(current);
    const allBusy = rowHours.every((h) => next.has(h));
    rowHours.forEach((h) => (allBusy ? next.delete(h) : next.add(h)));
    commit(next);
  };

  const toggleOne = (hour: number) => {
    const next = new Set(current);
    if (next.has(hour)) next.delete(hour);
    else next.add(hour);
    commit(next);
  };

  const ranges = hoursToRanges(current);

  return (
    <div className="cd-hours" style={{ '--pc': color } as CSSProperties}>
      <div
        className="cd-hours-grid"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
      >
        {ROWS.map((row) => (
          <div key={row.label} className="cd-hours-row">
            <button
              type="button"
              className="cd-hours-rowlabel"
              onClick={() => toggleRow(row.hours)}
              aria-label={`${row.label} 전체 ${row.hours.every((h) => current.has(h)) ? '해제' : '안 됨으로 표시'}`}
            >
              {row.label}
            </button>
            {row.hours.map((h) => (
              <button
                key={h}
                type="button"
                data-hour={h}
                className={`cd-hour${current.has(h) ? ' is-busy' : ''}`}
                aria-pressed={current.has(h)}
                aria-label={`${h}시 ${current.has(h) ? '안 됨' : '가능'}`}
                onClick={(e) => {
                  // 마우스·터치는 pointer 이벤트로 처리, 키보드만 여기서
                  if (e.detail === 0) toggleOne(h);
                }}
              >
                {h}
              </button>
            ))}
          </div>
        ))}
      </div>
      <p className="cd-hours-readout" aria-live="polite">
        {ranges.length === 0
          ? '안 되는 시간을 누르거나 드래그해서 칠하세요'
          : `안 되는 시간 · ${ranges.map(([s, e]) => formatHourRange(s, e)).join(', ')}`}
      </p>
    </div>
  );
}
