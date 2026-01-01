import {
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  updateProfile,
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { User } from '../types';
import { debugLog, debugError, measurePerformance } from '../utils/debug';

// 인증 제공자 초기화
const googleProvider = new GoogleAuthProvider();

/**
 * Firestore에 사용자 정보 저장/업데이트
 */
async function saveUserToFirestore(
  userId: string,
  email: string,
  name: string
) {
  debugLog('AUTH', 'saveUserToFirestore 시작', { userId, email, name });

  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    const userData = {
      email,
      name,
      provider: 'google',
      createdAt: userDoc.exists() 
        ? userDoc.data().createdAt 
        : new Date(),
      updatedAt: new Date(),
    };

    await setDoc(userRef, userData, { merge: true });
    debugLog('AUTH', 'saveUserToFirestore 완료', { userId, userData });
  } catch (error) {
    debugError('AUTH', 'saveUserToFirestore 실패', error);
    throw error;
  }
}

/**
 * 사용자 이름 업데이트
 */
export async function updateUserName(name: string): Promise<void> {
  debugLog('AUTH', 'updateUserName 시작', { name });

  return measurePerformance('updateUserName', async () => {
    const user = auth.currentUser;
    if (!user) {
      const error = new Error('로그인이 필요합니다.');
      debugError('AUTH', 'updateUserName - 로그인 필요', error);
      throw error;
    }

    try {
      // Firebase Auth 프로필 업데이트
      await updateProfile(user, { displayName: name });
      debugLog('AUTH', 'Firebase Auth 프로필 업데이트 완료', { uid: user.uid, name });

      // Firestore 업데이트
      await saveUserToFirestore(user.uid, user.email || '', name);
      debugLog('AUTH', 'updateUserName 완료', { uid: user.uid, name });
    } catch (error) {
      debugError('AUTH', 'updateUserName 실패', error);
      throw error;
    }
  });
}

/**
 * 구글 로그인
 */
export async function signInWithGoogle(): Promise<FirebaseUser> {
  debugLog('AUTH', 'signInWithGoogle 시작');

  return measurePerformance('signInWithGoogle', async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      debugLog('AUTH', '구글 로그인 팝업 성공', {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
      });

      // 이름이 없거나 기본값인 경우를 확인하기 위해 임시로 저장하지 않음
      // 이름 설정 모달에서 처리하도록 함
      const defaultName = result.user.displayName || result.user.email?.split('@')[0] || '사용자';
      debugLog('AUTH', '기본 이름 설정', { defaultName });

      // Firestore에 임시 저장 (이름은 나중에 업데이트될 수 있음)
      await saveUserToFirestore(
        result.user.uid,
        result.user.email || '',
        defaultName
      );

      debugLog('AUTH', 'signInWithGoogle 완료', { uid: result.user.uid });
      return result.user;
    } catch (error: any) {
      debugError('AUTH', 'signInWithGoogle 실패', error);
      debugLog('AUTH', '에러 상세', {
        code: error.code,
        message: error.message,
        stack: error.stack,
      });
      throw error;
    }
  });
}

/**
 * 로그아웃
 */
export async function logout(): Promise<void> {
  debugLog('AUTH', 'logout 시작');

  try {
    await signOut(auth);
    debugLog('AUTH', 'logout 완료');
  } catch (error) {
    debugError('AUTH', 'logout 실패', error);
    throw error;
  }
}

/**
 * 현재 사용자 정보 조회 (Firestore에서, 없으면 Firebase Auth에서)
 */
export async function getCurrentUserData(): Promise<User | null> {
  debugLog('AUTH', 'getCurrentUserData 시작');

  return measurePerformance('getCurrentUserData', async () => {
    const firebaseUser = auth.currentUser;

    if (!firebaseUser) {
      debugLog('AUTH', 'getCurrentUserData - 로그인된 사용자 없음');
      return null;
    }

    debugLog('AUTH', 'Firebase Auth 사용자 확인', { uid: firebaseUser.uid });

    try {
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));

      if (userDoc.exists()) {
        const data = userDoc.data();
        const userData = {
          id: firebaseUser.uid,
          email: data.email || firebaseUser.email || '',
          name: data.name || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '사용자',
          createdAt: data.createdAt?.toDate() || new Date(),
        };
        debugLog('AUTH', 'getCurrentUserData - Firestore에서 조회', userData);
        return userData;
      } else {
        // Firestore에 없으면 Firebase Auth 데이터로 생성
        debugLog('AUTH', 'getCurrentUserData - Firestore에 없음, 새로 생성');
        const defaultName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '사용자';
        await saveUserToFirestore(
          firebaseUser.uid,
          firebaseUser.email || '',
          defaultName
        );
        const userData = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          name: defaultName,
          createdAt: new Date(),
        };
        debugLog('AUTH', 'getCurrentUserData - 새 사용자 생성 완료', userData);
        return userData;
      }
    } catch (error) {
      debugError('AUTH', 'getCurrentUserData 실패', error);
      throw error;
    }
  });
}
