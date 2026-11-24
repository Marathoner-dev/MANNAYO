import { useCallback, useState } from 'react';
import { MapPin, X } from '@phosphor-icons/react';
import type { ConfirmedTime } from '../../types';
import { AddressSearchModal } from '../AddressSearchModal';
import { formatDateLong, formatHourRange, type HourRange } from '../../utils/schedule';

interface ConfirmSheetProps {
  date: string;
  initialTime: ConfirmedTime | null;
  initialLocation: string | null;
  /** 그 날 모두 가능한 시간 — 한 번에 고를 수 있게 보여준다 */
  freeRanges: HourRange[];
  onClose: () => void;
  onSubmit: (time: ConfirmedTime | null, location: string | null) => Promise<void>;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

/** 약속 확정 (달력 주인 전용). 열릴 때마다 새로 마운트해서 초기값을 받는다. */
export function ConfirmSheet({
  date,
  initialTime,
  initialLocation,
  freeRanges,
  onClose,
  onSubmit,
}: ConfirmSheetProps) {
  const [allDay, setAllDay] = useState(initialTime === null);
  const [start, setStart] = useState(initialTime?.start ?? freeRanges[0]?.[0] ?? 18);
  const [end, setEnd] = useState(initialTime?.end ?? freeRanges[0]?.[1] ?? 21);
  const [location, setLocation] = useState(initialLocation ?? '');
  const [showAddress, setShowAddress] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const closeAddress = useCallback(() => setShowAddress(false), []);
  const selectAddress = useCallback((address: string) => setLocation(address), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSubmit(allDay ? null : { start, end }, location.trim() || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '확정에 실패했습니다.');
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <form
          className="modal-content cd-confirm"
          onClick={(e) => e.stopPropagation()}
          onSubmit={handleSubmit}
          aria-labelledby="cd-confirm-title"
        >
          <h2 id="cd-confirm-title">약속 확정하기</h2>
          <p className="cd-confirm-date">{formatDateLong(date)}</p>

          <div className="cd-field">
            <span className="cd-field-label">시간</span>
            <div className="cd-segmented" role="radiogroup" aria-label="시간">
              <button
                type="button"
                role="radio"
                aria-checked={allDay}
                className={allDay ? 'is-on' : ''}
                onClick={() => setAllDay(true)}
              >
                종일
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={!allDay}
                className={!allDay ? 'is-on' : ''}
                onClick={() => setAllDay(false)}
              >
                시간 정하기
              </button>
            </div>
          </div>

          {!allDay && (
            <>
              <div className="cd-timerange">
                <select
                  value={start}
                  aria-label="시작 시간"
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setStart(v);
                    if (end <= v) setEnd(v + 1);
                  }}
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {h}시
                    </option>
                  ))}
                </select>
                <span>부터</span>
                <select value={end} aria-label="끝 시간" onChange={(e) => setEnd(Number(e.target.value))}>
                  {HOURS.filter((h) => h > start)
                    .concat(24)
                    .map((h) => (
                      <option key={h} value={h}>
                        {h}시
                      </option>
                    ))}
                </select>
                <span>까지</span>
              </div>
              {freeRanges.length > 0 && (
                <div className="cd-free-chips">
                  {freeRanges.map(([s, e]) => (
                    <button
                      key={s}
                      type="button"
                      className={`cd-free-chip${s === start && e === end ? ' is-active' : ''}`}
                      onClick={() => {
                        setStart(s);
                        setEnd(e);
                      }}
                    >
                      모두 가능 {formatHourRange(s, e)}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="cd-field">
            <span className="cd-field-label">장소</span>
            <div className="cd-location">
              <button
                type="button"
                className={`cd-location-input${location ? '' : ' is-empty'}`}
                onClick={() => setShowAddress(true)}
              >
                <MapPin size={16} weight="bold" aria-hidden="true" />
                <span>{location || '주소 검색 (선택)'}</span>
              </button>
              {location && (
                <button
                  type="button"
                  className="btn btn-icon"
                  onClick={() => setLocation('')}
                  aria-label="장소 지우기"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>
          <p className="cd-hint">장소는 나중에 정해도 돼요. 확정하면 모든 참여자 화면에 바로 표시돼요.</p>

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              취소
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? '확정하는 중…' : '확정하기'}
            </button>
          </div>
        </form>
      </div>

      <AddressSearchModal isOpen={showAddress} onClose={closeAddress} onSelectAddress={selectAddress} />
    </>
  );
}
