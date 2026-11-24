import { useEffect, useState } from 'react';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';

interface MonthPickerProps {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
  onClose: () => void;
}

/** "3월 2025 ⌄"를 누르면 뜨는 연·월 선택 팝오버 */
export function MonthPicker({ year, month, onChange, onClose }: MonthPickerProps) {
  const [viewYear, setViewYear] = useState(year);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="cd-popover-backdrop" onClick={onClose} />
      <div className="cd-popover cd-monthpicker" role="dialog" aria-label="월 선택">
        <div className="cd-monthpicker-head">
          <button
            type="button"
            className="btn btn-icon"
            onClick={() => setViewYear(viewYear - 1)}
            aria-label="이전 해"
          >
            <CaretLeft size={18} weight="bold" />
          </button>
          <strong>{viewYear}년</strong>
          <button
            type="button"
            className="btn btn-icon"
            onClick={() => setViewYear(viewYear + 1)}
            aria-label="다음 해"
          >
            <CaretRight size={18} weight="bold" />
          </button>
        </div>
        <div className="cd-monthpicker-grid">
          {Array.from({ length: 12 }, (_, m) => (
            <button
              key={m}
              type="button"
              className={viewYear === year && m === month ? 'is-on' : ''}
              onClick={() => {
                onChange(viewYear, m);
                onClose();
              }}
            >
              {m + 1}월
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
