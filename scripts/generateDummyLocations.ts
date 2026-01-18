/**
 * 테스트용 더미 데이터 생성 스크립트
 * 
 * 사용 방법:
 * 1. Firebase 인증 필요 (로그인 후 실행)
 * 2. 이 파일을 별도로 실행하거나, 브라우저 콘솔에서 실행
 * 
 * 실행 방법:
 * - 브라우저 콘솔에서 실행 (권장)
 * - 또는 별도의 스크립트로 실행
 */

import { collection, doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../src/services/firebase';

/**
 * 한국 주요 지역의 실제 주소 더미 데이터
 */
const dummyLocations: Array<{ calendarId: string; confirmedLocation: string }> = [
  // 서울 지역
  { calendarId: 'dummy-cal-001', confirmedLocation: '서울특별시 강남구 역삼동 737' },
  { calendarId: 'dummy-cal-002', confirmedLocation: '서울특별시 강남구 논현동 123' },
  { calendarId: 'dummy-cal-003', confirmedLocation: '서울특별시 강남구 신사동 567' },
  { calendarId: 'dummy-cal-004', confirmedLocation: '서울특별시 서초구 반포동 789' },
  { calendarId: 'dummy-cal-005', confirmedLocation: '서울특별시 서초구 서초동 456' },
  { calendarId: 'dummy-cal-006', confirmedLocation: '서울특별시 마포구 합정동 321' },
  { calendarId: 'dummy-cal-007', confirmedLocation: '서울특별시 마포구 상암동 654' },
  { calendarId: 'dummy-cal-008', confirmedLocation: '서울특별시 종로구 사직동 123' },
  { calendarId: 'dummy-cal-009', confirmedLocation: '서울특별시 종로구 삼청동 456' },
  { calendarId: 'dummy-cal-010', confirmedLocation: '서울특별시 용산구 이태원동 789' },
  { calendarId: 'dummy-cal-011', confirmedLocation: '서울특별시 용산구 한남동 321' },
  { calendarId: 'dummy-cal-012', confirmedLocation: '서울특별시 송파구 잠실동 654' },
  { calendarId: 'dummy-cal-013', confirmedLocation: '서울특별시 송파구 문정동 987' },
  { calendarId: 'dummy-cal-014', confirmedLocation: '서울특별시 강동구 천호동 234' },
  { calendarId: 'dummy-cal-015', confirmedLocation: '서울특별시 강동구 성내동 567' },
  
  // 부산 지역
  { calendarId: 'dummy-cal-016', confirmedLocation: '부산광역시 해운대구 우동 123' },
  { calendarId: 'dummy-cal-017', confirmedLocation: '부산광역시 해운대구 센텀동 456' },
  { calendarId: 'dummy-cal-018', confirmedLocation: '부산광역시 사상구 괘법동 789' },
  { calendarId: 'dummy-cal-019', confirmedLocation: '부산광역시 부산진구 전포동 321' },
  { calendarId: 'dummy-cal-020', confirmedLocation: '부산광역시 남구 용당동 654' },
  
  // 인천 지역
  { calendarId: 'dummy-cal-021', confirmedLocation: '인천광역시 연수구 송도동 123' },
  { calendarId: 'dummy-cal-022', confirmedLocation: '인천광역시 남동구 구월동 456' },
  { calendarId: 'dummy-cal-023', confirmedLocation: '인천광역시 중구 신포동 789' },
  
  // 경기도 지역
  { calendarId: 'dummy-cal-024', confirmedLocation: '경기도 성남시 분당구 정자동 123' },
  { calendarId: 'dummy-cal-025', confirmedLocation: '경기도 성남시 분당구 판교동 456' },
  { calendarId: 'dummy-cal-026', confirmedLocation: '경기도 수원시 영통구 원천동 789' },
  { calendarId: 'dummy-cal-027', confirmedLocation: '경기도 수원시 팔달구 인계동 321' },
  { calendarId: 'dummy-cal-028', confirmedLocation: '경기도 용인시 기흥구 신갈동 654' },
  { calendarId: 'dummy-cal-029', confirmedLocation: '경기도 용인시 수지구 죽전동 987' },
  { calendarId: 'dummy-cal-030', confirmedLocation: '경기도 고양시 일산동구 장항동 234' },
  { calendarId: 'dummy-cal-031', confirmedLocation: '경기도 고양시 일산서구 대화동 567' },
  { calendarId: 'dummy-cal-032', confirmedLocation: '경기도 안양시 만안구 안양동 890' },
  { calendarId: 'dummy-cal-033', confirmedLocation: '경기도 광명시 철산동 123' },
  { calendarId: 'dummy-cal-034', confirmedLocation: '경기도 부천시 원미구 상동 456' },
  
  // 대전 지역
  { calendarId: 'dummy-cal-035', confirmedLocation: '대전광역시 유성구 봉명동 789' },
  { calendarId: 'dummy-cal-036', confirmedLocation: '대전광역시 서구 둔산동 321' },
  
  // 대구 지역
  { calendarId: 'dummy-cal-037', confirmedLocation: '대구광역시 수성구 범어동 654' },
  { calendarId: 'dummy-cal-038', confirmedLocation: '대구광역시 중구 동성로 987' },
  
  // 광주 지역
  { calendarId: 'dummy-cal-039', confirmedLocation: '광주광역시 북구 용봉동 234' },
  
  // 강원도 지역
  { calendarId: 'dummy-cal-040', confirmedLocation: '강원특별자치도 춘천시 옥천동 567' },
  { calendarId: 'dummy-cal-041', confirmedLocation: '강원특별자치도 강릉시 경포동 890' },
  
  // 충청도 지역
  { calendarId: 'dummy-cal-042', confirmedLocation: '충청남도 천안시 동남구 원성동 123' },
  { calendarId: 'dummy-cal-043', confirmedLocation: '충청북도 청주시 상당구 북문로 456' },
  
  // 전라도 지역
  { calendarId: 'dummy-cal-044', confirmedLocation: '전라북도 전주시 완산구 중앙동 789' },
  { calendarId: 'dummy-cal-045', confirmedLocation: '전라남도 여수시 중앙동 321' },
  
  // 경상도 지역
  { calendarId: 'dummy-cal-046', confirmedLocation: '경상북도 포항시 남구 대잠동 654' },
  { calendarId: 'dummy-cal-047', confirmedLocation: '경상남도 창원시 의창구 상남동 987' },
  
  // 제주도 지역
  { calendarId: 'dummy-cal-048', confirmedLocation: '제주특별자치도 제주시 연동 234' },
  { calendarId: 'dummy-cal-049', confirmedLocation: '제주특별자치도 서귀포시 중문동 567' },
  
  // 같은 지역에 여러 개 추가 (집계 테스트용)
  { calendarId: 'dummy-cal-050', confirmedLocation: '서울특별시 강남구 역삼동 738' },
  { calendarId: 'dummy-cal-051', confirmedLocation: '서울특별시 강남구 역삼동 739' },
  { calendarId: 'dummy-cal-052', confirmedLocation: '서울특별시 강남구 논현동 124' },
  { calendarId: 'dummy-cal-053', confirmedLocation: '서울특별시 강남구 논현동 125' },
  { calendarId: 'dummy-cal-054', confirmedLocation: '서울특별시 마포구 합정동 322' },
  { calendarId: 'dummy-cal-055', confirmedLocation: '서울특별시 마포구 합정동 323' },
  { calendarId: 'dummy-cal-056', confirmedLocation: '경기도 성남시 분당구 정자동 124' },
  { calendarId: 'dummy-cal-057', confirmedLocation: '경기도 성남시 분당구 정자동 125' },
  { calendarId: 'dummy-cal-058', confirmedLocation: '부산광역시 해운대구 우동 124' },
  { calendarId: 'dummy-cal-059', confirmedLocation: '부산광역시 해운대구 우동 125' },
  { calendarId: 'dummy-cal-060', confirmedLocation: '인천광역시 연수구 송도동 124' },
];

/**
 * 더미 데이터를 Firestore locations 컬렉션에 추가
 */
export async function generateDummyLocations(): Promise<void> {
  console.log('🚀 더미 데이터 생성 시작...');
  console.log(`📊 총 ${dummyLocations.length}개의 더미 데이터를 생성합니다.`);

  try {
    // Batch를 사용하여 한 번에 여러 문서 작성 (성능 최적화)
    const batch = writeBatch(db);
    let batchCount = 0;
    const BATCH_LIMIT = 500; // Firestore 배치 제한

    for (const location of dummyLocations) {
      const locationRef = doc(db, 'locations', location.calendarId);
      batch.set(locationRef, {
        confirmedLocation: location.confirmedLocation,
      }, { merge: true });
      
      batchCount++;
      
      // 배치 제한에 도달하면 커밋하고 새 배치 시작
      if (batchCount >= BATCH_LIMIT) {
        await batch.commit();
        console.log(`✅ ${batchCount}개 문서 작성 완료`);
        batchCount = 0;
      }
    }

    // 남은 문서들 커밋
    if (batchCount > 0) {
      await batch.commit();
      console.log(`✅ 나머지 ${batchCount}개 문서 작성 완료`);
    }

    console.log(`\n✅ 모든 더미 데이터 생성 완료!`);
    console.log(`📊 총 ${dummyLocations.length}개의 locations 문서가 생성되었습니다.`);
    console.log(`\n📍 생성된 지역별 집계:`);
    
    // 지역별 집계 출력
    const regionCounts = new Map<string, number>();
    dummyLocations.forEach(loc => {
      // 주소에서 첫 번째 단위 추출 (시/도 단위)
      const parts = loc.confirmedLocation.split(' ');
      const region = parts.length > 0 ? parts[0] : '기타';
      regionCounts.set(region, (regionCounts.get(region) || 0) + 1);
    });
    
    Array.from(regionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([region, count]) => {
        console.log(`  - ${region}: ${count}개`);
      });
      
    console.log(`\n💡 이제 만나요 플레이스 페이지에서 지도가 표시될 것입니다!`);
    
  } catch (error: any) {
    console.error('❌ 더미 데이터 생성 실패:', error);
    throw error;
  }
}

/**
 * 브라우저 콘솔에서 실행할 수 있도록 전역 함수로 등록
 * 사용 방법: generateDummyLocations() 실행
 */
if (typeof window !== 'undefined') {
  (window as any).generateDummyLocations = generateDummyLocations;
  console.log('💡 브라우저 콘솔에서 generateDummyLocations() 함수를 실행하여 더미 데이터를 생성할 수 있습니다.');
}
