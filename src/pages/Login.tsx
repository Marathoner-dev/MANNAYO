import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { signInWithGoogle } from '../services/auth';
import { useAuth } from '../contexts/AuthContext';
import { NameInputModal } from '../components/NameInputModal';
import { debugLog, debugError } from '../utils/debug';
import './Login.css';

export function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showNameModal, setShowNameModal] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser, userData } = useAuth();
  
  // 리다이렉트 경로 가져오기
  const redirectPath = searchParams.get('redirect') || '/';

  // 로그인 성공 시 이름 확인 및 리다이렉트 경로로 이동
  useEffect(() => {
    if (currentUser && userData) {
      debugLog('LOGIN', '로그인 상태 확인', {
        userId: currentUser.uid,
        userName: userData.name,
        redirectPath,
      });
      // 이름이 기본값이거나 없으면 이름 입력 모달 표시
      const defaultName = currentUser.email?.split('@')[0] || '사용자';
      if (!userData.name || userData.name === defaultName || userData.name === '사용자') {
        debugLog('LOGIN', '이름 입력 모달 표시 필요');
        setShowNameModal(true);
      } else {
        debugLog('LOGIN', '리다이렉트 경로로 이동', { redirectPath });
        navigate(redirectPath, { replace: true });
      }
    }
  }, [currentUser, userData, navigate, redirectPath]);

  const handleNameSet = () => {
    // 이름이 설정되면 리다이렉트 경로로 이동
    debugLog('LOGIN', '이름 설정 완료, 리다이렉트', { redirectPath });
    navigate(redirectPath, { replace: true });
  };

  const handleGoogleSignIn = async () => {
    debugLog('LOGIN', '구글 로그인 버튼 클릭');
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      debugLog('LOGIN', '구글 로그인 성공');
      // navigate는 useEffect에서 자동으로 처리됨
    } catch (err: any) {
      debugError('LOGIN', '구글 로그인 실패', err);
      setError(
        err.code === 'auth/popup-closed-by-user'
          ? '로그인 창이 닫혔습니다.'
          : err.code === 'auth/popup-blocked'
          ? '팝업이 차단되었습니다. 브라우저 설정을 확인해주세요.'
          : '구글 로그인에 실패했습니다. 다시 시도해주세요.'
      );
      setLoading(false);
    }
  };

  return (
    <>
      <div className="login-page">
        <div className="login-container">
          <h1>로그인</h1>
          <p className="login-subtitle">구글 계정으로 간편하게 로그인하세요</p>
          
          <div className="social-login-buttons">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="btn btn-google"
              disabled={loading}
            >
              <img 
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                alt="Google"
                className="social-icon"
              />
              <span>{loading ? '처리 중...' : 'Google로 시작하기'}</span>
            </button>
          </div>

          {error && <div className="error-message">{error}</div>}
          
          <Link to="/" className="back-link">← 홈으로</Link>
        </div>
      </div>

      <NameInputModal
        isOpen={showNameModal}
        currentName={userData?.name || currentUser?.email?.split('@')[0] || '사용자'}
        onClose={() => setShowNameModal(false)}
        onNameSet={handleNameSet}
      />
    </>
  );
}
