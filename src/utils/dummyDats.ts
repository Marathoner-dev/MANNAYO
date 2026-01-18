import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * 테스트용 더미 데이터 생성 함수
 * 
 * 사용 방법:
 * 1. 브라우저 콘솔에서: window.generateDummyLocations()
 * 2. 또는 코드에서 직접: import { generateDummyLocations } from './utils/dummyDats'; await generateDummyLocations();
 */
export async function generateDummyLocations(): Promise<void> {
  console.log('🚀 더미 데이터 생성 시작...');
  try {
  
      const dummyLocations = [
        // 서울 지역 (강남구 집중 - 집계 테스트용)
        { calendarId: 'dummy-cal-001', confirmedLocation: '서울특별시 강남구 역삼동 737' },
        { calendarId: 'dummy-cal-002', confirmedLocation: '서울특별시 강남구 논현동 123' },
        { calendarId: 'dummy-cal-003', confirmedLocation: '서울특별시 강남구 신사동 567' },
        { calendarId: 'dummy-cal-004', confirmedLocation: '서울특별시 강남구 삼성동 890' },
        { calendarId: 'dummy-cal-005', confirmedLocation: '서울특별시 강남구 청담동 234' },
        { calendarId: 'dummy-cal-006', confirmedLocation: '서울특별시 서초구 반포동 789' },
        { calendarId: 'dummy-cal-007', confirmedLocation: '서울특별시 서초구 서초동 456' },
        { calendarId: 'dummy-cal-008', confirmedLocation: '서울특별시 마포구 합정동 321' },
        { calendarId: 'dummy-cal-009', confirmedLocation: '서울특별시 마포구 상암동 654' },
        { calendarId: 'dummy-cal-010', confirmedLocation: '서울특별시 종로구 사직동 123' },
        { calendarId: 'dummy-cal-011', confirmedLocation: '서울특별시 강남구 역삼동 738' },
        { calendarId: 'dummy-cal-012', confirmedLocation: '서울특별시 강남구 역삼동 739' },
        { calendarId: 'dummy-cal-013', confirmedLocation: '서울특별시 강남구 논현동 124' },
        { calendarId: 'dummy-cal-014', confirmedLocation: '서울특별시 강남구 논현동 125' },
        { calendarId: 'dummy-cal-015', confirmedLocation: '서울특별시 마포구 합정동 322' },
        // 경기도 지역
        { calendarId: 'dummy-cal-016', confirmedLocation: '경기도 성남시 분당구 정자동 123' },
        { calendarId: 'dummy-cal-017', confirmedLocation: '경기도 성남시 분당구 판교동 456' },
        { calendarId: 'dummy-cal-018', confirmedLocation: '경기도 수원시 영통구 원천동 789' },
        { calendarId: 'dummy-cal-019', confirmedLocation: '경기도 광명시 철산동 123' },
        { calendarId: 'dummy-cal-020', confirmedLocation: '경기도 성남시 분당구 정자동 124' },
        // 부산 지역
        { calendarId: 'dummy-cal-021', confirmedLocation: '부산광역시 해운대구 우동 123' },
        { calendarId: 'dummy-cal-022', confirmedLocation: '부산광역시 해운대구 센텀동 456' },
        { calendarId: 'dummy-cal-023', confirmedLocation: '부산광역시 해운대구 우동 124' },
        // 인천 지역
        { calendarId: 'dummy-cal-024', confirmedLocation: '인천광역시 연수구 송도동 123' },
        { calendarId: 'dummy-cal-025', confirmedLocation: '인천광역시 남동구 구월동 456' },
        // 기타 지역
        { calendarId: 'dummy-cal-026', confirmedLocation: '대전광역시 유성구 봉명동 789' },
        { calendarId: 'dummy-cal-027', confirmedLocation: '대구광역시 수성구 범어동 321' },
        { calendarId: 'dummy-cal-028', confirmedLocation: '강원특별자치도 강릉시 경포동 567' },
        { calendarId: 'dummy-cal-029', confirmedLocation: '제주특별자치도 제주시 연동 890' },
      ];
  
      console.log(`📊 총 ${dummyLocations.length}개의 더미 데이터를 생성합니다.`);
      const batch = writeBatch(db);
      
      for (const location of dummyLocations) {
        const locationRef = doc(db, 'locations', location.calendarId);
        batch.set(locationRef, {
          confirmedLocation: location.confirmedLocation,
        }, { merge: true });
      }
      
      await batch.commit();
      console.log(`\n✅ 모든 더미 데이터 생성 완료!`);
      console.log(`📊 총 ${dummyLocations.length}개의 locations 문서가 생성되었습니다.`);
      console.log(`\n💡 이제 만나요 플레이스 페이지에서 지도가 표시될 것입니다!`);
      console.log(`🔄 페이지를 새로고침하면 새로운 데이터가 지도에 표시됩니다.`);
    } catch (error) {
      console.error('❌ 더미 데이터 생성 실패:', error);
      console.error('💡 다음 사항을 확인하세요:');
      console.error('  1. Firebase에 로그인되어 있는지 확인');
      console.error('  2. Firestore 보안 규칙이 locations 컬렉션 쓰기를 허용하는지 확인');
      console.error('  3. 브라우저 콘솔에서 실행 중인지 확인');
      console.error('  4. 만약 모듈 import 오류가 발생하면, 아래 "대안 방법"을 시도하세요');
      throw error;
    }
}

// 브라우저 콘솔에서 사용할 수 있도록 window 객체에 등록 (개발 모드에서만)
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).generateDummyLocations = generateDummyLocations;
  console.log('💡 generateDummyLocations() 함수가 준비되었습니다!');
  console.log('💡 콘솔에서 generateDummyLocations()를 실행하여 더미 데이터를 생성하세요.');
}