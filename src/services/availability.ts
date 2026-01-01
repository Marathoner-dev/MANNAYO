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
 * 날짜별 가용성 토글
 */
export async function toggleAvailability(
  calendarId: string,
  date: string
): Promise<Availability> {
  debugLog('AVAILABILITY', 'toggleAvailability 시작', { calendarId, date });

  return measurePerformance('toggleAvailability', async () => {
    try {
      // 달력의 서브컬렉션으로 가용성 데이터 접근
      const availabilityRef = collection(db, 'calendars', calendarId, 'availability');
      
      // 기존 가용성 데이터 찾기 (날짜로만 검색 - 사용자 구분 없음)
      const q = query(
        availabilityRef,
        where('date', '==', date)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        // 새로 생성 (불가일로 설정) - 모든 사용자에게 적용
        debugLog('AVAILABILITY', '새 가용성 데이터 생성 - Firestore에 저장 (모든 사용자에게 적용)', { 
          calendarId, 
          date,
        });
        const newAvailability = {
          date,
          isUnavailable: true,
          createdAt: new Date(),
        };

        const docRef = await addDoc(availabilityRef, newAvailability);
        debugLog('AVAILABILITY', 'Firestore 저장 완료 - 새 문서 생성됨', { 
          id: docRef.id,
          calendarId,
          date,
        });

        return {
          id: docRef.id,
          calendarId,
          ...newAvailability,
        };
      } else {
        // 기존 데이터 토글 (날짜별로 하나만 존재)
        const availabilityDoc = querySnapshot.docs[0];
        const currentStatus = availabilityDoc.data().isUnavailable;
        const newStatus = !currentStatus;

        debugLog('AVAILABILITY', '가용성 상태 토글 - Firestore 업데이트 (모든 사용자에게 적용)', {
          id: availabilityDoc.id,
          currentStatus,
          newStatus,
          calendarId,
          date,
        });

        await updateDoc(doc(availabilityRef, availabilityDoc.id), {
          isUnavailable: newStatus,
        });

        debugLog('AVAILABILITY', 'Firestore 업데이트 완료', {
          id: availabilityDoc.id,
          newStatus,
        });

        const data = availabilityDoc.data();
        return {
          id: availabilityDoc.id,
          calendarId,
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
      console.error('가용성 데이터 변경 감지 에러:', error);
    }
  );

  return unsubscribe;
}

/**
 * 특정 날짜가 불가능한지 확인 (모든 사용자에게 공통)
 */
export function isDateUnavailable(
  availability: Availability[],
  date: string
): boolean {
  const dateAvailability = availability.find((av) => av.date === date);
  return dateAvailability?.isUnavailable || false;
}

