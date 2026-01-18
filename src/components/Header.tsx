import { Link } from 'react-router-dom';
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

  if (loading) {
    return (
      <header className="header">
        <div className="container">로딩 중...</div>
      </header>
    );
  }

  return (
    <header className="header">
      <div className="container">
        <div className="logo-container">
          <Link to="/" className="logo">
            MANNAYO
          </Link>
        </div>
        <nav className="nav">
          {currentUser ? (
            <>
              <span className="user-name">{userData?.name || '사용자'}님</span>
              <button onClick={handleLogout} className="btn btn-outline">
                로그아웃
              </button>
            </>
          ) : (
            <Link to="/login" className="btn btn-primary">
              로그인
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}


