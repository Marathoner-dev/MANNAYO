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
import { getAnonymousUserId } from '../utils/anonymousUser';

/**
 * 날짜별 가용성 토글
 */
export async function toggleAvailability(
  calendarId: string,
  date: string
): Promise<Availability> {
  debugLog('AVAILABILITY', 'toggleAvailability 시작', { calendarId, date });

  return measurePerformance('toggleAvailability', async () => {
    const user = auth.currentUser;
    // 로그인한 사용자는 user.uid 사용, 익명 사용자는 임시 ID 사용
    const userId = user ? user.uid : getAnonymousUserId();
    
    debugLog('AVAILABILITY', '사용자 확인', { 
      uid: userId, 
      isAuthenticated: !!user,
      isAnonymous: !user 
    });

    try {
      // 기존 가용성 데이터 찾기
      const q = query(
        collection(db, 'availability'),
        where('calendarId', '==', calendarId),
        where('userId', '==', userId),
        where('date', '==', date)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        // 새로 생성 (불가일로 설정)
        debugLog('AVAILABILITY', '새 가용성 데이터 생성', { calendarId, date });
        const newAvailability = {
          calendarId,
          userId: userId,
          date,
          isUnavailable: true,
          createdAt: new Date(),
        };

        const docRef = await addDoc(collection(db, 'availability'), newAvailability);
        debugLog('AVAILABILITY', '가용성 데이터 생성 완료', { id: docRef.id });

        return {
          id: docRef.id,
          ...newAvailability,
        };
      } else {
        // 기존 데이터 토글
        const availabilityDoc = querySnapshot.docs[0];
        const currentStatus = availabilityDoc.data().isUnavailable;
        const newStatus = !currentStatus;

        debugLog('AVAILABILITY', '가용성 상태 토글', {
          id: availabilityDoc.id,
          currentStatus,
          newStatus,
        });

        await updateDoc(doc(db, 'availability', availabilityDoc.id), {
          isUnavailable: newStatus,
        });

        const data = availabilityDoc.data();
        return {
          id: availabilityDoc.id,
          calendarId: data.calendarId,
          userId: data.userId,
          date: data.date,
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
      const q = query(
        collection(db, 'availability'),
        where('calendarId', '==', calendarId)
      );

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
          calendarId: data.calendarId,
          userId: data.userId,
          date: data.date,
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
 * 특정 달력의 가용성 데이터 실시간 구독
 */
export function subscribeAvailability(
  calendarId: string,
  callback: (availability: Availability[]) => void
): () => void {
  debugLog('AVAILABILITY', 'subscribeAvailability 시작', { calendarId });

  const q = query(
    collection(db, 'availability'),
    where('calendarId', '==', calendarId)
  );

  const unsubscribe = onSnapshot(
    q,
    (querySnapshot) => {
      const availability: Availability[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        availability.push({
          id: doc.id,
          calendarId: data.calendarId,
          userId: data.userId,
          date: data.date,
          isUnavailable: data.isUnavailable,
          createdAt: data.createdAt?.toDate() || new Date(),
        });
      });

      debugLog('AVAILABILITY', '가용성 데이터 업데이트', {
        calendarId,
        count: availability.length,
      });

      callback(availability);
    },
    (error) => {
      debugError('AVAILABILITY', 'subscribeAvailability 에러', error);
    }
  );

  return unsubscribe;
}

/**
 * 특정 날짜의 불가능한 사용자 목록 조회
 */
export function getUnavailableUsersForDate(
  availability: Availability[],
  date: string
): string[] {
  return availability
    .filter((av) => av.date === date && av.isUnavailable)
    .map((av) => av.userId);
}

