/**
 * 익명 사용자 ID 관리
 * 로컬 스토리지에 임시 사용자 ID를 저장하고 관리
 */

const ANONYMOUS_USER_ID_KEY = 'mannayo_anonymous_user_id';

/**
 * 익명 사용자 ID 가져오기 또는 생성
 */
export function getAnonymousUserId(): string {
  let userId = localStorage.getItem(ANONYMOUS_USER_ID_KEY);
  
  if (!userId) {
    // 새 익명 사용자 ID 생성 (타임스탬프 + 랜덤 문자열)
    userId = `anonymous_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem(ANONYMOUS_USER_ID_KEY, userId);
  }
  
  return userId;
}

/**
 * 익명 사용자 ID 초기화
 */
export function clearAnonymousUserId(): void {
  localStorage.removeItem(ANONYMOUS_USER_ID_KEY);
}

