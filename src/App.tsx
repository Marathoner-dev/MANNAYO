import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Header } from './components/Header';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { CreateCalendar } from './pages/CreateCalendar';
import { JoinCalendar } from './pages/JoinCalendar';
import { CalendarDetail } from './pages/CalendarDetail';
import './App.css';

// 개발 모드에서 더미 데이터 생성 함수를 window 객체에 등록
if (import.meta.env.DEV) {
  import('./utils/dummyDats').then(() => {
    console.log('💡 generateDummyLocations() 함수가 준비되었습니다!');
  });
  
  // 개발 모드에서 더미 데이터 삭제 함수를 window 객체에 등록
  import('./utils/deleteDummyData').then(() => {
    console.log('💡 deleteDummyLocations() 함수가 준비되었습니다!');
    console.log('💡 콘솔에서 deleteDummyLocations()를 실행하여 더미 데이터를 삭제할 수 있습니다.');
  });
}

// Protected Route 컴포넌트
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>로딩 중...</div>;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/calendars"
        element={<Navigate to="/" replace />}
      />
      <Route
        path="/calendar/create"
        element={
          <ProtectedRoute>
            <CreateCalendar />
          </ProtectedRoute>
        }
      />
      <Route
        path="/calendar/join"
        element={
          <ProtectedRoute>
            <JoinCalendar />
          </ProtectedRoute>
        }
      />
      <Route
        path="/calendar/:code"
        element={<CalendarDetail />}
      />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app">
          <Header />
          <main className="main">
            <AppRoutes />
          </main>
      </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
