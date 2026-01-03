import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  deleteDoc,
  orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import { auth } from './firebase';
import type { Calendar } from '../types';
import { debugLog, debugError, measurePerformance } from '../utils/debug';

/**
 * 랜덤 코드 생성 (6-8자 영문+숫자)
 */
function generateRandomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  debugLog('CALENDAR', '랜덤 코드 생성', { code: result });
  return result;
}

/**
 * 공유달력 생성
 */
export async function createCalendar(
  title: string,
  usePassword: boolean,
  password?: string
): Promise<Calendar> {
  debugLog('CALENDAR', 'createCalendar 시작', { title, usePassword, hasPassword: !!password });

  return measurePerformance('createCalendar', async () => {
    const user = auth.currentUser;
    if (!user) {
      const error = new Error('로그인이 필요합니다.');
      debugError('CALENDAR', 'createCalendar - 로그인 필요', error);
      throw error;
    }

    debugLog('CALENDAR', '사용자 확인', { uid: user.uid });

    // 중복되지 않는 코드 생성
    let code = generateRandomCode();
    let codeExists = true;
    let attempts = 0;
    const maxAttempts = 10;

    debugLog('CALENDAR', '코드 중복 확인 시작', { code, maxAttempts });

    while (codeExists && attempts < maxAttempts) {
      const codeQuery = query(
        collection(db, 'calendars'),
        where('code', '==', code)
      );
      const codeSnapshot = await getDocs(codeQuery);

      debugLog('CALENDAR', '코드 중복 확인', { code, exists: !codeSnapshot.empty, attempt: attempts + 1 });

      if (codeSnapshot.empty) {
        codeExists = false;
      } else {
        code = generateRandomCode();
        attempts++;
      }
    }

    if (codeExists) {
      const error = new Error('달력 코드 생성에 실패했습니다. 다시 시도해주세요.');
      debugError('CALENDAR', '코드 생성 실패 - 최대 시도 횟수 초과', error);
      throw error;
    }

    debugLog('CALENDAR', '고유 코드 생성 완료', { code, attempts });

    const calendarData = {
      title,
      code,
      usePassword,
      password: (usePassword ? password : null) as string | null,
      confirmedDate: null,
      createdBy: user.uid,
      participants: [user.uid],
      createdAt: new Date(),
    };

    debugLog('CALENDAR', '달력 데이터 준비 완료', calendarData);

    try {
      const docRef = await addDoc(collection(db, 'calendars'), calendarData);
      debugLog('CALENDAR', '달력 생성 완료', { id: docRef.id, code });

      return {
        id: docRef.id,
        ...calendarData,
      };
    } catch (error) {
      debugError('CALENDAR', '달력 생성 실패', error);
      throw error;
    }
  });
}

/**
 * 코드로 공유달력 찾기
 */
export async function findCalendarByCode(code: string): Promise<Calendar | null> {
  debugLog('CALENDAR', 'findCalendarByCode 시작', { code });

  return measurePerformance('findCalendarByCode', async () => {
    try {
      const q = query(collection(db, 'calendars'), where('code', '==', code));
      const querySnapshot = await getDocs(q);

      debugLog('CALENDAR', '코드로 달력 검색 결과', {
        code,
        found: !querySnapshot.empty,
        count: querySnapshot.size,
      });

      if (querySnapshot.empty) {
        debugLog('CALENDAR', '달력을 찾을 수 없음', { code });
        return null;
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();

      const calendar = {
        id: doc.id,
        title: data.title,
        code: data.code,
        usePassword: data.usePassword,
        password: data.password,
        confirmedDate: data.confirmedDate,
        createdBy: data.createdBy,
        participants: data.participants,
        createdAt: data.createdAt?.toDate() || new Date(),
      };

      debugLog('CALENDAR', '달력 찾기 완료', {
        id: calendar.id,
        title: calendar.title,
        usePassword: calendar.usePassword,
        participantsCount: calendar.participants.length,
      });

      return calendar;
    } catch (error) {
      debugError('CALENDAR', 'findCalendarByCode 실패', error);
      throw error;
    }
  });
}

/**
 * 공유달력 참여
 */
export async function joinCalendar(
  code: string,
  password?: string
): Promise<Calendar> {
  debugLog('CALENDAR', 'joinCalendar 시작', { code, hasPassword: !!password });

  return measurePerformance('joinCalendar', async () => {
    const user = auth.currentUser;
    if (!user) {
      const error = new Error('로그인이 필요합니다.');
      debugError('CALENDAR', 'joinCalendar - 로그인 필요', error);
      throw error;
    }

    debugLog('CALENDAR', '사용자 확인', { uid: user.uid });

    try {
      const calendar = await findCalendarByCode(code);

      if (!calendar) {
        const error = new Error('존재하지 않는 달력 코드입니다.');
        debugError('CALENDAR', 'joinCalendar - 달력 없음', error);
        throw error;
      }

      debugLog('CALENDAR', '달력 확인 완료', { calendarId: calendar.id, title: calendar.title });

      // 이미 참여자인지 확인
      if (calendar.participants.includes(user.uid)) {
        const error = new Error('이미 참여 중인 달력입니다.');
        debugError('CALENDAR', 'joinCalendar - 이미 참여 중', error);
        throw error;
      }

      // 비밀번호 확인
      if (calendar.usePassword && calendar.password !== password) {
        const error = new Error('비밀번호가 일치하지 않습니다.');
        debugError('CALENDAR', 'joinCalendar - 비밀번호 불일치', error);
        throw error;
      }

      debugLog('CALENDAR', '참여 조건 확인 완료', {
        calendarId: calendar.id,
        currentParticipants: calendar.participants.length,
      });

      // 참여자 목록에 추가
      const calendarRef = doc(db, 'calendars', calendar.id);
      const newParticipants = [...calendar.participants, user.uid];
      await updateDoc(calendarRef, {
        participants: newParticipants,
      });

      debugLog('CALENDAR', '참여 완료', {
        calendarId: calendar.id,
        newParticipantsCount: newParticipants.length,
      });

      return {
        ...calendar,
        participants: newParticipants,
      };
    } catch (error) {
      debugError('CALENDAR', 'joinCalendar 실패', error);
      throw error;
    }
  });
}

/**
 * 사용자가 참여한 공유달력 리스트 조회
 */
export async function getCalendars(): Promise<Calendar[]> {
  debugLog('CALENDAR', 'getCalendars 시작');

  return measurePerformance('getCalendars', async () => {
    const user = auth.currentUser;
    if (!user) {
      const error = new Error('로그인이 필요합니다.');
      debugError('CALENDAR', 'getCalendars - 로그인 필요', error);
      throw error;
    }

    debugLog('CALENDAR', '사용자 확인', { uid: user.uid });

    try {
      const q = query(
        collection(db, 'calendars'),
        where('participants', 'array-contains', user.uid),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      debugLog('CALENDAR', '달력 리스트 조회 결과', { count: querySnapshot.size });

      const calendars: Calendar[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        calendars.push({
          id: doc.id,
          title: data.title,
          code: data.code,
          usePassword: data.usePassword,
          password: data.password,
          confirmedDate: data.confirmedDate,
          createdBy: data.createdBy,
          participants: data.participants,
          createdAt: data.createdAt?.toDate() || new Date(),
        });
      });

      debugLog('CALENDAR', 'getCalendars 완료', {
        count: calendars.length,
        titles: calendars.map((c) => c.title),
      });

      return calendars;
    } catch (error) {
      debugError('CALENDAR', 'getCalendars 실패', error);
      throw error;
    }
  });
}

/**
 * 공유달력 상세 조회
 */
export async function getCalendarById(calendarId: string): Promise<Calendar | null> {
  debugLog('CALENDAR', 'getCalendarById 시작', { calendarId });

  return measurePerformance('getCalendarById', async () => {
    const user = auth.currentUser;
    if (!user) {
      const error = new Error('로그인이 필요합니다.');
      debugError('CALENDAR', 'getCalendarById - 로그인 필요', error);
      throw error;
    }

    debugLog('CALENDAR', '사용자 확인', { uid: user.uid });

    try {
      const calendarRef = doc(db, 'calendars', calendarId);
      const calendarDoc = await getDoc(calendarRef);

      debugLog('CALENDAR', '달력 문서 조회 결과', {
        calendarId,
        exists: calendarDoc.exists(),
      });

      if (!calendarDoc.exists()) {
        debugLog('CALENDAR', '달력을 찾을 수 없음', { calendarId });
        return null;
      }

      const data = calendarDoc.data();

      // 참여자 확인
      if (!data.participants.includes(user.uid)) {
        const error = new Error('접근 권한이 없습니다.');
        debugError('CALENDAR', 'getCalendarById - 권한 없음', {
          error,
          calendarId,
          userId: user.uid,
          participants: data.participants,
        });
        throw error;
      }

      const calendar = {
        id: calendarDoc.id,
        title: data.title,
        code: data.code,
        usePassword: data.usePassword,
        password: data.password,
        confirmedDate: data.confirmedDate,
        createdBy: data.createdBy,
        participants: data.participants,
        createdAt: data.createdAt?.toDate() || new Date(),
      };

      debugLog('CALENDAR', 'getCalendarById 완료', {
        id: calendar.id,
        title: calendar.title,
        participantsCount: calendar.participants.length,
      });

      return calendar;
    } catch (error) {
      debugError('CALENDAR', 'getCalendarById 실패', error);
      throw error;
    }
  });
}

/**
 * 약속 확정일 설정
 */
export async function setConfirmedDate(
  calendarId: string,
  date: string | null
): Promise<void> {
  debugLog('CALENDAR', 'setConfirmedDate 시작', { calendarId, date });

  return measurePerformance('setConfirmedDate', async () => {
    const user = auth.currentUser;
    if (!user) {
      const error = new Error('로그인이 필요합니다.');
      debugError('CALENDAR', 'setConfirmedDate - 로그인 필요', error);
      throw error;
    }

    debugLog('CALENDAR', '사용자 확인', { uid: user.uid });

    try {
      const calendar = await getCalendarById(calendarId);

      if (!calendar) {
        const error = new Error('달력을 찾을 수 없습니다.');
        debugError('CALENDAR', 'setConfirmedDate - 달력 없음', error);
        throw error;
      }

      // 생성자만 확정일 설정 가능
      if (calendar.createdBy !== user.uid) {
        const error = new Error('생성자만 확정일을 설정할 수 있습니다.');
        debugError('CALENDAR', 'setConfirmedDate - 권한 없음', error);
        throw error;
      }

      const calendarRef = doc(db, 'calendars', calendarId);
      await updateDoc(calendarRef, {
        confirmedDate: date,
      });

      debugLog('CALENDAR', 'setConfirmedDate 완료', { calendarId, date });
    } catch (error) {
      debugError('CALENDAR', 'setConfirmedDate 실패', error);
      throw error;
    }
  });
}

/**
 * 공유달력 삭제
 */
export async function deleteCalendar(calendarId: string): Promise<void> {
  debugLog('CALENDAR', 'deleteCalendar 시작', { calendarId });

  return measurePerformance('deleteCalendar', async () => {
    const user = auth.currentUser;
    if (!user) {
      const error = new Error('로그인이 필요합니다.');
      debugError('CALENDAR', 'deleteCalendar - 로그인 필요', error);
      throw error;
    }

    debugLog('CALENDAR', '사용자 확인', { uid: user.uid });

    try {
      const calendar = await getCalendarById(calendarId);

      if (!calendar) {
        const error = new Error('달력을 찾을 수 없습니다.');
        debugError('CALENDAR', 'deleteCalendar - 달력 없음', error);
        throw error;
      }

      debugLog('CALENDAR', '달력 확인 완료', {
        calendarId,
        title: calendar.title,
        createdBy: calendar.createdBy,
        currentUser: user.uid,
      });

      // 생성자만 삭제 가능
      if (calendar.createdBy !== user.uid) {
        const error = new Error('생성자만 달력을 삭제할 수 있습니다.');
        debugError('CALENDAR', 'deleteCalendar - 권한 없음', error);
        throw error;
      }

      // 달력 삭제 전에 관련된 availability 서브컬렉션도 삭제
      debugLog('CALENDAR', 'availability 서브컬렉션 삭제 시작', { calendarId });
      try {
        const availabilityRef = collection(db, 'calendars', calendarId, 'availability');
        const availabilitySnapshot = await getDocs(availabilityRef);
        
        const deletePromises = availabilitySnapshot.docs.map((doc) => 
          deleteDoc(doc.ref)
        );
        
        await Promise.all(deletePromises);
        debugLog('CALENDAR', 'availability 서브컬렉션 삭제 완료', { 
          calendarId, 
          deletedCount: availabilitySnapshot.size 
        });
      } catch (availabilityError) {
        debugError('CALENDAR', 'availability 서브컬렉션 삭제 실패', availabilityError);
        // availability 삭제 실패해도 달력 삭제는 계속 진행
        console.warn('availability 서브컬렉션 삭제 실패했지만 달력 삭제는 계속 진행합니다:', availabilityError);
      }

      // 달력 문서 삭제
      const calendarDocRef = doc(db, 'calendars', calendarId);
      await deleteDoc(calendarDocRef);
      
      debugLog('CALENDAR', 'deleteCalendar 완료 - Firestore에서 문서 삭제됨', { calendarId });
    } catch (error) {
      debugError('CALENDAR', 'deleteCalendar 실패', error);
      throw error;
    }
  });
}
