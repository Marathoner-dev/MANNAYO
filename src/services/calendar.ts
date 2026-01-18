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
  setDoc,
  orderBy,
  writeBatch,
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
      confirmedLocation: null,
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
        confirmedLocation: data.confirmedLocation || null,
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
          confirmedLocation: data.confirmedLocation || null,
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
        confirmedLocation: data.confirmedLocation || null,
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
 * 주소를 좌표로 지오코딩 (Kakao Maps API 사용)
 */
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    // Kakao Maps API가 로드되어 있는지 확인
    if (typeof window === 'undefined' || !window.kakao || !window.kakao.maps || !window.kakao.maps.services) {
      debugLog('CALENDAR', 'Kakao Maps API가 로드되지 않았습니다.');
      resolve(null);
      return;
    }

    const geocoder = new window.kakao.maps.services.Geocoder();
    geocoder.addressSearch(address, (result: any[], status: string) => {
      if (status === window.kakao.maps.services.Status.OK && result && result.length > 0) {
        const { y: lat, x: lng } = result[0];
        resolve({
          lat: parseFloat(lat),
          lng: parseFloat(lng),
        });
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * 약속 확정일 및 장소 설정
 */
export async function setConfirmedDate(
  calendarId: string,
  date: string | null,
  location: string | null = null
): Promise<void> {
  debugLog('CALENDAR', 'setConfirmedDate 시작', { calendarId, date, location });

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
      const updateData: { confirmedDate: string | null; confirmedLocation?: string | null } = {
        confirmedDate: date,
      };
      
      // location이 명시적으로 전달된 경우에만 업데이트 (null도 포함)
      if (location !== undefined) {
        // 빈 문자열을 명시적으로 null로 변환
        // location이 빈 문자열이면 null로 저장 (Firestore에서 필터링 용이)
        updateData.confirmedLocation = (location && location.trim()) ? location.trim() : null;
      }

      debugLog('CALENDAR', 'calendars 컬렉션 업데이트 시도', { 
        calendarId, 
        updateData,
        userId: user.uid,
        calendarCreatedBy: calendar.createdBy,
        isCreator: calendar.createdBy === user.uid
      });
      
      try {
        await updateDoc(calendarRef, updateData);
        debugLog('CALENDAR', 'calendars 컬렉션 업데이트 성공', { calendarId });
      } catch (err: any) {
        debugError('CALENDAR', 'calendars 컬렉션 업데이트 실패', err);
        throw err; // calendars 업데이트 실패는 즉시 에러로 처리
      }

      // locations 컬렉션에 확정된 장소 정보 저장/삭제
      // ⚠️ 중요: 날짜와 장소가 모두 확정되어야만 locations 컬렉션에 저장/업데이트
      const finalDate = updateData.confirmedDate; // 업데이트된 날짜 (date 파라미터)
      // location 파라미터가 있으면 사용, 없으면 기존 calendar의 confirmedLocation 사용
      const finalLocation = location !== undefined 
        ? ((location && location.trim()) ? location.trim() : null)
        : calendar.confirmedLocation;
      
      // 날짜와 장소가 모두 있어야 locations 컬렉션 처리
      const hasDate = finalDate !== null && finalDate !== undefined && finalDate.trim() !== '';
      const hasLocation = finalLocation !== null && finalLocation !== undefined && finalLocation.trim() !== '';
      
      debugLog('CALENDAR', 'locations 컬렉션 처리 조건 확인', {
        calendarId,
        hasDate,
        hasLocation,
        finalDate,
        finalLocation,
        locationParam: location,
        existingLocation: calendar.confirmedLocation
      });
      
      const locationRef = doc(db, 'locations', calendarId);
      
      // 날짜와 장소가 모두 있으면 저장/업데이트
      if (hasDate && hasLocation) {
        const locationData = finalLocation!.trim(); // hasLocation이 true이므로 null이 아님
        
        // 지오코딩을 수행하여 좌표도 함께 저장
        debugLog('CALENDAR', '지오코딩 시작 (날짜+장소 모두 확정)', { 
          calendarId, 
          date: finalDate,
          address: locationData.substring(0, 50) + '...'
        });
        
        let lat: number | null = null;
        let lng: number | null = null;
        
        try {
          const coords = await geocodeAddress(locationData);
          if (coords) {
            lat = coords.lat;
            lng = coords.lng;
            debugLog('CALENDAR', '지오코딩 성공', { 
              calendarId, 
              lat, 
              lng 
            });
          } else {
            debugLog('CALENDAR', '지오코딩 실패 (주소를 찾을 수 없음)', { 
              calendarId, 
              address: locationData.substring(0, 50) + '...'
            });
          }
        } catch (geocodeErr: any) {
          debugError('CALENDAR', '지오코딩 에러', geocodeErr);
          // 지오코딩 실패해도 주소는 저장 (좌표만 null)
        }
        
        const locationDoc: {
          confirmedLocation: string;
          confirmedDate: string;
          lat?: number | null;
          lng?: number | null;
        } = {
          confirmedLocation: locationData,
          confirmedDate: finalDate,
        };
        
        // 좌표가 있으면 함께 저장
        if (lat !== null && lng !== null) {
          locationDoc.lat = lat;
          locationDoc.lng = lng;
        }
        
        debugLog('CALENDAR', 'locations 컬렉션 setDoc 시도 (날짜+장소 확정)', { 
          calendarId, 
          userId: user.uid,
          date: finalDate,
          locationData: locationData.substring(0, 50) + '...',
          hasCoords: lat !== null && lng !== null
        });
        
        try {
          await setDoc(locationRef, locationDoc, { merge: true });
          debugLog('CALENDAR', 'locations 컬렉션 업데이트 완료', { 
            calendarId, 
            date: finalDate,
            location: locationData,
            lat,
            lng
          });
        } catch (err: any) {
          debugError('CALENDAR', 'locations 컬렉션 setDoc 실패', err);
          const errorCode = err?.code || 'unknown';
          const errorMessage = err?.message || '알 수 없는 에러';
          
          // 권한 오류인 경우 상세 정보 로그
          if (errorCode === 'permission-denied') {
            debugError('CALENDAR', 'locations 컬렉션 업데이트 권한 오류 - Firestore 규칙 확인 필요', {
              calendarId,
              userId: user.uid,
              errorCode,
              errorMessage,
              hint: 'Firestore 보안 규칙에서 locations 컬렉션에 대한 쓰기 권한을 확인하세요.',
            });
          } else {
            debugError('CALENDAR', 'locations 컬렉션 업데이트 실패', {
              calendarId,
              errorCode,
              errorMessage,
              err,
            });
          }
          // locations 업데이트 실패는 에러로 처리하지 않음 (calendars 업데이트는 이미 성공)
          // 하지만 상세 로그는 남김
        }
      } else {
        // 날짜 또는 장소가 없으면 locations 컬렉션에서 삭제
        debugLog('CALENDAR', 'locations 컬렉션 삭제 시도 (날짜 또는 장소 미확정)', { 
          calendarId, 
          userId: user.uid,
          hasDate,
          hasLocation,
          reason: !hasDate ? '날짜 미확정' : '장소 미확정'
        });
        
        try {
          // 삭제 전에 주소 가져오기 (집계 업데이트용)
          const locationDoc = await getDoc(locationRef);
          const oldAddress = locationDoc.exists() ? locationDoc.data().confirmedLocation : null;
          
          if (locationDoc.exists()) {
            await deleteDoc(locationRef);
            debugLog('CALENDAR', 'locations 컬렉션에서 삭제 성공', { calendarId });
          }
        } catch (err: any) {
          // 문서가 없을 수 있으므로 에러 무시
          debugLog('CALENDAR', 'locations 컬렉션 삭제 시도 (문서 없음 또는 권한 오류)', { 
            calendarId,
            error: err?.code || 'unknown',
            message: err?.message || 'no message'
          });
          // 권한 오류는 무시하지 않고 로그만 남김 (calendars 업데이트는 성공했으므로)
        }
      }

      debugLog('CALENDAR', 'setConfirmedDate 완료', { calendarId, date, location });
    } catch (error) {
      debugError('CALENDAR', 'setConfirmedDate 실패', error);
      throw error;
    }
  });
}

/**
 * 확정된 장소가 있는 모든 캘린더 조회 (모든 사용자의 확정 장소)
 */
/**
 * 확정된 장소가 있는 모든 캘린더 조회
 * ⚠️ 중요: 로그인 없이도 조회 가능합니다 (공개 데이터)
 * locations 컬렉션에서 확정된 장소 정보만 조회합니다
 */
export async function getAllCalendarsWithConfirmedLocation(): Promise<Calendar[]> {
  debugLog('CALENDAR', 'getAllCalendarsWithConfirmedLocation 시작 - locations 컬렉션 조회 (로그인 불필요)');

  return measurePerformance('getAllCalendarsWithConfirmedLocation', async () => {
    try {
      // ⚠️ 중요: locations 컬렉션에서만 조회
      // 민감한 정보(password 등)가 포함되지 않은 안전한 데이터만 조회
      const locationsRef = collection(db, 'locations');
      const q = query(locationsRef);
      const querySnapshot = await getDocs(q);
      
      debugLog('CALENDAR', '모든 달력 조회 결과', { count: querySnapshot.size });

      const calendars: Calendar[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const confirmedLocation = data.confirmedLocation;
        
        // locations 컬렉션에는 confirmedLocation만 있으므로 검증
        if (!confirmedLocation || confirmedLocation === null || confirmedLocation === undefined) {
          return;
        }
        
        const locationString = String(confirmedLocation).trim();
        if (locationString === '' || locationString === 'null' || locationString === 'undefined') {
          return;
        }
        
        // locations 컬렉션 데이터를 Calendar 타입으로 변환 (confirmedLocation + 좌표 포함)
        const calendarData: Calendar = {
          id: doc.id, // locations 컬렉션의 document ID를 사용 (calendarId)
          title: '', // locations 컬렉션에는 title 없음
          code: '', // locations 컬렉션에는 code 없음
          usePassword: false, // 공개 데이터에서는 항상 false
          password: null, // locations 컬렉션에 없음
          confirmedDate: null, // locations 컬렉션에는 confirmedDate 없음
          confirmedLocation: locationString,
          createdBy: '', // locations 컬렉션에는 createdBy 없음
          participants: [], // locations 컬렉션에는 참여자 목록 없음
          createdAt: new Date(), // 기본값 사용
        };
        
        // 좌표 정보가 있으면 포함
        if (data.lat !== undefined && data.lat !== null && data.lng !== undefined && data.lng !== null) {
          calendarData.lat = data.lat;
          calendarData.lng = data.lng;
        }
        
        calendars.push(calendarData);
      });
      
      debugLog('CALENDAR', 'getAllCalendarsWithConfirmedLocation 완료 (모든 사용자)', {
        totalCount: querySnapshot.size,
        confirmedCount: calendars.length,
        locations: calendars.map((c) => c.confirmedLocation).slice(0, 10), // 처음 10개만 로그
      });

      return calendars;
    } catch (error) {
      debugError('CALENDAR', 'getAllCalendarsWithConfirmedLocation 실패', error);
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
        debugError('CALENDAR', 'availability 서브컬렉션 삭제 실패했지만 달력 삭제는 계속 진행합니다', availabilityError);
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

/**
 * 과거 데이터에 confirmedLocation 필드 추가 (마이그레이션)
 * confirmedLocation 필드가 없는 모든 캘린더에 null을 추가합니다.
 */
export async function migrateCalendarsAddConfirmedLocation(): Promise<{ total: number; updated: number; errors: number }> {
  debugLog('CALENDAR', '마이그레이션 시작: confirmedLocation 필드 추가');

  return measurePerformance('migrateCalendarsAddConfirmedLocation', async () => {
    const user = auth.currentUser;
    if (!user) {
      const error = new Error('로그인이 필요합니다.');
      debugError('CALENDAR', 'migrateCalendarsAddConfirmedLocation - 로그인 필요', error);
      throw error;
    }

    try {
      // 모든 캘린더 조회
      const q = query(collection(db, 'calendars'));
      const querySnapshot = await getDocs(q);
      
      debugLog('CALENDAR', '마이그레이션 시작', { 
        userId: user.uid,
        totalCalendars: querySnapshot.size 
      });

      const calendarsToUpdate: string[] = [];
      let totalCount = 0;

      // confirmedLocation 필드가 없는 캘린더 찾기
      querySnapshot.forEach((doc) => {
        totalCount++;
        const data = doc.data();
        
        if (!('confirmedLocation' in data)) {
          calendarsToUpdate.push(doc.id);
          debugLog('CALENDAR', '마이그레이션 대상', { 
            calendarId: doc.id, 
            title: data.title || '제목 없음' 
          });
        }
      });

      debugLog('CALENDAR', '마이그레이션 대상 개수', { count: calendarsToUpdate.length });

      if (calendarsToUpdate.length === 0) {
        debugLog('CALENDAR', '마이그레이션할 데이터 없음');
        return { total: totalCount, updated: 0, errors: 0 };
      }

      // Firestore Batch Write 제한 (500개씩)
      const BATCH_SIZE = 500;
      let updatedCount = 0;
      let errorCount = 0;

      for (let i = 0; i < calendarsToUpdate.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const batchItems = calendarsToUpdate.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

        batchItems.forEach((calendarId) => {
          const calendarRef = doc(db, 'calendars', calendarId);
          batch.update(calendarRef, { confirmedLocation: null });
        });

        try {
          await batch.commit();
          updatedCount += batchItems.length;
          debugLog('CALENDAR', `마이그레이션 배치 ${batchNumber} 완료`, { 
            count: batchItems.length 
          });
        } catch (err: any) {
          errorCount += batchItems.length;
          const errorCode = err?.code || 'unknown';
          
          debugError('CALENDAR', `마이그레이션 배치 ${batchNumber} 실패`, err);
          
          // 권한 에러인 경우 사용자에게 알림
          if (errorCode === 'permission-denied') {
            debugError('CALENDAR', 'Firestore 보안 규칙 문제: 모든 캘린더를 수정할 권한이 없습니다.', err);
          }
        }
      }

      debugLog('CALENDAR', '마이그레이션 완료', {
        total: totalCount,
        updated: updatedCount,
        errors: errorCount,
      });

      return { total: totalCount, updated: updatedCount, errors: errorCount };
    } catch (error) {
      debugError('CALENDAR', 'migrateCalendarsAddConfirmedLocation 실패', error);
      throw error;
    }
  });
}

/**
 * 기존 확정된 장소 데이터를 locations 컬렉션으로 마이그레이션
 * calendars 컬렉션에 confirmedLocation이 있는 달력들을 locations 컬렉션으로 복사
 */
export async function migrateLocationsCollection(): Promise<{ total: number; migrated: number; errors: number }> {
  debugLog('CALENDAR', '마이그레이션 시작: locations 컬렉션 생성');

  return measurePerformance('migrateLocationsCollection', async () => {
    const user = auth.currentUser;
    if (!user) {
      const error = new Error('로그인이 필요합니다.');
      debugError('CALENDAR', 'migrateLocationsCollection - 로그인 필요', error);
      throw error;
    }

    try {
      // confirmedLocation이 있는 모든 캘린더 조회
      const q = query(
        collection(db, 'calendars'),
        where('confirmedLocation', '!=', null)
      );
      const querySnapshot = await getDocs(q);
      
      debugLog('CALENDAR', 'locations 컬렉션 마이그레이션 시작', {
        userId: user.uid,
        totalCalendars: querySnapshot.size,
      });

      const calendarsToMigrate: Array<{ id: string; confirmedLocation: string }> = [];
      let totalCount = 0;

      // confirmedLocation이 있는 캘린더 찾기
      querySnapshot.forEach((doc) => {
        totalCount++;
        const data = doc.data();
        const confirmedLocation = data.confirmedLocation;
        
        if (confirmedLocation && confirmedLocation.trim() !== '') {
          calendarsToMigrate.push({
            id: doc.id,
            confirmedLocation: confirmedLocation.trim(),
          });
          debugLog('CALENDAR', 'locations 마이그레이션 대상', {
            calendarId: doc.id,
            title: data.title || '제목 없음',
            confirmedLocation,
          });
        }
      });

      debugLog('CALENDAR', 'locations 마이그레이션 대상 개수', { count: calendarsToMigrate.length });

      if (calendarsToMigrate.length === 0) {
        debugLog('CALENDAR', 'locations 마이그레이션할 데이터 없음');
        return { total: totalCount, migrated: 0, errors: 0 };
      }

      // Firestore Batch Write 제한 (500개씩)
      const BATCH_SIZE = 500;
      let migratedCount = 0;
      let errorCount = 0;

      for (let i = 0; i < calendarsToMigrate.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const batchItems = calendarsToMigrate.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

        batchItems.forEach(({ id, confirmedLocation }) => {
          const locationRef = doc(db, 'locations', id);
          // locations 컬렉션에는 confirmedLocation만 저장
          batch.set(locationRef, { confirmedLocation }, { merge: true });
        });

        try {
          await batch.commit();
          migratedCount += batchItems.length;
          debugLog('CALENDAR', `locations 마이그레이션 배치 ${batchNumber} 완료`, { 
            count: batchItems.length 
          });
        } catch (err: any) {
          errorCount += batchItems.length;
          const errorCode = err?.code || 'unknown';
          
          debugError('CALENDAR', `locations 마이그레이션 배치 ${batchNumber} 실패`, err);
          
          // 권한 에러인 경우 사용자에게 알림
          if (errorCode === 'permission-denied') {
            debugError('CALENDAR', 'Firestore 보안 규칙 문제: locations 컬렉션에 쓰기 권한이 없습니다.', err);
          }
        }
      }

      debugLog('CALENDAR', 'locations 컬렉션 마이그레이션 완료', {
        total: totalCount,
        migrated: migratedCount,
        errors: errorCount,
      });

      return { total: totalCount, migrated: migratedCount, errors: errorCount };
    } catch (error) {
      debugError('CALENDAR', 'migrateLocationsCollection 실패', error);
      throw error;
    }
  });
}
