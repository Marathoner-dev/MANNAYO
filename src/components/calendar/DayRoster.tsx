import type { CSSProperties } from 'react';
import { Check } from '@phosphor-icons/react';
import type { Profile } from '../../types';
import {
  VIEW_END_HOUR,
  VIEW_HOURS,
  VIEW_START_HOUR,
  commonFreeRanges,
  describeBusy,
  formatHourRange,
  isBusyAt,
  type DayBusy,
  type HourRange,
} from '../../utils/schedule';

interface DayRosterProps {
  profiles: Profile[];
  day: Map<string, DayBusy> | undefined;
  myProfileId: string | null;
  /** 아직 아무 날짜도 표시하지 않은 사람 */
  enteredIds: Set<string>;
  /** 추천에서 고른 구간 강조 */
  highlight: HourRange | null;
  onPickRange?: (range: HourRange) => void;
}

const AXIS_TICKS = [6, 9, 12, 15, 18, 21];

/**
 * 하루 현황: 사람별 시간 막대 + 모두 가능한 시간
 * 안 되는 사람이 먼저 오도록 정렬한다.
 */
export function DayRoster({
  profiles,
  day,
  myProfileId,
  enteredIds,
  highlight,
  onPickRange,
}: DayRosterProps) {
  const sorted = profiles
    .map((p, order) => {
      const busy = day?.get(p.id);
      // 종일 불가 → 일부 불가 → 가능 순
      const rank = !busy ? 2 : busy.kind === 'allDay' ? 0 : 1;
      return { profile: p, busy, order, rank };
    })
    .sort((a, b) => a.rank - b.rank || a.order - b.order);
  const highlighted = new Set(
    highlight ? VIEW_HOURS.filter((h) => h >= highlight[0] && h < highlight[1]) : []
  );
  const free = commonFreeRanges(
    profiles.map((p) => p.id),
    day
  );
  const span = VIEW_END_HOUR - VIEW_START_HOUR;

  return (
    <div className="cd-roster">
      <div className="cd-roster-axis" aria-hidden="true">
        {AXIS_TICKS.map((h) => (
          <span key={h} style={{ left: `${((h - VIEW_START_HOUR) / span) * 100}%` }}>
            {h}
          </span>
        ))}
        <span style={{ left: '100%' }}>24</span>
      </div>

      <ul className="cd-roster-list">
        {sorted.map(({ profile, busy }) => {
          const status = !busy ? 'free' : busy.kind === 'allDay' ? 'allday' : 'partial';
          return (
            <li
              key={profile.id}
              className={`cd-roster-row is-${status}`}
              style={{ '--pc': profile.color } as CSSProperties}
            >
              <div className="cd-roster-who">
                <span className="cd-avatar" aria-hidden="true">
                  {profile.name.charAt(0)}
                </span>
                <span className="cd-roster-name">
                  {profile.name}
                  {profile.id === myProfileId && <span className="cd-me-tag">나</span>}
                </span>
                <span className="cd-roster-status">
                  {!busy
                    ? enteredIds.has(profile.id)
                      ? '가능'
                      : '가능 · 아직 미입력'
                    : `${describeBusy(busy)} 안 돼요`}
                </span>
              </div>
              <div className="cd-bar" aria-hidden="true">
                {VIEW_HOURS.map((h) => (
                  <span
                    key={h}
                    className={`${isBusyAt(busy, h) ? 'is-busy' : ''}${highlighted.has(h) ? ' is-hl' : ''}`}
                  />
                ))}
              </div>
            </li>
          );
        })}

        {profiles.length > 0 && (
          <li className="cd-roster-row is-summary">
            <div className="cd-roster-who">
              <span className="cd-avatar is-all" aria-hidden="true">
                <Check size={14} weight="bold" />
              </span>
              <span className="cd-roster-name">모두 가능</span>
              <span className="cd-roster-status">
                {free.length === 0 ? '겹치는 시간이 없어요' : `${free.length}개 구간`}
              </span>
            </div>
            <div className="cd-bar" aria-hidden="true">
              {VIEW_HOURS.map((h) => (
                <span
                  key={h}
                  className={`${free.some(([s, e]) => h >= s && h < e) ? 'is-free' : ''}${highlighted.has(h) ? ' is-hl' : ''}`}
                />
              ))}
            </div>
            {free.length > 0 && (
              <div className="cd-free-chips">
                {free.map(([s, e]) => (
                  <button
                    key={s}
                    type="button"
                    className={`cd-free-chip${highlight && highlight[0] === s && highlight[1] === e ? ' is-active' : ''}`}
                    onClick={() => onPickRange?.([s, e])}
                  >
                    {formatHourRange(s, e)}
                    <span>{e - s}시간</span>
                  </button>
                ))}
              </div>
            )}
          </li>
        )}
      </ul>
    </div>
  );
}
