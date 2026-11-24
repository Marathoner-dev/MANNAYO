import { Link } from 'react-router-dom';
import { CalendarCheck, SignOut } from '@phosphor-icons/react';
import { useAuth } from '../contexts/AuthContext';
import { logout } from '../services/auth';
import { debugError } from '../utils/debug';
import './Header.css';

export function Header() {
  const { currentUser, userData, loading } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      debugError('HEADER', '로그아웃 실패', error);
      alert('로그아웃에 실패했습니다.');
    }
  };

  const name = userData?.name || '사용자';

  return (
    <header className="header">
      <div className="header-inner">
        <Link to="/" className="brand" aria-label="MANNAYO 홈">
          <span className="brand-mark" aria-hidden="true">
            <CalendarCheck size={18} weight="bold" />
          </span>
          <span className="brand-word">MANNAYO</span>
        </Link>

        {/* 인증 확인 중에는 오른쪽을 비워 둔다 (깜빡임 방지) */}
        {!loading && (
          <nav className="header-nav">
            {currentUser ? (
              <>
                <span className="header-user">
                  <span className="header-avatar" aria-hidden="true">
                    {name.charAt(0)}
                  </span>
                  <span className="header-name">{name}</span>
                </span>
                <button type="button" onClick={handleLogout} className="btn btn-ghost btn-sm">
                  <SignOut size={18} />
                  <span className="header-logout-label">로그아웃</span>
                </button>
              </>
            ) : (
              <Link to="/login" className="btn btn-primary btn-sm">
                로그인
              </Link>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
