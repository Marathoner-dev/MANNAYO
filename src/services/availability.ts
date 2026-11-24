import {
  collection,
  doc,
  onSnapshot,
  query,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Availability } from '../types';
import { availabilityDocId, type DayBusy } from '../utils/schedule';
import { debugLog, debugError } from '../utils/debug';

function toAvailability(id: string, calendarId: string, data: DocumentData): Availability {
  return {
    id,
    calendarId, // 서브컬렉션이므로 calendarId는 부모에서 가져옴
    date: data.date,
    profileId: data.profileId || '',
    isUnavailable: !!data.isUnavailable,
    busyHours: Array.isArray(data.busyHours) ? data.busyHours : null,
    updatedAt: (data.updatedAt ?? data.createdAt)?.toDate?.() ?? new Date(0),
  };
}

/**
 * 한 사람의 하루 상태 저장
 * - busy가 null이면 "가능" → 문서 삭제
 * - 문서 ID는 `${date}_${profileId}`로 고정해서 조회 없이 바로 쓴다 (로컬 스냅샷이 즉시 반영됨)
 * - staleDocIds: 같은 (날짜, 프로필)의 예전 랜덤 ID 문서 — 함께 지워서 중복을 없앤다
 */
export async function setDayBusy(
  calendarId: string,
  profileId: string,
  date: string,
  busy: DayBusy | null,
  staleDocIds: string[] = []
): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`잘못된 날짜 형식입니다: ${date}`);
  }
  if (!profileId) {
    throw new Error('프로필이 선택되지 않았습니다.');
  }

  const availabilityRef = collection(db, 'calendars', calendarId, 'availability');
  const canonicalId = availabilityDocId(date, profileId);
  const batch = writeBatch(db);

  for (const id of staleDocIds) {
    if (id !== canonicalId) batch.delete(doc(availabilityRef, id));
  }

  const canonicalRef = doc(availabilityRef, canonicalId);
  if (busy === null) {
    batch.delete(canonicalRef);
  } else {
    batch.set(canonicalRef, {
      date,
      profileId,
      isUnavailable: true,
      busyHours: busy.kind === 'hours' ? busy.hours : null,
      updatedAt: new Date(),
    });
  }

  debugLog('AVAILABILITY', 'setDayBusy', { calendarId, profileId, date, busy, staleDocIds });

  try {
    await batch.commit();
  } catch (error) {
    debugError('AVAILABILITY', 'setDayBusy 실패', error);
    throw error;
  }
}

/**
 * 특정 달력의 가용성 데이터 실시간 구독
 */
export function subscribeAvailability(
  calendarId: string,
  callback: (availability: Availability[]) => void
): () => void {
  const availabilityRef = collection(db, 'calendars', calendarId, 'availability');

  return onSnapshot(
    query(availabilityRef),
    (querySnapshot) => {
      const availability = querySnapshot.docs.map((d) =>
        toAvailability(d.id, calendarId, d.data())
      );
      debugLog('AVAILABILITY', '가용성 변경 감지', {
        calendarId,
        count: availability.length,
        hasPendingWrites: querySnapshot.metadata.hasPendingWrites,
      });
      callback(availability);
    },
    (error) => {
      debugError('AVAILABILITY', '가용성 데이터 변경 감지 에러', error);
    }
  );
}
