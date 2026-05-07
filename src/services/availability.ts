import {
  collection,
  addDoc,
  doc,
  getDocs,
  query,
  where,
  updateDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { auth } from './firebase';
import type { Availability } from '../types';
import { debugLog, debugError, measurePerformance } from '../utils/debug';

/**
 * 프로필별 날짜 가용성 토글
 * (calendarId, date, profileId) 조합 단위로 문서를 관리
 */
export async function toggleAvailability(
  calendarId: string,
  date: string,
  profileId: string
): Promise<Availability> {
  const normalizedDate = date.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    const error = new Error(`잘못된 날짜 형식입니다: ${date}. YYYY-MM-DD 형식이어야 합니다.`);
    debugError('AVAILABILITY', 'toggleAvailability - 날짜 형식 오류', error);
    throw error;
  }

  if (!profileId) {
    const error = new Error('프로필이 선택되지 않았습니다.');
    debugError('AVAILABILITY', 'toggleAvailability - profileId 누락', error);
    throw error;
  }

  debugLog('AVAILABILITY', 'toggleAvailability 시작', { calendarId, date: normalizedDate, profileId });

  return measurePerformance('toggleAvailability', async () => {
    try {
      const availabilityRef = collection(db, 'calendars', calendarId, 'availability');

      // (date, profileId) 조합으로 검색
      const q = query(
        availabilityRef,
        where('date', '==', normalizedDate),
        where('profileId', '==', profileId)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        debugLog('AVAILABILITY', '새 가용성 데이터 생성 (프로필별)', {
          calendarId,
          date: normalizedDate,
          profileId,
        });
        const newAvailability = {
          date: normalizedDate,
          profileId,
          isUnavailable: true,
          createdAt: new Date(),
        };

        const docRef = await addDoc(availabilityRef, newAvailability);
        debugLog('AVAILABILITY', 'Firestore 저장 완료', {
          id: docRef.id,
          calendarId,
          date: normalizedDate,
          profileId,
        });

        return {
          id: docRef.id,
          calendarId,
          ...newAvailability,
        };
      } else {
        // 기존 (date, profileId) 데이터 토글
        const availabilityDoc = querySnapshot.docs[0];
        const currentStatus = availabilityDoc.data().isUnavailable;
        const newStatus = !currentStatus;

        debugLog('AVAILABILITY', '가용성 토글 (프로필별)', {
          id: availabilityDoc.id,
          currentStatus,
          newStatus,
          calendarId,
          date: normalizedDate,
          profileId,
        });

        await updateDoc(doc(availabilityRef, availabilityDoc.id), {
          isUnavailable: newStatus,
        });

        const data = availabilityDoc.data();
        return {
          id: availabilityDoc.id,
          calendarId,
          date: data.date,
          profileId: data.profileId,
          isUnavailable: newStatus,
          createdAt: data.createdAt?.toDate() || new Date(),
        };
      }
    } catch (error) {
      debugError('AVAILABILITY', 'toggleAvailability 실패', error);
      throw error;
    }
  });
}

/**
 * 특정 달력의 가용성 데이터 조회
 */
export async function getAvailabilityByCalendar(
  calendarId: string
): Promise<Availability[]> {
  debugLog('AVAILABILITY', 'getAvailabilityByCalendar 시작', { calendarId });

  return measurePerformance('getAvailabilityByCalendar', async () => {
    const user = auth.currentUser;
    if (!user) {
      const error = new Error('로그인이 필요합니다.');
      debugError('AVAILABILITY', 'getAvailabilityByCalendar - 로그인 필요', error);
      throw error;
    }

    try {
      // 달력의 서브컬렉션으로 가용성 데이터 조회
      const availabilityRef = collection(db, 'calendars', calendarId, 'availability');
      const q = query(availabilityRef);

      const querySnapshot = await getDocs(q);
      debugLog('AVAILABILITY', '가용성 데이터 조회 결과', {
        calendarId,
        count: querySnapshot.size,
      });

      const availability: Availability[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        availability.push({
          id: doc.id,
          calendarId, // 서브컬렉션이므로 calendarId는 부모에서 가져옴
          date: data.date,
          profileId: data.profileId || '',
          isUnavailable: data.isUnavailable,
          createdAt: data.createdAt?.toDate() || new Date(),
        });
      });

      debugLog('AVAILABILITY', 'getAvailabilityByCalendar 완료', {
        calendarId,
        count: availability.length,
      });

      return availability;
    } catch (error) {
      debugError('AVAILABILITY', 'getAvailabilityByCalendar 실패', error);
      throw error;
    }
  });
}

/**
 * 특정 달력의 가용성 데이터 변경 감지 및 사이트 업데이트
 * Firestore의 실시간 변경사항을 감지하여 사이트 상태를 자동으로 업데이트합니다.
 */
export function subscribeAvailability(
  calendarId: string,
  callback: (availability: Availability[]) => void
): () => void {
  debugLog('AVAILABILITY', '가용성 데이터 변경 감지 시작', { calendarId });

  // 달력의 서브컬렉션으로 가용성 데이터 변경 감지
  const availabilityRef = collection(db, 'calendars', calendarId, 'availability');
  const q = query(availabilityRef);

  const unsubscribe = onSnapshot(
    q,
    {
      // 실시간 업데이트 옵션
      includeMetadataChanges: false, // 메타데이터 변경은 제외 (실제 데이터 변경만 감지)
    },
    (querySnapshot) => {
      const availability: Availability[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        availability.push({
          id: doc.id,
          calendarId, // 서브컬렉션이므로 calendarId는 부모에서 가져옴
          date: data.date,
          profileId: data.profileId || '',
          isUnavailable: data.isUnavailable,
          createdAt: data.createdAt?.toDate() || new Date(),
        });
      });

      debugLog('AVAILABILITY', '가용성 데이터 변경 감지 - 사이트 업데이트', {
        calendarId,
        count: availability.length,
        snapshotSize: querySnapshot.size,
        hasPendingWrites: querySnapshot.metadata.hasPendingWrites,
      });

      // 데이터베이스 변경사항을 감지하여 사이트 상태 업데이트
      callback(availability);
    },
    (error) => {
      debugError('AVAILABILITY', '가용성 데이터 변경 감지 에러', error);
      // 에러가 발생해도 연결 유지 (재연결 시도)
    }
  );

  return unsubscribe;
}

/**
 * 특정 (날짜, 프로필) 조합이 불가능한지 확인
 */
export function isDateUnavailableForProfile(
  availability: Availability[],
  date: string,
  profileId: string
): boolean {
  const match = availability.find(
    (av) => av.date === date && av.profileId === profileId
  );
  return match?.isUnavailable || false;
}

