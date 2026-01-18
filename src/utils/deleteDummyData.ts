/**
 * 더미 데이터 삭제 유틸리티
 */

import { collection, getDocs, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import { debugLog, debugError } from './debug';

/**
 * 더미 데이터 삭제 함수
 */
export async function deleteDummyLocations(): Promise<void> {
  console.log('🗑️ 더미 데이터 삭제 시작...');
  
  try {
    const locationsRef = collection(db, 'locations');
    const snapshot = await getDocs(locationsRef);
    
    const deletePromises: Promise<void>[] = [];
    let dummyCount = 0;
    
    snapshot.forEach((docSnap) => {
      if (docSnap.id.startsWith('dummy-cal-')) {
        deletePromises.push(deleteDoc(doc(db, 'locations', docSnap.id)));
        dummyCount++;
      }
    });
    
    if (deletePromises.length === 0) {
      console.log('✅ 삭제할 더미 데이터가 없습니다.');
      return;
    }
    
    console.log(`📊 삭제할 더미 데이터: ${dummyCount}개`);
    
    // 배치로 삭제 (성능 최적화)
    const BATCH_LIMIT = 500;
    let deletedCount = 0;
    
    // 실제 문서 ID를 수집
    const docIdsToDelete: string[] = [];
    snapshot.forEach((docSnap) => {
      if (docSnap.id.startsWith('dummy-cal-')) {
        docIdsToDelete.push(docSnap.id);
      }
    });
    
    console.log(`📝 삭제할 문서 ID 목록 (처음 10개):`, docIdsToDelete.slice(0, 10));
    
    // 배치로 삭제
    for (let i = 0; i < docIdsToDelete.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      const batchIds = docIdsToDelete.slice(i, i + BATCH_LIMIT);
      
      batchIds.forEach((docId) => {
        const docRef = doc(db, 'locations', docId);
        batch.delete(docRef);
      });
      
      await batch.commit();
      deletedCount += batchIds.length;
      console.log(`✅ 배치 삭제 완료: ${deletedCount}/${docIdsToDelete.length}`);
    }
    
    console.log(`\n✅ 더미 데이터 삭제 완료!`);
    console.log(`📊 총 ${deletePromises.length}개의 더미 데이터가 삭제되었습니다.`);
    console.log(`🔄 페이지를 새로고침하면 지도에서 제거된 데이터가 반영됩니다.`);
    
    debugLog('DUMMY_DATA', '더미 데이터 삭제 완료', { count: deletePromises.length });
  } catch (error) {
    console.error('❌ 더미 데이터 삭제 실패:', error);
    debugError('DUMMY_DATA', '더미 데이터 삭제 실패', error);
    throw error;
  }
}

// 브라우저 콘솔에서 사용할 수 있도록 window 객체에 등록 (개발 모드에서만)
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).deleteDummyLocations = deleteDummyLocations;
  console.log('💡 deleteDummyLocations() 함수가 준비되었습니다!');
  console.log('💡 콘솔에서 deleteDummyLocations()를 실행하여 더미 데이터를 삭제하세요.');
}
