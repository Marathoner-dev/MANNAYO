import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth } from '../services/firebase';
import { getCurrentUserData } from '../services/auth';
import type { User } from '../types';
import { debugLog, debugError } from '../utils/debug';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userData: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userData: null,
  loading: true,
});

export function useAuth() {
  return useContext(AuthContext);
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    debugLog('AUTH_CONTEXT', 'AuthProvider 초기화');

    // 사용자 데이터 로드 및 로딩 종료
    const finishLoading = async () => {
      if (!isMounted) {
        debugLog('AUTH_CONTEXT', 'finishLoading - 컴포넌트 언마운트됨');
        return;
      }

      debugLog('AUTH_CONTEXT', 'finishLoading 시작');

      try {
        const data = await getCurrentUserData();
        if (isMounted) {
          debugLog('AUTH_CONTEXT', '사용자 데이터 로드 완료', {
            hasData: !!data,
            userId: data?.id,
            userName: data?.name,
          });
          setUserData(data);
          setLoading(false);
        }
      } catch (error) {
        debugError('AUTH_CONTEXT', '사용자 데이터 조회 실패', error);
        if (isMounted) {
          setUserData(null);
          setLoading(false);
        }
      }
    };

    // Firebase Auth 상태 감지
    debugLog('AUTH_CONTEXT', 'onAuthStateChanged 리스너 등록');
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!isMounted) {
        debugLog('AUTH_CONTEXT', 'onAuthStateChanged - 컴포넌트 언마운트됨');
        return;
      }

      debugLog('AUTH_CONTEXT', '인증 상태 변경', {
        hasUser: !!user,
        userId: user?.uid,
        email: user?.email,
      });

      setCurrentUser(user);

      if (user) {
        // Firebase Auth 사용자가 있으면 데이터 로드
        debugLog('AUTH_CONTEXT', '사용자 로그인됨, 데이터 로드 시작');
        await finishLoading();
      } else {
        // 사용자가 없으면 로딩 종료
        debugLog('AUTH_CONTEXT', '사용자 없음, 로딩 종료');
        setUserData(null);
        setLoading(false);
      }
    });

    return () => {
      debugLog('AUTH_CONTEXT', 'AuthProvider 정리');
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // 상태 변화 추적 (개발 모드)
  useEffect(() => {
    debugLog('AUTH_CONTEXT', '상태 업데이트', {
      hasCurrentUser: !!currentUser,
      hasUserData: !!userData,
      loading,
    });
  }, [currentUser, userData, loading]);

  const value = {
    currentUser,
    userData,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
