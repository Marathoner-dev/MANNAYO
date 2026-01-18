/**
 * 브라우저 콘솔에서 바로 실행할 수 있는 더미 데이터 생성 코드
 * 
 * 📋 사용 방법:
 * 1. 만나요 앱을 실행하고 로그인합니다
 * 2. 브라우저 개발자 도구 콘솔을 엽니다 (F12 또는 Cmd+Option+I)
 * 3. 아래 코드 블록 전체를 복사하여 콘솔에 붙여넣고 실행합니다
 */

/*
// ========== 이 아래 코드를 복사하여 콘솔에 붙여넣으세요 ==========

(async function generateDummyLocations() {
  console.log('🚀 더미 데이터 생성 시작...');

  try {
    // Firebase Firestore 모듈 동적 import
    const firestore = await import('firebase/firestore');
    const { db } = await import('/src/services/firebase.ts');
    
    const { doc, writeBatch } = firestore;

    // 한국 주요 지역의 실제 주소 더미 데이터 (60개)
    const dummyLocations = [
      // 서울 지역 - 강남구 집중 (집계 테스트용)
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
      { calendarId: 'dummy-cal-011', confirmedLocation: '서울특별시 종로구 삼청동 456' },
      { calendarId: 'dummy-cal-012', confirmedLocation: '서울특별시 용산구 이태원동 789' },
      { calendarId: 'dummy-cal-013', confirmedLocation: '서울특별시 용산구 한남동 321' },
      { calendarId: 'dummy-cal-014', confirmedLocation: '서울특별시 송파구 잠실동 654' },
      { calendarId: 'dummy-cal-015', confirmedLocation: '서울특별시 송파구 문정동 987' },
      
      // 같은 지역에 여러 개 추가 (집계 테스트용)
      { calendarId: 'dummy-cal-016', confirmedLocation: '서울특별시 강남구 역삼동 738' },
      { calendarId: 'dummy-cal-017', confirmedLocation: '서울특별시 강남구 역삼동 739' },
      { calendarId: 'dummy-cal-018', confirmedLocation: '서울특별시 강남구 논현동 124' },
      { calendarId: 'dummy-cal-019', confirmedLocation: '서울특별시 강남구 논현동 125' },
      { calendarId: 'dummy-cal-020', confirmedLocation: '서울특별시 강남구 신사동 568' },
      { calendarId: 'dummy-cal-021', confirmedLocation: '서울특별시 마포구 합정동 322' },
      { calendarId: 'dummy-cal-022', confirmedLocation: '서울특별시 마포구 합정동 323' },
      { calendarId: 'dummy-cal-023', confirmedLocation: '서울특별시 서초구 반포동 790' },
      
      // 경기도 지역
      { calendarId: 'dummy-cal-024', confirmedLocation: '경기도 성남시 분당구 정자동 123' },
      { calendarId: 'dummy-cal-025', confirmedLocation: '경기도 성남시 분당구 판교동 456' },
      { calendarId: 'dummy-cal-026', confirmedLocation: '경기도 수원시 영통구 원천동 789' },
      { calendarId: 'dummy-cal-027', confirmedLocation: '경기도 수원시 팔달구 인계동 321' },
      { calendarId: 'dummy-cal-028', confirmedLocation: '경기도 용인시 기흥구 신갈동 654' },
      { calendarId: 'dummy-cal-029', confirmedLocation: '경기도 용인시 수지구 죽전동 987' },
      { calendarId: 'dummy-cal-030', confirmedLocation: '경기도 고양시 일산동구 장항동 234' },
      { calendarId: 'dummy-cal-031', confirmedLocation: '경기도 광명시 철산동 123' },
      { calendarId: 'dummy-cal-032', confirmedLocation: '경기도 부천시 원미구 상동 456' },
      { calendarId: 'dummy-cal-033', confirmedLocation: '경기도 성남시 분당구 정자동 124' },
      { calendarId: 'dummy-cal-034', confirmedLocation: '경기도 성남시 분당구 정자동 125' },
      
      // 부산 지역
      { calendarId: 'dummy-cal-035', confirmedLocation: '부산광역시 해운대구 우동 123' },
      { calendarId: 'dummy-cal-036', confirmedLocation: '부산광역시 해운대구 센텀동 456' },
      { calendarId: 'dummy-cal-037', confirmedLocation: '부산광역시 사상구 괘법동 789' },
      { calendarId: 'dummy-cal-038', confirmedLocation: '부산광역시 부산진구 전포동 321' },
      { calendarId: 'dummy-cal-039', confirmedLocation: '부산광역시 해운대구 우동 124' },
      { calendarId: 'dummy-cal-040', confirmedLocation: '부산광역시 해운대구 우동 125' },
      
      // 인천 지역
      { calendarId: 'dummy-cal-041', confirmedLocation: '인천광역시 연수구 송도동 123' },
      { calendarId: 'dummy-cal-042', confirmedLocation: '인천광역시 남동구 구월동 456' },
      { calendarId: 'dummy-cal-043', confirmedLocation: '인천광역시 중구 신포동 789' },
      { calendarId: 'dummy-cal-044', confirmedLocation: '인천광역시 연수구 송도동 124' },
      
      // 대전 지역
      { calendarId: 'dummy-cal-045', confirmedLocation: '대전광역시 유성구 봉명동 789' },
      { calendarId: 'dummy-cal-046', confirmedLocation: '대전광역시 서구 둔산동 321' },
      
      // 대구 지역
      { calendarId: 'dummy-cal-047', confirmedLocation: '대구광역시 수성구 범어동 654' },
      { calendarId: 'dummy-cal-048', confirmedLocation: '대구광역시 중구 동성로 987' },
      
      // 광주 지역
      { calendarId: 'dummy-cal-049', confirmedLocation: '광주광역시 북구 용봉동 234' },
      
      // 강원도 지역
      { calendarId: 'dummy-cal-050', confirmedLocation: '강원특별자치도 춘천시 옥천동 567' },
      { calendarId: 'dummy-cal-051', confirmedLocation: '강원특별자치도 강릉시 경포동 890' },
      
      // 충청도 지역
      { calendarId: 'dummy-cal-052', confirmedLocation: '충청남도 천안시 동남구 원성동 123' },
      { calendarId: 'dummy-cal-053', confirmedLocation: '충청북도 청주시 상당구 북문로 456' },
      
      // 전라도 지역
      { calendarId: 'dummy-cal-054', confirmedLocation: '전라북도 전주시 완산구 중앙동 789' },
      { calendarId: 'dummy-cal-055', confirmedLocation: '전라남도 여수시 중앙동 321' },
      
      // 경상도 지역
      { calendarId: 'dummy-cal-056', confirmedLocation: '경상북도 포항시 남구 대잠동 654' },
      { calendarId: 'dummy-cal-057', confirmedLocation: '경상남도 창원시 의창구 상남동 987' },
      
      // 제주도 지역
      { calendarId: 'dummy-cal-058', confirmedLocation: '제주특별자치도 제주시 연동 234' },
      { calendarId: 'dummy-cal-059', confirmedLocation: '제주특별자치도 서귀포시 중문동 567' },
      { calendarId: 'dummy-cal-060', confirmedLocation: '제주특별자치도 제주시 노형동 890' },
    ];

    console.log(`📊 총 ${dummyLocations.length}개의 더미 데이터를 생성합니다.`);

    // Batch를 사용하여 한 번에 여러 문서 작성
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
    
    // 지역별 집계 출력
    const regionCounts = new Map();
    dummyLocations.forEach(loc => {
      const parts = loc.confirmedLocation.split(' ');
      const region = parts.length > 0 ? parts[0] : '기타';
      regionCounts.set(region, (regionCounts.get(region) || 0) + 1);
    });
    
    console.log(`\n📍 생성된 지역별 집계:`);
    Array.from(regionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([region, count]) => {
        console.log(`  - ${region}: ${count}개`);
      });
      
    console.log(`\n💡 이제 만나요 플레이스 페이지에서 지도가 표시될 것입니다!`);
    console.log(`🔄 페이지를 새로고침하면 새로운 데이터가 지도에 표시됩니다.`);
    
  } catch (error) {
    console.error('❌ 더미 데이터 생성 실패:', error);
    console.error('💡 다음 사항을 확인하세요:');
    console.error('  1. Firebase에 로그인되어 있는지 확인');
    console.error('  2. Firestore 보안 규칙이 locations 컬렉션 쓰기를 허용하는지 확인');
    console.error('  3. 브라우저 콘솔에서 실행 중인지 확인');
  }
})();

// ========== 이 위 코드를 복사하여 콘솔에 붙여넣으세요 ==========
*/
